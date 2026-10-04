/**
 * Repository tests against a real Postgres (TEST_DATABASE_URL: CI service container, or the embedded
 * Postgres started by test/setup/globalSetup.cjs).
 */
import pg from 'pg';
import { MAPS, type PlayerStats } from '@maze/shared';
import { migrate } from '../src/db/migrate';
import { createPgRepositories } from '../src/db/repositories/pg';
import type { MatchInput, Repositories } from '../src/db/repositories/types';

let pool: pg.Pool;
let repos: Repositories;

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const ran = await migrate(pool);
  expect(ran).toEqual(['001_users_maps.sql', '002_matches.sql', '003_versus.sql']);
  expect(await migrate(pool)).toEqual([]); // idempotent
  repos = createPgRepositories(pool);
});

afterAll(async () => {
  await pool?.end();
});

async function user(name: string) {
  const u = await repos.users.create({
    username: name,
    email: `${name.toLowerCase()}@test.io`,
    passwordHash: 'hash',
  });
  if (u === 'duplicate') throw new Error('dup');
  return u;
}

const stat = (userId: string, extra: Partial<PlayerStats> = {}): PlayerStats => ({
  userId,
  kills: 0,
  damageDealt: 0,
  goldSpent: 0,
  towersBuilt: 0,
  enemiesSent: 0,
  placement: null,
  ...extra,
});

const match = (extra: Partial<MatchInput>): MatchInput => ({
  mode: 'solo',
  mapId: 'meadow',
  difficulty: 'normal',
  result: 'lose',
  wavesReached: 1,
  durationSec: 1,
  seed: 1,
  startedAt: new Date(),
  endedAt: new Date(),
  players: [],
  ...extra,
});

describe('PgUserRepository', () => {
  it('creates users, rejects duplicates, finds by login or id', async () => {
    const u = await user('Zed');
    expect(await repos.users.create({ username: 'zed', email: 'z2@test.io', passwordHash: 'h' })).toBe(
      'duplicate',
    ); // case-insensitive
    expect(await repos.users.create({ username: 'Zed2', email: 'zed@test.io', passwordHash: 'h' })).toBe(
      'duplicate',
    );
    expect((await repos.users.findByLogin('zed@test.io'))?.id).toBe(u.id);
    expect((await repos.users.findById(u.id))?.username).toBe('Zed');
    expect(await repos.users.findById('not-a-uuid')).toBeNull();
    expect(await repos.users.findByLogin('nobody')).toBeNull();
  });
});

describe('PgMatchRepository', () => {
  it('saves one matches row and one match_players row per player, in a transaction', async () => {
    const a = await user('alpha');
    const b = await user('beta');
    const id = await repos.matches.saveMatch(
      match({
        mode: 'versus',
        result: 'win',
        wavesReached: 14,
        durationSec: 800,
        seed: 12345,
        players: [
          stat(a.id, {
            kills: 40,
            damageDealt: 1234.6,
            goldSpent: 900,
            towersBuilt: 8,
            enemiesSent: 12,
            placement: 1,
          }),
          stat(b.id, {
            kills: 22,
            damageDealt: 800,
            goldSpent: 500,
            towersBuilt: 5,
            enemiesSent: 3,
            placement: 2,
          }),
        ],
      }),
    );
    const m = await pool.query('SELECT * FROM matches WHERE id = $1', [id]);
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0].mode).toBe('versus');
    const mp = await pool.query('SELECT * FROM match_players WHERE match_id = $1 ORDER BY kills DESC', [id]);
    expect(mp.rows.map((r) => [r.kills, Number(r.damage_dealt), r.placement, r.enemies_sent])).toEqual([
      [40, 1235, 1, 12],
      [22, 800, 2, 3],
    ]);

    // A bad player row rolls back the whole match.
    const before = (await pool.query('SELECT COUNT(*)::int AS n FROM matches')).rows[0].n;
    await expect(
      repos.matches.saveMatch(match({ players: [stat('00000000-0000-0000-0000-000000000000')] })),
    ).rejects.toThrow();
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM matches')).rows[0].n).toBe(before);
    await expect(
      repos.matches.saveMatch(match({ mode: 'coop' as never, players: [stat(a.id)] })),
    ).rejects.toThrow();
  });

  it('solo leaderboard orders by waves DESC, duration ASC and ignores versus games; profile and history', async () => {
    const c = await user('gamma');
    let clock = Date.now() - 60_000; // distinct end times so history order is deterministic
    const save = (waves: number, dur: number, result: 'win' | 'lose' = 'lose') =>
      repos.matches.saveMatch(
        match({
          endedAt: new Date((clock += 1000)),
          mapId: 'canyon',
          difficulty: 'hard',
          result,
          wavesReached: waves,
          durationSec: dur,
          players: [stat(c.id, { kills: waves, damageDealt: 10, goldSpent: 1, towersBuilt: 1 })],
        }),
      );
    await save(10, 300);
    await save(30, 2000, 'win');
    await save(10, 250);
    await repos.matches.saveMatch(
      match({
        mode: 'versus',
        mapId: 'canyon',
        difficulty: 'hard',
        wavesReached: 99,
        endedAt: new Date((clock += 1000)),
        players: [stat(c.id, { placement: 1 })],
      }),
    );
    const lb = await repos.matches.leaderboard('canyon', 'hard', 50, 0);
    expect(lb.map((e) => [e.wavesReached, e.durationSec])).toEqual([
      [30, 2000],
      [10, 250],
      [10, 300],
    ]);
    expect(lb[0]).toMatchObject({ players: ['gamma'], result: 'win' });
    expect(await repos.matches.leaderboard('canyon', 'hard', 1, 2)).toHaveLength(1);
    expect(await repos.matches.leaderboard('canyon', 'easy', 50, 0)).toEqual([]);

    expect(await repos.matches.profile(c.id)).toMatchObject({
      games: 3,
      wins: 1,
      kills: 50,
      bestWave: 30,
      damageDealt: 30,
      versusGames: 1,
      versusWins: 1,
    });
    expect(await repos.matches.profile('bad')).toBeNull();
    const hist = await repos.matches.history(c.id, 2, 0);
    expect(hist).toHaveLength(2);
    expect(hist[0]).toMatchObject({ mode: 'versus', placement: 1, mapId: 'canyon', players: ['gamma'] });
    expect(hist[1]).toMatchObject({ mode: 'solo', placement: null, enemiesSent: 0 });
    expect(await repos.matches.history('bad', 5, 0)).toEqual([]);
  });

  it('versus leaderboard ranks by wins, then fewer games', async () => {
    const [x, y, z] = [await user('xavi'), await user('yuki'), await user('zora')];
    const game = (placements: [string, number][]) =>
      repos.matches.saveMatch(
        match({
          mode: 'versus',
          result: 'win',
          players: placements.map(([id, placement]) => stat(id, { placement, enemiesSent: 2 })),
        }),
      );
    await game([
      [x.id, 1],
      [y.id, 2],
      [z.id, 3],
    ]);
    await game([
      [y.id, 1],
      [x.id, 2],
    ]);
    await game([
      [y.id, 1],
      [z.id, 2],
    ]);
    const lb = (await repos.matches.versusLeaderboard(50, 0)).filter((e) =>
      [x.id, y.id, z.id].includes(e.userId),
    );
    expect(lb.map((e) => [e.username, e.wins, e.games, e.enemiesSent])).toEqual([
      ['yuki', 2, 3, 6],
      ['xavi', 1, 2, 4],
      ['zora', 0, 2, 4],
    ]);
    expect(await repos.matches.versusLeaderboard(1, 0)).toHaveLength(1);
  });

  it('built-in maps are seeded', async () => {
    const { rows } = await pool.query('SELECT id, width, height FROM maps ORDER BY id');
    expect(rows).toEqual(
      Object.values(MAPS)
        .map((m) => ({ id: m.id, width: m.width, height: m.height }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
  });
});
