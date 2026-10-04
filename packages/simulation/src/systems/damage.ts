import type { Enemy } from '../entities';
import { statsFor, type World } from '../world';

/** Armor reduces damage but at least 1 is always dealt. */
export function damageAfterArmor(damage: number, armor: number): number {
  return Math.max(1, damage - armor);
}

export interface DamageOpts {
  /** Piercing hits skip armor. */
  ignoreArmor?: boolean;
  /** Damage over time / beams: already per-tick, no armor and no 1-damage minimum. */
  dot?: boolean;
}

/** Applies a hit: armor first, then shield, then HP. Credits damage and the kill to `owner`. */
export function applyDamage(
  world: World,
  e: Enemy,
  damage: number,
  owner: string,
  opts: DamageOpts = {},
): void {
  if (e.hp <= 0 || e.leaked) return;
  let dmg = opts.dot || opts.ignoreArmor ? damage : damageAfterArmor(damage, e.armor);
  const stats = statsFor(world, owner);
  if (e.shield > 0) {
    const absorbed = Math.min(e.shield, dmg);
    e.shield -= absorbed;
    dmg -= absorbed;
    stats.damageDealt += absorbed;
  }
  if (dmg <= 0) return;
  const dealt = Math.min(e.hp, dmg);
  e.hp -= dealt;
  stats.damageDealt += dealt;
  if (e.hp <= 0) {
    e.hp = 0;
    e.killedBy = owner;
  }
}
