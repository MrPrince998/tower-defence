# CLAUDE.md — Instructions for AI coding assistants

Project: **Co-op Maze Defense** (multiplayer tower defense, 2-4 players).
All specs live in `/docs`. Do NOT rely on memory of this project; read the docs.

## How to work
1. Read `docs/README.md` (index) first.
2. Read `docs/08-PROGRESS-TRACKER.md` to find the current phase.
3. Read ONLY the files needed for that phase (each phase file lists its "Required reading").
4. Implement one phase at a time. Do not build ahead.
5. When finished, tick the checklist in `08-PROGRESS-TRACKER.md`.
6. Every time a feature is completed, add it to `docs/FEATURES.md` (the single list of everything built).

## Hard rules
- Server is authoritative. Client sends intent only, never results.
- `GameSimulation` is pure TypeScript: no sockets, no DB, no `Date.now()`, no `Math.random()` (use injected RNG and `dt`).
- Socket event names and payloads come ONLY from `packages/shared`. Never hardcode strings.
- TypeScript strict mode. Validate all incoming socket payloads with Zod.
- Every game rule needs a Jest unit test.
- Game balance values live in `packages/shared/src/config/`, never inline in logic.
