import type { Enemy } from '../entities';

/** Uniform-grid bucketing of enemies for range queries (06-ALGORITHMS.md §5). */
export class SpatialHash {
  private readonly cols: number;
  private readonly rows: number;
  private readonly buckets: Enemy[][];

  constructor(
    width: number,
    height: number,
    private readonly cellSize: number,
  ) {
    this.cols = Math.ceil(width / cellSize) + 1;
    this.rows = Math.ceil(height / cellSize) + 1;
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  rebuild(enemies: readonly Enemy[]): void {
    for (const b of this.buckets) b.length = 0;
    for (const e of enemies) {
      if (e.hp <= 0 || e.leaked) continue;
      this.buckets[this.bucketIndex(e.x, e.y)].push(e);
    }
  }

  /** Calls `fn` for every live enemy whose position is within `r` of (x, y). */
  query(x: number, y: number, r: number, fn: (e: Enemy) => void): void {
    const r2 = r * r;
    const c0 = this.clampCol(Math.floor((x - r) / this.cellSize));
    const c1 = this.clampCol(Math.floor((x + r) / this.cellSize));
    const r0 = this.clampRow(Math.floor((y - r) / this.cellSize));
    const r1 = this.clampRow(Math.floor((y + r) / this.cellSize));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        for (const e of this.buckets[row * this.cols + col]) {
          const dx = e.x - x;
          const dy = e.y - y;
          if (dx * dx + dy * dy <= r2 && e.hp > 0) fn(e);
        }
      }
    }
  }

  private bucketIndex(x: number, y: number): number {
    const col = this.clampCol(Math.floor(x / this.cellSize));
    const row = this.clampRow(Math.floor(y / this.cellSize));
    return row * this.cols + col;
  }

  private clampCol(c: number): number {
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  private clampRow(r: number): number {
    return r < 0 ? 0 : r >= this.rows ? this.rows - 1 : r;
  }
}
