'use client';

import { useEffect } from 'react';
import { ENEMIES, SEND_TYPES, SENDS } from '@maze/shared';
import { EnemyIcon } from '@/components/Icons';
import { commands } from '@/lib/net';
import { playerName, useGameStore } from '@/stores/gameStore';

/** Hotkeys in SEND_TYPES order (grunt, runner, tank, flyer, healer, splitter, knight). */
export const SEND_KEYS = ['z', 'x', 'c', 'v', 'b', 'n', 'm'] as const;

/** Versus: spend gold to push enemies onto an opponent's board; every send raises your income for good. */
export function SendPanel() {
  const myId = useGameStore((s) => s.myId);
  const me = useGameStore((s) => (s.myId ? s.boards[s.myId] : undefined));
  const boardIds = useGameStore((s) => s.boardIds);
  const boards = useGameStore((s) => s.boards);
  const players = useGameStore((s) => s.players);
  const target = useGameStore((s) => s.sendTarget);
  const setTarget = useGameStore((s) => s.setSendTarget);
  const opponents = boardIds.filter((id) => id !== myId && boards[id]?.alive);
  const validTarget = target && opponents.includes(target) ? target : null;
  // A targeted opponent was knocked out: fall back to "next opponent".
  useEffect(() => {
    if (target && !validTarget) setTarget(null);
  }, [target, validTarget, setTarget]);
  if (!myId || !me) return null;
  const open = me.alive && me.wave > 0;

  return (
    <section className="panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold tracking-wide text-rose-300">SEND ENEMIES</h3>
        <span className="text-xs text-emerald-300">+{me.income}/wave</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {SEND_TYPES.map((type, i) => {
          const cfg = SENDS[type];
          const affordable = me.gold >= cfg.cost;
          return (
            <button
              key={type}
              disabled={!open || !affordable || opponents.length === 0}
              onClick={() => commands.send(type, validTarget)}
              title={`Send a ${ENEMIES[type].name} (${cfg.cost}g) — +${cfg.income} income per wave`}
              className="relative flex flex-col items-center rounded-xl border border-rose-400/20 bg-rose-500/10 p-1 pt-1.5 transition hover:border-rose-300/60 hover:bg-rose-500/20 disabled:opacity-40 disabled:hover:bg-rose-500/10"
            >
              <span className="absolute top-0.5 left-1 text-[10px] font-bold text-slate-500 uppercase">
                {SEND_KEYS[i]}
              </span>
              <EnemyIcon type={type} size={34} />
              <span className={`text-xs font-bold ${affordable ? 'text-amber-300' : 'text-red-300'}`}>
                {cfg.cost}
              </span>
              <span className="text-[10px] font-semibold text-emerald-300">+{cfg.income}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="text-slate-400">Target</span>
        <select
          className="input py-1 text-xs"
          value={validTarget ?? ''}
          onChange={(e) => setTarget(e.target.value || null)}
          disabled={opponents.length === 0}
        >
          <option value="">Next opponent</option>
          {opponents.map((id) => (
            <option key={id} value={id}>
              {playerName(players, id)}
            </option>
          ))}
        </select>
      </div>
      {!open && me.alive && (
        <p className="mt-2 text-xs text-slate-500">Sends open when wave 1 starts. Build first!</p>
      )}
    </section>
  );
}
