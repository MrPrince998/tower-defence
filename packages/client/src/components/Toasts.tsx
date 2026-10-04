'use client';

import { useGameStore } from '@/stores/gameStore';

export function Toasts() {
  const toasts = useGameStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-toast rounded-xl border px-4 py-2 text-sm font-semibold shadow-lg ${
            t.kind === 'error'
              ? 'border-red-400/40 bg-red-950/90 text-red-100'
              : t.kind === 'success'
                ? 'border-emerald-400/40 bg-emerald-950/90 text-emerald-100'
                : 'border-white/15 bg-slate-900/95 text-slate-100'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
