'use client';

import { useEffect, useRef } from 'react';
import type { MapData, TowerSnap } from '@maze/shared';
import { drawMiniMap, ENEMY_COLORS, TOWER_COLORS } from '@/game/art';
import { INTERPOLATION_DELAY_MS } from '@/lib/config';
import { snapshots } from '@/lib/net';
import { playerName, useGameStore, type BoardHud } from '@/stores/gameStore';

const CELL = 9;

/** Live overview of every other board (and yours when you are watching someone else). Click to watch. */
export function OpponentsPanel() {
  const boardIds = useGameStore((s) => s.boardIds);
  const view = useGameStore((s) => s.viewBoard);
  const myId = useGameStore((s) => s.myId);
  const shown = boardIds.filter((id) => id !== view);
  if (shown.length === 0) return null;
  return (
    <section className="panel p-3">
      <h3 className="font-display mb-2 text-sm font-bold tracking-wide text-slate-300">
        {myId ? 'OPPONENTS' : 'BOARDS'}{' '}
        <span className="font-sans text-[10px] font-normal text-slate-500">click to watch · Tab cycles</span>
      </h3>
      <div className="space-y-2">
        {shown.map((id) => (
          <BoardCard key={id} id={id} />
        ))}
      </div>
    </section>
  );
}

function BoardCard({ id }: { id: string }) {
  const hud = useGameStore((s) => s.boards[id]);
  const map = useGameStore((s) => s.map);
  const players = useGameStore((s) => s.players);
  const myId = useGameStore((s) => s.myId);
  const maxBaseHp = useGameStore((s) => s.maxBaseHp);
  const setView = useGameStore((s) => s.setViewBoard);
  if (!hud || !map) return null;
  const player = players.find((p) => p.userId === id);
  const name = id === myId ? 'You' : playerName(players, id);
  const frac = maxBaseHp ? hud.baseHp / maxBaseHp : 0;
  return (
    <button
      onClick={() => setView(id)}
      className={`block w-full rounded-xl border p-2 text-left transition hover:border-white/30 ${
        hud.alive ? 'border-white/10 bg-white/5' : 'border-white/5 bg-black/30 opacity-60'
      }`}
    >
      <div className="mb-1 flex items-center gap-2 text-sm">
        <span className="font-semibold">{name}</span>
        {player && !player.connected && <span className="text-[10px] text-red-300">offline</span>}
        <span className="ml-auto text-xs text-amber-300">{hud.gold}g</span>
        <span className="text-xs text-emerald-300">+{hud.income}</span>
      </div>
      <div className="relative">
        <MiniBoard id={id} map={map} />
        {!hud.alive && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/60 text-lg font-extrabold">
            {hud.placement === 1 ? '🏆 WINNER' : `💀 #${hud.placement}`}
          </div>
        )}
      </div>
      <HpBar hud={hud} frac={frac} maxBaseHp={maxBaseHp} />
    </button>
  );
}

function HpBar({ hud, frac, maxBaseHp }: { hud: BoardHud; frac: number; maxBaseHp: number }) {
  return (
    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
      <span>
        ❤ {hud.baseHp}/{maxBaseHp}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full ${frac > 0.5 ? 'bg-emerald-400' : frac > 0.25 ? 'bg-amber-400' : 'bg-red-500'}`}
          style={{ width: `${Math.max(0, frac) * 100}%` }}
        />
      </div>
      <span>W{hud.wave}</span>
    </div>
  );
}

/** Canvas minimap: terrain, towers as colored squares, enemies as moving dots (interpolated like the main view). */
function MiniBoard({ id, map }: { id: string; map: MapData }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = map.width * CELL;
    const h = map.height * CELL;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const terrain = document.createElement('canvas');
    terrain.width = w;
    terrain.height = h;
    drawMiniMap(terrain.getContext('2d')!, map, CELL);
    let raf = 0;
    let last = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 66) return; // ~15 fps is plenty for a minimap
      last = now;
      ctx.drawImage(terrain, 0, 0);
      const towers: Record<number, TowerSnap> = useGameStore.getState().towers[id] ?? {};
      for (const t of Object.values(towers)) {
        ctx.fillStyle = TOWER_COLORS[t.type];
        ctx.fillRect(t.x * CELL + 1, t.y * CELL + 1, CELL - 2, CELL - 2);
      }
      const frame = snapshots.sample(id, performance.now(), INTERPOLATION_DELAY_MS);
      for (const e of frame.enemies) {
        ctx.fillStyle = ENEMY_COLORS[e.type];
        ctx.beginPath();
        ctx.arc(
          e.x * CELL,
          e.y * CELL,
          e.type === 'boss' ? 4.5 : e.type === 'tank' ? 3.2 : 2.4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [id, map]);
  return (
    <canvas
      ref={ref}
      className="w-full rounded-lg border border-white/10"
      style={{ aspectRatio: `${map.width} / ${map.height}` }}
    />
  );
}
