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
  cells     JSONB NOT NULL,
  spawns    JSONB NOT NULL,
  goal      JSONB NOT NULL
);

-- Usernames are unique regardless of case ("Bob" and "bob" are the same player).
CREATE UNIQUE INDEX idx_users_username_lower ON users (lower(username));
