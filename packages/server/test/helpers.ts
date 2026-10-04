import type { AddressInfo } from 'node:net';
import { io as ioClient, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ErrorCode, ServerToClientEvents } from '@maze/shared';
import { signToken } from '../src/auth/jwt';
import { createServer } from './serverFactory';

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type AckResult = { ok: boolean; code?: ErrorCode } & Record<string, unknown>;

export const SECRET = 'test-secret';

export function tokenFor(id: string, name = id): string {
  return signToken({ sub: id, name }, SECRET);
}

export async function startServer(opts: Parameters<typeof createServer>[0] = {}) {
  const server = createServer(opts);
  await new Promise<void>((r) => server.httpServer.listen(0, r));
  const port = (server.httpServer.address() as AddressInfo).port;
  const clients: ClientSocket[] = [];
  const url = `http://localhost:${port}`;
  return {
    ...server,
    url,
    async connect(userId: string, token = tokenFor(userId)): Promise<ClientSocket> {
      const c: ClientSocket = ioClient(url, { auth: { token }, transports: ['websocket'], forceNew: true });
      clients.push(c);
      await new Promise<void>((resolve, reject) => {
        c.once('connect', () => resolve());
        c.once('connect_error', (e) => reject(e));
      });
      return c;
    },
    async stop() {
      for (const c of clients) c.disconnect();
      await server.close();
    },
  };
}

export function emit<E extends keyof ClientToServerEvents>(
  socket: ClientSocket,
  event: E,
  payload: Parameters<ClientToServerEvents[E]>[0],
): Promise<AckResult> {
  return new Promise((resolve) => {
    (socket.emit as (...a: unknown[]) => void)(event, payload, resolve);
  });
}

export function waitFor<E extends keyof ServerToClientEvents>(
  socket: ClientSocket,
  event: E,
  pred: (...args: Parameters<ServerToClientEvents[E]>) => boolean = () => true,
  timeoutMs = 5000,
): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler as never);
      reject(new Error(`timeout waiting for ${event}`));
    }, timeoutMs);
    const handler = (...args: Parameters<ServerToClientEvents[E]>) => {
      if (!pred(...args)) return;
      clearTimeout(timer);
      socket.off(event, handler as never);
      resolve(args[0]);
    };
    socket.on(event, handler as never);
  });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
