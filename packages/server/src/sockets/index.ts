import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import {
  EVENTS,
  ROOM,
  schemas,
  type Ack,
  type ClientToServerEvents,
  type SchemaEvent,
  type ServerToClientEvents,
  type SocketData,
} from '@maze/shared';
import { verifyToken } from '../auth/jwt';
import type { Logger } from '../logger';
import type { Emitter, RoomCoordinator } from '../rooms/RoomCoordinator';
import { RateLimiter } from './rateLimiter';

export type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const userChannel = (userId: string) => `user:${userId}`;
const roomChannel = (roomId: string) => `room:${roomId}`;

export function createEmitter(io: IO): Emitter {
  return {
    toRoom: (roomId, event, ...args) => io.to(roomChannel(roomId)).emit(event, ...args),
    toUser: (userId, event, ...args) => io.to(userChannel(userId)).emit(event, ...args),
    joinChannel: (userId, roomId) => io.in(userChannel(userId)).socketsJoin(roomChannel(roomId)),
    leaveChannel: (userId, roomId) => io.in(userChannel(userId)).socketsLeave(roomChannel(roomId)),
  };
}

export function attachSockets(
  io: IO,
  deps: { coordinator: RoomCoordinator; jwtSecret: string; logger: Logger },
): void {
  const { coordinator, logger } = deps;
  const connections = new Map<string, number>();

  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
    const payload = typeof token === 'string' ? verifyToken(token, deps.jwtSecret) : null;
    if (!payload) return next(new Error('UNAUTHORIZED'));
    socket.data.userId = payload.sub;
    socket.data.name = payload.name;
    next();
  });

  io.on('connection', (socket: IOSocket) => {
    const user = { userId: socket.data.userId, name: socket.data.name };
    logger.debug({ socketId: socket.id, userId: user.userId }, 'socket connected');
    socket.join(userChannel(user.userId));
    connections.set(user.userId, (connections.get(user.userId) ?? 0) + 1);
    const limiter = new RateLimiter(ROOM.MAX_COMMANDS_PER_SEC);

    /** Validate with Zod → rate limit → delegate. Never throws into socket.io. */
    function on<E extends SchemaEvent>(
      event: E,
      handler: (p: z.infer<(typeof schemas)[E]>, ack: (r: Ack<object>) => void) => void,
    ) {
      socket.on(
        event as never,
        ((payload: unknown, ack: unknown) => {
          const reply = typeof ack === 'function' ? (ack as (r: Ack<object>) => void) : () => {};
          if (!limiter.allow()) return reply({ ok: false, code: 'RATE_LIMITED' });
          const parsed = schemas[event].safeParse(payload ?? {});
          if (!parsed.success) return reply({ ok: false, code: 'INVALID_PAYLOAD' });
          try {
            handler(parsed.data as z.infer<(typeof schemas)[E]>, reply);
          } catch (err) {
            logger.error({ err, event }, 'socket handler failed');
            reply({ ok: false, code: 'INVALID_PAYLOAD' });
          }
        }) as never,
      );
    }

    on(EVENTS.ROOM_CREATE, (p, ack) => ack(coordinator.create(user, p.mode, p.mapId, p.difficulty)));
    on(EVENTS.ROOM_JOIN, (p, ack) => ack(coordinator.join(user, p.code)));
    on(EVENTS.ROOM_SPECTATE, (p, ack) => ack(coordinator.spectate(user, p.code)));
    on(EVENTS.ROOM_LEAVE, (_p, ack) => ack(coordinator.leave(user.userId)));
    on(EVENTS.ROOM_READY, (p, ack) => ack(coordinator.setReady(user.userId, p.ready)));
    on(EVENTS.ROOM_START, (_p, ack) => ack(coordinator.forceStart(user.userId)));
    on(EVENTS.ROOM_RECONNECT, (p, ack) => ack(coordinator.reconnect(user, p.roomId)));
    on(EVENTS.TOWER_PLACE, (p, ack) =>
      coordinator.command(user.userId, { kind: 'place', type: p.type, x: p.x, y: p.y }, ack),
    );
    on(EVENTS.TOWER_UPGRADE, (p, ack) =>
      coordinator.command(user.userId, { kind: 'upgrade', towerId: p.towerId, branch: p.branch }, ack),
    );
    on(EVENTS.TOWER_SELL, (p, ack) =>
      coordinator.command(user.userId, { kind: 'sell', towerId: p.towerId }, ack),
    );
    on(EVENTS.TOWER_SET_TARGET, (p, ack) =>
      coordinator.command(user.userId, { kind: 'setTarget', towerId: p.towerId, mode: p.mode }, ack),
    );
    on(EVENTS.WAVE_SKIP, (_p, ack) => coordinator.command(user.userId, { kind: 'skipWave' }, ack));
    on(EVENTS.PERK_CHOOSE, (p, ack) =>
      coordinator.command(user.userId, { kind: 'choosePerk', perk: p.perk }, ack),
    );
    on(EVENTS.SEND_ENEMY, (p, ack) =>
      coordinator.command(user.userId, { kind: 'send', type: p.type, target: p.target }, ack),
    );
    on(EVENTS.CHAT_SEND, (p, ack) => ack(coordinator.chat(user, p.text)));

    socket.on('disconnect', () => {
      const left = (connections.get(user.userId) ?? 1) - 1;
      if (left > 0) {
        connections.set(user.userId, left);
        return;
      }
      connections.delete(user.userId);
      coordinator.disconnected(user.userId);
    });
  });
}
