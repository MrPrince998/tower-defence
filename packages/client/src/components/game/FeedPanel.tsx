'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';

const COLORS = {
  incoming: 'text-rose-300',
  outgoing: 'text-emerald-300',
  other: 'text-slate-400',
  elimination: 'text-amber-200 font-semibold',
} as const;

/** Versus battle log: who sent what at whom, and knock-outs. */
export function FeedPanel() {
  const feed = useGameStore((s) => s.feed);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [feed]);
  return (
    <section className="panel p-3">
      <h3 className="font-display mb-1 text-sm font-bold tracking-wide text-slate-300">BATTLE LOG</h3>
      <div ref={list} className="max-h-28 space-y-0.5 overflow-y-auto text-xs">
        {feed.length === 0 && <p className="text-slate-500">Sends and knock-outs show up here.</p>}
        {feed.map((f) => (
          <p key={f.id} className={COLORS[f.kind]}>
            {f.text}
          </p>
        ))}
      </div>
    </section>
  );
}
