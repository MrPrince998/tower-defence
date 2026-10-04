import { ENEMY_SCALING } from '@maze/shared';
import type { Enemy } from '../entities';
import type { World } from '../world';
import { applyDamage } from './damage';

/**
 * Slow does not stack: a new application refreshes the duration and keeps the strongest multiplier
 * (06-ALGORITHMS.md §8). Duration is scaled by the Frostbite perk.
 */
export function applySlow(
  world: World,
  enemy: Enemy,
  durationSec: number,
  mult: number = ENEMY_SCALING.SLOW_MULT,
): void {
  const until = world.tick + Math.round((durationSec * world.mods.slowDuration) / world.dt);
  enemy.slowMult = isSlowed(world, enemy) ? Math.min(enemy.slowMult, mult) : mult;
  enemy.slowUntilTick = Math.max(enemy.slowUntilTick, until);
}

export function isSlowed(world: World, enemy: Enemy): boolean {
  return world.tick < enemy.slowUntilTick;
}

export function applyStun(world: World, enemy: Enemy, durationSec: number): void {
  enemy.stunUntilTick = Math.max(enemy.stunUntilTick, world.tick + Math.round(durationSec / world.dt));
}

export function isStunned(world: World, enemy: Enemy): boolean {
  return world.tick < enemy.stunUntilTick;
}

/** Burning does not stack either: refresh the duration, keep the hotter fire. */
export function applyBurn(world: World, enemy: Enemy, dps: number, durationSec: number, owner: string): void {
  const until = world.tick + Math.round(durationSec / world.dt);
  const active = enemy.burn && world.tick < enemy.burn.untilTick;
  enemy.burn = {
    dps: active ? Math.max(enemy.burn!.dps, dps) : dps,
    untilTick: Math.max(active ? enemy.burn!.untilTick : 0, until),
    owner: active && enemy.burn!.dps >= dps ? enemy.burn!.owner : owner,
  };
}

export function isBurning(world: World, enemy: Enemy): boolean {
  return !!enemy.burn && world.tick < enemy.burn.untilTick;
}

export function speedMultiplier(world: World, enemy: Enemy): number {
  if (isStunned(world, enemy)) return 0;
  return isSlowed(world, enemy) ? enemy.slowMult : 1;
}

/** Damage-over-time effects (burn). Slow and stun expire implicitly by tick stamp. */
export function updateStatus(world: World): void {
  for (const e of world.enemies) {
    if (!e.burn) continue;
    if (world.tick >= e.burn.untilTick) {
      e.burn = null;
      continue;
    }
    applyDamage(world, e, e.burn.dps * world.dt, e.burn.owner, { dot: true });
  }
}
