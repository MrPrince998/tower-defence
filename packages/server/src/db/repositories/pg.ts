import pg from 'pg';
import type {
  Difficulty,
  LeaderboardEntry,
  MatchHistoryEntry,
  ProfileStats,
  VersusLeaderboardEntry,
} from '@maze/shared';
import type { MatchInput, MatchRepository, Repositories, UserRecord, UserRepository } from './types';

interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

const toUser = (r: UserRow): UserRecord => ({
  id: r.id,
  username: r.username,
  email: r.email,
  passwordHash: r.password_hash,
  createdAt: r.created_at,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: pg.Pool) {}

  async create(input: {
    username: string;
    email: string;
    passwordHash: string;
  }): Promise<UserRecord | 'duplicate'> {
    try {
      const { rows } = await this.pool.query<UserRow>(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
        [input.username, input.email, input.passwordHash],
      );
      return toUser(rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') return 'duplicate';
      throw err;
    }
  }

  async findByLogin(login: string): Promise<UserRecord | null> {
    const { rows } = await this.pool.query<UserRow>(
      'SELECT * FROM users WHERE lower(username) = lower($1) OR email = lower($1) LIMIT 1',
      [login],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    if (!UUID_RE.test(id)) return null;
    const { rows } = await this.pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ? toUser(rows[0]) : null;
  }
}

export class PgMatchRepository implements MatchRepository {
  constructor(private readonly pool: pg.Pool) {}

  /** Match row + all match_players rows in one transaction. */
  async saveMatch(m: MatchInput): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO matches (mode, map_id, difficulty, result, waves_reached, duration_sec, seed, started_at, ended_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          m.mode,
          m.mapId,
          m.difficulty,
          m.result,
          m.wavesReached,
          m.durationSec,
          m.seed,
          m.startedAt,
          m.endedAt,
        ],
      );
      const matchId = rows[0].id;
      for (const p of m.players) {
        await client.query(
          `INSERT INTO match_players
             (match_id, user_id, kills, damage_dealt, gold_spent, towers_built, placement, enemies_sent)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            matchId,
            p.userId,
            p.kills,
            Math.round(p.damageDealt),
            p.goldSpent,
            p.towersBuilt,
            p.placement,
            p.enemiesSent,
          ],
        );
      }
      await client.query('COMMIT');
      return matchId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async leaderboard(
    mapId: string,
    difficulty: Difficulty,
    limit: number,
    offset: number,
  ): Promise<LeaderboardEntry[]> {
    const { rows } = await this.pool.query(
      `SELECT m.id, m.waves_reached, m.duration_sec, m.result, m.ended_at,
              array_agg(u.username ORDER BY u.username) AS players
       FROM matches m
       JOIN match_players mp ON mp.match_id = m.id
       JOIN users u ON u.id = mp.user_id
       WHERE m.mode = 'solo' AND m.map_id = $1 AND m.difficulty = $2
       GROUP BY m.id
       ORDER BY m.waves_reached DESC, m.duration_sec ASC, m.ended_at ASC
       LIMIT $3 OFFSET $4`,
      [mapId, difficulty, limit, offset],
    );
    return rows.map((r) => ({
      id: r.id,
      wavesReached: r.waves_reached,
      durationSec: r.duration_sec,
      result: r.result,
      endedAt: new Date(r.ended_at).toISOString(),
      players: r.players,
    }));
  }

  async versusLeaderboard(limit: number, offset: number): Promise<VersusLeaderboardEntry[]> {
    const { rows } = await this.pool.query(
      `SELECT u.id, u.username,
              COUNT(*) FILTER (WHERE mp.placement = 1)::int AS wins,
              COUNT(*)::int AS games,
              COALESCE(SUM(mp.enemies_sent), 0)::int AS enemies_sent
       FROM match_players mp
       JOIN matches m ON m.id = mp.match_id
       JOIN users u ON u.id = mp.user_id
       WHERE m.mode = 'versus'
       GROUP BY u.id, u.username
       ORDER BY wins DESC, games ASC, u.username ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return rows.map((r) => ({
      userId: r.id,
      username: r.username,
      wins: r.wins,
      games: r.games,
      enemiesSent: r.enemies_sent,
    }));
  }

  async profile(userId: string): Promise<ProfileStats | null> {
    if (!UUID_RE.test(userId)) return null;
    const user = await this.pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
    if (!user.rows[0]) return null;
    const { rows } = await this.pool.query(
      `SELECT COUNT(*) FILTER (WHERE m.mode = 'solo')::int AS games,
              COUNT(*) FILTER (WHERE m.mode = 'solo' AND m.result = 'win')::int AS wins,
              COALESCE(MAX(m.waves_reached) FILTER (WHERE m.mode = 'solo'), 0)::int AS best_wave,
              COUNT(*) FILTER (WHERE m.mode = 'versus')::int AS versus_games,
              COUNT(*) FILTER (WHERE m.mode = 'versus' AND mp.placement = 1)::int AS versus_wins,
              COALESCE(SUM(mp.kills), 0)::int AS kills,
              COALESCE(SUM(mp.damage_dealt), 0)::bigint AS damage
       FROM match_players mp JOIN matches m ON m.id = mp.match_id WHERE mp.user_id = $1`,
      [userId],
    );
    const r = rows[0];
    const u = user.rows[0];
    return {
      user: { id: u.id, username: u.username, createdAt: u.created_at.toISOString() },
      games: r.games,
      wins: r.wins,
      kills: r.kills,
      damageDealt: Number(r.damage),
      bestWave: r.best_wave,
      versusGames: r.versus_games,
      versusWins: r.versus_wins,
    };
  }

  async history(userId: string, limit: number, offset: number): Promise<MatchHistoryEntry[]> {
    if (!UUID_RE.test(userId)) return [];
    const { rows } = await this.pool.query(
      `SELECT m.id, m.mode, m.map_id, m.difficulty, m.result, m.waves_reached, m.duration_sec, m.ended_at,
              mp.kills, mp.damage_dealt, mp.gold_spent, mp.towers_built, mp.placement, mp.enemies_sent,
              (SELECT array_agg(u.username ORDER BY u.username)
                 FROM match_players mp2 JOIN users u ON u.id = mp2.user_id
                WHERE mp2.match_id = m.id) AS players
       FROM match_players mp JOIN matches m ON m.id = mp.match_id
       WHERE mp.user_id = $1
       ORDER BY m.ended_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    return rows.map((r) => ({
      id: r.id,
      mode: r.mode,
      placement: r.placement,
      enemiesSent: r.enemies_sent,
      mapId: r.map_id,
      difficulty: r.difficulty,
      result: r.result,
      wavesReached: r.waves_reached,
      durationSec: r.duration_sec,
      endedAt: new Date(r.ended_at).toISOString(),
      kills: r.kills,
      damageDealt: Number(r.damage_dealt),
      goldSpent: r.gold_spent,
      towersBuilt: r.towers_built,
      players: r.players,
    }));
  }
}

export function createPgRepositories(pool: pg.Pool): Repositories {
  return {
    kind: 'postgres',
    users: new PgUserRepository(pool),
    matches: new PgMatchRepository(pool),
    close: () => pool.end(),
  };
}
