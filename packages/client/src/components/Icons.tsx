'use client';

import { useEffect, useRef } from 'react';
import type { EnemyType, MapData, TowerType } from '@maze/shared';
import { drawEnemyIcon, drawMiniMap, drawTowerIcon } from '@/game/art';

/** Redraws when `deps` change (callers pass every input of `draw`). */
function useCanvas(
  draw: (ctx: CanvasRenderingContext2D) => void,
  deps: unknown[],
  size: { w: number; h: number },
) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx);
  }, deps);
  return ref;
}

export function TowerIcon({
  type,
  size = 48,
  level = 1,
}: {
  type: TowerType;
  size?: number;
  level?: number;
}) {
  const ref = useCanvas((ctx) => drawTowerIcon(ctx, type, size, level), [type, size, level], {
    w: size,
    h: size,
  });
  return <canvas ref={ref} style={{ width: size, height: size }} />;
}

export function EnemyIcon({ type, size = 28 }: { type: EnemyType; size?: number }) {
  const ref = useCanvas((ctx) => drawEnemyIcon(ctx, type, size), [type, size], { w: size, h: size });
  return <canvas ref={ref} style={{ width: size, height: size }} />;
}

export function MiniMap({ map, cell = 10 }: { map: MapData; cell?: number }) {
  const w = map.width * cell;
  const h = map.height * cell;
  const ref = useCanvas((ctx) => drawMiniMap(ctx, map, cell), [map, cell], { w, h });
  return <canvas ref={ref} className="rounded-lg border border-white/10" style={{ width: w, height: h }} />;
}
