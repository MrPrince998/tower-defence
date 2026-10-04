'use client';

import { useGameStore } from '@/stores/gameStore';

export function WaveBanner() {
  const banner = useGameStore((s) => s.banner);
  if (!banner) return null;
  const color =
    banner.kind === 'boss'
      ? 'from-red-300 to-red-600'
      : banner.kind === 'clear'
        ? 'from-emerald-200 to-emerald-500'
        : 'from-amber-100 to-amber-400';
  return (
    <div
      key={banner.id}
      className="animate-banner pointer-events-none absolute inset-x-0 top-[18%] text-center"
    >
      <div
        className={`font-display bg-gradient-to-b ${color} bg-clip-text text-6xl font-extrabold text-transparent drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]`}
      >
        {banner.title}
      </div>
      {banner.subtitle && (
        <div
          className={`mt-2 text-lg font-bold tracking-[0.25em] ${banner.kind === 'boss' ? 'text-red-300' : 'text-slate-100'} drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]`}
        >
          {banner.subtitle}
        </div>
      )}
    </div>
  );
}
