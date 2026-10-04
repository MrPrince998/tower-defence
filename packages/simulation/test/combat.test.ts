import { parseMap } from '@maze/shared';
import { damageAfterArmor } from '../src';
import { applySlow, isSlowed } from '../src/systems/StatusSystem';
import { findTarget } from '../src/systems/TargetingSystem';
import { enemy, field, newSim, runTicks } from './helpers';

describe('damage and armor', () => {
  it('armor reduces damage but at least 1 is dealt', () => {
    expect(damageAfterArmor(8, 0)).toBe(8);
    expect(damageAfterArmor(8, 5)).toBe(3);
    expect(damageAfterArmor(2, 8)).toBe(1);
  });

  it('an arrow hit on a tank deals 8 - 5 = 3', () => {
    const sim = newSim(field);
    sim.placeTower('p1', 'arrow', 2, 1);
    const id = sim.spawnEnemy('tank');
    const hp = enemy(sim, id)!.hp;
    let t = 0;
    while (enemy(sim, id)!.hp === hp && t++ < 100) sim.update();
    expect(hp - enemy(sim, id)!.hp).toBe(3);
  });
});

describe('frost slow', () => {
  it('slows by 40% and refreshes instead of stacking', () => {
    const sim = newSim(field);
    const id = sim.spawnEnemy('grunt');
    const world = sim.inspect() as ReturnType<typeof sim.inspect> & { tick: number };
    const e = enemy(sim, id)!;
    applySlow(world, e, 2);
    expect(e.slowUntilTick).toBe(world.tick + 40);
    applySlow(world, e, 2);
    expect(e.slowUntilTick).toBe(world.tick + 40); // no stacking
    runTicks(sim, 10);
    applySlow(world, e, 2);
    expect(e.slowUntilTick).toBe(world.tick + 40); // refreshed from now
    expect(isSlowed(world, e)).toBe(true);
    runTicks(sim, 41);
    expect(isSlowed(world, e)).toBe(false);
  });

  it('slowed enemies move at 60% speed', () => {
    const a = newSim(field);
    const b = newSim(field);
    const ia = a.spawnEnemy('grunt');
    const ib = b.spawnEnemy('grunt');
    a.update();
    b.update();
    applySlow(b.inspect(), enemy(b, ib)!, 10);
    const ax = enemy(a, ia)!.x;
    const bx = enemy(b, ib)!.x;
    runTicks(a, 20);
    runTicks(b, 20);
    expect((enemy(b, ib)!.x - bx) / (enemy(a, ia)!.x - ax)).toBeCloseTo(0.6);
  });

  it('frost projectiles apply the slow', () => {
    const sim = newSim(field);
    sim.placeTower('p1', 'frost', 2, 1);
    const id = sim.spawnEnemy('tank');
    runTicks(sim, 10);
    expect(sim.getSnapshot().enemies.find((e) => e.id === id)!.slowed).toBe(true);
  });
});

describe('cannon splash', () => {
  it('hits multiple ground enemies but never flyers', () => {
    const sim = newSim(field);
    sim.placeTower('p1', 'cannon', 2, 1);
    const g1 = sim.spawnEnemy('tank');
    const g2 = sim.spawnEnemy('tank');
    const f = sim.spawnEnemy('flyer');
    for (let i = 0; i < 20; i++) sim.update();
    expect(enemy(sim, g1)!.hp).toBeLessThan(enemy(sim, g1)!.maxHp);
    expect(enemy(sim, g2)!.hp).toBeLessThan(enemy(sim, g2)!.maxHp);
    expect(enemy(sim, f)!.hp).toBe(enemy(sim, f)!.maxHp);
  });

  it('cannons do not target flyers at all', () => {
    const sim = newSim(field);
    sim.placeTower('p1', 'cannon', 2, 1);
    sim.spawnEnemy('flyer');
    runTicks(sim, 10);
    expect(sim.getSnapshot().projectiles).toHaveLength(0);
  });

  it('splash still explodes at the last position when the target already died', () => {
    const sim = newSim(field);
    sim.placeTower('p1', 'cannon', 2, 1);
    const a = sim.spawnEnemy('tank');
    const b = sim.spawnEnemy('tank');
    sim.update(); // cannon fires at one of them
    expect(sim.getSnapshot().projectiles).toHaveLength(1);
    const target = sim.inspect().projectiles[0].targetId;
    enemy(sim, target)!.hp = 0.0001; // will die to anything; mark as dying next tick
    enemy(sim, target)!.hp = 0;
    const other = target === a ? b : a;
    runTicks(sim, 5);
    expect(enemy(sim, other)!.hp).toBeLessThan(enemy(sim, other)!.maxHp);
  });
});

describe('support aura', () => {
  it('buffs towers in range; two supports do not stack', () => {
    const sim = newSim(field, { difficulty: 'easy' });
    sim.placeTower('p1', 'arrow', 4, 0);
    sim.placeTower('p1', 'support', 5, 0);
    sim.update();
    const towers = sim.inspect().towers;
    const arrow = [...towers.values()].find((t) => t.type === 'arrow')!;
    expect(arrow.damageMult).toBeCloseTo(1.2);
    expect(arrow.rangeMult).toBeCloseTo(1.1);
    sim.inspect().gold += 500;
    sim.placeTower('p1', 'support', 3, 0);
    sim.placeTower('p1', 'arrow', 10, 4); // far away
    sim.update();
    expect(arrow.damageMult).toBeCloseTo(1.2);
    const far = [...towers.values()].find((t) => t.x === 10)!;
    expect(far.damageMult).toBe(1);
    const supports = [...towers.values()].filter((t) => t.type === 'support');
    expect(supports.every((s) => s.damageMult === 1)).toBe(true);
    for (const s of supports) sim.sellTower(s.id);
    sim.update();
    expect(arrow.damageMult).toBe(1);
  });
});

describe('upgrades and targeting modes', () => {
  it('upgrade cost and stats match the design', () => {
    const sim = newSim(field);
    sim.inspect().gold = 1000;
    sim.placeTower('p1', 'arrow', 4, 0);
    const id = sim.getTowers()[0].id;
    expect(sim.upgradeTower('p1', id)).toEqual({ ok: true });
    expect(sim.gold).toBe(1000 - 50 - 75);
    expect(sim.upgradeTower('p1', id)).toEqual({ ok: false, code: 'BRANCH_REQUIRED' });
    expect(sim.upgradeTower('p1', id, 'a')).toEqual({ ok: true });
    expect(sim.getTowers()[0].branch).toBe('a');
    expect(sim.upgradeTower('p1', id, 'b')).toEqual({ ok: true }); // branch is fixed after level 3
    expect(sim.getTowers()[0].branch).toBe('a');
    expect(sim.gold).toBe(1000 - 50 - 75 - 113 - 169);
    expect(sim.getTowers()[0].level).toBe(4);
    expect(sim.upgradeTower('p1', id)).toEqual({ ok: false, code: 'MAX_LEVEL' });
    expect(sim.upgradeTower('p1', 999)).toEqual({ ok: false, code: 'TOWER_NOT_FOUND' });
    expect(sim.getStats()[0]).toMatchObject({ goldSpent: 50 + 75 + 113 + 169, towersBuilt: 1 });
  });

  it('rejects upgrades without enough gold', () => {
    const sim = newSim(field);
    sim.placeTower('p1', 'sniper', 4, 0);
    expect(sim.upgradeTower('p1', sim.getTowers()[0].id)).toEqual({ ok: false, code: 'NOT_ENOUGH_GOLD' });
  });

  it('selects first / last / strongest / closest', () => {
    const map = parseMap('open', 'Open', ['.........', 'S.......G', '.........']);
    const sim = newSim(map);
    sim.placeTower('p1', 'sniper', 4, 0);
    const world = sim.inspect();
    const tower = [...world.towers.values()][0];
    const ids = [sim.spawnEnemy('grunt'), sim.spawnEnemy('grunt'), sim.spawnEnemy('grunt')];
    const [a, b, c] = ids.map((id) => enemy(sim, id)!);
    Object.assign(a, { x: 1.5, y: 1.5, remaining: 7, hp: 10 });
    Object.assign(b, { x: 4.5, y: 1.5, remaining: 4, hp: 30 });
    Object.assign(c, { x: 7.5, y: 1.5, remaining: 1, hp: 20 });
    world.hash.rebuild(world.enemies);
    const pick = (mode: typeof tower.targetMode) => {
      tower.targetMode = mode;
      return findTarget(world, tower)?.id;
    };
    expect(pick('first')).toBe(c.id);
    expect(pick('last')).toBe(a.id);
    expect(pick('strongest')).toBe(b.id);
    expect(pick('closest')).toBe(b.id);
  });

  it('sniper defaults to strongest; setTarget changes mode and emits an event', () => {
    const sim = newSim(field);
    sim.placeTower('p1', 'sniper', 4, 0);
    const t = sim.getTowers()[0];
    expect(t.targetMode).toBe('strongest');
    sim.drainEvents();
    expect(sim.setTargetMode(t.id, 'closest')).toEqual({ ok: true });
    expect(sim.getTowers()[0].targetMode).toBe('closest');
    expect(sim.drainEvents()).toEqual([{ t: 'tower_target', id: t.id, mode: 'closest' }]);
    expect(sim.setTargetMode(99, 'first')).toEqual({ ok: false, code: 'TOWER_NOT_FOUND' });
  });

  it('retargets when the target leaves range', () => {
    const sim = newSim(field);
    sim.placeTower('p1', 'arrow', 1, 1);
    sim.spawnEnemy('runner');
    runTicks(sim, 3);
    const tower = [...sim.inspect().towers.values()][0];
    expect(tower.targetId).not.toBeNull();
    runTicks(sim, 60); // runner is long gone out of range (or dead)
    expect(tower.targetId).toBeNull();
  });
});

describe('kills, rewards and flyers', () => {
  it('kills pay the reward to the shared pool and credit the tower owner', () => {
    const sim = newSim(field, { players: ['p1', 'p2'] });
    sim.placeTower('p2', 'arrow', 2, 1);
    const id = sim.spawnEnemy('grunt');
    const gold = sim.gold;
    let killed = false;
    for (let i = 0; i < 200 && !killed; i++) {
      sim.update();
      killed = sim.drainEvents().some((e) => e.t === 'enemy_killed' && e.id === id);
    }
    expect(killed).toBe(true);
    expect(sim.gold).toBe(gold + 5);
    const p2 = sim.getStats().find((s) => s.userId === 'p2')!;
    expect(p2).toMatchObject({ kills: 1, damageDealt: 40 });
  });

  it('projectiles aimed at an enemy that died do not crash and vanish on arrival', () => {
    const sim = newSim(field);
    sim.placeTower('p1', 'arrow', 2, 1);
    sim.placeTower('p1', 'arrow', 2, 3);
    const id = sim.spawnEnemy('grunt');
    sim.update();
    enemy(sim, id)!.hp = 1;
    expect(() => runTicks(sim, 20)).not.toThrow();
    expect(enemy(sim, id)).toBeUndefined();
    runTicks(sim, 20);
    expect(sim.getSnapshot().projectiles).toHaveLength(0);
  });

  it('flyers ignore the maze and fly straight to the goal', () => {
    const sim = newSim(field, { difficulty: 'easy' });
    for (const y of [1, 2, 3]) sim.placeTower('p1', 'support', 5, y);
    sim.spawnEnemy('flyer');
    let ticks = 0;
    for (let i = 1; i <= 400; i++) {
      sim.update();
      if (sim.drainEvents().some((e) => e.t === 'enemy_leaked')) {
        ticks = i;
        break;
      }
    }
    expect(Math.abs(ticks - 110)).toBeLessThanOrEqual(1); // 11 tiles at 2 t/s
  });
});
