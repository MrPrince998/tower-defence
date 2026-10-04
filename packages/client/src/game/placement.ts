import {
  buildBlocked,
  computeFlowField,
  INF,
  isBuildableCell,
  spawnsReachable,
  towerCost,
  type ErrorCode,
  type Mods,
  type MapData,
  type TowerSnap,
  type TowerType,
  type Vec2,
} from '@maze/shared';

export interface PlacementInput {
  map: MapData;
  towers: readonly TowerSnap[];
  groundEnemies: readonly Vec2[]; // world positions (tiles)
  gold: number;
  mods?: Mods;
  type: TowerType;
  x: number;
  y: number;
}

/**
 * Client-side preview only (06-ALGORITHMS.md §12): same checks as the server using the shared
 * flow field. The server's answer is final.
 */
export function previewPlacement(p: PlacementInput): { ok: true } | { ok: false; code: ErrorCode } {
  if (!isBuildableCell(p.map, p.x, p.y)) return { ok: false, code: 'INVALID_CELL' };
  if (p.towers.some((t) => t.x === p.x && t.y === p.y)) return { ok: false, code: 'CELL_OCCUPIED' };
  const enemyCells = p.groundEnemies.map((e) => ({ x: Math.floor(e.x), y: Math.floor(e.y) }));
  if (enemyCells.some((c) => c.x === p.x && c.y === p.y)) return { ok: false, code: 'CELL_OCCUPIED' };
  if (p.gold < towerCost(p.type, p.mods)) return { ok: false, code: 'NOT_ENOUGH_GOLD' };
  const blocked = buildBlocked(p.map, [...p.towers, { x: p.x, y: p.y }]);
  const dist = computeFlowField(p.map.width, p.map.height, blocked, p.map.goal);
  if (!spawnsReachable(p.map, dist)) return { ok: false, code: 'BLOCKS_PATH' };
  if (enemyCells.some((c) => dist[c.y * p.map.width + c.x] >= INF)) return { ok: false, code: 'BLOCKS_PATH' };
  return { ok: true };
}
