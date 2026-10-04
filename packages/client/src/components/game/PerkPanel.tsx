'use client';

import { useEffect, useState } from 'react';
import { PERKS } from '@maze/shared';
import { commands } from '@/lib/net';
import { canControlView, useGameStore } from '@/stores/gameStore';

/**
 * Every 5 waves: pick 1 of 3 perks. Shown over your own board; the game keeps running while you decide,
 * and "Later" tucks it into a small pill so it does not cover the maze.
 */
export function PerkPanel() {
  const offer = useGameStore((s) => (s.myId ? s.boards[s.myId]?.perkOffer : null));
  const control = useGameStore(canControlView);
  const [hidden, setHidden] = useState(false);
  const key = offer?.join(',') ?? '';
  useEffect(() => setHidden(false), [key]); // a new offer opens again
  if (!offer || !control) return null;

  if (hidden) {
    return (
      <button
        onClick={() => setHidden(false)}
        className="absolute right-3 bottom-3 animate-pulse rounded-full border border-amber-300/60 bg-slate-950/90 px-4 py-2 text-sm font-bold text-amber-200 shadow-lg"
      >
        🎁 Perk ready — choose
      </button>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
      <div className="panel pointer-events-auto border-amber-300/40 p-3">
        <div className="mb-2 flex items-center justify-between gap-4">
          <span className="font-display font-bold text-amber-200">Choose a perk</span>
          <button className="text-xs text-slate-400 hover:text-white" onClick={() => setHidden(true)}>
            Later ✕
          </button>
        </div>
        <div className="flex gap-2">
          {offer.map((id) => (
            <button
              key={id}
              onClick={() => commands.choosePerk(id)}
              className="w-36 rounded-xl border border-white/15 bg-white/5 p-2 text-left transition hover:-translate-y-0.5 hover:border-amber-300/70 hover:bg-amber-400/10"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{PERKS[id].icon}</span>
                <span className="text-sm font-bold">{PERKS[id].name}</span>
              </div>
              <div className="mt-1 text-[11px] leading-tight text-slate-300">{PERKS[id].description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
