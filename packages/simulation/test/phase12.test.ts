import { ENEMIES, enemyHp, MAPS, parseMap, PERK_RULES, SENDS, TOWERS, VERSUS } from '@maze/shared';
import { MatchSimulation } from '../src';
import { enemy, field, newSim, runTicks } from './helpers';

const open = parseMap('open', 'Open', ['..........', '..........', 'S........G', '..........', '..........']);

function towerOf(sim: ReturnType<typeof newSim>) {
  return [...sim.inspect().towers.values()][0];
}

describe('new enemies', () => {
  it('healer restores HP to nearby enemies (not itself), capped at max HP', () => {
    const sim = newSim(field);
    const h = sim.spawnEnemy('healer');
    const g = sim.spawnEnemy('grunt');
    enemy(sim, g)!.hp = 10;
    enemy(sim, h)!.hp = 10;
    runTicks(sim, 21); // one pulse after 1 s
    expect(enemy(sim, g)!.hp).toBeCloseTo(10 + 40 * ENEMIES.healer.heal!.pct);
    expect(enemy(sim, h)!.hp).toBe(10);
    enemy(sim, g)!.hp = 39.9;
    runTicks(sim, 21);
    expect(enemy(sim, g)!.hp).toBe(40);
  });

  it('splitter bursts into 3 runners at its position that keep walking to the goal', () => {
    const sim = newSim(field);
    const id = sim.spawnEnemy('splitter');
    runTicks(sim, 30);
    const before = enemy(sim, id)!;
    const pos = { x: before.x, y: before.y };
    before.hp = 0;
    sim.update();
    const runners = sim.inspect().enemies.filter((e) => e.type === 'runner');
    expect(runners).toHaveLength(3);
    for (const r of runners) {
      expect(Math.hypot(r.x - pos.x, r.y - pos.y)).toBeLessThan(0.3);
      expect(r.maxHp).toBe(enemyHp('runner', 1, 1));
    }
    expect(sim.drainEvents()).toContainEqual(expect.objectContaining({ t: 'enemy_split', count: 3 }));
    let leaks = 0;
    for (let i = 0; i < 600; i++) {
      sim.update();
      leaks += sim.drainEvents().filter((e) => e.t === 'enemy_leaked').length;
    }
    expect(leaks).toBe(3);
  });

  it('knight shield absorbs damage before HP', () => {
    const sim = newSim(field);
    const id = sim.spawnEnemy('shielded');
    const k = enemy(sim, id)!;
    expect(k.shield).toBe(70);
    sim.placeTower('p1', 'sniper', 2, 1); // 80 dmg - 2 armor = 78: 70 to shield, 8 to hp
    let t = 0;
    while (k.shield === 70 && t++ < 100) sim.update();
    expect(k.shield).toBe(0);
    expect(k.hp).toBe(80 - 8);
    expect(sim.getSnapshot().enemies[0]).toMatchObject({ shield: 0, maxShield: 70 });
  });

  it('boss summons grunts every 8 s and enrages once below half HP', () => {
    const sim = newSim(open, { difficulty: 'easy' });
    const id = sim.spawnEnemy('boss');
    runTicks(sim, 8 * 20);
    expect(sim.inspect().enemies.filter((e) => e.type === 'grunt')).toHaveLength(2);
    const events = sim.drainEvents();
    expect(events).toContainEqual(expect.objectContaining({ t: 'boss_ability', ability: 'summon', id }));
    const boss = enemy(sim, id)!;
    const speed = boss.speed;
    boss.hp = boss.maxHp * 0.4;
    sim.update();
    expect(boss.enraged).toBe(true);
    expect(boss.shield).toBe(Math.round(boss.maxHp * 0.3));
    expect(boss.speed).toBeCloseTo(speed * 1.25);
    expect(sim.drainEvents()).toContainEqual(expect.objectContaining({ ability: 'enrage' }));
    sim.update();
    expect(boss.shield).toBe(Math.round(boss.maxHp * 0.3)); // only once
  });

  it('new enemies appear in waves after their unlock wave', () => {
    const sim = newSim(field, { waves: true });
    const w = sim.inspect();
    const seen = new Set<string>();
    for (let wave = 1; wave <= 20; wave++) for (const t of generateFor(w.rng, wave)) seen.add(t);
    expect(seen.has('healer')).toBe(true);
    expect(seen.has('splitter')).toBe(true);
    expect(seen.has('shielded')).toBe(true);
  });
});

import { generateWave, Rng } from '../src';
function generateFor(rng: Rng, wave: number) {
  return generateWave(wave, rng);
}

describe('new towers', () => {
  it('laser ramps up damage while it holds one target', () => {
    const sim = newSim(open);
    sim.inspect().gold = 1000;
    sim.placeTower('p1', 'laser', 3, 1);
    const id = sim.spawnEnemy('tank');
    const tank = enemy(sim, id)!;
    tank.hp = tank.maxHp = 1e6;
    runTicks(sim, 5);
    const early = 1e6 - tank.hp;
    runTicks(sim, 60);
    const t = towerOf(sim);
    expect(t.ramp).toBeGreaterThan(2);
    const before = tank.hp;
    runTicks(sim, 5);
    expect(before - tank.hp).toBeGreaterThan(early * 1.8);
    expect(sim.getSnapshot().beams).toEqual([t.id, id]);
  });

  it('laser Split Beam hits two targets', () => {
    const sim = newSim(open);
    sim.inspect().gold = 10_000;
    sim.placeTower('p1', 'laser', 3, 1);
    const t = towerOf(sim);
    sim.upgradeTower('p1', t.id);
    sim.upgradeTower('p1', t.id, 'b');
    const a = sim.spawnEnemy('tank');
    const b = sim.spawnEnemy('tank');
    for (const id of [a, b]) enemy(sim, id)!.hp = enemy(sim, id)!.maxHp = 1e6;
    runTicks(sim, 20);
    expect(sim.getSnapshot().beams).toHaveLength(4);
  });

  it('tesla chains to nearby enemies with falloff and emits a zap', () => {
    const sim = newSim(open);
    sim.inspect().gold = 1000;
    sim.placeTower('p1', 'tesla', 2, 1);
    const ids = [sim.spawnEnemy('grunt'), sim.spawnEnemy('grunt'), sim.spawnEnemy('grunt')];
    const es = ids.map((id) => enemy(sim, id)!);
    es.forEach((e, i) => Object.assign(e, { x: 2.5 + i, y: 2.5, hp: 1000, maxHp: 1000, speed: 0 }));
    sim.update();
    const zap = sim.drainEvents().find((e) => e.t === 'zap');
    expect(zap).toBeDefined();
    const dealt = es.map((e) => 1000 - e.hp).sort((x, y) => y - x);
    const base = TOWERS.tesla.damage;
    expect(dealt[0]).toBeCloseTo(base);
    expect(dealt[1]).toBeCloseTo(base * 0.75);
    expect(dealt[2]).toBeCloseTo(base * 0.75 * 0.75);
  });

  it('mine layer drops mines on the path; ground enemies set them off, flyers do not', () => {
    const sim = newSim(open);
    sim.inspect().gold = 1000;
    sim.placeTower('p1', 'mines', 4, 1);
    sim.update();
    const w = sim.inspect();
    expect(w.mines).toHaveLength(1);
    const m = w.mines[0];
    expect(m.y).toBe(2.5); // on the path row
    const f = sim.spawnEnemy('flyer');
    Object.assign(enemy(sim, f)!, { x: m.x, y: m.y, speed: 0 });
    sim.update();
    expect(w.mines.some((x) => x.id === m.id)).toBe(true);
    const g = sim.spawnEnemy('grunt');
    Object.assign(enemy(sim, g)!, { x: m.x, y: m.y, targetX: Math.floor(m.x), targetY: 2, speed: 0 });
    sim.update();
    expect(w.mines.some((x) => x.id === m.id)).toBe(false);
    expect(enemy(sim, g)).toBeUndefined(); // mine damage kills a 40 HP grunt
    expect(enemy(sim, f)!.hp).toBe(enemy(sim, f)!.maxHp);
    const events = sim.drainEvents();
    expect(events).toContainEqual(expect.objectContaining({ t: 'mine_exploded' }));
  });

  it('mine layers stop at their max and lose their mines when sold', () => {
    const sim = newSim(open);
    sim.inspect().gold = 1000;
    sim.placeTower('p1', 'mines', 4, 1);
    runTicks(sim, 20 * 30);
    expect(sim.inspect().mines).toHaveLength(4);
    sim.sellTower(towerOf(sim).id);
    expect(sim.inspect().mines).toHaveLength(0);
    expect(sim.getSnapshot().mines).toEqual([]);
  });

  it('barricade blocks the path, never attacks and cannot be upgraded', () => {
    const sim = newSim(field);
    expect(sim.placeTower('p1', 'barricade', 5, 2)).toEqual({ ok: true });
    expect(sim.gold).toBe(200 - 25);
    expect(sim.flowField[2 * 12 + 5]).toBeGreaterThan(1e5); // blocked
    expect(sim.upgradeTower('p1', towerOf(sim).id)).toEqual({ ok: false, code: 'MAX_LEVEL' });
  });
});

describe('tower branches', () => {
  function branched(
    type: Parameters<ReturnType<typeof newSim>['placeTower']>[1],
    branch: 'a' | 'b',
    map = open,
  ) {
    const sim = newSim(map);
    sim.inspect().gold = 100_000;
    sim.placeTower('p1', type, 3, 1);
    const t = towerOf(sim);
    sim.upgradeTower('p1', t.id);
    expect(sim.upgradeTower('p1', t.id, branch)).toEqual({ ok: true });
    return { sim, t };
  }

  it('Piercing arrows ignore armor', () => {
    const { sim } = branched('arrow', 'b');
    const id = sim.spawnEnemy('tank');
    const tank = enemy(sim, id)!;
    const hp = tank.hp;
    let i = 0;
    while (tank.hp === hp && i++ < 100) sim.update();
    expect(hp - tank.hp).toBeCloseTo(8 * 1.6 * 1.2); // no armor reduction
  });

  it('Rapid Fire arrows shoot 60% faster', () => {
    const count = (branch: 'a' | 'b') => {
      const { sim } = branched('arrow', branch);
      const id = sim.spawnEnemy('tank');
      enemy(sim, id)!.hp = enemy(sim, id)!.maxHp = 1e6;
      let shots = 0;
      let last = new Set<number>();
      for (let i = 0; i < 100; i++) {
        sim.update();
        const now = new Set(sim.inspect().projectiles.map((p) => p.id));
        for (const p of now) if (!last.has(p)) shots++;
        last = now;
      }
      return shots;
    };
    expect(count('a') / count('b')).toBeGreaterThan(1.4);
  });

  it('Napalm cannon sets victims on fire', () => {
    const { sim } = branched('cannon', 'b');
    const id = sim.spawnEnemy('tank');
    enemy(sim, id)!.hp = enemy(sim, id)!.maxHp = 1e6;
    let i = 0;
    while (!enemy(sim, id)!.burn && i++ < 100) sim.update();
    expect(enemy(sim, id)!.burn).not.toBeNull();
    expect(sim.getSnapshot().enemies[0].burning).toBe(true);
  });

  it('Deep Freeze slows harder; Shatter spreads the slow', () => {
    const deep = branched('frost', 'a').sim;
    const a = deep.spawnEnemy('tank');
    runTicks(deep, 20);
    expect(enemy(deep, a)!.slowMult).toBeCloseTo(0.4);

    const shatter = branched('frost', 'b').sim;
    const ids = [shatter.spawnEnemy('tank'), shatter.spawnEnemy('tank')];
    runTicks(shatter, 20);
    expect(ids.every((id) => shatter.getSnapshot().enemies.find((e) => e.id === id)!.slowed)).toBe(true);
  });

  it('Paralyze tesla can stun (movement stops)', () => {
    const { sim } = branched('tesla', 'b');
    const ids = Array.from({ length: 6 }, () => sim.spawnEnemy('tank'));
    for (const id of ids) enemy(sim, id)!.hp = enemy(sim, id)!.maxHp = 1e6;
    let stunned = false;
    for (let i = 0; i < 200 && !stunned; i++) {
      sim.update();
      stunned = sim.getSnapshot().enemies.some((e) => e.stunned);
    }
    expect(stunned).toBe(true);
  });

  it('War Drums support gives +35% damage; Gold Mine pays gold every wave', () => {
    const sim = newSim(open, { waves: true });
    sim.inspect().gold = 100_000;
    sim.placeTower('p1', 'arrow', 3, 1);
    sim.placeTower('p1', 'support', 4, 1);
    const support = [...sim.inspect().towers.values()].find((t) => t.type === 'support')!;
    sim.upgradeTower('p1', support.id);
    sim.upgradeTower('p1', support.id, 'a');
    sim.update();
    const arrow = [...sim.inspect().towers.values()].find((t) => t.type === 'arrow')!;
    expect(arrow.damageMult).toBeCloseTo(1.35);

    const mine = newSim(open, { waves: true });
    mine.inspect().gold = 100_000;
    mine.placeTower('p1', 'support', 4, 1);
    const s = towerOf(mine);
    mine.upgradeTower('p1', s.id);
    mine.upgradeTower('p1', s.id, 'b');
    const gold = mine.gold;
    mine.skipWave(); // wave 1 starts now
    const skipBonus = 30;
    expect(mine.gold - gold - skipBonus).toBeGreaterThanOrEqual(15);
  });

  it('Assassin crits are deterministic for a seed', () => {
    const run = () => {
      const { sim } = branched('sniper', 'a');
      const id = sim.spawnEnemy('tank');
      Object.assign(enemy(sim, id)!, { hp: 1e6, maxHp: 1e6, speed: 0 });
      runTicks(sim, 20 * 30);
      return enemy(sim, id)!.hp;
    };
    expect(run()).toBe(run());
  });
});

describe('perks', () => {
  function atWave5() {
    const sim = newSim(field, { waves: true });
    const w = sim.inspect();
    w.waves.wave = PERK_RULES.EVERY_WAVES - 1;
    w.waves.buildTimer = 0.01;
    sim.update();
    return sim;
  }

  it('an offer of 3 perks appears when wave 5 starts', () => {
    const sim = atWave5();
    const offer = sim.getSnapshot().perkOffer!;
    expect(offer).toHaveLength(3);
    expect(new Set(offer).size).toBe(3);
    expect(sim.drainEvents()).toContainEqual({ t: 'perk_offered', options: offer });
  });

  it('choosing applies the perk; wrong or missing offers are rejected', () => {
    const sim = atWave5();
    const w = sim.inspect();
    expect(sim.applyCommand('p1', { kind: 'choosePerk', perk: 'sharpened' })).toEqual(
      w.perkOffers[0].includes('sharpened') ? { ok: true } : { ok: false, code: 'INVALID_PERK' },
    );
    w.perkOffers = [['war_chest', 'fortify', 'masonry']];
    const gold = sim.gold;
    expect(sim.choosePerk('war_chest')).toEqual({ ok: true });
    expect(sim.gold).toBe(gold + 150);
    expect(sim.choosePerk('fortify')).toEqual({ ok: false, code: 'NO_PERK_OFFER' });
    w.perkOffers = [['fortify', 'masonry', 'interest']];
    const hp = sim.baseHp;
    sim.choosePerk('fortify');
    expect(sim.baseHp).toBe(hp + 5);
    w.perkOffers = [['masonry', 'interest', 'bounty']];
    sim.choosePerk('masonry');
    const before = sim.gold;
    sim.placeTower('p1', 'arrow', 3, 0);
    expect(before - sim.gold).toBe(45);
    expect(sim.getSnapshot().perks).toEqual(expect.arrayContaining(['war_chest', 'fortify', 'masonry']));
  });

  it('lasting perks are not offered twice', () => {
    const sim = atWave5();
    const w = sim.inspect();
    w.perks = ['sharpened', 'eagle_eye', 'rapid_reload', 'masonry', 'bounty', 'frostbite', 'interest'];
    w.perkOffers = [];
    w.waves.wave = 9;
    w.waves.state = 'building';
    w.waves.buildTimer = 0.01;
    sim.update();
    expect(new Set(sim.getSnapshot().perkOffer)).toEqual(new Set(['war_chest', 'fortify']));
  });

  it('Interest pays 10% of banked gold (max 50) and Bounty adds 25% to kill rewards', () => {
    const sim = newSim(field, { waves: true });
    const w = sim.inspect();
    w.perks = ['interest', 'bounty'];
    sim.inspect().mods = { ...w.mods, interest: 0.1, bounty: 1.25 };
    w.gold = 300;
    sim.skipWave();
    expect(sim.gold).toBe(300 + 30 + Math.min(50, Math.floor((300 + 30) * 0.1))); // skip bonus 30, then interest
    const id = sim.spawnEnemy('tank');
    const g = sim.gold;
    enemy(sim, id)!.hp = 0;
    sim.update();
    expect(sim.gold - g).toBeGreaterThanOrEqual(Math.round(15 * 1.25));
  });
});

describe('versus with new units', () => {
  it('healer, splitter and knight can be sent', () => {
    const m = new MatchSimulation({ mode: 'versus', map: MAPS.meadow, seed: 3, players: ['a', 'b'] });
    for (const id of m.players) m.board(id)!.inspect().baseHp = 1e9;
    for (let i = 0; i < VERSUS.FIRST_BUILD_SEC * 20 + 1; i++) m.update();
    m.board('a')!.inspect().gold = 1000;
    for (const t of ['healer', 'splitter', 'shielded'] as const) {
      expect(m.applyCommand('a', { kind: 'send', type: t })).toEqual({ ok: true });
    }
    expect(m.board('a')!.income).toBe(
      VERSUS.BASE_INCOME + SENDS.healer.income + SENDS.splitter.income + SENDS.shielded.income,
    );
    for (let i = 0; i < 20; i++) m.update();
    const types = m
      .board('b')!
      .inspect()
      .enemies.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['healer', 'splitter', 'shielded']));
  });
});
