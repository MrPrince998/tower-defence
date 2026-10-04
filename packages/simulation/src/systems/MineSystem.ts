import { branchOf, TOWERS, towerStats, tracePath } from '@maze/shared';
import type { Tower } from '../entities';
import type { World } from '../world';
import { applyDamage } from './damage';

const TRIGGER_RADIUS = 0.45; // a ground enemy this close to a mine's cell center sets it off
const RETRY_SEC = 0.5; // no free path cell in range: look again soon

/** Cells enemies currently walk through, recomputed only when the maze changes. */
function pathCells(world: World): { x: number; y: number }[] {
  if (world.pathCache.version !== world.grid.version || world.pathCache.cells.length === 0) {
    const seen = new Set<number>();
    const cells: { x: number; y: number }[] = [];
    for (const s of world.map.spawns) {
      for (const c of tracePath(world.map, world.grid.dist, s)) {
        const k = c.y * world.map.width + c.x;
        if (seen.has(k)) continue;
        seen.add(k);
        cells.push(c);
      }
    }
    world.pathCache = { version: world.grid.version, cells };
  }
  return world.pathCache.cells;
}

function layMine(world: World, t: Tower): boolean {
  const cfg = TOWERS[t.type].mines!;
  const br = branchOf(t.type, t.branch);
  const range = towerStats(t.type, t.level, t.branch, world.mods).range * t.rangeMult;
  const taken = new Set(world.mines.map((m) => `${m.x},${m.y}`));
  const options = pathCells(world)
    .map((c) => ({ x: c.x + 0.5, y: c.y + 0.5 }))
    .filter((c) => Math.hypot(c.x - t.cx, c.y - t.cy) <= range && !taken.has(`${c.x},${c.y}`))
    .filter((c) => !(c.x - 0.5 === world.map.goal.x && c.y - 0.5 === world.map.goal.y));
  if (options.length === 0) return false;
  const cell = options[Math.floor(world.rng.float() * options.length)];
  const stats = towerStats(t.type, t.level, t.branch, world.mods);
  world.mines.push({
    id: ++world.ids.mine,
    towerId: t.id,
    x: cell.x,
    y: cell.y,
    damage: stats.damage * t.damageMult * (br?.mineDamageMult ?? 1),
    radius: cfg.radius * (br?.mineRadiusMult ?? 1),
    owner: t.owner,
  });
  return true;
}

/** Mine layers drop mines on path cells in range; a ground enemy stepping on one blows it up (ground only). */
export function updateMines(world: World): void {
  for (const t of world.towers.values()) {
    const cfg = TOWERS[t.type].mines;
    if (!cfg) continue;
    t.layTimer -= world.dt;
    if (t.layTimer > 0) continue;
    const br = branchOf(t.type, t.branch);
    const max = cfg.maxMines + (br?.extraMines ?? 0);
    const mine = world.mines.filter((m) => m.towerId === t.id).length;
    if (mine >= max) {
      t.layTimer = RETRY_SEC;
      continue;
    }
    t.layTimer = layMine(world, t) ? cfg.layEverySec / (br?.layRateMult ?? 1) / world.mods.rate : RETRY_SEC;
  }

  if (world.mines.length === 0) return;
  const remaining = [];
  for (const m of world.mines) {
    let triggered = false;
    world.hash.query(m.x, m.y, TRIGGER_RADIUS, (e) => {
      if (!e.flying && !e.leaked) triggered = true;
    });
    if (!triggered) {
      remaining.push(m);
      continue;
    }
    const victims: typeof world.enemies = [];
    world.hash.query(m.x, m.y, m.radius, (e) => {
      if (!e.flying && !e.leaked) victims.push(e);
    });
    for (const e of victims) applyDamage(world, e, m.damage, m.owner);
    world.events.push({ t: 'mine_exploded', x: m.x, y: m.y, radius: m.radius });
  }
  world.mines = remaining;
}
