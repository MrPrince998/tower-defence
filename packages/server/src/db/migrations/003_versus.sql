-- Versus mode: matches have a mode; players get a final placement and a count of enemies they sent.
ALTER TABLE matches ADD COLUMN mode VARCHAR(8) NOT NULL DEFAULT 'solo' CHECK (mode IN ('solo', 'versus'));
ALTER TABLE match_players ADD COLUMN placement INT;
ALTER TABLE match_players ADD COLUMN enemies_sent INT NOT NULL DEFAULT 0;

DROP INDEX idx_matches_leaderboard;
CREATE INDEX idx_matches_leaderboard ON matches (mode, map_id, difficulty, waves_reached DESC, duration_sec ASC);
CREATE INDEX idx_match_players_placement ON match_players (placement) WHERE placement = 1;
