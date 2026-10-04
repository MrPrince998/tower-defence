import type { PerkId } from '../types';

/** Board-wide modifiers from perks (1 = no change). */
export interface Mods {
  damage: number;
  range: number;
  rate: number;
  cost: number;
  bounty: number;
  slowDuration: number;
  interest: number; // fraction of banked gold paid at each wave start
}

export const NO_MODS: Mods = {
  damage: 1,
  range: 1,
  rate: 1,
  cost: 1,
  bounty: 1,
  slowDuration: 1,
  interest: 0,
};

export interface PerkConfig {
  name: string;
  description: string;
  icon: string;
  mods?: Partial<Mods>;
  /** One-off rewards when picked. */
  gold?: number;
  baseHp?: number;
}

export const PERKS: Record<PerkId, PerkConfig> = {
  sharpened: {
    name: 'Sharpened',
    description: 'All towers deal +15% damage.',
    icon: '⚔️',
    mods: { damage: 1.15 },
  },
  eagle_eye: {
    name: 'Eagle Eye',
    description: 'All towers get +10% range.',
    icon: '🦅',
    mods: { range: 1.1 },
  },
  rapid_reload: {
    name: 'Rapid Reload',
    description: 'All towers fire 12% faster.',
    icon: '⚡',
    mods: { rate: 1.12 },
  },
  masonry: {
    name: 'Masonry',
    description: 'Towers and upgrades cost 10% less.',
    icon: '🧱',
    mods: { cost: 0.9 },
  },
  bounty: { name: 'Bounty Hunter', description: '+25% gold from kills.', icon: '💰', mods: { bounty: 1.25 } },
  frostbite: {
    name: 'Frostbite',
    description: 'Slows last 50% longer.',
    icon: '❄️',
    mods: { slowDuration: 1.5 },
  },
  interest: {
    name: 'Interest',
    description: 'Earn 10% of your gold at each wave start (max 50).',
    icon: '🏦',
    mods: { interest: 0.1 },
  },
  war_chest: { name: 'War Chest', description: '+150 gold right now.', icon: '🪙', gold: 150 },
  fortify: { name: 'Fortify', description: '+5 castle lives.', icon: '🏰', baseHp: 5 },
};

export const PERK_RULES = {
  EVERY_WAVES: 5, // an offer appears when wave 5, 10, 15, ... starts
  OFFER_SIZE: 3,
  INTEREST_CAP: 50,
} as const;

/** Combine picked perks (multiplicative, interest additive). */
export function perkMods(perks: readonly PerkId[]): Mods {
  const m: Mods = { ...NO_MODS };
  for (const id of perks) {
    const p = PERKS[id].mods;
    if (!p) continue;
    m.damage *= p.damage ?? 1;
    m.range *= p.range ?? 1;
    m.rate *= p.rate ?? 1;
    m.cost *= p.cost ?? 1;
    m.bounty *= p.bounty ?? 1;
    m.slowDuration *= p.slowDuration ?? 1;
    m.interest += p.interest ?? 0;
  }
  return m;
}
