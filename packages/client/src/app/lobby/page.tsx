'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DIFFICULTY, DIFFICULTIES, EVENTS, MAPS, VERSUS, type Difficulty, type GameMode } from '@maze/shared';
import { MiniMap } from '@/components/Icons';
import { RequireAuth } from '@/components/RequireAuth';
import { unlockAudio } from '@/lib/audio';
import { ERROR_TEXT } from '@/lib/errors';
import { request, rememberRoom } from '@/lib/net';
import { useGameStore } from '@/stores/gameStore';
import { useLobbyStore } from '@/stores/lobbyStore';

export default function LobbyPage() {
  return (
    <RequireAuth>
      <Lobby />
    </RequireAuth>
  );
}

function Lobby() {
  const router = useRouter();
  const room = useLobbyStore((s) => s.room);
  const connected = useLobbyStore((s) => s.connected);
  const [mode, setMode] = useState<GameMode>('versus');
  const [mapId, setMapId] = useState('meadow');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (room && room.status !== 'ended') router.push(`/room/${room.roomId}`);
  }, [room, router]);

  async function run(
    fn: () => Promise<{ ok: true; roomId: string } | { ok: false; code: keyof typeof ERROR_TEXT }>,
  ) {
    unlockAudio();
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) return useGameStore.getState().toast(ERROR_TEXT[res.code] ?? res.code);
    rememberRoom(res.roomId);
    router.push(`/room/${res.roomId}`);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 md:grid-cols-[3fr_2fr]">
      <section className="panel p-6">
        <h2 className="font-display text-2xl font-bold">New game</h2>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(
            [
              [
                'versus',
                '⚔ Versus',
                '2–4 players. Your own castle; send enemies at rivals. Last castle standing wins.',
              ],
              ['solo', '🛡 Solo', 'Just you against 30 waves. Chase the leaderboard.'],
            ] as const
          ).map(([m, title, text]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-2xl border p-4 text-left transition ${mode === m ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 hover:border-white/30'}`}
            >
              <div className="font-display text-lg font-bold">{title}</div>
              <div className="text-xs text-slate-400">{text}</div>
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {Object.values(MAPS).map((m) => (
            <button
              key={m.id}
              onClick={() => setMapId(m.id)}
              className={`rounded-2xl border p-3 text-left transition ${mapId === m.id ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 hover:border-white/30'}`}
            >
              <MiniMap map={m} cell={11} />
              <div className="mt-2 flex items-center justify-between">
                <span className="font-display font-bold">{m.name}</span>
                <span className="text-xs text-slate-400">
                  {m.spawns.length} spawn{m.spawns.length > 1 ? 's' : ''}
                </span>
              </div>
            </button>
          ))}
        </div>
        {mode === 'solo' && (
          <div className="mt-5">
            <span className="label">Difficulty</span>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`rounded-xl border px-3 py-2 text-left transition ${difficulty === d ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 hover:border-white/30'}`}
                >
                  <div className="font-semibold capitalize">{d}</div>
                  <div className="text-xs text-slate-400">
                    {DIFFICULTY[d].startGold}g · {DIFFICULTY[d].baseHp}♥ ·{' '}
                    {Math.round(DIFFICULTY[d].hpMult * 100)}% HP
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {mode === 'versus' && (
          <p className="mt-5 rounded-xl bg-white/5 p-3 text-xs text-slate-400">
            Everyone starts with {VERSUS.START_GOLD} gold and {VERSUS.BASE_HP} lives on an identical board.
            Waves come every {VERSUS.WAVE_INTERVAL_SEC}s. Sending enemies costs gold but raises your income
            every wave.
          </p>
        )}
        <button
          className="btn-primary mt-6 w-full py-3 text-lg"
          disabled={busy || !connected}
          onClick={() => run(() => request(EVENTS.ROOM_CREATE, { mode, mapId, difficulty }))}
        >
          {mode === 'solo' ? 'Play solo' : 'Create versus room'}
        </button>
        {!connected && (
          <p className="mt-2 text-center text-xs text-red-300">Connecting to the game server…</p>
        )}
      </section>

      <section className="panel h-fit p-6">
        <h2 className="font-display text-2xl font-bold">Join with a code</h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => request(EVENTS.ROOM_JOIN, { code: code.trim().toUpperCase() }));
          }}
        >
          <input
            className="input text-center font-mono text-3xl tracking-[0.5em] uppercase"
            maxLength={4}
            placeholder="ABCD"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
          />
          <button className="btn-primary w-full" disabled={busy || code.length !== 4 || !connected}>
            Join room
          </button>
          <button
            type="button"
            className="btn-secondary w-full"
            disabled={busy || code.length !== 4 || !connected}
            onClick={() => run(() => request(EVENTS.ROOM_SPECTATE, { code }))}
          >
            👁 Spectate
          </button>
        </form>
        <div className="mt-6 space-y-1 text-sm text-slate-400">
          <p className="font-semibold text-slate-300">Controls</p>
          <p>1–9 pick a tower · click to build · shift-click to keep building</p>
          <p>Click a tower to select · U upgrade · S sell · Esc cancel</p>
          <p>
            Versus: Z–M send grunt / runner / tank / flyer / healer / splitter / knight · Tab cycle boards ·
            Home your board
          </p>
          <p>Solo: Space starts the next wave early for bonus gold</p>
        </div>
      </section>
    </div>
  );
}
