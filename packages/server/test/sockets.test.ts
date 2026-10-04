import { VERSUS, type GameMode, type MatchEvent, type RoomState, type Snapshot } from '@maze/shared';
import { createMemoryRepositories } from '../src/db/repositories/memory';
import { emit, sleep, startServer, tokenFor, waitFor, type ClientSocket } from './helpers';

type Server = Awaited<ReturnType<typeof startServer>>;

async function startedGame(
  server: Server,
  ids: string[],
  mode: GameMode = ids.length > 1 ? 'versus' : 'solo',
) {
  const sockets: ClientSocket[] = [];
  for (const id of ids) sockets.push(await server.connect(id));
  const starts = sockets.map((s) => waitFor(s, 'game:start'));
  const created = await emit(sockets[0], 'room:create', { mode, mapId: 'meadow', difficulty: 'normal' });
  if (!created.ok) throw new Error(String(created.code));
  for (const s of sockets.slice(1))
    expect(await emit(s, 'room:join', { code: created.code as string })).toMatchObject({ ok: true });
  if (mode === 'versus') for (const s of sockets) await emit(s, 'room:ready', { ready: true });
  const payloads = await Promise.all(starts);
  return { sockets, roomId: created.roomId as string, code: created.code as string, payloads };
}

/** Skip the versus opening build phase so sends are allowed. */
function fastForwardToWave1(server: Server, roomId: string) {
  const game = server.coordinator.games.get(roomId)!;
  for (const id of game.sim.players) game.sim.board(id)!.inspect().waves.buildTimer = 0.01;
}

describe('sockets', () => {
  let server: Server;
  beforeEach(async () => {
    server = await startServer();
  });
  afterEach(async () => {
    await server.stop();
  });

  it('rejects connections with an invalid JWT', async () => {
    await expect(server.connect('x', 'not-a-token')).rejects.toThrow('UNAUTHORIZED');
    await expect(server.connect('x', '')).rejects.toThrow('UNAUTHORIZED');
  });

  it('solo games start immediately and hold one player', async () => {
    const { sockets, payloads, code } = await startedGame(server, ['solo1'], 'solo');
    expect(payloads[0].config).toMatchObject({ mode: 'solo', role: 'player' });
    expect(payloads[0].snapshot.boards.map((b) => b.id)).toEqual(['solo1']);
    const other = await server.connect('other');
    expect(await emit(other, 'room:join', { code })).toEqual({ ok: false, code: 'GAME_IN_PROGRESS' });
    expect(await emit(sockets[0], 'send:enemy', { type: 'grunt' })).toEqual({
      ok: false,
      code: 'NOT_AVAILABLE',
    });
  });

  it('versus: two users see ready state live; a single player cannot start', async () => {
    const a = await server.connect('alice');
    const b = await server.connect('bob');
    const created = await emit(a, 'room:create', { mode: 'versus', mapId: 'meadow', difficulty: 'easy' });
    expect(created).toMatchObject({ ok: true });
    expect(await emit(a, 'room:start', {})).toEqual({ ok: false, code: 'NOT_ENOUGH_PLAYERS' });
    await emit(a, 'room:ready', { ready: true });
    expect(server.rooms.get(created.roomId as string)!.status).toBe('lobby'); // one ready player is not enough
    const seen = waitFor(a, 'room:state', (s: RoomState) =>
      s.players.some((p) => p.userId === 'bob' && p.ready),
    );
    await emit(b, 'room:join', { code: (created.code as string).toLowerCase() });
    await emit(b, 'room:ready', { ready: true });
    const state = await seen;
    expect(state).toMatchObject({ mode: 'versus', hostId: 'alice' });
    expect(state.players.map((p) => p.userId)).toEqual(['alice', 'bob']);
    expect(server.metrics.players).toBe(2);
  });

  it('versus start: one board per player; both clients get identical events and snapshots', async () => {
    const { sockets, payloads } = await startedGame(server, ['a', 'b']);
    expect(payloads[0].seed).toBe(payloads[1].seed);
    expect(payloads[0].snapshot.boards.map((b) => [b.id, b.gold, b.income])).toEqual([
      ['a', VERSUS.START_GOLD, VERSUS.BASE_INCOME],
      ['b', VERSUS.START_GOLD, VERSUS.BASE_INCOME],
    ]);
    const events: MatchEvent[][] = [[], []];
    sockets.forEach((s, i) => s.on('game:event', (e) => events[i].push(e)));
    const snaps: Snapshot[][] = [[], []];
    sockets.forEach((s, i) => s.on('game:snapshot', (snap) => snaps[i].push(snap)));

    expect(await emit(sockets[0], 'tower:place', { type: 'arrow', x: 5, y: 5 })).toEqual({ ok: true });
    // Same cell on the *other* board is free: boards are independent.
    expect(await emit(sockets[1], 'tower:place', { type: 'arrow', x: 5, y: 5 })).toEqual({ ok: true });
    expect(await emit(sockets[1], 'wave:skip', {})).toEqual({ ok: false, code: 'CANNOT_SKIP' });
    await sleep(500);
    expect(events[0]).toEqual(events[1]);
    expect(
      events[0]
        .filter((e) => e.event.t === 'tower_built')
        .map((e) => e.board)
        .sort(),
    ).toEqual(['a', 'b']);
    const byTick = (list: Snapshot[]) => new Map(list.map((s) => [s.tick, JSON.stringify(s)]));
    const [m0, m1] = [byTick(snaps[0]), byTick(snaps[1])];
    let compared = 0;
    for (const [tick, s] of m0) {
      if (m1.has(tick)) {
        expect(m1.get(tick)).toBe(s);
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(2);
    const withTowers = snaps[0].find((s) => s.boards.some((b) => b.towers));
    expect(withTowers!.boards.find((b) => b.id === 'a')!.towers).toHaveLength(1);
  });

  it('versus: sending an enemy lands on the opponent board and raises income', async () => {
    const { sockets, roomId } = await startedGame(server, ['a', 'b']);
    expect(await emit(sockets[0], 'send:enemy', { type: 'grunt' })).toEqual({
      ok: false,
      code: 'NOT_AVAILABLE',
    });
    fastForwardToWave1(server, roomId);
    await sleep(150);
    const sent = waitFor(sockets[1], 'game:event', (e: MatchEvent) => e.event.t === 'enemy_sent');
    expect(await emit(sockets[0], 'send:enemy', { type: 'tank', target: 'b' })).toEqual({ ok: true });
    expect(await sent).toMatchObject({ board: 'b', event: { from: 'a', to: 'b', type: 'tank' } });
    expect(await emit(sockets[0], 'send:enemy', { type: 'grunt', target: 'a' })).toEqual({
      ok: false,
      code: 'INVALID_TARGET',
    });
    expect(await emit(sockets[0], 'send:enemy', { type: 'boss' } as never)).toEqual({
      ok: false,
      code: 'INVALID_PAYLOAD',
    });
    await sleep(150);
    const game = server.coordinator.games.get(roomId)!;
    expect(
      game.sim
        .board('b')!
        .inspect()
        .enemies.some((e) => e.type === 'tank'),
    ).toBe(true);
    expect(game.sim.board('a')!.income).toBeGreaterThan(VERSUS.BASE_INCOME);
  });

  it('rejects invalid payloads without crashing the loop', async () => {
    const { sockets } = await startedGame(server, ['a']);
    const s = sockets[0];
    expect(await emit(s, 'tower:place', { type: 'plasma', x: 1, y: 1 } as never)).toEqual({
      ok: false,
      code: 'INVALID_PAYLOAD',
    });
    expect(await emit(s, 'tower:place', { type: 'arrow', x: -3, y: 1 })).toEqual({
      ok: false,
      code: 'INVALID_PAYLOAD',
    });
    expect(await emit(s, 'tower:place', { type: 'arrow', x: 1, y: 1, gold: 1e9 } as never)).toEqual({
      ok: false,
      code: 'INVALID_PAYLOAD',
    });
    expect(await emit(s, 'tower:upgrade', null as never)).toEqual({ ok: false, code: 'INVALID_PAYLOAD' });
    expect(await emit(s, 'room:create', { mapId: 'meadow', difficulty: 'normal' } as never)).toEqual({
      ok: false,
      code: 'INVALID_PAYLOAD',
    });
    expect(await emit(s, 'tower:place', { type: 'arrow', x: 0, y: 3 })).toEqual({
      ok: false,
      code: 'INVALID_CELL',
    });
    expect(await emit(s, 'tower:sell', { towerId: 77 })).toEqual({ ok: false, code: 'TOWER_NOT_FOUND' });
    const snap = await waitFor(s, 'game:snapshot');
    expect(snap.tick).toBeGreaterThan(0);
  });

  it('commands from a user not in a room are rejected with NOT_IN_ROOM', async () => {
    const s = await server.connect('loner');
    expect(await emit(s, 'tower:place', { type: 'arrow', x: 1, y: 1 })).toEqual({
      ok: false,
      code: 'NOT_IN_ROOM',
    });
    expect(await emit(s, 'send:enemy', { type: 'grunt' })).toEqual({ ok: false, code: 'NOT_IN_ROOM' });
    expect(await emit(s, 'room:leave', {})).toEqual({ ok: false, code: 'NOT_IN_ROOM' });
    expect(await emit(s, 'room:reconnect', { roomId: 'nope' })).toEqual({ ok: false, code: 'NOT_IN_ROOM' });
  });

  it('rate limits to 10 commands per second per socket', async () => {
    const s = await server.connect('spammer');
    const results = await Promise.all(Array.from({ length: 14 }, () => emit(s, 'wave:skip', {})));
    expect(results.filter((r) => !r.ok && r.code === 'RATE_LIMITED').length).toBeGreaterThanOrEqual(4);
  });

  it('spectators receive every board but their commands are rejected', async () => {
    const { code } = await startedGame(server, ['p1', 'p2']);
    const spec = await server.connect('watcher');
    const start = waitFor(spec, 'game:start');
    expect(await emit(spec, 'room:spectate', { code })).toMatchObject({ ok: true });
    const payload = await start;
    expect(payload.config.role).toBe('spectator');
    expect(payload.snapshot.boards).toHaveLength(2);
    expect(await emit(spec, 'tower:place', { type: 'arrow', x: 3, y: 3 })).toEqual({
      ok: false,
      code: 'SPECTATOR',
    });
    expect(await emit(spec, 'send:enemy', { type: 'grunt' })).toEqual({ ok: false, code: 'SPECTATOR' });
    expect(await emit(spec, 'room:join', { code })).toEqual({ ok: false, code: 'ALREADY_IN_ROOM' });
  });

  it('reconnect after a dropped socket restores the same state', async () => {
    const { sockets, roomId } = await startedGame(server, ['a', 'b']);
    await emit(sockets[0], 'tower:place', { type: 'frost', x: 6, y: 6 });
    sockets[0].disconnect();
    const bSees = await waitFor(sockets[1], 'room:state', (s: RoomState) =>
      s.players.some((p) => p.userId === 'a' && !p.connected),
    );
    expect(bSees.status).toBe('running');
    const again = await server.connect('a');
    const start = waitFor(again, 'game:start');
    expect(await emit(again, 'room:reconnect', { roomId })).toEqual({ ok: true, roomId });
    const payload = await start;
    const mine = payload.snapshot.boards.find((b) => b.id === 'a')!;
    expect(mine.towers).toEqual([expect.objectContaining({ type: 'frost', x: 6, y: 6, owner: 'a' })]);
    expect(await emit(again, 'tower:place', { type: 'arrow', x: 4, y: 2 })).toEqual({ ok: true });
  });

  it('pauses when everyone disconnects and resumes on reconnect', async () => {
    const { sockets, roomId } = await startedGame(server, ['solo']);
    sockets[0].disconnect();
    await sleep(100);
    const room = server.rooms.get(roomId)!;
    expect(room.status).toBe('paused');
    const tick = server.coordinator.games.get(roomId)!.sim.tick;
    await sleep(150);
    expect(server.coordinator.games.get(roomId)!.sim.tick).toBe(tick);
    const again = await server.connect('solo');
    await emit(again, 'room:reconnect', { roomId });
    expect(room.status).toBe('running');
    await sleep(150);
    expect(server.coordinator.games.get(roomId)!.sim.tick).toBeGreaterThan(tick);
  });

  it('destroys a paused room after the timeout (60 s, scaled)', async () => {
    const { sockets, roomId } = await startedGame(server, ['gone']);
    sockets[0].disconnect();
    await sleep(900); // 60 s / 100
    expect(server.rooms.get(roomId)).toBeUndefined();
    expect(server.coordinator.games.size).toBe(0);
  });

  it('host can force start with 2+ players; leaving a lobby transfers host', async () => {
    const a = await server.connect('h1');
    const b = await server.connect('h2');
    const c = await server.connect('h3');
    const created = await emit(a, 'room:create', { mode: 'versus', mapId: 'canyon', difficulty: 'hard' });
    await emit(b, 'room:join', { code: created.code as string });
    await emit(c, 'room:join', { code: created.code as string });
    expect(await emit(b, 'room:start', {})).toEqual({ ok: false, code: 'NOT_HOST' });
    await emit(a, 'room:leave', {});
    expect(server.rooms.get(created.roomId as string)!.hostId).toBe('h2');
    const start = waitFor(b, 'game:start');
    expect(await emit(b, 'room:start', {})).toEqual({ ok: true });
    expect((await start).map.id).toBe('canyon');
    expect(await emit(a, 'room:create', { mode: 'solo', mapId: 'nowhere', difficulty: 'hard' })).toEqual({
      ok: false,
      code: 'INVALID_PAYLOAD',
    });
  });

  it('tower branches and perk choices go through the socket', async () => {
    const { sockets, roomId } = await startedGame(server, ['brancher']);
    const s = sockets[0];
    const board = server.coordinator.games.get(roomId)!.sim.board('brancher')!;
    board.inspect().gold = 10_000;
    expect(await emit(s, 'tower:place', { type: 'tesla', x: 5, y: 5 })).toEqual({ ok: true });
    const id = board.getTowers()[0].id;
    expect(await emit(s, 'tower:upgrade', { towerId: id })).toEqual({ ok: true });
    expect(await emit(s, 'tower:upgrade', { towerId: id })).toEqual({ ok: false, code: 'BRANCH_REQUIRED' });
    expect(await emit(s, 'tower:upgrade', { towerId: id, branch: 'b' })).toEqual({ ok: true });
    expect(board.getTowers()[0]).toMatchObject({ level: 3, branch: 'b' });
    expect(await emit(s, 'perk:choose', { perk: 'fortify' })).toEqual({ ok: false, code: 'NO_PERK_OFFER' });
    board.inspect().perkOffers = [['fortify', 'masonry', 'bounty']];
    expect(await emit(s, 'perk:choose', { perk: 'bounty' })).toEqual({ ok: true });
    expect(await emit(s, 'perk:choose', { perk: 'cheat' } as never)).toEqual({
      ok: false,
      code: 'INVALID_PAYLOAD',
    });
  });

  it('chat is broadcast to the room', async () => {
    const { sockets } = await startedGame(server, ['a', 'b']);
    const chat = waitFor(sockets[0], 'chat:message');
    await emit(sockets[1], 'chat:send', { text: ' gg ' });
    expect(await chat).toMatchObject({ name: 'b', text: 'gg' });
  });
});

describe('game over', () => {
  async function seededUsers(names: string[]) {
    const repos = createMemoryRepositories();
    for (const name of names)
      await repos.users.create({ username: name, email: `${name}@x.io`, passwordHash: 'x' });
    const ids = [...repos.users.users.values()].map((u) => u.id);
    return { repos, ids };
  }

  it('versus: leaving forfeits; last standing wins; one match row with placements is saved', async () => {
    const { repos, ids } = await seededUsers(['p1', 'p2', 'p3']);
    const server = await startServer({ repos });
    try {
      const socks = [];
      for (const [i, id] of ids.entries()) socks.push(await server.connect(id, tokenFor(id, `p${i + 1}`)));
      const created = await emit(socks[0], 'room:create', {
        mode: 'versus',
        mapId: 'meadow',
        difficulty: 'normal',
      });
      for (const s of socks.slice(1)) await emit(s, 'room:join', { code: created.code as string });
      const started = Promise.all(socks.map((s) => waitFor(s, 'game:start')));
      for (const s of socks) await emit(s, 'room:ready', { ready: true });
      await started;
      const roomId = created.roomId as string;
      const game = server.coordinator.games.get(roomId)!;
      for (const id of ids) game.sim.board(id)!.inspect().waves.buildTimer = 0.01;
      await sleep(150);
      await emit(socks[0], 'tower:place', { type: 'arrow', x: 3, y: 3 });
      await emit(socks[0], 'send:enemy', { type: 'runner' });

      // p3's castle falls; p2 leaves (forfeit) → p1 wins.
      const eliminated = waitFor(
        socks[0],
        'game:event',
        (e: MatchEvent) => e.event.t === 'player_eliminated',
      );
      game.sim.board(ids[2])!.inspect().baseHp = 0;
      expect(await eliminated).toMatchObject({ event: { userId: ids[2], placement: 3 } });
      const over = waitFor(socks[0], 'game:over');
      expect(await emit(socks[1], 'room:leave', {})).toEqual({ ok: true });
      const payload = await over;
      expect(payload).toMatchObject({ mode: 'versus', winners: [ids[0]] });
      await sleep(50);
      expect(repos.matches.matches).toHaveLength(1);
      const saved = repos.matches.matches[0];
      expect(saved.mode).toBe('versus');
      expect(Object.fromEntries(saved.players.map((p) => [p.userId, p.placement]))).toEqual({
        [ids[0]]: 1,
        [ids[1]]: 2,
        [ids[2]]: 3,
      });
      expect(saved.players.find((p) => p.userId === ids[0])!.enemiesSent).toBe(1);
      expect(server.rooms.get(roomId)!.status).toBe('ended');
      expect(
        await emit(socks[0], 'room:create', { mode: 'solo', mapId: 'meadow', difficulty: 'easy' }),
      ).toMatchObject({
        ok: true,
      });
    } finally {
      await server.stop();
    }
  });

  it('solo: castle falls → game:over lose, saved with mode solo', async () => {
    const { repos, ids } = await seededUsers(['lonely']);
    const server = await startServer({ repos });
    try {
      const s = await server.connect(ids[0], tokenFor(ids[0], 'lonely'));
      const started = waitFor(s, 'game:start');
      const created = await emit(s, 'room:create', { mode: 'solo', mapId: 'meadow', difficulty: 'normal' });
      await started;
      await emit(s, 'wave:skip', {});
      await sleep(150);
      const over = waitFor(s, 'game:over');
      server.coordinator.games
        .get(created.roomId as string)!
        .sim.board(ids[0])!
        .inspect().baseHp = 0;
      expect(await over).toMatchObject({ mode: 'solo', result: 'lose' });
      await sleep(50);
      expect(repos.matches.matches).toHaveLength(1);
      expect(repos.matches.matches[0]).toMatchObject({ mode: 'solo', wavesReached: 1 });
    } finally {
      await server.stop();
    }
  });

  it('a failing save is retried once and never crashes the room', async () => {
    const repos = createMemoryRepositories();
    let calls = 0;
    repos.matches.saveMatch = async () => {
      calls++;
      throw new Error('db down');
    };
    const server = await startServer({ repos });
    try {
      const s = await server.connect('u1');
      const started = waitFor(s, 'game:start');
      const created = await emit(s, 'room:create', { mode: 'solo', mapId: 'meadow', difficulty: 'normal' });
      await started;
      const over = waitFor(s, 'game:over');
      server.coordinator.games
        .get(created.roomId as string)!
        .sim.board('u1')!
        .inspect().baseHp = 0;
      await over;
      await sleep(50);
      expect(calls).toBe(2);
      expect(await emit(s, 'room:leave', {})).toEqual({ ok: true });
    } finally {
      await server.stop();
    }
  });
});
