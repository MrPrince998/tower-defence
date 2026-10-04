import { z } from 'zod';
import {
  DIFFICULTIES,
  GAME_MODES,
  PERK_IDS,
  SEND_TYPES,
  TARGET_MODES,
  TOWER_BRANCHES,
  TOWER_TYPES,
} from '../types';
import { GAME } from '../config/game';

const cellX = z
  .number()
  .int()
  .min(0)
  .max(GAME.MAX_MAP_WIDTH - 1);
const cellY = z
  .number()
  .int()
  .min(0)
  .max(GAME.MAX_MAP_HEIGHT - 1);
const towerId = z.number().int().min(1).max(1_000_000_000);
const empty = z.object({}).strict();

export const schemas = {
  'room:create': z
    .object({ mode: z.enum(GAME_MODES), mapId: z.string().min(1).max(32), difficulty: z.enum(DIFFICULTIES) })
    .strict(),
  'room:join': z.object({ code: z.string().trim().toUpperCase().length(4) }).strict(),
  'room:leave': empty,
  'room:ready': z.object({ ready: z.boolean() }).strict(),
  'room:start': empty,
  'room:reconnect': z.object({ roomId: z.string().min(1).max(64) }).strict(),
  'room:spectate': z.object({ code: z.string().trim().toUpperCase().length(4) }).strict(),
  'tower:place': z.object({ type: z.enum(TOWER_TYPES), x: cellX, y: cellY }).strict(),
  'tower:upgrade': z.object({ towerId, branch: z.enum(TOWER_BRANCHES).optional() }).strict(),
  'perk:choose': z.object({ perk: z.enum(PERK_IDS) }).strict(),
  'tower:sell': z.object({ towerId }).strict(),
  'tower:setTarget': z.object({ towerId, mode: z.enum(TARGET_MODES) }).strict(),
  'wave:skip': empty,
  'send:enemy': z.object({ type: z.enum(SEND_TYPES), target: z.string().min(1).max(64).optional() }).strict(),
  'chat:send': z.object({ text: z.string().trim().min(1).max(200) }).strict(),
} as const;

export type SchemaEvent = keyof typeof schemas;

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(24)
      .regex(/^[A-Za-z0-9_]+$/, 'letters, digits and underscore only'),
    email: z.string().trim().toLowerCase().email().max(255),
    password: z.string().min(8).max(128),
  })
  .strict();

export const loginSchema = z
  .object({
    login: z.string().trim().min(3).max(255), // username or email
    password: z.string().min(1).max(128),
  })
  .strict();

export const leaderboardQuerySchema = z.object({
  mode: z.enum(GAME_MODES).default('solo'),
  mapId: z.string().min(1).max(32).default('meadow'),
  difficulty: z.enum(DIFFICULTIES).default('normal'),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});
