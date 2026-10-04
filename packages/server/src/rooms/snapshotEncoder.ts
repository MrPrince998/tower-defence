import type { BoardSnapshot, EnemySnap, ProjectileSnap, Snapshot } from '@maze/shared';

/**
 * Bandwidth optimisation for broadcast snapshots (03-PROTOCOL.md "Bandwidth rules"), per board:
 * - towers are omitted unless they changed since the last broadcast
 * - enemy `type`/`maxHp` and projectile `kind` are sent only the first time an id appears; `slowed` only when true
 * - `nextWave` is sent only when it changes
 * Full snapshots (game:start, reconnect) still carry everything, and socket.io delivery is ordered,
 * so every client already knows the omitted fields.
 */
class BoardEncoder {
  private known = new Set<number>();
  private knownProjectiles = new Set<number>();
  private lastNextWave = '';
  towersDirty = false;

  encode(full: BoardSnapshot): BoardSnapshot {
    const seen = new Set<number>();
    const enemies = full.enemies.map((e): EnemySnap => {
      seen.add(e.id);
      const out: EnemySnap = { id: e.id, x: e.x, y: e.y, hp: e.hp };
      if (!this.known.has(e.id)) {
        out.type = e.type;
        out.maxHp = e.maxHp;
      }
      if (e.slowed) out.slowed = true;
      if (e.stunned) out.stunned = true;
      if (e.burning) out.burning = true;
      if (e.maxShield !== undefined) {
        out.shield = e.shield;
        out.maxShield = e.maxShield;
      }
      return out;
    });
    this.known = seen;
    const seenProjectiles = new Set<number>();
    const projectiles = full.projectiles.map((p): ProjectileSnap => {
      seenProjectiles.add(p.id);
      return this.knownProjectiles.has(p.id) ? { id: p.id, x: p.x, y: p.y } : p;
    });
    this.knownProjectiles = seenProjectiles;
    const board: BoardSnapshot = { ...full, enemies, projectiles };
    const nextWave = JSON.stringify(full.nextWave);
    if (nextWave === this.lastNextWave) delete board.nextWave;
    else this.lastNextWave = nextWave;
    if (this.towersDirty) this.towersDirty = false;
    else delete board.towers;
    return board;
  }
}

export class SnapshotEncoder {
  private readonly boards = new Map<string, BoardEncoder>();

  private board(id: string): BoardEncoder {
    let b = this.boards.get(id);
    if (!b) {
      b = new BoardEncoder();
      this.boards.set(id, b);
    }
    return b;
  }

  markTowersDirty(boardId: string): void {
    this.board(boardId).towersDirty = true;
  }

  encode(full: Snapshot): Snapshot {
    return { ...full, boards: full.boards.map((b) => this.board(b.id).encode(b)) };
  }
}
