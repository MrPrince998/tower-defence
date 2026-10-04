import type { Vec2 } from '@maze/shared';

/** Hovered cell, written by the Phaser scene and read by React keyboard shortcuts (no Phaser import here). */
export const pointerState: { cell: Vec2 | null } = { cell: null };
