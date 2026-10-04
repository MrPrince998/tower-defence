import { towerStats, type TowerStats } from '@maze/shared';
import type { Tower } from './entities';
import type { World } from './world';

/** Final tower stats: level, branch and perks (shared) plus the support aura on this tower. */
export function statsOf(world: World, t: Tower): TowerStats {
  const s = towerStats(t.type, t.level, t.branch, world.mods);
  return { damage: s.damage * t.damageMult, range: s.range * t.rangeMult, rate: s.rate };
}
