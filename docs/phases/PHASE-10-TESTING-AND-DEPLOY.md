# Phase 10 — Testing and Deploy

**Required reading:** `02-CONVENTIONS.md`, `01-ARCHITECTURE.md`
**Goal:** Confidence and a live deployment.

## Deliverables
- Load test (Artillery or k6 with socket.io) simulating 25+ concurrent rooms
- CI (GitHub Actions): lint, type-check, unit tests, build, Postgres service for repo tests
- Dockerfiles for `server` and `client`; production `docker-compose.yml` (server, client, postgres, reverse proxy)
- Security: helmet, CORS allowlist, rate limiting on auth routes, input validation audit
- Logging (pino), `/health` and basic metrics (rooms, players, avg tick ms)
- Deployment guide in `docs/DEPLOYMENT.md` (Render/Fly.io/VPS)
- Root `README.md` with screenshots and architecture diagram

## Tasks
1. Add tick-time metric; alert if avg tick > 10 ms.
2. Write the load test script; record results (rooms vs CPU, tick time).
3. Configure CI pipeline and caching.
4. Containerize; run full stack with one command.
5. Deploy; verify WebSocket support (sticky sessions if multiple instances; otherwise single instance).

## Acceptance criteria
- 25 concurrent rooms keep avg tick < 10 ms on a small VPS
- CI green on main
- `docker compose up` brings up a working game locally
- Public URL playable by two players on different networks

## Prompt
> Read CLAUDE.md and docs/phases/PHASE-10-TESTING-AND-DEPLOY.md with required reading. Phase 10 only.
