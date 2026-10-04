# Deployment

The game is two processes plus Postgres:

| Service | Port | Notes |
|---|---|---|
| `server` (Express + Socket.io) | 4000 | Stateful: rooms and simulations live in memory. Run **one instance** (or sticky sessions + one room per instance). |
| `client` (Next.js standalone) | 3000 | Stateless. |
| `postgres` | 5432 | Only accounts and finished matches. Migrations run automatically on server start. |

The browser talks to the server directly: REST at `NEXT_PUBLIC_SERVER_URL` and Socket.io at that URL's **origin** (`/socket.io`). WebSockets must be allowed end-to-end.

## Option A — one VPS with Docker (recommended)

```bash
git clone <repo> maze-defense && cd maze-defense
cat > .env <<'ENV'
JWT_SECRET=<long random string>
POSTGRES_PASSWORD=<strong password>
PUBLIC_URL=https://play.example.com
SITE_ADDRESS=play.example.com
ENV
docker compose -f docker-compose.prod.yml up -d --build
```

Caddy (`docker/Caddyfile`) terminates TLS automatically for `SITE_ADDRESS`, forwards `/socket.io/*` and `/api/*` to the server
and everything else to Next.js. Point the domain's DNS A record at the VPS first. For a local trial, leave `PUBLIC_URL` and
`SITE_ADDRESS` unset and open http://localhost.

`NEXT_PUBLIC_SERVER_URL` is baked into the client at **build** time (`${PUBLIC_URL}/api`), so rebuild the client when the URL changes.

Health check: `curl https://play.example.com/api/health` → `{ status, rooms, players, avgTickMs, db }`.

## Option B — Fly.io / Render

1. Create a managed Postgres and note its `DATABASE_URL`.
2. Deploy the server from `packages/server/Dockerfile` (build context = repo root) with env `DATABASE_URL`, `JWT_SECRET`,
   `CLIENT_ORIGIN=https://<client-host>`. Scale to **exactly one** instance; Fly: `fly scale count 1`. Both platforms support
   WebSockets without extra config.
3. Deploy the client from `packages/client/Dockerfile` with build arg `NEXT_PUBLIC_SERVER_URL=https://<server-host>`.

## Environment variables

| Variable | Used by | Default |
|---|---|---|
| `PORT` | server | 4000 |
| `DATABASE_URL` | server | unset → in-memory store (dev only; refused in production) |
| `JWT_SECRET` | server | required in production |
| `CLIENT_ORIGIN` | server | `http://localhost:3000` (comma-separated allowlist for CORS) |
| `BCRYPT_COST` | server | 12 |
| `LOG_LEVEL` | server | `info` |
| `NEXT_PUBLIC_SERVER_URL` | client (build time) | `http://localhost:4000` |
| `NEXT_PUBLIC_SOCKET_URL` | client (build time) | origin of `NEXT_PUBLIC_SERVER_URL` |

## Operations

- Logs are JSON (pino) in production; the server warns when the average tick exceeds 10 ms.
- Load test: `JWT_SECRET=<same as server> npm run loadtest -- --url https://play.example.com --rooms 25 --seconds 60`
  (connects directly to Socket.io; use the origin, not `/api`).
- Backups: only the Postgres volume matters (`pg_dump maze_defense`).
- Scaling past one instance needs sticky sessions keyed by room and a shared room directory; not needed for the target load
  (25 rooms used ~0.09 ms per tick on a laptop).
