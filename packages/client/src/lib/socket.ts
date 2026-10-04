import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@maze/shared';
import { SOCKET_URL } from './config';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;
let socketToken: string | null = null;

/** One socket per browser tab, authenticated with the JWT. */
export function getSocket(token: string): GameSocket {
  if (socket && socketToken === token) return socket;
  socket?.disconnect();
  socketToken = token;
  socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'], reconnectionDelayMax: 3000 });
  return socket;
}

export function currentSocket(): GameSocket | null {
  return socket;
}

export function closeSocket(): void {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}
