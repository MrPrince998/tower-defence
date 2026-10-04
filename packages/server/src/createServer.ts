import http from 'node:http';
import { Server } from 'socket.io';
import type { Repositories } from './db/repositories/types';
import { createApp } from './http/app';
import { logger as defaultLogger, type Logger } from './logger';
import type { LoopClock } from './loop/GameLoop';
import { Metrics } from './metrics';
import { RoomCoordinator, type Timers } from './rooms/RoomCoordinator';
import { RoomManager } from './rooms/RoomManager';
import { attachSockets, createEmitter, type IO } from './sockets';

export interface ServerOptions {
  repos: Repositories;
  jwtSecret: string;
  clientOrigins: string[];
  bcryptCost?: number;
  logger?: Logger;
  timers?: Timers;
  clock?: LoopClock;
  authRateLimit?: number;
}

/** Builds the full HTTP + Socket.io stack without listening (tests call `listen(0)`). */
export function createGameServer(opts: ServerOptions) {
  const logger = opts.logger ?? defaultLogger;
  const metrics = new Metrics();
  const app = createApp({
    repos: opts.repos,
    jwtSecret: opts.jwtSecret,
    clientOrigins: opts.clientOrigins,
    bcryptCost: opts.bcryptCost ?? 12,
    metrics,
    logger,
    authRateLimit: opts.authRateLimit,
  });
  const httpServer = http.createServer(app);
  const io: IO = new Server(httpServer, { cors: { origin: opts.clientOrigins } });
  const rooms = new RoomManager();
  const coordinator = new RoomCoordinator({
    rooms,
    emitter: createEmitter(io),
    matches: opts.repos.matches,
    logger,
    metrics,
    timers: opts.timers,
    clock: opts.clock,
  });
  attachSockets(io, { coordinator, jwtSecret: opts.jwtSecret, logger });

  return {
    app,
    httpServer,
    io,
    rooms,
    coordinator,
    metrics,
    async close() {
      coordinator.shutdown();
      io.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}
