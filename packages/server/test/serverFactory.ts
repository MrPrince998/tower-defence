import { createGameServer } from '../src/createServer';
import { createMemoryRepositories } from '../src/db/repositories/memory';
import type { Repositories } from '../src/db/repositories/types';
import type { Timers } from '../src/rooms/RoomCoordinator';

/** Timers running `scale` times faster than real time (countdown 3 s → 30 ms at scale 100). */
export function fastTimers(scale = 100): Timers {
  return {
    setTimeout: (fn, ms) => setTimeout(fn, ms / scale),
    clearTimeout: (h) => clearTimeout(h as NodeJS.Timeout),
  };
}

export function createServer(opts: { repos?: Repositories; timers?: Timers; authRateLimit?: number } = {}) {
  return createGameServer({
    repos: opts.repos ?? createMemoryRepositories(),
    jwtSecret: 'test-secret',
    clientOrigins: ['http://localhost:3000'],
    bcryptCost: 4,
    timers: opts.timers ?? fastTimers(),
    authRateLimit: opts.authRateLimit,
  });
}
