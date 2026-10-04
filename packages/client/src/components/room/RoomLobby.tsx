'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DIFFICULTY, EVENTS, GAME, MAPS, VERSUS, type RoomState } from '@maze/shared';
import { MiniMap } from '@/components/Icons';
import { unlockAudio } from '@/lib/audio';
import { ERROR_TEXT } from '@/lib/errors';
import { rememberRoom, request } from '@/lib/net';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';
import { useLobbyStore } from '@/stores/lobbyStore';

export function RoomLobby({ room }: { room: RoomState }) {
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const [now, setNow] = useState(() => Date.now());
  const map = MAPS[room.mapId];
  const mine = room.players.find((p) => p.userId === me?.id);
  const isHost = room.hostId === me?.id;
  const diff = DIFFICULTY[room.difficulty];

  useEffect(() => {
    if (room.status !== 'countdown') return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [room.status]);

  async function leave() {
    await request(EVENTS.ROOM_LEAVE, {});
    rememberRoom(null);
    useLobbyStore.getState().setRoom(null);
    useGameStore.getState().reset();
    router.push('/lobby');
  }

  async function act(p: Promise<{ ok: boolean; code?: keyof typeof ERROR_TEXT }>) {
    unlockAudio();
    const res = await p;
    if (!res.ok && res.code) useGameStore.getState().toast(ERROR_TEXT[res.code]);
  }

  const countdown =
    room.status === 'countdown' && room.countdownEndsAt
      ? Math.max(0, Math.ceil((room.countdownEndsAt - now) / 1000))
      : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-white/5 px-6 py-5">
          <div>
            <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">Room code</p>
            <button
              className="font-mono text-5xl font-bold tracking-[0.3em] text-amber-300 hover:text-amber-200"
              title="Copy code"
              onClick={() => {
                void navigator.clipboard?.writeText(room.code);
                useGameStore.getState().toast('Code copied', 'success');
              }}
            >
              {room.code}
            </button>
          </div>
          <div className="flex items-center gap-4">
            {map && <MiniMap map={map} cell={8} />}
            <div className="text-sm">
              <div className="font-display text-lg font-bold">{map?.name}</div>
              <div className="text-slate-400">
                {room.mode === 'versus'
                  ? `⚔ Versus · ${VERSUS.START_GOLD} gold · ${VERSUS.BASE_HP} lives each`
                  : `🛡 Solo · ${room.difficulty} · ${diff.startGold} gold · ${diff.baseHp} lives`}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-6 sm:grid-cols-2">
          {Array.from({ length: GAME.MAX_PLAYERS }).map((_, i) => {
            const p = room.players[i];
            return (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-xl border p-4 ${p ? 'border-white/10 bg-white/5' : 'border-dashed border-white/10'}`}
              >
                {p ? (
                  <>
                    <div className="font-display flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 font-bold">
                      {p.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">
                        {p.name}{' '}
                        {p.userId === room.hostId && <span className="text-xs text-amber-300">★ host</span>}
                        {p.userId === me?.id && <span className="ml-1 text-xs text-slate-400">(you)</span>}
                      </div>
                      {!p.connected && <div className="text-xs text-red-300">disconnected</div>}
                    </div>
                    <span
                      className={`rounded-lg px-2 py-1 text-xs font-bold ${p.ready ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/50 text-slate-400'}`}
                    >
                      {p.ready ? 'READY' : 'NOT READY'}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-slate-500">Waiting for player…</span>
                )}
              </div>
            );
          })}
        </div>
        {room.spectators.length > 0 && (
          <p className="px-6 text-sm text-slate-400">
            👁 Spectating: {room.spectators.map((s) => s.name).join(', ')}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-6 py-5">
          <button className="btn-danger" onClick={leave}>
            Leave
          </button>
          <div className="flex-1 text-center">
            {countdown !== null ? (
              <span className="font-display text-3xl font-bold text-amber-300">Starting in {countdown}…</span>
            ) : (
              <span className="text-sm text-slate-400">
                {room.mode === 'versus' && room.players.length < VERSUS.MIN_PLAYERS
                  ? 'Share the code — versus needs at least 2 players.'
                  : 'The game starts when everyone is ready.'}
              </span>
            )}
          </div>
          {isHost &&
            room.status === 'lobby' &&
            room.players.length >= VERSUS.MIN_PLAYERS &&
            room.players.some((p) => !p.ready) && (
              <button className="btn-secondary" onClick={() => act(request(EVENTS.ROOM_START, {}))}>
                Force start
              </button>
            )}
          {mine && (
            <button
              className={mine.ready ? 'btn-secondary' : 'btn-primary px-8'}
              onClick={() => act(request(EVENTS.ROOM_READY, { ready: !mine.ready }))}
            >
              {mine.ready ? 'Not ready' : 'Ready!'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
