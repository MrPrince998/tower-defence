import { GAME } from '@maze/shared';
import type { Enemy, Projectile } from '../entities';
import type { World } from '../world';
import { applyDamage } from './damage';
import { applyBurn, applySlow } from './StatusSystem';

export { applyDamage, damageAfterArmor } from './damage';

/** Homing projectiles; if the target dies they continue to its last position (06-ALGORITHMS.md §7). */
export function updateProjectiles(world: World, enemyById: Map<number, Enemy>): void {
  const step = GAME.PROJECTILE_SPEED * world.dt;
  const keep: Projectile[] = [];
  for (const p of world.projectiles) {
    const target = enemyById.get(p.targetId);
    if (target && target.hp > 0 && !target.leaked) {
      p.tx = target.x;
      p.ty = target.y;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d > step) {
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
      keep.push(p);
      continue;
    }
    p.x = p.tx;
    p.y = p.ty;
    hit(world, p, target);
  }
  world.projectiles = keep;
}

function strike(world: World, p: Projectile, e: Enemy): void {
  applyDamage(world, e, p.damage, p.owner, { ignoreArmor: p.ignoreArmor });
  if (p.burn) applyBurn(world, e, p.damage * p.burn.pctPerSec, p.burn.durationSec, p.owner);
}

function hit(world: World, p: Projectile, target: Enemy | undefined): void {
  if (p.splashRadius > 0) {
    // Cannon splash hits ground enemies only.
    const victims: Enemy[] = [];
    world.hash.query(p.x, p.y, p.splashRadius, (e) => {
      if (!e.leaked && !(p.groundOnlySplash && e.flying)) victims.push(e);
    });
    for (const e of victims) strike(world, p, e);
    return;
  }
  if (!target || target.hp <= 0 || target.leaked) return;
  strike(world, p, target);
  if (!p.slow) return;
  if (p.slow.radius > 0) {
    // Shatter: the slow spreads to everything near the target.
    world.hash.query(target.x, target.y, p.slow.radius, (e) =>
      applySlow(world, e, p.slow!.durationSec, p.slow!.mult),
    );
  } else {
    applySlow(world, target, p.slow.durationSec, p.slow.mult);
  }
}
