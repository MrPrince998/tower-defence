import {
  buildBlocked,
  computeFlowField,
  INF,
  isBuildableCell,
  spawnsReachable,
  type ErrorCode,
  type MapData,
  type Vec2,
} from '@maze/shared';

/** Walkability, tower occupancy and the flow field for one map. */
export class Grid {
  readonly width: number;
  readonly height: number;
  readonly blocked: Uint8Array;
  readonly towerAt: Int32Array; // 0 = empty, otherwise tower id
  dist: Int32Array;
  /** Bumped whenever the walkable layout changes. */
  version = 0;

  constructor(readonly map: MapData) {
    this.width = map.width;
    this.height = map.height;
    this.blocked = buildBlocked(map);
    this.towerAt = new Int32Array(map.width * map.height);
    this.dist = this.compute();
  }

  idx(x: number, y: number): number {
    return y * this.width + x;
  }

  distAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return INF;
    return this.dist[this.idx(x, y)];
  }

  /** Cell-level checks: bounds, terrain, existing towers, enemies standing on it. */
  checkCell(x: number, y: number, enemyCells: readonly Vec2[]): ErrorCode | null {
    if (!isBuildableCell(this.map, x, y)) return 'INVALID_CELL';
    if (this.towerAt[this.idx(x, y)] !== 0) return 'CELL_OCCUPIED';
    if (enemyCells.some((c) => c.x === x && c.y === y)) return 'CELL_OCCUPIED';
    return null;
  }

  /**
   * Path check: with (x, y) blocked, every spawn and every ground enemy cell must still reach the goal.
   * Returns the new flow field on success so it can be committed without recomputing.
   */
  checkPath(
    x: number,
    y: number,
    enemyCells: readonly Vec2[],
  ): { ok: true; dist: Int32Array } | { ok: false } {
    const i = this.idx(x, y);
    this.blocked[i] = 1;
    const dist = this.compute();
    this.blocked[i] = 0;
    if (!spawnsReachable(this.map, dist)) return { ok: false };
    for (const c of enemyCells) if (dist[this.idx(c.x, c.y)] >= INF) return { ok: false };
    return { ok: true, dist };
  }

  placeTower(x: number, y: number, towerId: number, dist?: Int32Array): void {
    const i = this.idx(x, y);
    this.blocked[i] = 1;
    this.towerAt[i] = towerId;
    this.dist = dist ?? this.compute();
    this.version++;
  }

  removeTower(x: number, y: number): void {
    const i = this.idx(x, y);
    this.blocked[i] = 0;
    this.towerAt[i] = 0;
    this.dist = this.compute();
    this.version++;
  }

  private compute(): Int32Array {
    return computeFlowField(this.width, this.height, this.blocked, this.map.goal);
  }
}
