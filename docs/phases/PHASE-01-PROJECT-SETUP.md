# Phase 1 — Project Setup

**Required reading:** `01-ARCHITECTURE.md`, `02-CONVENTIONS.md`, `03-PROTOCOL.md`
**Goal:** A running monorepo where client and server compile, share types, and connect via Socket.io.

## Deliverables
- npm workspaces root with `packages/{shared,simulation,server,client}`
- `tsconfig.base.json` (strict), ESLint, Prettier, Jest configs
- `shared`: types from `03-PROTOCOL.md`, event name constants, Zod schemas, config stubs
- `server`: Express app (`GET /health`), Socket.io server with CORS from `CLIENT_ORIGIN`
- `client`: Next.js (App Router) + Tailwind, a page that connects a socket and shows "connected"
- `docker-compose.yml` with Postgres 16
- `.env.example`, `README` root quick-start

## Tasks
1. Init workspaces and base tsconfig; make packages reference each other by name (`@maze/shared`).
2. Write all shared types and event constants (`EVENTS.TOWER_PLACE = 'tower:place'`).
3. Typed Socket.io: `Server<ClientToServerEvents, ServerToClientEvents>`.
4. Add scripts: `dev` (runs server + client), `test`, `lint`, `build`.
5. Add a `simulation` package with an empty `GameSimulation` class and one passing test.

## Acceptance criteria
- `npm run dev` starts both; browser shows "connected" and server logs the socket id
- `npm test` passes; `npm run build` passes with zero TS errors
- Changing an event name in `shared` produces a compile error in client and server

## Pitfalls
- Avoid circular deps (simulation must not import server)
- Phaser is loaded later via `dynamic import` with `ssr: false`

## Prompt
> Read CLAUDE.md and docs/phases/PHASE-01-PROJECT-SETUP.md with its required reading. Implement Phase 1 only.
