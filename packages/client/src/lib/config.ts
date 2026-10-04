/** REST base URL (may include a path prefix such as `/api` behind a reverse proxy). */
export const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:4000';
/** Socket.io connects to the origin; its `/socket.io` path is proxied as-is. */
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? new URL(SERVER_URL).origin;
/** Client renders at 2x the logical 32 px tile for crisp graphics. */
export const RENDER_SCALE = 2;
export const INTERPOLATION_DELAY_MS = 100;
export const STORAGE = {
  auth: 'maze.auth',
  roomId: 'maze.roomId',
  audio: 'maze.audio',
} as const;
