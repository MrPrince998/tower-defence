'use client';

import { useRouter } from 'next/navigation';
import { EVENTS, isBossWave, PERKS, type EnemyType } from '@maze/shared';
import { EnemyIcon } from '@/components/Icons';
import { commands, rememberRoom, request } from '@/lib/net';
import { playerName, useGameStore } from '@/stores/gameStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { useSettingsStore } from '@/stores/settingsStore';

export function TopBar() {
  const router = useRouter();
  const mode = useGameStore((s) => s.mode);
  const view = useGameStore((s) => s.viewBoard);
  const myId = useGameStore((s) => s.myId);
  const hud = useGameStore((s) => (s.viewBoard ? s.boards[s.viewBoard] : undefined));
  const maxBaseHp = useGameStore((s) => s.maxBaseHp);
  const next = useGameStore((s) => (s.viewBoard ? s.nextWave[s.viewBoard] : null));
  const players = useGameStore((s) => s.players);
  const spectator = useGameStore((s) => s.config?.role === 'spectator');
  const code = useLobbyStore((s) => s.room?.code);
  const { volume, muted, showPath, setVolume, toggleMute, togglePath } = useSettingsStore();
  if (!hud) return null;
  const hpFrac = maxBaseHp ? hud.baseHp / maxBaseHp : 1;
  const own = view === myId;
  const canSkip =
    mode === 'solo' && own && hud.waveState === 'building' && !isBossWave(hud.wave + 1) && !spectator;

  async function leave() {
    const msg =
      mode === 'versus' && own && hud?.alive
        ? 'Leave this match? You will forfeit and your castle falls.'
        : 'Leave this game?';
    if (!confirm(msg)) return;
    await request(EVENTS.ROOM_LEAVE, {});
    rememberRoom(null);
    useLobbyStore.getState().setRoom(null);
    useGameStore.getState().reset();
    router.push('/lobby');
  }

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-slate-950/80 px-4 py-2">
      <span className="font-display text-lg font-extrabold text-amber-300">
        {mode === 'versus' ? 'VS' : 'MD'}
      </span>
      {!own && view && (
        <span className="rounded-lg bg-sky-500/15 px-2 py-1 text-xs font-bold text-sky-200">
          👁 {playerName(players, view)}&apos;s board
        </span>
      )}
      <Stat icon="🌊" label="Wave" value={hud.wave === 0 ? '—' : hud.wave} />
      {hud.perks.length > 0 && (
        <div className="flex items-center gap-0.5 rounded-xl bg-white/5 px-2 py-1.5" title="Perks">
          {hud.perks.map((p, i) => (
            <span key={i} title={`${PERKS[p].name}: ${PERKS[p].description}`} className="text-lg">
              {PERKS[p].icon}
            </span>
          ))}
        </div>
      )}
      <Stat icon="🪙" label="Gold" value={hud.gold} accent="text-amber-300" />
      {mode === 'versus' && (
        <Stat icon="📈" label="Income / wave" value={`+${hud.income}`} accent="text-emerald-300" />
      )}
      <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5">
        <span>❤️</span>
        <div className="w-28">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Castle</span>
            <span className="font-bold text-slate-100">
              {hud.baseHp}/{maxBaseHp}
            </span>
          </div>
          <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-all ${hpFrac > 0.5 ? 'bg-emerald-400' : hpFrac > 0.25 ? 'bg-amber-400' : 'bg-red-500'}`}
              style={{ width: `${hpFrac * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-1.5">
        <span className="text-xs text-slate-400 uppercase">
          {!hud.alive
            ? hud.placement === 1
              ? 'Winner'
              : `Out — #${hud.placement}`
            : hud.nextWaveIn > 0
              ? `Next wave in ${Math.ceil(hud.nextWaveIn)}s`
              : hud.waveState === 'spawning'
                ? 'Incoming!'
                : 'Clearing…'}
        </span>
        {next && hud.alive && (
          <span className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">W{next.wave}:</span>
            {(Object.entries(next.counts) as [EnemyType, number][]).map(([type, n]) => (
              <span
                key={type}
                className={`flex items-center text-xs font-bold ${type === 'boss' ? 'text-red-300' : ''}`}
                title={type}
              >
                <EnemyIcon type={type} size={22} />×{n}
              </span>
            ))}
            {next.boss && (
              <span className="animate-pulse rounded bg-red-600/80 px-1.5 text-[10px] font-extrabold">
                BOSS
              </span>
            )}
          </span>
        )}
        {mode === 'solo' && own && hud.waveState === 'building' && (
          <button
            className="btn-primary px-3 py-1 text-sm"
            disabled={!canSkip}
            title={
              isBossWave(hud.wave + 1) ? 'Cannot skip before a boss wave' : 'Start now for bonus gold (Space)'
            }
            onClick={() => commands.skipWave()}
          >
            ⏩ Start (+{Math.floor(hud.nextWaveIn)}g)
          </button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {code && mode === 'versus' && (
          <span className="rounded-lg bg-white/5 px-2 py-1 font-mono text-sm text-slate-300">
            Room {code}
          </span>
        )}
        <button className="btn-secondary px-2 py-1 text-sm" onClick={togglePath} title="Toggle path arrows">
          {showPath ? '🧭' : '🚫'}
        </button>
        <button className="btn-secondary px-2 py-1 text-sm" onClick={toggleMute} title="Mute">
          {muted ? '🔇' : '🔊'}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-20 accent-amber-400"
          aria-label="Volume"
        />
        <button className="btn-danger px-3 py-1 text-sm" onClick={leave}>
          Leave
        </button>
      </div>
    </header>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5">
      <span>{icon}</span>
      <div>
        <div className="text-xs text-slate-400">{label}</div>
        <div className={`font-display leading-none font-bold ${accent ?? 'text-slate-100'}`}>{value}</div>
      </div>
    </div>
  );
}
