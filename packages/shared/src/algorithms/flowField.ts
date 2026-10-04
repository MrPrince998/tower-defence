import { CELL, type MapData, type Vec2 } from '../types';

export const INF = 1_000_000;

/** Neighbor order is fixed (right, left, down, up) so tie-breaks are deterministic. */
export const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** BFS step distance from every walkable cell to the goal (see 06-ALGORITHMS.md §1). */
export function computeFlowField(w: number, h: number, blocked: Uint8Array, goal: Vec2): Int32Array {
  const dist = new Int32Array(w * h).fill(INF);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const g = goal.y * w + goal.x;
  dist[g] = 0;
  queue[tail++] = g;
  while (head < tail) {
    const cur = queue[head++];
    const cx = cur % w;
    const cy = (cur / w) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (blocked[ni] || dist[ni] !== INF) continue;
      dist[ni] = dist[cur] + 1;
      queue[tail++] = ni;
    }
  }
  return dist;
}

/** Blocked mask of a map: rocks plus the given tower cells. */
export function buildBlocked(map: MapData, towers: Iterable<Vec2> = []): Uint8Array {
  const blocked = new Uint8Array(map.width * map.height);
  for (let i = 0; i < map.cells.length; i++) blocked[i] = map.cells[i] === CELL.ROCK ? 1 : 0;
  for (const t of towers) blocked[t.y * map.width + t.x] = 1;
  return blocked;
}

export function isBuildableCell(map: MapData, x: number, y: number): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  return map.cells[y * map.width + x] === CELL.BUILDABLE;
}

/** True if every spawn can still reach the goal. */
export function spawnsReachable(map: MapData, dist: Int32Array): boolean {
  return map.spawns.every((s) => dist[s.y * map.width + s.x] < INF);
}

/**
 * Walk the flow field from a spawn to the goal (lowest-distance neighbor, fixed tie-break).
 * Used by clients to draw the path overlay; the simulation uses the same rule per step.
 */
export function tracePath(map: MapData, dist: Int32Array, from: Vec2): Vec2[] {
  const path: Vec2[] = [{ ...from }];
  let cur = from;
  const maxSteps = map.width * map.height;
  for (let step = 0; step < maxSteps; step++) {
    const d = dist[cur.y * map.width + cur.x];
    if (d === 0 || d >= INF) break;
    const next = nextCell(map.width, map.height, dist, cur.x, cur.y);
    if (!next) break;
    path.push(next);
    cur = next;
  }
  return path;
}

export function nextCell(w: number, h: number, dist: Int32Array, x: number, y: number): Vec2 | null {
  let best: Vec2 | null = null;
  let bestD = dist[y * w + x];
  for (const [dx, dy] of DIRS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const d = dist[ny * w + nx];
    if (d < bestD) {
      bestD = d;
      best = { x: nx, y: ny };
    }
  }
  return best;
}
