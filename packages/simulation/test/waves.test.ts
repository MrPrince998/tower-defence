import { ENEMIES, GAME, MAPS, waveBudget, WAVES } from '@maze/shared';
import { GameSimulation, generateWave, Rng, unlockedTypes, waveCost } from '../src';
import { field, newSim, runTicks } from './helpers';

describe('wave generator', () => {
  it('same seed generates the same wave list', () => {
    const a = new Rng(123);
    const b = new Rng(123);
    for (let w = 1; w <= 30; w++) expect(generateWave(w, a)).toEqual(generateWave(w, b));
  });

  it('never exceeds 1.1x the budget and spends it down below the cheapest unit', () => {
    for (const seed of [1, 2, 3, 99]) {
      const rng = new Rng(seed);
      for (let w = 1; w <= 60; w++) {
        const list = generateWave(w, rng);
        const budget = waveBudget(w) * (w % 10 === 0 ? WAVES.BOSS_BUDGET_FRACTION : 1);
        const cost = waveCost(list);
        expect(cost).toBeLessThanOrEqual(budget * 1.1);
        const cheapest = Math.min(...unlockedTypes(w).map((t) => ENEMIES[t].budgetCost));
        expect(budget - cost).toBeLessThan(cheapest);
      }
    }
  });

  it('respects unlock waves', () => {
    const rng = new Rng(5);
    for (let w = 1; w <= 12; w++) {
      const list = generateWave(w, rng);
      if (w < 3) expect(list.every((t) => t === 'grunt')).toBe(true);
      if (w < 5) expect(list).not.toContain('tank');
      if (w < 7) expect(list).not.toContain('flyer');
    }
    expect(unlockedTypes(7)).toEqual(['grunt', 'runner', 'tank', 'flyer']);
  });

  it('every 10th wave spawns exactly one boss', () => {
    for (const seed of [1, 7, 42, 1000]) {
      const rng = new Rng(seed);
      for (let w = 1; w <= 30; w++) {
        const bosses = generateWave(w, rng).filter((t) => t === 'boss').length;
        expect(bosses).toBe(w % 10 === 0 ? 1 : 0);
      }
    }
  });
});

describe('wave system', () => {
  it('runs a 30 s build phase, then spawns round-robin over spawns', () => {
    const sim = new GameSimulation({ map: MAPS.meadow, seed: 1 });
    expect(sim.getSnapshot()).toMatchObject({ wave: 0, waveState: 'building', nextWaveIn: 30 });
    expect(sim.getSnapshot().nextWave).toMatchObject({ wave: 1, boss: false });
    runTicks(sim, 30 * GAME.TICK_RATE - 1);
    expect(sim.waveState).toBe('building');
    sim.update();
    expect(sim.drainEvents()).toContainEqual({ t: 'wave_started', wave: 1, boss: false });
    const spawnYs = sim.inspect().enemies.map((e) => Math.floor(e.y));
    expect(spawnYs).toEqual([3]); // first enemy on spawn 0
    runTicks(sim, 16); // 0.8 s later: second enemy on spawn 1
    expect(sim.inspect().enemies.map((e) => e.id)).toHaveLength(2);
    expect(sim.inspect().enemies[1].y).toBeCloseTo(10.5);
  });

  it('clears the wave when every enemy is gone and pays the bonus, then builds for 10 s', () => {
    const sim = newSim(field, { waves: true });
    sim.skipWave();
    const w = sim.inspect();
    runTicks(sim, 20);
    expect(w.waves.state).toBe('spawning');
    for (const e of w.enemies) e.hp = 0;
    w.waves.queue.length = 0;
    const gold = sim.gold;
    runTicks(sim, 2);
    expect(sim.drainEvents()).toContainEqual({ t: 'wave_cleared', wave: 1, bonus: 22 });
    expect(sim.gold).toBeGreaterThanOrEqual(gold + 22);
    expect(sim.getSnapshot()).toMatchObject({ waveState: 'building' });
    expect(sim.getSnapshot().nextWaveIn).toBeCloseTo(10, 0);
  });

  it('skip gives 1 gold per remaining build second', () => {
    const sim = newSim(field, { waves: true });
    runTicks(sim, 20 * 5 + 10); // 5.5 s elapsed -> 24.5 s left -> 24 gold
    const gold = sim.gold;
    expect(sim.applyCommand('p1', { kind: 'skipWave' })).toEqual({ ok: true });
    expect(sim.gold).toBe(gold + 24);
    expect(sim.wave).toBe(1);
    expect(sim.applyCommand('p1', { kind: 'skipWave' })).toEqual({ ok: false, code: 'CANNOT_SKIP' });
  });

  it('cannot skip into a boss wave; wave 10 spawns exactly one boss', () => {
    const sim = newSim(field, { waves: true });
    const w = sim.inspect();
    w.waves.wave = 9;
    w.waves.nextList = generateWave(10, w.rng);
    expect(sim.skipWave()).toEqual({ ok: false, code: 'CANNOT_SKIP' });
    w.waves.buildTimer = 0.01;
    runTicks(sim, 200);
    const bossCount = w.enemies.filter((e) => e.type === 'boss').length;
    expect(bossCount).toBe(1);
  });

  it('clearing wave 30 wins the game', () => {
    const sim = newSim(field, { waves: true });
    const w = sim.inspect();
    Object.assign(w.waves, { wave: 30, state: 'active', queue: [] });
    sim.update();
    expect(sim.isOver).toBe(true);
    expect(sim.getGameOver()).toMatchObject({ result: 'win', wavesReached: 30 });
  });

  it('difficulty sets start gold and base HP and scales enemy HP', () => {
    const easy = newSim(field, { difficulty: 'easy' });
    const hard = newSim(field, { difficulty: 'hard' });
    expect([easy.gold, easy.baseHp, hard.gold, hard.baseHp]).toEqual([300, 30, 150, 10]);
    easy.spawnEnemy('grunt');
    hard.spawnEnemy('grunt');
    expect(easy.getSnapshot().enemies[0].maxHp).toBe(32);
    expect(hard.getSnapshot().enemies[0].maxHp).toBe(52);
  });
});
