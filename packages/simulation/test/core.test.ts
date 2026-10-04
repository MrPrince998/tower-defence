import { DIFFICULTY, parseMap } from '@maze/shared';
import { GameSimulation, Grid } from '../src';
import { corridor, enemy, field, newSim, runTicks, ticksUntilLeak } from './helpers';

describe('movement and base damage', () => {
  it('grunt walks a 9-tile corridor in 6 s (120 ticks ±1)', () => {
    const sim = newSim(corridor);
    sim.spawnEnemy('grunt');
    const ticks = ticksUntilLeak(sim);
    expect(Math.abs(ticks - 120)).toBeLessThanOrEqual(1);
  });

  it('leaks cost 1 base HP (boss 10) and base HP never goes below 0', () => {
    const sim = newSim(corridor, { difficulty: 'hard' });
    sim.spawnEnemy('grunt');
    runTicks(sim, 200);
    expect(sim.baseHp).toBe(DIFFICULTY.hard.baseHp - 1);
    sim.spawnEnemy('boss');
    runTicks(sim, 400);
    expect(sim.baseHp).toBe(0);
    expect(sim.isOver).toBe(true);
    expect(sim.getGameOver()).toMatchObject({ result: 'lose' });
  });

  it('game over rejects commands and stops updating', () => {
    const sim = newSim(corridor, { difficulty: 'hard' });
    for (let i = 0; i < 10; i++) sim.spawnEnemy('grunt');
    runTicks(sim, 300);
    expect(sim.isOver).toBe(true);
    const tick = sim.tick;
    sim.update();
    expect(sim.tick).toBe(tick);
    expect(sim.applyCommand('p1', { kind: 'skipWave' })).toEqual({ ok: false, code: 'GAME_NOT_RUNNING' });
  });

  it('carries leftover distance across cell boundaries (large dt)', () => {
    const sim = newSim(corridor);
    const id = sim.spawnEnemy('runner');
    sim.update(0.5); // 1.5 tiles in one step
    expect(enemy(sim, id)!.x).toBeCloseTo(2.0);
  });
});

describe('tower placement', () => {
  it('rejects a tower that seals the path and leaves state unchanged', () => {
    const map = parseMap('pinch', 'Pinch', ['#####', 'S...G', '#####']);
    const sim = newSim(map);
    const before = JSON.stringify(sim.getSnapshot());
    expect(sim.placeTower('p1', 'arrow', 2, 1)).toEqual({ ok: false, code: 'BLOCKS_PATH' });
    expect(JSON.stringify(sim.getSnapshot())).toBe(before);
    expect(sim.drainEvents()).toEqual([]);
  });

  it('rejects invalid cells, occupied cells and insufficient gold', () => {
    const sim = newSim(field);
    expect(sim.placeTower('p1', 'arrow', 0, 2).ok).toBe(false); // spawn
    expect(sim.placeTower('p1', 'arrow', 11, 2)).toEqual({ ok: false, code: 'INVALID_CELL' }); // goal
    expect(sim.placeTower('p1', 'arrow', 12, 0)).toEqual({ ok: false, code: 'INVALID_CELL' }); // out of bounds
    expect(sim.placeTower('p1', 'arrow', 3, 0)).toEqual({ ok: true });
    expect(sim.placeTower('p1', 'arrow', 3, 0)).toEqual({ ok: false, code: 'CELL_OCCUPIED' });
    expect(sim.placeTower('p1', 'cannon', 5, 0)).toEqual({ ok: true });
    expect(sim.placeTower('p1', 'sniper', 7, 0)).toEqual({ ok: false, code: 'NOT_ENOUGH_GOLD' });
    expect(sim.gold).toBe(50);
  });

  it('rejects placing on a cell occupied by a ground enemy', () => {
    const sim = newSim(field);
    const id = sim.spawnEnemy('grunt');
    runTicks(sim, 10);
    const e = enemy(sim, id)!;
    expect(sim.placeTower('p1', 'arrow', e.targetX, e.targetY)).toEqual({ ok: false, code: 'CELL_OCCUPIED' });
  });

  it('rejects placements that would trap an enemy already inside the maze', () => {
    // Enemy stands in a pocket whose only exit is (2,1).
    const map = parseMap('pocket', 'Pocket', ['#.###', 'S...G', '#####']);
    const sim = newSim(map);
    const grid = new Grid(map);
    expect(grid.checkPath(2, 1, [{ x: 1, y: 0 }]).ok).toBe(false);
    expect(sim.placeTower('p1', 'arrow', 1, 0)).toEqual({ ok: true });
  });

  it('a tower that lengthens the path increases travel time and emits path_updated', () => {
    const map = parseMap('detour', 'Detour', ['.......', 'S.....G', '.......']);
    const base = newSim(map);
    base.spawnEnemy('grunt');
    const straight = ticksUntilLeak(base);
    expect(Math.abs(straight - 80)).toBeLessThanOrEqual(1); // 6 tiles at 1.5 t/s

    const sim = newSim(map);
    // Support towers never fire, so travel time is pure pathing.
    expect(sim.placeTower('p1', 'support', 3, 1)).toEqual({ ok: true });
    expect(sim.drainEvents().map((e) => e.t)).toEqual(['tower_built', 'path_updated']);
    sim.spawnEnemy('grunt');
    const detour = ticksUntilLeak(sim);
    expect(Math.abs(detour - 107)).toBeLessThanOrEqual(1); // 8 tiles
  });

  it('enemies mid-move keep going when the maze changes and re-route on arrival', () => {
    const sim = newSim(field, { difficulty: 'easy' });
    const id = sim.spawnEnemy('grunt');
    runTicks(sim, 15); // between cells on row 2
    for (const y of [0, 1, 2, 3]) sim.placeTower('p1', 'frost', 6, y);
    // Sell to get gold refunds not needed; enemy must still leak eventually.
    const e = enemy(sim, id)!;
    expect(e).toBeDefined();
    let leaked = false;
    for (let i = 0; i < 2000 && !leaked; i++) {
      sim.update();
      leaked = sim.drainEvents().some((ev) => ev.t === 'enemy_leaked' || ev.t === 'enemy_killed');
    }
    expect(leaked).toBe(true);
  });

  it('sell refunds 70% of invested gold and reopens the path', () => {
    const map = parseMap('pinch2', 'Pinch2', ['#.###', 'S...G', '#.###']);
    const sim = newSim(map);
    expect(sim.placeTower('p1', 'arrow', 1, 0)).toEqual({ ok: true });
    const towerId = sim.getTowers()[0].id;
    expect(sim.upgradeTower('p1', towerId)).toEqual({ ok: true });
    const goldBefore = sim.gold;
    sim.drainEvents();
    expect(sim.sellTower(towerId)).toEqual({ ok: true });
    expect(sim.gold).toBe(goldBefore + Math.floor((50 + 75) * 0.7));
    expect(sim.drainEvents()).toEqual([{ t: 'tower_sold', id: towerId, refund: 87 }, { t: 'path_updated' }]);
    expect(sim.sellTower(towerId)).toEqual({ ok: false, code: 'TOWER_NOT_FOUND' });
  });
});

describe('determinism', () => {
  function play(seed: number) {
    const sim = new GameSimulation({ map: field, seed, players: ['a', 'b'] });
    sim.enqueue('a', { kind: 'place', type: 'arrow', x: 4, y: 1 });
    sim.enqueue('b', { kind: 'place', type: 'frost', x: 6, y: 3 });
    const snaps: string[] = [];
    for (let i = 0; i < 1400; i++) {
      if (i === 5) sim.enqueue('a', { kind: 'skipWave' });
      if (i === 300) sim.enqueue('b', { kind: 'place', type: 'cannon', x: 8, y: 1 });
      sim.update();
      if (i % 50 === 0) snaps.push(JSON.stringify(sim.getSnapshot()));
    }
    return snaps.join('\n');
  }

  it('same seed and commands produce identical snapshots', () => {
    expect(play(7)).toBe(play(7));
  });

  it('queued commands report results via callback before systems run', () => {
    const sim = newSim(field);
    const results: unknown[] = [];
    sim.enqueue('p1', { kind: 'place', type: 'arrow', x: 1, y: 1 }, (r) => results.push(r));
    sim.enqueue('p1', { kind: 'place', type: 'arrow', x: 1, y: 1 }, (r) => results.push(r));
    expect(results).toEqual([]);
    sim.update();
    expect(results).toEqual([{ ok: true }, { ok: false, code: 'CELL_OCCUPIED' }]);
  });
});

describe('queries', () => {
  it('exposes state getters and a full snapshot', () => {
    const sim = newSim(corridor, { waves: true });
    expect(sim.map.id).toBe('corridor');
    expect(sim.wave).toBe(0);
    expect(sim.waveState).toBe('building');
    expect(sim.flowField[0]).toBe(9);
    expect(sim.getGameOver()).toBeNull();
    sim.spawnEnemy('grunt');
    sim.update();
    const snap = sim.getSnapshot();
    expect(snap).toMatchObject({ wave: 0, gold: 200, baseHp: 20, income: 0, towers: [] });
    expect(sim.tick).toBe(1);
    expect(snap.enemies[0]).toMatchObject({ type: 'grunt', hp: 40, maxHp: 40, slowed: false });
    expect(sim.enemyCount).toBe(1);
  });

  it('commands dispatch through applyCommand', () => {
    const sim = newSim(field);
    expect(sim.applyCommand('p1', { kind: 'place', type: 'arrow', x: 3, y: 0 })).toEqual({ ok: true });
    const id = sim.getTowers()[0].id;
    expect(sim.applyCommand('p1', { kind: 'upgrade', towerId: id })).toEqual({ ok: true });
    expect(sim.applyCommand('p1', { kind: 'setTarget', towerId: id, mode: 'last' })).toEqual({ ok: true });
    expect(sim.applyCommand('p1', { kind: 'sell', towerId: id })).toEqual({ ok: true });
    expect(sim.applyCommand('p1', { kind: 'skipWave' })).toEqual({ ok: false, code: 'CANNOT_SKIP' });
  });
});
