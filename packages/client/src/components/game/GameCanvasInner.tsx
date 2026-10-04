'use client';

import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import type { MapData } from '@maze/shared';
import { createGame } from '@/game/createGame';

export function GameCanvasInner({ map }: { map: MapData }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const game: Phaser.Game = createGame(ref.current, map);
    return () => game.destroy(true);
  }, [map]);
  return <div ref={ref} className="h-full w-full" />;
}
