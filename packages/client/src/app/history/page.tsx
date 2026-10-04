'use client';

import { useEffect, useState } from 'react';
import { MAPS, type MatchHistoryEntry } from '@maze/shared';
import { RequireAuth } from '@/components/RequireAuth';
import { api, describeApiError } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/format';

export default function HistoryPage() {
  return (
    <RequireAuth>
      <History />
    </RequireAuth>
  );
}

function History() {
  const [offset, setOffset] = useState(0);
  const [matches, setMatches] = useState<MatchHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMatches(null);
    api
      .history(offset)
      .then((r) => setMatches(r.matches))
      .catch((e) => setError(describeApiError(e)));
  }, [offset]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Match history</h1>
      {error && <p className="mt-6 text-red-300">{error}</p>}
      {!error && !matches && <p className="mt-6 text-slate-500">Loading…</p>}
      {matches?.length === 0 && <p className="mt-6 text-slate-500">No matches yet. Go defend something!</p>}
      <div className="mt-6 space-y-3">
        {matches?.map((m) => (
          <div key={m.id} className="panel grid grid-cols-2 items-center gap-3 p-4 md:grid-cols-6">
            <div className="col-span-2">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-bold ${won(m) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}
                >
                  {m.mode === 'versus'
                    ? m.placement === 1
                      ? 'WIN'
                      : `#${m.placement ?? '?'}`
                    : m.result.toUpperCase()}
                </span>
                <span className="text-xs">{m.mode === 'versus' ? '⚔ Versus' : '🛡 Solo'}</span>
                <span className="font-display font-bold">{MAPS[m.mapId]?.name ?? m.mapId}</span>
                {m.mode === 'solo' && (
                  <span className="text-xs text-slate-400 capitalize">{m.difficulty}</span>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {formatDate(m.endedAt)} · {m.players.join(', ')}
              </div>
            </div>
            <Stat label="Wave" value={m.wavesReached} highlight />
            <Stat label="Time" value={formatDuration(m.durationSec)} />
            <Stat
              label={m.mode === 'versus' ? 'Kills / sent' : 'Kills'}
              value={m.mode === 'versus' ? `${m.kills} / ${m.enemiesSent}` : m.kills}
            />
            <Stat label="Towers" value={`${m.towersBuilt} (${m.goldSpent}g)`} />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-between">
        <button
          className="btn-secondary"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 20))}
        >
          ← Newer
        </button>
        <button
          className="btn-secondary"
          disabled={!matches || matches.length < 20}
          onClick={() => setOffset(offset + 20)}
        >
          Older →
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div>
      <div className={`font-bold ${highlight ? 'text-amber-300' : ''}`}>{value}</div>
      <div className="text-xs text-slate-500 uppercase">{label}</div>
    </div>
  );
}

function won(m: MatchHistoryEntry): boolean {
  return m.mode === 'versus' ? m.placement === 1 : m.result === 'win';
}
