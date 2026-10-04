# 04 — Database (PostgreSQL)

Live game state is NOT stored in Postgres. Only accounts, finished matches, stats, and leaderboards.

## Schema
```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(24) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE maps (
  id        VARCHAR(32) PRIMARY KEY,
  name      VARCHAR(64) NOT NULL,
  width     INT NOT NULL,
  height    INT NOT NULL,
  cells     JSONB NOT NULL,          -- number[]; see MapData in 03-PROTOCOL.md
  spawns    JSONB NOT NULL,
  goal      JSONB NOT NULL
);

CREATE TABLE matches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id        VARCHAR(32) NOT NULL REFERENCES maps(id),
  difficulty    VARCHAR(8)  NOT NULL CHECK (difficulty IN ('easy','normal','hard')),
  result        VARCHAR(4)  NOT NULL CHECK (result IN ('win','lose')),
  waves_reached INT NOT NULL,
  duration_sec  INT NOT NULL,
  seed          BIGINT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL,
  ended_at      TIMESTAMPTZ NOT NULL
);

CREATE TABLE match_players (
  match_id      UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  kills         INT NOT NULL DEFAULT 0,
  damage_dealt  BIGINT NOT NULL DEFAULT 0,
  gold_spent    INT NOT NULL DEFAULT 0,
  towers_built  INT NOT NULL DEFAULT 0,
  PRIMARY KEY (match_id, user_id)
);

CREATE TABLE match_commands (       -- optional, for replays (stretch)
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  tick     INT NOT NULL,
  user_id  UUID NOT NULL,
  command  JSONB NOT NULL
);

CREATE INDEX idx_matches_leaderboard ON matches (map_id, difficulty, waves_reached DESC, duration_sec ASC);
CREATE INDEX idx_match_players_user ON match_players (user_id);
CREATE INDEX idx_match_commands_match ON match_commands (match_id, tick);
```

## Key queries
Leaderboard (per map + difficulty):
```sql
SELECT m.id, m.waves_reached, m.duration_sec, m.ended_at,
       array_agg(u.username) AS players
FROM matches m
JOIN match_players mp ON mp.match_id = m.id
JOIN users u ON u.id = mp.user_id
WHERE m.map_id = $1 AND m.difficulty = $2
GROUP BY m.id
ORDER BY m.waves_reached DESC, m.duration_sec ASC
LIMIT 50;
```
Player profile stats:
```sql
SELECT COUNT(*) AS games, SUM(kills) AS kills, MAX(m.waves_reached) AS best_wave
FROM match_players mp JOIN matches m ON m.id = mp.match_id WHERE mp.user_id = $1;
```

## Rules
- Use `pg` with parameterized queries only (no string concatenation)
- Migrations in `packages/server/src/db/migrations/NNN_name.sql`, run by a small runner script
- Persist a match inside one transaction (match + all match_players)
- Passwords hashed with `bcrypt` (cost 12); JWT expiry 7 days
