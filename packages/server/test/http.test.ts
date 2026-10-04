import request from 'supertest';
import { createMemoryRepositories } from '../src/db/repositories/memory';
import { createServer } from './serverFactory';

describe('REST API', () => {
  const repos = createMemoryRepositories();
  const server = createServer({ repos, authRateLimit: 1000 });
  const app = server.app;
  afterAll(() => server.close());

  it('GET /health reports status and metrics', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', rooms: 0, players: 0, db: 'memory' });
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff'); // helmet
  });

  it('register → login → /me', async () => {
    const reg = await request(app)
      .post('/auth/register')
      .send({ username: 'alice', email: 'Alice@Example.com', password: 'hunter22!' })
      .expect(201);
    expect(reg.body.user).toMatchObject({ username: 'alice', email: 'alice@example.com' });
    expect(reg.body.user.passwordHash).toBeUndefined();
    const stored = await repos.users.findByLogin('alice');
    expect(stored!.passwordHash).toMatch(/^\$2[aby]\$/);

    const login = await request(app)
      .post('/auth/login')
      .send({ login: 'ALICE', password: 'hunter22!' })
      .expect(200);
    const me = await request(app).get('/me').set('Authorization', `Bearer ${login.body.token}`).expect(200);
    expect(me.body.username).toBe('alice');
    await request(app)
      .post('/auth/login')
      .send({ login: 'alice@example.com', password: 'hunter22!' })
      .expect(200);
  });

  it('rejects duplicates, bad credentials, invalid bodies and bad tokens', async () => {
    await request(app)
      .post('/auth/register')
      .send({ username: 'bob', email: 'bob@x.io', password: 'password1' })
      .expect(201);
    await request(app)
      .post('/auth/register')
      .send({ username: 'BOB', email: 'other@x.io', password: 'password1' })
      .expect(409);
    await request(app)
      .post('/auth/register')
      .send({ username: 'b', email: 'nope', password: '1' })
      .expect(400);
    await request(app)
      .post('/auth/register')
      .send({ username: 'carl', email: 'c@x.io', password: 'password1', admin: true })
      .expect(400);
    await request(app).post('/auth/login').send({ login: 'bob', password: 'wrong-pass' }).expect(401);
    await request(app).post('/auth/login').send({ login: 'ghost', password: 'whatever' }).expect(401);
    await request(app).get('/me').expect(401);
    await request(app).get('/me').set('Authorization', 'Bearer garbage').expect(401);
    await request(app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{bad json')
      .expect(400);
    await request(app).get('/nope').expect(404);
  });

  it('leaderboard, profile and history', async () => {
    const a = await repos.users.create({ username: 'p1', email: 'p1@x.io', passwordHash: 'x' });
    const b = await repos.users.create({ username: 'p2', email: 'p2@x.io', passwordHash: 'x' });
    if (a === 'duplicate' || b === 'duplicate') throw new Error();
    const base = {
      mode: 'solo' as const,
      mapId: 'meadow',
      difficulty: 'normal' as const,
      seed: 1,
      startedAt: new Date(),
      endedAt: new Date(),
    };
    const stat = (userId: string, kills: number, placement: number | null = null) => ({
      userId,
      kills,
      damageDealt: 100,
      goldSpent: 50,
      towersBuilt: 1,
      enemiesSent: placement ? 3 : 0,
      placement,
    });
    await repos.matches.saveMatch({
      ...base,
      result: 'lose',
      wavesReached: 12,
      durationSec: 500,
      players: [stat(a.id, 10), stat(b.id, 5)],
    });
    await repos.matches.saveMatch({
      ...base,
      result: 'lose',
      wavesReached: 15,
      durationSec: 900,
      players: [stat(a.id, 20)],
    });
    await repos.matches.saveMatch({
      ...base,
      result: 'lose',
      wavesReached: 15,
      durationSec: 700,
      players: [stat(b.id, 1)],
    });

    const lb = await request(app).get('/leaderboard?mapId=meadow&difficulty=normal').expect(200);
    expect(
      lb.body.entries.map((e: { wavesReached: number; durationSec: number }) => [
        e.wavesReached,
        e.durationSec,
      ]),
    ).toEqual([
      [15, 700],
      [15, 900],
      [12, 500],
    ]);
    expect(lb.body.entries[2].players).toEqual(['p1', 'p2']);
    const page = await request(app).get('/leaderboard?limit=1&offset=1').expect(200);
    expect(page.body.entries[0].durationSec).toBe(900);
    await request(app).get('/leaderboard?difficulty=insane').expect(400);

    // Versus games do not appear on the solo board; they have their own ranking by wins.
    const versus = {
      ...base,
      mode: 'versus' as const,
      result: 'win' as const,
      wavesReached: 40,
      durationSec: 60,
    };
    await repos.matches.saveMatch({ ...versus, players: [stat(a.id, 1, 2), stat(b.id, 1, 1)] });
    await repos.matches.saveMatch({ ...versus, players: [stat(a.id, 1, 1), stat(b.id, 1, 2)] });
    await repos.matches.saveMatch({ ...versus, players: [stat(a.id, 1, 1), stat(b.id, 1, 2)] });
    const again = await request(app).get('/leaderboard?mapId=meadow&difficulty=normal').expect(200);
    expect(again.body.entries).toHaveLength(3);
    const vs = await request(app).get('/leaderboard?mode=versus').expect(200);
    expect(vs.body.mode).toBe('versus');
    expect(
      vs.body.entries.map((e: { username: string; wins: number; games: number }) => [
        e.username,
        e.wins,
        e.games,
      ]),
    ).toEqual([
      ['p1', 2, 3],
      ['p2', 1, 3],
    ]);
    await request(app).get('/leaderboard?mode=coop').expect(400);

    const prof = await request(app).get(`/users/${a.id}/profile`).expect(200);
    expect(prof.body).toMatchObject({
      games: 2,
      kills: 33,
      bestWave: 15,
      wins: 0,
      versusGames: 3,
      versusWins: 2,
    });
    await request(app).get('/users/not-a-user/profile').expect(404);

    const login = await request(app)
      .post('/auth/register')
      .send({ username: 'hist', email: 'h@x.io', password: 'password1' });
    const hist = await request(app)
      .get('/me/matches')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
    expect(hist.body.matches).toEqual([]);
  });
});
