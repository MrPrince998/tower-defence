import { nextCell } from '@maze/shared';
import type { Enemy } from '../entities';
import type { World } from '../world';
import { speedMultiplier } from './StatusSystem';

/**
 * Ground enemies walk cell-center to cell-center, choosing the next cell from the flow field on arrival and
 * carrying leftover distance forward. Flyers go straight to the goal (06-ALGORITHMS.md §3-4).
 */
export function moveEnemies(world: World): void {
  const goal = world.map.goal;
  const gx = goal.x + 0.5;
  const gy = goal.y + 0.5;
  for (const e of world.enemies) {
    if (e.hp <= 0 || e.leaked) continue;
    const move = e.speed * speedMultiplier(world, e) * world.dt;
    if (e.flying) {
      const dx = gx - e.x;
      const dy = gy - e.y;
      const d = Math.hypot(dx, dy);
      if (d <= move) {
        e.x = gx;
        e.y = gy;
        e.leaked = true;
      } else {
        e.x += (dx / d) * move;
        e.y += (dy / d) * move;
      }
      e.remaining = Math.max(0, d - move);
      continue;
    }
    moveGround(world, e, move);
  }
}

function moveGround(world: World, e: Enemy, move: number): void {
  const { grid, map } = world;
  // Bounded loop: one iteration per cell reached this tick.
  for (let guard = 0; guard < 64 && move > 0; guard++) {
    const tx = e.targetX + 0.5;
    const ty = e.targetY + 0.5;
    const dx = tx - e.x;
    const dy = ty - e.y;
    const d = Math.hypot(dx, dy);
    if (d > move) {
      e.x += (dx / d) * move;
      e.y += (dy / d) * move;
      break;
    }
    e.x = tx;
    e.y = ty;
    move -= d;
    if (e.targetX === map.goal.x && e.targetY === map.goal.y) {
      e.leaked = true;
      break;
    }
    const next = nextCell(grid.width, grid.height, grid.dist, e.targetX, e.targetY);
    if (!next) break;
    e.targetX = next.x;
    e.targetY = next.y;
  }
  e.remaining = grid.distAt(e.targetX, e.targetY) + Math.hypot(e.targetX + 0.5 - e.x, e.targetY + 0.5 - e.y);
}
