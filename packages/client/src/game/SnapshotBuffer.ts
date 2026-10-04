import type { EnemyType, Snapshot, TowerType } from '@maze/shared';

export interface RenderEnemy {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  slowed: boolean;
  shield: number;
  maxShield: number;
  stunned: boolean;
  burning: boolean;
}

export interface RenderProjectile {
  id: number;
  kind: TowerType;
  x: number;
  y: number;
}

export interface RenderFrame {
  serverTime: number;
  enemies: RenderEnemy[];
  projectiles: RenderProjectile[];
  /** Laser beams [towerId, enemyId, ...] and mine positions [x, y, ...] of the newer snapshot (not interpolated). */
  beams: number[];
  mines: number[];
}

interface StoredBoard {
  enemies: Map<number, RenderEnemy>;
  projectiles: Map<number, RenderProjectile>;
  beams: number[];
  mines: number[];
}

interface Stored {
  serverTime: number;
  boards: Map<string, StoredBoard>;
}

interface BoardMeta {
  enemies: Map<number, { type: EnemyType; maxHp: number }>;
  projectiles: Map<number, TowerType>;
}

const MAX_SNAPSHOTS = 40;
const OFFSET_SNAP_MS = 250;
const EMPTY: StoredBoard = { enemies: new Map(), projectiles: new Map(), beams: [], mines: [] };
const EMPTY_FRAME: RenderFrame = { serverTime: 0, enemies: [], projectiles: [], beams: [], mines: [] };

/**
 * Keeps recent snapshots and renders entities `delay` ms in the past, lerping between the two
 * snapshots that surround the render time (06-ALGORITHMS.md §11). Also restores fields that the
 * server omits after an entity's first appearance (enemy type/maxHp, projectile kind). One buffer
 * holds every board of the match; ids are only unique per board.
 */
export class SnapshotBuffer {
  private snaps: Stored[] = [];
  private offset: number | null = null; // localTime - serverTime
  private meta = new Map<string, BoardMeta>();

  reset(full: Snapshot, localNow: number): void {
    this.snaps = [];
    this.offset = null;
    this.meta.clear();
    this.push(full, localNow);
  }

  push(snap: Snapshot, localNow: number): void {
    const sample = localNow - snap.serverTime;
    if (this.offset === null || Math.abs(sample - this.offset) > OFFSET_SNAP_MS) this.offset = sample;
    else this.offset = this.offset * 0.9 + sample * 0.1;

    const boards = new Map<string, StoredBoard>();
    for (const b of snap.boards) {
      let meta = this.meta.get(b.id);
      if (!meta) {
        meta = { enemies: new Map(), projectiles: new Map() };
        this.meta.set(b.id, meta);
      }
      const enemies = new Map<number, RenderEnemy>();
      for (const e of b.enemies) {
        if (e.type !== undefined && e.maxHp !== undefined)
          meta.enemies.set(e.id, { type: e.type, maxHp: e.maxHp });
        const m = meta.enemies.get(e.id);
        if (!m) continue; // never render an enemy of unknown type
        enemies.set(e.id, {
          id: e.id,
          type: m.type,
          maxHp: m.maxHp,
          x: e.x,
          y: e.y,
          hp: e.hp,
          slowed: !!e.slowed,
          shield: e.shield ?? 0,
          maxShield: e.maxShield ?? 0,
          stunned: !!e.stunned,
          burning: !!e.burning,
        });
      }
      for (const id of meta.enemies.keys()) if (!enemies.has(id)) meta.enemies.delete(id);

      const projectiles = new Map<number, RenderProjectile>();
      for (const p of b.projectiles) {
        if (p.kind) meta.projectiles.set(p.id, p.kind);
        const kind = meta.projectiles.get(p.id);
        if (kind) projectiles.set(p.id, { id: p.id, kind, x: p.x, y: p.y });
      }
      for (const id of meta.projectiles.keys()) if (!projectiles.has(id)) meta.projectiles.delete(id);
      boards.set(b.id, { enemies, projectiles, beams: b.beams ?? [], mines: b.mines ?? [] });
    }

    // Drop anything at or after this time (e.g. after a pause/reset the server clock may repeat).
    while (this.snaps.length && this.snaps[this.snaps.length - 1].serverTime >= snap.serverTime)
      this.snaps.pop();
    this.snaps.push({ serverTime: snap.serverTime, boards });
    if (this.snaps.length > MAX_SNAPSHOTS) this.snaps.shift();
  }

  get size(): number {
    return this.snaps.length;
  }

  sample(board: string, localNow: number, delayMs: number): RenderFrame {
    if (this.snaps.length === 0 || this.offset === null) return EMPTY_FRAME;
    const t = localNow - this.offset - delayMs;
    const first = this.snaps[0];
    const last = this.snaps[this.snaps.length - 1];
    const of = (s: Stored) => s.boards.get(board) ?? EMPTY;
    if (t <= first.serverTime) return frameOf(of(first), of(first), 0, first.serverTime);
    if (t >= last.serverTime) return frameOf(of(last), of(last), 0, last.serverTime);
    let i = this.snaps.length - 2;
    while (i > 0 && this.snaps[i].serverTime > t) i--;
    const a = this.snaps[i];
    const b = this.snaps[i + 1];
    const alpha = (t - a.serverTime) / (b.serverTime - a.serverTime);
    return frameOf(of(a), of(b), alpha, t);
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Entities present in `b` are shown (lerped from `a` when also there); entities only in `a` are gone. */
function frameOf(a: StoredBoard, b: StoredBoard, alpha: number, serverTime: number): RenderFrame {
  const enemies: RenderEnemy[] = [];
  for (const eb of b.enemies.values()) {
    const ea = a.enemies.get(eb.id);
    enemies.push(
      ea
        ? { ...eb, x: lerp(ea.x, eb.x, alpha), y: lerp(ea.y, eb.y, alpha), hp: alpha < 0.5 ? ea.hp : eb.hp }
        : eb,
    );
  }
  const projectiles: RenderProjectile[] = [];
  for (const pb of b.projectiles.values()) {
    const pa = a.projectiles.get(pb.id);
    projectiles.push(pa ? { ...pb, x: lerp(pa.x, pb.x, alpha), y: lerp(pa.y, pb.y, alpha) } : pb);
  }
  return { serverTime, enemies, projectiles, beams: b.beams, mines: b.mines };
}
