import { ENEMIES } from '@maze/shared';
import type { Enemy } from '../entities';
import { spawnChild } from './WaveSystem';
import { statsFor, type World } from '../world';

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Runs after every other system: pays rewards for kills, applies leak damage to the base, then removes dead and
 * leaked enemies (never mid-iteration of another system).
 */
export function resolveDeathsAndLeaks(world: World): void {
  const alive: Enemy[] = [];
  for (const e of world.enemies) {
    if (e.hp <= 0) {
      const reward = Math.round(e.reward * world.mods.bounty);
      world.gold += reward;
      if (e.killedBy) statsFor(world, e.killedBy).kills += 1;
      world.events.push({ t: 'enemy_killed', id: e.id, x: r2(e.x), y: r2(e.y), reward });
      // Splitters burst into smaller enemies that carry on from the same spot (appended, so this loop keeps them).
      const split = ENEMIES[e.type].split;
      if (split) {
        for (let k = 0; k < split.count; k++) spawnChild(world, split.into, e);
        world.events.push({ t: 'enemy_split', x: r2(e.x), y: r2(e.y), count: split.count });
      }
    } else if (e.leaked) {
      world.baseHp = Math.max(0, world.baseHp - e.leakDamage);
      world.events.push({ t: 'enemy_leaked', id: e.id, damage: e.leakDamage });
    } else {
      alive.push(e);
    }
  }
  world.enemies = alive;
  if (world.baseHp <= 0 && world.result === null) world.result = 'lose';
}
