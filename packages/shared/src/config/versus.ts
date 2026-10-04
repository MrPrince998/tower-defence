import type { SendType } from '../types';

/** Versus ("send") mode balance. Every player gets an identical board and identical base waves. */
export const VERSUS = {
  MIN_PLAYERS: 2,
  START_GOLD: 250,
  BASE_HP: 20,
  FIRST_BUILD_SEC: 30,
  WAVE_INTERVAL_SEC: 30, // waves arrive on a timer, cleared or not
  BASE_INCOME: 10, // paid at every wave start, on top of kill rewards
  SEND_SPAWN_INTERVAL_SEC: 0.35,
  MAX_PENDING_SENDS: 40, // per receiving board
} as const;

export interface SendConfig {
  cost: number;
  income: number; // permanent income increase for the sender
}

/** Sending costs gold now and raises your income for the rest of the game. */
export const SENDS: Record<SendType, SendConfig> = {
  grunt: { cost: 15, income: 1 },
  runner: { cost: 20, income: 1 },
  flyer: { cost: 40, income: 3 },
  tank: { cost: 60, income: 4 },
  healer: { cost: 45, income: 3 },
  splitter: { cost: 50, income: 3 },
  shielded: { cost: 55, income: 4 },
};
