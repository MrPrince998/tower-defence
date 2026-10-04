# Phase 7 — Waves and Balance

**Required reading:** `05-GAME-DESIGN.md`, `06-ALGORITHMS.md` (section 10)
**Goal:** Full wave progression, boss waves, difficulty modes, and a headless balance harness.

## Deliverables
- `WaveSystem`: build phase timer, spawn scheduling, wave-clear detection, bonus gold, `wave:skip`
- Budget wave generator with unlocks and boss every 10th wave
- Difficulty modifiers (HP, start gold, base HP)
- Boss enemy (armor 8, leak = 10 HP)
- `tools/balance-bot.ts`: headless runner that simulates N games with scripted strategies (e.g. "arrows only", "mixed", "maze-heavy") and prints average wave reached
- Client: wave banner, next-wave preview (enemy types and count), boss warning

## Tasks
1. Implement generator; write tests for budget spending and unlocks.
2. Spawn queue with intervals, round-robin over spawns.
3. Wave skip grants small bonus gold; disallow skip during boss wave.
4. Implement balance bot using only `GameSimulation` API.
5. Tune config so "mixed" strategy reaches wave ~20 on normal; document results in the tracker notes.

## Acceptance criteria
- Same seed generates the same wave list
- No wave exceeds 1.1x its budget
- Balance bot runs 100 games in under 60 s and outputs a table
- Wave 10 reliably spawns exactly one boss

## Prompt
> Read CLAUDE.md and docs/phases/PHASE-07-WAVES-AND-BALANCE.md with required reading. Phase 7 only.
