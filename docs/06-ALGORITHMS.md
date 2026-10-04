# 06 — Algorithms Reference

## 1. Flow field (BFS from goal)
Computes step distance from every walkable cell to the goal. Enemies move to the neighbor with the lowest distance.
```ts
const INF = 1_000_000;
export function computeFlowField(w: number, h: number, blocked: Uint8Array, goal: Vec2): Int32Array {
  const dist = new Int32Array(w * h).fill(INF);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  const g = goal.y * w + goal.x;
  dist[g] = 0; queue[tail++] = g;
  while (head < tail) {
    const cur = queue[head++];
    const cx = cur % w, cy = (cur / w) | 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (blocked[ni] || dist[ni] !== INF) continue;
      dist[ni] = dist[cur] + 1;
      queue[tail++] = ni;
    }
  }
  return dist;
}
```
Complexity O(W*H). Recompute on tower place/sell only. Enemy next step: pick neighbor with min `dist`; tie-break deterministically (fixed direction order).

## 2. Placement validation
```
canPlace(cell):
  if occupied/out of bounds/not buildable -> INVALID_CELL / CELL_OCCUPIED
  temporarily mark cell blocked
  dist = computeFlowField(...)
  for each spawn: if dist[spawn] == INF -> BLOCKS_PATH (revert)
  also verify no ground enemy would be trapped: dist at each enemy's current cell != INF
  commit
```

## 3. Ground enemy movement
Enemy stores `x, y` (float) and `targetCell`. Each tick: move toward center of `targetCell` at `speed * slowMult * dt`. On arrival, choose next cell via flow field. Overshoot handled by carrying leftover distance into the next step. When the flow field changes, enemy keeps its current target cell, then re-evaluates on arrival.

## 4. Flyers
Move in a straight line from spawn to goal. Ignore the flow field and tower blocking.

## 5. Spatial hash grid (targeting performance)
Cell size = 2 tiles. Each tick, rebuild: `Map<cellKey, Enemy[]>`. A tower queries only buckets overlapping its range circle, then filters by exact distance.

## 6. Targeting modes
- `first`: enemy with smallest `dist` (flow field value at its cell, refined by distance to next cell)
- `last`: largest dist
- `strongest`: highest current HP
- `closest`: nearest to tower
Recompute target when current target dies, leaves range, or every 0.25 s.

## 7. Firing and projectiles
Cooldown timer per tower: `cd -= dt; if cd <= 0 && target: fire; cd += 1/rate`.
Projectile: speed 10 tiles/s, homing to target position; on hit apply damage (`max(1, dmg - armor)`). If target died, projectile continues to last position (cannon splash still explodes).
Splash: all ground enemies within radius r of impact take damage (full damage MVP; falloff is a stretch).

## 8. Status effects
Per enemy `slowUntil` (tick-based timer). Slow does not stack; refresh duration. Speed multiplier 0.6.

## 9. Support aura
Each tick (or on change), for each support tower compute towers within aura radius; apply `damageMult = 1.2`, `rangeMult = 1.1` using max (no stacking).

## 10. Wave budget generator
See `05-GAME-DESIGN.md`. Use seeded RNG:
```ts
export function mulberry32(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
```

## 11. Client interpolation
Keep a buffer of the last snapshots. Render at `renderTime = now - 100ms` (server clock offset estimated from `serverTime`). For each entity, lerp between the two snapshots surrounding `renderTime`. Entities appearing/disappearing between snapshots fade or snap.

## 12. Placement preview (client only)
Run the same `computeFlowField` from `shared`/`simulation` package locally on the client to color the ghost red/green. Server result is still final.

## 13. Fixed timestep loop
```ts
let acc = 0, last = performance.now();
setInterval(() => {
  const now = performance.now(); acc += (now - last) / 1000; last = now;
  acc = Math.min(acc, 0.25);                 // avoid spiral of death
  while (acc >= DT) { sim.update(DT); acc -= DT; }
}, 10);
```
