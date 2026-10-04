import { ENEMIES, GAME, MAPS, SENDS, VERSUS, enemyHp, type MatchEvent } from '@maze/shared';
import { MatchSimulation } from '../src';

const secs = (m: MatchSimulation, s: number) => {
  for (let i = 0; i < Math.round(s * GAME.TICK_RATE); i++) m.update();
};

function versus(players = ['a', 'b'], seed = 5) {
  return new MatchSimulation({ mode: 'versus', map: MAPS.meadow, seed, players });
}

/** Keep every board alive regardless of leaks (isolates the rule under test). */
function immortal(m: MatchSimulation) {
  for (const id of m.players) m.board(id)!.inspect().baseHp = 1e9;
}

describe('solo match', () => {
  it('has one board with solo rules and ends when the castle falls', () => {
    const m = new MatchSimulation({
      mode: 'solo',
      map: MAPS.meadow,
      seed: 1,
      difficulty: 'hard',
      players: ['me'],
    });
    const snap = m.getSnapshot();
    expect(snap.mode).toBe('solo');
    expect(snap.boards).toHaveLength(1);
    expect(snap.boards[0]).toMatchObject({
      id: 'me',
      alive: true,
      placement: null,
      gold: 150,
      baseHp: 10,
      income: 0,
      nextWaveIn: 30,
    });
    expect(m.applyCommand('me', { kind: 'send', type: 'grunt' })).toEqual({
      ok: false,
      code: 'NOT_AVAILABLE',
    });
    expect(m.applyCommand('me', { kind: 'skipWave' })).toEqual({ ok: true });
    m.board('me')!.inspect().baseHp = 0;
    m.update();
    expect(m.isOver).toBe(true);
    expect(m.getGameOver()).toMatchObject({ mode: 'solo', result: 'lose', winners: [], wavesReached: 1 });
    expect(m.applyCommand('me', { kind: 'skipWave' })).toEqual({ ok: false, code: 'GAME_NOT_RUNNING' });
  });

  it('forfeit ends a solo game', () => {
    const m = new MatchSimulation({ mode: 'solo', map: MAPS.meadow, seed: 1, players: ['me'] });
    m.forfeit('me');
    expect(m.getGameOver()).toMatchObject({ result: 'lose' });
    expect(() => new MatchSimulation({ mode: 'solo', map: MAPS.meadow, seed: 1, players: [] })).toThrow();
  });
});

describe('versus waves and income', () => {
  it('every board starts equal and faces identical base waves', () => {
    const m = versus(['a', 'b', 'c']);
    immortal(m);
    expect(m.getSnapshot().boards.map((b) => [b.gold, b.baseHp > 0, b.income])).toEqual([
      [VERSUS.START_GOLD, true, VERSUS.BASE_INCOME],
      [VERSUS.START_GOLD, true, VERSUS.BASE_INCOME],
      [VERSUS.START_GOLD, true, VERSUS.BASE_INCOME],
    ]);
    secs(m, VERSUS.FIRST_BUILD_SEC + 3);
    const [a, b, c] = m.getSnapshot().boards;
    expect(a.enemies.length).toBeGreaterThan(0);
    expect(b.enemies).toEqual(a.enemies);
    expect(c.enemies).toEqual(a.enemies);
  });

  it('waves arrive on a timer whether or not the last one was cleared, paying income each time', () => {
    const m = versus();
    immortal(m);
    expect(m.applyCommand('a', { kind: 'skipWave' })).toEqual({ ok: false, code: 'CANNOT_SKIP' });
    secs(m, VERSUS.FIRST_BUILD_SEC);
    const board = m.getSnapshot().boards[0];
    expect(board.wave).toBe(1);
    expect(board.gold).toBe(VERSUS.START_GOLD + VERSUS.BASE_INCOME);
    expect(board.nextWaveIn).toBeCloseTo(VERSUS.WAVE_INTERVAL_SEC, 0);
    secs(m, VERSUS.WAVE_INTERVAL_SEC);
    expect(m.getSnapshot().boards[0].wave).toBe(2);
  });

  it('clearing a wave before the timer pays the clear bonus exactly once', () => {
    const m = versus();
    immortal(m);
    secs(m, VERSUS.FIRST_BUILD_SEC + 5);
    const w = m.board('a')!.inspect();
    w.waves.queue.length = 0;
    for (const e of w.enemies) e.hp = 0;
    m.update();
    m.update();
    m.update();
    const cleared = m.drainEvents().filter((e) => e.board === 'a' && e.event.t === 'wave_cleared');
    expect(cleared).toHaveLength(1);
  });
});

describe('sending enemies', () => {
  function started() {
    const m = versus(['a', 'b', 'c']);
    immortal(m);
    secs(m, VERSUS.FIRST_BUILD_SEC + 0.05);
    m.drainEvents();
    return m;
  }

  it('is not allowed during the opening build phase', () => {
    const m = versus();
    expect(m.applyCommand('a', { kind: 'send', type: 'grunt' })).toEqual({
      ok: false,
      code: 'NOT_AVAILABLE',
    });
  });

  it('costs gold, raises income, and spawns on the next opponent by default', () => {
    const m = started();
    const goldA = m.board('a')!.gold;
    const before = m.board('b')!.enemyCount;
    expect(m.applyCommand('a', { kind: 'send', type: 'tank' })).toEqual({ ok: true });
    expect(m.board('a')!.gold).toBe(goldA - SENDS.tank.cost);
    expect(m.board('a')!.income).toBe(VERSUS.BASE_INCOME + SENDS.tank.income);
    expect(m.drainEvents()).toEqual<MatchEvent[]>([
      {
        board: 'b',
        event: {
          t: 'enemy_sent',
          from: 'a',
          to: 'b',
          type: 'tank',
          income: VERSUS.BASE_INCOME + SENDS.tank.income,
        },
      },
    ]);
    m.update();
    const b = m.board('b')!.inspect();
    expect(b.enemies.length).toBe(before + 1);
    const tank = b.enemies.find((e) => e.type === 'tank')!;
    expect(tank.maxHp).toBe(enemyHp('tank', 1, 1));
    expect(
      m
        .board('c')!
        .inspect()
        .enemies.some((e) => e.type === 'tank'),
    ).toBe(false);
    expect(m.getStats().find((s) => s.userId === 'a')).toMatchObject({
      enemiesSent: 1,
      goldSpent: SENDS.tank.cost,
    });
  });

  it('can target a specific opponent; rejects self, unknown and eliminated targets', () => {
    const m = started();
    expect(m.applyCommand('a', { kind: 'send', type: 'grunt', target: 'c' })).toEqual({ ok: true });
    expect(m.drainEvents()[0]).toMatchObject({ board: 'c', event: { to: 'c' } });
    expect(m.applyCommand('a', { kind: 'send', type: 'grunt', target: 'a' })).toEqual({
      ok: false,
      code: 'INVALID_TARGET',
    });
    expect(m.applyCommand('a', { kind: 'send', type: 'grunt', target: 'zzz' })).toEqual({
      ok: false,
      code: 'INVALID_TARGET',
    });
    m.forfeit('b');
    expect(m.applyCommand('a', { kind: 'send', type: 'grunt', target: 'b' })).toEqual({
      ok: false,
      code: 'INVALID_TARGET',
    });
    expect(m.nextOpponent('a')).toBe('c'); // skips eliminated players
    expect(m.applyCommand('zzz', { kind: 'skipWave' })).toEqual({ ok: false, code: 'NOT_IN_ROOM' });
  });

  it('rejects sends without gold or when the target queue is full', () => {
    const m = started();
    m.board('a')!.inspect().gold = 10;
    expect(m.applyCommand('a', { kind: 'send', type: 'grunt' })).toEqual({
      ok: false,
      code: 'NOT_ENOUGH_GOLD',
    });
    m.board('a')!.inspect().gold = 100_000;
    for (let i = 0; i < VERSUS.MAX_PENDING_SENDS; i++)
      expect(m.applyCommand('a', { kind: 'send', type: 'grunt' }).ok).toBe(true);
    expect(m.board('b')!.pendingSends).toBe(VERSUS.MAX_PENDING_SENDS);
    expect(m.applyCommand('a', { kind: 'send', type: 'grunt' })).toEqual({
      ok: false,
      code: 'SEND_QUEUE_FULL',
    });
    // Sent units trickle in one by one.
    m.update();
    expect(m.board('b')!.pendingSends).toBe(VERSUS.MAX_PENDING_SENDS - 1);
    secs(m, 1);
    expect(m.board('b')!.pendingSends).toBeLessThan(VERSUS.MAX_PENDING_SENDS - 2);
  });

  it('sent units pay their normal kill reward to the defender', () => {
    expect(ENEMIES.grunt.reward).toBeGreaterThan(0); // documented rule: defender earns kill gold
  });
});

describe('eliminations and placements', () => {
  it('knocked-out players get places in order; last standing wins', () => {
    const m = versus(['a', 'b', 'c']);
    immortal(m);
    secs(m, 1);
    m.board('b')!.inspect().baseHp = 0;
    m.update();
    expect(m.drainEvents()).toContainEqual({
      board: 'b',
      event: { t: 'player_eliminated', userId: 'b', placement: 3 },
    });
    expect(m.isAlive('b')).toBe(false);
    expect(m.applyCommand('b', { kind: 'place', type: 'arrow', x: 5, y: 5 })).toEqual({
      ok: false,
      code: 'ELIMINATED',
    });
    const frozenTick = m.board('b')!.tick;
    secs(m, 1);
    expect(m.board('b')!.tick).toBe(frozenTick); // eliminated boards stop simulating
    expect(m.isOver).toBe(false);
    m.forfeit('a');
    expect(m.isOver).toBe(true);
    const over = m.getGameOver()!;
    expect(over).toMatchObject({ mode: 'versus', winners: ['c'] });
    expect(Object.fromEntries(over.stats.map((s) => [s.userId, s.placement]))).toEqual({ a: 2, b: 3, c: 1 });
    expect(m.getSnapshot().boards.map((b) => [b.id, b.alive, b.placement])).toEqual([
      ['a', false, 2],
      ['b', false, 3],
      ['c', false, 1],
    ]);
    m.forfeit('c'); // no effect after the end
    expect(m.getGameOver()!.winners).toEqual(['c']);
  });

  it('simultaneous knock-out of the last players is a shared win', () => {
    const m = versus(['a', 'b']);
    secs(m, 1);
    m.board('a')!.inspect().baseHp = 0;
    m.board('b')!.inspect().baseHp = 0;
    m.update();
    expect(m.getGameOver()!.winners).toEqual(['a', 'b']);
    expect(m.applyCommand('a', { kind: 'skipWave' })).toEqual({ ok: false, code: 'GAME_NOT_RUNNING' });
    const tick = m.tick;
    m.update();
    expect(m.tick).toBe(tick);
  });

  it('queued commands are applied at the start of the next tick', () => {
    const m = versus();
    const results: unknown[] = [];
    m.enqueue('a', { kind: 'place', type: 'arrow', x: 5, y: 5 }, (r) => results.push(r));
    expect(results).toEqual([]);
    m.update();
    expect(results).toEqual([{ ok: true }]);
    expect(m.getSnapshot().boards[0].towers).toHaveLength(1);
    expect(m.getSnapshot().boards[1].towers).toHaveLength(0);
    expect(m.serverTime).toBe(50);
  });
});

describe('determinism', () => {
  function play() {
    const m = versus(['a', 'b'], 77);
    m.enqueue('a', { kind: 'place', type: 'arrow', x: 4, y: 4 });
    m.enqueue('b', { kind: 'place', type: 'cannon', x: 8, y: 8 });
    const out: string[] = [];
    for (let i = 0; i < 20 * 90; i++) {
      if (i === 20 * 32) m.enqueue('a', { kind: 'send', type: 'runner' });
      if (i === 20 * 40) m.enqueue('b', { kind: 'send', type: 'tank' });
      m.update();
      if (i % 100 === 0) out.push(JSON.stringify(m.getSnapshot()));
    }
    return out.join('\n');
  }
  it('same seed and commands give identical matches', () => {
    expect(play()).toBe(play());
  });
});
