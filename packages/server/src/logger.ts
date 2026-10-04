import pino from 'pino';

const pretty = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';

export const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : (process.env.LOG_LEVEL ?? 'info'),
  transport: pretty
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
});

export type Logger = pino.Logger;
