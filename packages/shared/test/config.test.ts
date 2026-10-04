import {
  DIFFICULTY,
  enemyHp,
  ENEMIES,
  isBossWave,
  sellRefund,
  totalInvested,
  towerDamage,
  towerRange,
  TOWERS,
  upgradeCost,
  waveBudget,
  waveClearBonus,
} from '../src';

describe('tower config', () => {
  it('matches the design table at level 1', () => {
    expect(TOWERS.arrow).toMatchObject({ cost: 50, damage: 8, range: 3.5, rate: 3 });
    expect(TOWERS.cannon).toMatchObject({
      cost: 100,
      damage: 25,
      range: 3,
      rate: 0.8,
      splashRadius: 1.2,
      groundOnly: true,
    });
    expect(TOWERS.frost).toMatchObject({
      cost: 75,
      damage: 2,
      range: 3,
      rate: 1.5,
      slow: { mult: 0.6, durationSec: 2 },
    });
    expect(TOWERS.sniper).toMatchObject({
      cost: 150,
      damage: 80,
      range: 7,
      rate: 0.4,
      defaultTarget: 'strongest',
    });
    expect(TOWERS.support).toMatchObject({ cost: 120, range: 2, aura: { damageMult: 1.2, rangeMult: 1.1 } });
  });

  it('upgrade cost = baseCost * 1.5^level, null at max level 4', () => {
    expect(upgradeCost('arrow', 1)).toBe(75);
    expect(upgradeCost('arrow', 2)).toBe(113);
    expect(upgradeCost('arrow', 3)).toBe(169);
    expect(upgradeCost('arrow', 4)).toBeNull();
  });

  it('each level adds +30% damage and +10% range', () => {
    expect(towerDamage('arrow', 1)).toBeCloseTo(8);
    expect(towerDamage('arrow', 2)).toBeCloseTo(10.4);
    expect(towerDamage('arrow', 4)).toBeCloseTo(15.2);
    expect(towerRange('sniper', 3)).toBeCloseTo(8.4);
  });

  it('sell refund is 70% of total invested, including upgrades', () => {
    expect(totalInvested('arrow', 1)).toBe(50);
    expect(totalInvested('arrow', 3)).toBe(50 + 75 + 113);
    expect(sellRefund(totalInvested('arrow', 1))).toBe(35);
    expect(sellRefund(238)).toBe(166);
  });
});

describe('enemy config', () => {
  it('matches the design table', () => {
    expect(ENEMIES.grunt).toMatchObject({ hp: 40, speed: 1.5, armor: 0, reward: 5 });
    expect(ENEMIES.runner).toMatchObject({ hp: 25, speed: 3, armor: 0, reward: 4 });
    expect(ENEMIES.tank).toMatchObject({ hp: 200, speed: 0.9, armor: 5, reward: 15 });
    expect(ENEMIES.flyer).toMatchObject({ hp: 50, speed: 2, flying: true, reward: 8 });
    expect(ENEMIES.boss).toMatchObject({ hp: 1500, speed: 0.8, armor: 8, reward: 150, leakDamage: 10 });
  });

  it('hp scales +12% per wave and by difficulty', () => {
    expect(enemyHp('grunt', 1, 1)).toBe(40);
    expect(enemyHp('grunt', 11, 1)).toBe(88);
    expect(enemyHp('grunt', 1, DIFFICULTY.hard.hpMult)).toBe(52);
    expect(enemyHp('grunt', 1, DIFFICULTY.easy.hpMult)).toBe(32);
  });
});

describe('wave config', () => {
  it('budget(w) = 20 + 12w + w^1.5', () => {
    expect(waveBudget(1)).toBeCloseTo(33);
    expect(waveBudget(4)).toBeCloseTo(76);
  });
  it('boss every 10th wave; clear bonus 20 + 2w', () => {
    expect([9, 10, 11, 20].map(isBossWave)).toEqual([false, true, false, true]);
    expect(waveClearBonus(5)).toBe(30);
  });
  it('difficulty modifiers', () => {
    expect(DIFFICULTY).toEqual({
      easy: { hpMult: 0.8, startGold: 300, baseHp: 30 },
      normal: { hpMult: 1, startGold: 200, baseHp: 20 },
      hard: { hpMult: 1.3, startGold: 150, baseHp: 10 },
    });
  });
});
