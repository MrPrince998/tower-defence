# 02 — Conventions

## Language and tooling
- TypeScript `strict: true`, ESM, Node 20+, npm workspaces
- ESLint + Prettier, Jest (`ts-jest`) for shared/simulation/server, Vitest or Jest for client utils
- Zod for runtime validation of all external input (HTTP body, socket payloads)

## Naming
- Files: `PascalCase.ts` for classes, `camelCase.ts` for modules, `kebab-case` for folders
- Socket events: `namespace:action` (`tower:place`, `game:snapshot`) defined as constants in `shared/src/events`
- DB: `snake_case` tables/columns, plural table names
- Constants: `UPPER_SNAKE_CASE`

## Determinism rules (simulation package)
- No `Date.now()`, `Math.random()`, `setTimeout`, or I/O
- Time comes from `dt`; randomness from injected seeded RNG (`mulberry32`)
- Same seed + same commands = identical result (enables replays and bot tests)

## Error handling
- Commands return `{ ok: true } | { ok: false, code: ErrorCode }`. Never throw for player mistakes.
- Socket handlers: validate with Zod → check room/player → call sim → emit ack.
- Error codes: `NOT_IN_ROOM`, `NOT_ENOUGH_GOLD`, `INVALID_CELL`, `BLOCKS_PATH`, `CELL_OCCUPIED`, `TOWER_NOT_FOUND`, `MAX_LEVEL`, `GAME_NOT_RUNNING`, `RATE_LIMITED`.

## Testing
- Every rule in `05-GAME-DESIGN.md` has a unit test
- Simulation tests run headless with a fixed seed
- Server tests use `socket.io-client` against an in-memory server

## Environment variables (`.env.example`)
```
PORT=4000
DATABASE_URL=postgres://user:pass@localhost:5432/maze_defense
JWT_SECRET=change-me
CLIENT_ORIGIN=http://localhost:3000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
```

## Git
Conventional commits: `feat(sim): add flow field`, `fix(server): ...`, `test(sim): ...`. One phase = one branch (`phase-03-simulation`).
