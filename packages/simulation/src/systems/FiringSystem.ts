import { branchOf, TOWERS } from '@maze/shared';
import type { Enemy, Tower } from '../entities';
import { statsOf } from '../stats';
import type { World } from '../world';
import { applyDamage } from './damage';
import { applyStun } from './StatusSystem';
import { canHit, findTargets } from './TargetingSystem';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Every attacking tower acts according to its kind (projectile, beam, chain). Mines have their own system. */
export function fireTowers(world: World, enemyById: Map<number, Enemy>): void {
  world.beams = [];
  for (const t of world.towers.values()) {
    switch (TOWERS[t.type].kind) {
      case 'projectile':
        fireProjectile(world, t, enemyById);
        break;
      case 'chain':
        fireChain(world, t, enemyById);
        break;
      case 'beam':
        fireBeam(world, t, enemyById);
        break;
      default:
        break;
    }
  }
}

/** Cooldown per tower: `cd -= dt; if cd <= 0 && target: fire; cd += 1/rate` (06-ALGORITHMS.md §7). */
function readyTarget(world: World, t: Tower, enemyById: Map<number, Enemy>, rate: number): Enemy | null {
  t.cooldown -= world.dt;
  if (t.cooldown > 0) return null;
  const target = t.targetId !== null ? enemyById.get(t.targetId) : undefined;
  if (!target) {
    t.cooldown = 0; // ready to fire as soon as something is in range
    return null;
  }
  t.cooldown += 1 / rate;
  return target;
}

function fireProjectile(world: World, t: Tower, enemyById: Map<number, Enemy>): void {
  const cfg = TOWERS[t.type];
  const stats = statsOf(world, t);
  const target = readyTarget(world, t, enemyById, stats.rate);
  if (!target) return;
  const br = branchOf(t.type, t.branch);
  let damage = stats.damage;
  if (br?.crit && world.rng.float() < br.crit.chance) damage *= br.crit.mult;
  world.projectiles.push({
    id: ++world.ids.projectile,
    kind: t.type,
    x: t.cx,
    y: t.cy,
    targetId: target.id,
    tx: target.x,
    ty: target.y,
    damage,
    splashRadius: (cfg.splashRadius ?? 0) * (br?.splashMult ?? 1),
    groundOnlySplash: !!cfg.groundOnly,
    ignoreArmor: !!br?.ignoreArmor,
    slow: cfg.slow
      ? {
          mult: br?.slowMult ?? cfg.slow.mult,
          durationSec: cfg.slow.durationSec,
          radius: br?.splashSlowRadius ?? 0,
        }
      : null,
    burn: br?.burn ?? null,
    owner: t.owner,
  });
}

/** Tesla: instant hit on the target, then jumps to the nearest un-hit enemy, losing damage per hop. */
function fireChain(world: World, t: Tower, enemyById: Map<number, Enemy>): void {
  const cfg = TOWERS[t.type];
  const chain = cfg.chain!;
  const stats = statsOf(world, t);
  const first = readyTarget(world, t, enemyById, stats.rate);
  if (!first) return;
  const br = branchOf(t.type, t.branch);
  const jumps = chain.jumps + (br?.extraJumps ?? 0);
  const hit = new Set<number>();
  const points = [r2(t.cx), r2(t.cy)];
  let current: Enemy | null = first;
  let damage = stats.damage;
  for (let hop = 0; current && hop <= jumps; hop++) {
    hit.add(current.id);
    points.push(r2(current.x), r2(current.y));
    applyDamage(world, current, damage, t.owner);
    if (br?.stun && world.rng.float() < br.stun.chance) applyStun(world, current, br.stun.durationSec);
    damage *= chain.falloff;
    let next: Enemy | null = null;
    let best = Infinity;
    const from: Enemy = current;
    world.hash.query(from.x, from.y, chain.jumpRange, (e) => {
      if (hit.has(e.id) || !canHit(t, e)) return;
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d < best || (d === best && next && e.id < next.id)) {
        best = d;
        next = e;
      }
    });
    current = next;
  }
  world.events.push({ t: 'zap', points });
}

/** Laser: continuous damage that ramps while the primary target stays the same. */
function fireBeam(world: World, t: Tower, enemyById: Map<number, Enemy>): void {
  const beam = TOWERS[t.type].beam!;
  const primary = t.targetId !== null ? enemyById.get(t.targetId) : undefined;
  if (!primary) {
    t.ramp = 1;
    t.beamTargets = [];
    return;
  }
  const br = branchOf(t.type, t.branch);
  const rampMult = br?.rampMult ?? 1;
  if (t.beamTargets[0] === primary.id) {
    t.ramp = Math.min(beam.maxRamp * rampMult, t.ramp + beam.rampPerSec * rampMult * world.dt);
  } else {
    t.ramp = 1;
  }
  const extras = findTargets(world, t, 1 + (br?.extraTargets ?? 0)).filter((e) => e.id !== primary.id);
  const targets = [primary, ...extras].slice(0, 1 + (br?.extraTargets ?? 0));
  const dps = statsOf(world, t).damage * t.ramp;
  for (const e of targets) {
    // Armor soaks damage per second, but a beam always does at least 10%.
    applyDamage(world, e, Math.max(dps * 0.1, dps - e.armor) * world.dt, t.owner, { dot: true });
    world.beams.push(t.id, e.id);
  }
  t.beamTargets = targets.map((e) => e.id);
}
