# Phase 3 — Simulation Core

**Required reading:** `05-GAME-DESIGN.md`, `06-ALGORITHMS.md` (sections 1-4, 10, 13), `02-CONVENTIONS.md` (determinism)
**Goal:** A pure, deterministic `GameSimulation` with grid, flow field, enemy movement, base HP. No sockets, no DB.

## Deliverables (`packages/simulation`)
- `Grid` (blocked array, buildable, spawn, goal)
- `computeFlowField` per `06-ALGORITHMS.md`
- `GameSimulation` with `update(dt)`, `applyCommand(playerId, cmd)`, `getSnapshot()`, `drainEvents()`
- Enemy entity (grunt only for now), spawn helper for tests
- `placeTower` command (generic tower, cost checks) with BFS placement validation
- Seeded RNG utility
- Jest tests

## Tasks
1. Build `Grid` from `MapData`.
2. Implement flow field and neighbor selection with deterministic tie-break.
3. Enemy movement between cell centers with leftover-distance handling.
4. Base damage on reaching goal; lose condition when HP <= 0.
5. `placeTower`: reject `BLOCKS_PATH`, `CELL_OCCUPIED`, `NOT_ENOUGH_GOLD`, `INVALID_CELL`; recompute flow field on success; emit `path_updated`.
6. `sellTower` with 70% refund and recompute.

## Acceptance criteria (tests)
- Straight corridor: enemy reaches goal in expected time (± one tick)
- Placing a tower that seals the path is rejected; state unchanged
- Placing a tower that lengthens the path increases enemy travel time
- Two runs with same seed and commands produce identical snapshots
- Test coverage ≥ 90% on simulation package

## Pitfalls
- No `Date.now()`/`Math.random()`
- Enemies mid-move when a tower is placed must not get stuck (they re-evaluate on arrival)

## Prompt
> Read CLAUDE.md and docs/phases/PHASE-03-SIMULATION-CORE.md with required reading. Write failing tests first, then implement. Phase 3 only.
