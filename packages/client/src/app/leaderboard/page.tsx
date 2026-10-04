'use client';

import { useEffect, useState } from 'react';
import {
  DIFFICULTIES,
  MAPS,
  type Difficulty,
  type GameMode,
  type LeaderboardEntry,
  type VersusLeaderboardEntry,
} from '@maze/shared';
import { api, describeApiError } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/format';

const PAGE = 25;
const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank);

export default function LeaderboardPage() {
  const [mode, setMode] = useState<GameMode>('versus');
  const [mapId, setMapId] = useState('meadow');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [offset, setOffset] = useState(0);
  const [solo, setSolo] = useState<LeaderboardEntry[] | null>(null);
  const [versus, setVersus] = useState<VersusLeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSolo(null);
    setVersus(null);
    setError(null);
    const req =
      mode === 'versus'
        ? api.versusLeaderboard(offset).then((r) => !cancelled && setVersus(r.entries))
        : api.leaderboard(mapId, difficulty, offset).then((r) => !cancelled && setSolo(r.entries));
    req.catch((e) => !cancelled && setError(describeApiError(e)));
    return () => {
      cancelled = true;
    };
  }, [mode, mapId, difficulty, offset]);

  const entries = mode === 'versus' ? versus : solo;
  const cols = mode === 'versus' ? 5 : 5;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Leaderboard</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {(['versus', 'solo'] as const).map((m) => (
          <button
            key={m}
            onClick={() => (setMode(m), setOffset(0))}
            className={`${mode === m ? 'btn-primary' : 'btn-secondary'} py-1.5`}
          >
            {m === 'versus' ? '⚔ Versus' : '🛡 Solo'}
          </button>
        ))}
        {mode === 'solo' && (
          <>
            <span className="mx-2 w-px bg-white/10" />
            {Object.values(MAPS).map((m) => (
              <button
                key={m.id}
                onClick={() => (setMapId(m.id), setOffset(0))}
                className={mapId === m.id ? 'btn-primary py-1.5' : 'btn-secondary py-1.5'}
              >
                {m.name}
              </button>
            ))}
            <span className="mx-2 w-px bg-white/10" />
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => (setDifficulty(d), setOffset(0))}
                className={`${difficulty === d ? 'btn-primary' : 'btn-secondary'} py-1.5 capitalize`}
              >
                {d}
              </button>
            ))}
          </>
        )}
      </div>
      <div className="panel mt-6 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs text-slate-400 uppercase">
            {mode === 'versus' ? (
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Wins</th>
                <th className="px-4 py-3">Games</th>
                <th className="px-4 py-3">Enemies sent</th>
              </tr>
            ) : (
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Wave</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            )}
          </thead>
          <tbody>
            {error && (
              <Row cols={cols} className="text-red-300">
                {error}
              </Row>
            )}
            {!error && !entries && <Row cols={cols}>Loading…</Row>}
            {entries?.length === 0 && <Row cols={cols}>No games yet — be the first!</Row>}
            {mode === 'versus' &&
              versus?.map((e, i) => (
                <tr key={e.userId} className="border-t border-white/5">
                  <td className="font-display px-4 py-3 text-lg font-bold">{medal(offset + i + 1)}</td>
                  <td className="px-4 py-3 font-semibold">{e.username}</td>
                  <td className="px-4 py-3 font-bold text-amber-300">{e.wins}</td>
                  <td className="px-4 py-3">
                    {e.games}{' '}
                    <span className="text-xs text-slate-500">
                      ({Math.round((e.wins / Math.max(1, e.games)) * 100)}%)
                    </span>
                  </td>
                  <td className="px-4 py-3 text-rose-300">{e.enemiesSent}</td>
                </tr>
              ))}
            {mode === 'solo' &&
              solo?.map((e, i) => (
                <tr key={e.id} className="border-t border-white/5">
                  <td className="font-display px-4 py-3 text-lg font-bold">{medal(offset + i + 1)}</td>
                  <td className="px-4 py-3">{e.players.join(', ')}</td>
                  <td className="px-4 py-3 font-bold text-amber-300">
                    {e.wavesReached}{' '}
                    {e.result === 'win' && (
                      <span className="ml-1 rounded bg-emerald-500/20 px-1.5 text-xs text-emerald-300">
                        WIN
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{formatDuration(e.durationSec)}</td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(e.endedAt)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between">
        <button
          className="btn-secondary"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - PAGE))}
        >
          ← Previous
        </button>
        <button
          className="btn-secondary"
          disabled={!entries || entries.length < PAGE}
          onClick={() => setOffset(offset + PAGE)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function Row({
  cols,
  children,
  className = 'text-slate-500',
}: {
  cols: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr>
      <td colSpan={cols} className={`px-4 py-6 text-center ${className}`}>
        {children}
      </td>
    </tr>
  );
}
