import {
  enemyShield,
  ENEMIES,
  NO_MODS,
  PERK_IDS,
  PERKS,
  perkMods,
  SEND_TYPES,
  SENDS,
  TOWER_TYPES,
  TOWERS,
  towerCost,
  towerStats,
  upgradeCost,
} from '../src';

describe('new towers', () => {
  it('every tower except the barricade has two level-3 branches', () => {
    for (const t of TOWER_TYPES) {
      if (t === 'barricade') expect(TOWERS[t].branches).toBeUndefined();
      else expect(Object.keys(TOWERS[t].branches!)).toEqual(['a', 'b']);
    }
  });

  it('barricade is a cheap wall that cannot be upgraded', () => {
    expect(TOWERS.barricade).toMatchObject({ kind: 'wall', cost: 25, maxLevel: 1 });
    expect(upgradeCost('barricade', 1)).toBeNull();
  });

  it('branch and perk modifiers apply to stats and costs', () => {
    expect(towerStats('arrow', 3, 'a').rate).toBeCloseTo(3 * 1.6);
    expect(towerStats('arrow', 3, 'b').damage).toBeCloseTo(8 * 1.6 * 1.2);
    expect(towerStats('sniper', 3, 'b').range).toBeCloseTo(7 * 1.2 * 1.4);
    const mods = perkMods(['sharpened', 'masonry']);
    expect(towerStats('arrow', 1, null, mods).damage).toBeCloseTo(8 * 1.15);
    expect(towerCost('arrow', mods)).toBe(45);
    expect(upgradeCost('arrow', 1, mods)).toBe(68);
    expect(towerCost('arrow', NO_MODS)).toBe(50);
  });
});

describe('new enemies', () => {
  it('healer, splitter and knight have their special rules', () => {
    expect(ENEMIES.healer.heal).toBeDefined();
    expect(ENEMIES.splitter.split).toEqual({ into: 'runner', count: 3 });
    expect(enemyShield('shielded', 1, 1)).toBe(70);
    expect(enemyShield('shielded', 11, 1)).toBe(154);
    expect(enemyShield('grunt', 5, 1)).toBe(0);
    expect(ENEMIES.boss.summon).toBeDefined();
    expect(ENEMIES.boss.enrage).toBeDefined();
  });

  it('every sendable type has a price and income', () => {
    for (const t of SEND_TYPES) expect(SENDS[t].cost).toBeGreaterThan(0);
  });
});

describe('perks', () => {
  it('stack multiplicatively; interest is additive; one-offs have no mods', () => {
    const m = perkMods(['sharpened', 'sharpened', 'interest']);
    expect(m.damage).toBeCloseTo(1.15 * 1.15);
    expect(m.interest).toBeCloseTo(0.1);
    expect(perkMods(['war_chest', 'fortify'])).toEqual(NO_MODS);
    for (const id of PERK_IDS) expect(PERKS[id].name.length).toBeGreaterThan(0);
  });
});
