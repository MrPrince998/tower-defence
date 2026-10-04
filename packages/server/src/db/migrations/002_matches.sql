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

CREATE TABLE match_commands (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  tick     INT NOT NULL,
  user_id  UUID NOT NULL,
  command  JSONB NOT NULL
);

CREATE INDEX idx_matches_leaderboard ON matches (map_id, difficulty, waves_reached DESC, duration_sec ASC);
CREATE INDEX idx_match_players_user ON match_players (user_id);
CREATE INDEX idx_match_commands_match ON match_commands (match_id, tick);
