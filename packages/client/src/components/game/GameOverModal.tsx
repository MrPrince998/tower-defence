'use client';

import { useRouter } from 'next/navigation';
import { EVENTS } from '@maze/shared';
import { formatDuration } from '@/lib/format';
import { rememberRoom, request } from '@/lib/net';
import { playerName, useGameStore } from '@/stores/gameStore';
import { useLobbyStore } from '@/stores/lobbyStore';

const MEDALS = ['', '🥇', '🥈', '🥉', '4th'];

export function GameOverModal() {
  const router = useRouter();
  const over = useGameStore((s) => s.gameOver);
  const players = useGameStore((s) => s.players);
  const myId = useGameStore((s) => s.myId);
  if (!over) return null;
  const name = (id: string) => (id === myId ? `${playerName(players, id)} (you)` : playerName(players, id));
  const versus = over.mode === 'versus';
  const mine = over.stats.find((s) => s.userId === myId);
  const won = versus ? !!myId && over.winners.includes(myId) : over.result === 'win';
  const title = versus
    ? !myId
      ? `${over.winners.map((id) => playerName(players, id)).join(' & ')} wins!`
      : won
        ? over.winners.length > 1
          ? 'Shared victory!'
          : 'Victory!'
        : `Defeated — #${mine?.placement ?? '?'}`
    : won
      ? 'Victory!'
      : 'Defeat';
  const rows = versus ? [...over.stats].sort((a, b) => (a.placement ?? 9) - (b.placement ?? 9)) : over.stats;

  async function exit(to: string) {
    await request(EVENTS.ROOM_LEAVE, {});
    rememberRoom(null);
    useLobbyStore.getState().setRoom(null);
    useGameStore.getState().reset();
    router.push(to);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="panel w-full max-w-2xl p-8">
        <div className="text-center">
          <div
            className={`font-display text-5xl font-extrabold ${won || !myId ? 'text-emerald-300' : 'text-red-400'}`}
          >
            {title}
          </div>
          <p className="mt-2 text-slate-300">
            {versus ? 'Last castle standing after' : 'Reached'} wave{' '}
            <b className="text-amber-300">{over.wavesReached}</b> in <b>{formatDuration(over.durationSec)}</b>
          </p>
        </div>
        <table className="mt-6 w-full text-left text-sm">
          <thead className="text-xs text-slate-400 uppercase">
            <tr>
              {versus && <th className="py-2">Place</th>}
              <th className="py-2">Player</th>
              <th>Kills</th>
              {versus && <th>Sent</th>}
              <th>Damage</th>
              <th>Towers</th>
              <th>Gold spent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr
                key={s.userId}
                className={`border-t border-white/5 ${s.userId === myId ? 'bg-amber-400/5' : ''}`}
              >
                {versus && <td className="py-2 text-lg">{MEDALS[s.placement ?? 0] ?? `#${s.placement}`}</td>}
                <td className="py-2 font-semibold">{name(s.userId)}</td>
                <td>{s.kills}</td>
                {versus && <td>{s.enemiesSent}</td>}
                <td>{s.damageDealt.toLocaleString()}</td>
                <td>{s.towersBuilt}</td>
                <td>{s.goldSpent}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-8 flex justify-center gap-3">
          <button className="btn-primary px-6" onClick={() => exit('/lobby')}>
            Play again
          </button>
          <button className="btn-secondary" onClick={() => exit('/leaderboard')}>
            Leaderboard
          </button>
          <button className="btn-secondary" onClick={() => exit('/history')}>
            History
          </button>
        </div>
      </div>
    </div>
  );
}
