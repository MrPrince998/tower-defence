'use client';

import dynamic from 'next/dynamic';

/** Phaser touches `window` at import time, so it is only ever loaded in the browser. */
export const GameCanvas = dynamic(() => import('./GameCanvasInner').then((m) => m.GameCanvasInner), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-slate-500">Loading battlefield…</div>
  ),
});
