/**
 * Socket.io load test: N rooms × P players each create/join, ready up, then keep building towers and skipping
 * waves. Reports server tick time from /health.
 *
 *   JWT_SECRET=... npx tsx tools/load-test.ts --url http://localhost:4000 --rooms 25 --players 2 --seconds 60
 *
 * Tokens are signed locally with JWT_SECRET (the load test does not hit the rate-limited auth routes).
 */
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import { io, type Socket } from 'socket.io-client';
import {
  EVENTS,
  MAPS,
  TOWER_TYPES,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@maze/shared';

type S = Socket<ServerToClientEvents, ClientToServerEvents>;

if (fs.existsSync('.env')) process.loadEnvFile('.env');
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const URL = arg('url', `http://localhost:${process.env.PORT ?? 4000}`);
const ROOMS = Number(arg('rooms', '25'));
const PLAYERS = Number(arg('players', '2'));
const SECONDS = Number(arg('seconds', '60'));
const SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';
const map = MAPS.meadow;

const token = (id: string) => jwt.sign({ name: id }, SECRET, { subject: id, expiresIn: '1h' });
const emit = <T>(s: S, event: string, payload: unknown) =>
  new Promise<T>((resolve) => (s.emit as unknown as (...a: unknown[]) => void)(event, payload, resolve));

async function connect(id: string): Promise<S> {
  const s: S = io(URL, { auth: { token: token(id) }, transports: ['websocket'], forceNew: true });
  await new Promise<void>((resolve, reject) => {
    s.once('connect', () => resolve());
    s.once('connect_error', reject);
  });
  return s;
}

let snapshots = 0;
let bytes = 0;
let commands = 0;
let rejected = 0;

async function room(r: number): Promise<S[]> {
  const run = Date.now().toString(36);
  const sockets = await Promise.all(
    Array.from({ length: PLAYERS }, (_, p) => connect(`load-${run}-${r}-${p}`)),
  );
  for (const s of sockets) {
    s.on(EVENTS.GAME_SNAPSHOT, (snap) => {
      snapshots++;
      bytes += JSON.stringify(snap).length;
    });
  }
  const created = await emit<{ ok: boolean; code?: string }>(sockets[0], EVENTS.ROOM_CREATE, {
    mapId: 'meadow',
    difficulty: 'easy',
  });
  if (!created.ok) throw new Error(`create failed: ${JSON.stringify(created)}`);
  for (const s of sockets.slice(1)) await emit(s, EVENTS.ROOM_JOIN, { code: created.code });
  const started = Promise.all(sockets.map((s) => new Promise((res) => s.once(EVENTS.GAME_START, res))));
  for (const s of sockets) await emit(s, EVENTS.ROOM_READY, { ready: true });
  await started;
  return sockets;
}

function act(s: S, i: number) {
  const type = TOWER_TYPES[i % 3];
  const x = 2 + Math.floor(Math.random() * (map.width - 4));
  const y = Math.floor(Math.random() * map.height);
  commands++;
  void emit<{ ok: boolean }>(
    s,
    i % 5 === 0 ? EVENTS.WAVE_SKIP : EVENTS.TOWER_PLACE,
    i % 5 === 0 ? {} : { type, x, y },
  ).then((r) => {
    if (!r.ok) rejected++;
  });
}

const t0 = Date.now();
const rooms: S[][] = await Promise.all(Array.from({ length: ROOMS }, (_, r) => room(r)));
console.log(`${ROOMS} rooms × ${PLAYERS} players running (setup ${Date.now() - t0} ms)`);

let i = 0;
const actions = setInterval(() => {
  for (const sockets of rooms) for (const s of sockets) act(s, i++);
}, 1000);

const samples: number[] = [];
const poll = setInterval(async () => {
  const health = (await (await fetch(`${URL}/health`)).json()) as {
    avgTickMs: number;
    rooms: number;
    players: number;
  };
  samples.push(health.avgTickMs);
  console.log(
    `t=${Math.round((Date.now() - t0) / 1000)}s rooms=${health.rooms} players=${health.players} avgTickMs=${health.avgTickMs}`,
  );
}, 5000);

await new Promise((r) => setTimeout(r, SECONDS * 1000));
clearInterval(actions);
clearInterval(poll);
const cpu = process.cpuUsage();
console.log('\n--- results ---');
console.log(`rooms: ${ROOMS}, players: ${ROOMS * PLAYERS}, duration: ${SECONDS}s`);
console.log(
  `server avg tick: ${(samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length)).toFixed(3)} ms (max sample ${Math.max(...samples)} ms)`,
);
console.log(`commands sent: ${commands} (${rejected} rejected by game rules)`);
console.log(
  `snapshots received: ${snapshots}, avg ${(bytes / Math.max(1, snapshots)).toFixed(0)} bytes, ${(bytes / SECONDS / (ROOMS * PLAYERS) / 1024).toFixed(1)} KiB/s per client`,
);
console.log(`load-test client cpu: ${((cpu.user + cpu.system) / 1e6).toFixed(1)} s`);
for (const sockets of rooms) for (const s of sockets) s.disconnect();
process.exit(0);
