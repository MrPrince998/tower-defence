import { branchOf, TOWERS, towerStats } from '@maze/shared';
import type { World } from '../world';

/**
 * Support aura: max of buffs, never stacked (06-ALGORITHMS.md §9). Recomputed only when towers or perks change.
 * War Drums (support branch a) raises the damage bonus.
 */
export function updateAuras(world: World): void {
  if (!world.auraDirty) return;
  world.auraDirty = false;
  const towers = [...world.towers.values()];
  for (const t of towers) {
    t.damageMult = 1;
    t.rangeMult = 1;
  }
  for (const s of towers) {
    const aura = TOWERS[s.type].aura;
    if (!aura) continue;
    const damageMult = branchOf(s.type, s.branch)?.auraDamageMult ?? aura.damageMult;
    const r = towerStats(s.type, s.level, s.branch, world.mods).range;
    for (const t of towers) {
      if (t === s || TOWERS[t.type].aura || TOWERS[t.type].kind === 'wall') continue;
      if (Math.hypot(t.cx - s.cx, t.cy - s.cy) > r) continue;
      t.damageMult = Math.max(t.damageMult, damageMult);
      t.rangeMult = Math.max(t.rangeMult, aura.rangeMult);
    }
  }
}
