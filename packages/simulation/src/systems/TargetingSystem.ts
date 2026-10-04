import { GAME, TOWERS, type TargetMode, type TowerKind } from '@maze/shared';
import type { Enemy, Tower } from '../entities';
import { statsOf } from '../stats';
import type { World } from '../world';

const TARGETING_KINDS = new Set<TowerKind>(['projectile', 'beam', 'chain']);

export function usesTargeting(t: Tower): boolean {
  return TARGETING_KINDS.has(TOWERS[t.type].kind);
}

export function effectiveRange(world: World, t: Tower): number {
  return statsOf(world, t).range;
}

export function canHit(t: Tower, e: Enemy): boolean {
  return !(TOWERS[t.type].groundOnly && e.flying);
}

/** Lower score wins. */
function score(mode: TargetMode, t: Tower, e: Enemy): number {
  switch (mode) {
    case 'first':
      return e.remaining;
    case 'last':
      return -e.remaining;
    case 'strongest':
      return -(e.hp + e.shield);
    case 'closest':
      return Math.hypot(e.x - t.cx, e.y - t.cy);
  }
}

/** Best `count` targets in range by the tower's mode (ties broken by id, so iteration order never matters). */
export function findTargets(world: World, t: Tower, count: number): Enemy[] {
  const found: { e: Enemy; s: number }[] = [];
  world.hash.query(t.cx, t.cy, effectiveRange(world, t), (e) => {
    if (canHit(t, e)) found.push({ e, s: score(t.targetMode, t, e) });
  });
  found.sort((a, b) => a.s - b.s || a.e.id - b.e.id);
  return found.slice(0, count).map((f) => f.e);
}

export function findTarget(world: World, t: Tower): Enemy | null {
  return findTargets(world, t, 1)[0] ?? null;
}

/** Retarget when the target dies, leaves range, or every RETARGET_INTERVAL (06-ALGORITHMS.md §6). */
export function updateTargeting(world: World, enemyById: Map<number, Enemy>): void {
  for (const t of world.towers.values()) {
    if (!usesTargeting(t)) continue;
    t.retargetTimer -= world.dt;
    if (t.targetId !== null) {
      const e = enemyById.get(t.targetId);
      const range = effectiveRange(world, t);
      if (!e || e.hp <= 0 || e.leaked || Math.hypot(e.x - t.cx, e.y - t.cy) > range) t.targetId = null;
    }
    if (t.targetId === null || t.retargetTimer <= 0) {
      t.targetId = findTarget(world, t)?.id ?? null;
      t.retargetTimer = GAME.RETARGET_INTERVAL_SEC;
    }
  }
}
