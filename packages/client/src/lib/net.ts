import {
  EVENTS,
  type Ack,
  type ClientToServerEvents,
  type ErrorCode,
  type MatchEvent,
  type PerkId,
  type TowerBranch,
  type SendType,
  type TargetMode,
  type TowerType,
} from '@maze/shared';
import { effectBus } from '@/game/bus';
import { SnapshotBuffer } from '@/game/SnapshotBuffer';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { play } from './audio';
import { STORAGE } from './config';
import { ERROR_TEXT } from './errors';
import { currentSocket, type GameSocket } from './socket';
import { readJson, writeJson } from './storage';

/** Interpolation buffer shared with the Phaser scene. */
export const snapshots = new SnapshotBuffer();

const bound = new WeakSet<GameSocket>();

export function rememberRoom(roomId: string | null): void {
  writeJson(STORAGE.roomId, roomId);
}

export function rememberedRoom(): string | null {
  return readJson<string>(STORAGE.roomId);
}

function onGameEvent(m: MatchEvent): void {
  const game = useGameStore.getState();
  game.applyEvent(m.board, m.event);
  effectBus.push(m, performance.now());
  const e = m.event;
  // Sounds only for the board on screen, plus attacks aimed at you.
  if (e.t === 'enemy_sent') {
    if (e.to === game.myId) play('incoming');
    else if (e.from === game.myId) play('send');
    return;
  }
  if (e.t === 'player_eliminated') {
    play(e.placement === 1 ? 'clear' : 'eliminated');
    return;
  }
  if (m.board !== game.viewBoard) return;
  switch (e.t) {
    case 'wave_started':
      play(e.boss ? 'boss' : 'wave');
      break;
    case 'wave_cleared':
      play('clear');
      break;
    case 'tower_built':
      play('build');
      break;
    case 'tower_upgraded':
      play('upgrade');
      break;
    case 'tower_sold':
      play('sell');
      break;
    case 'perk_offered':
    case 'perk_chosen':
      play('perk');
      break;
  }
}

/** Wire server → client events into stores and the snapshot buffer (idempotent per socket). */
export function bindSocket(socket: GameSocket): void {
  if (bound.has(socket)) return;
  bound.add(socket);

  socket.on('connect', () => {
    useLobbyStore.getState().setConnected(true);
    const roomId = rememberedRoom();
    if (roomId) {
      socket.emit(EVENTS.ROOM_RECONNECT, { roomId }, (res) => {
        if (!res.ok) {
          rememberRoom(null);
          useLobbyStore.getState().setRoom(null);
        }
      });
    }
  });
  socket.on('disconnect', () => useLobbyStore.getState().setConnected(false));
  socket.on('connect_error', (err) => {
    useLobbyStore.getState().setConnected(false);
    if (err.message === 'UNAUTHORIZED')
      useGameStore.getState().toast('Session expired — please log in again.');
  });

  socket.on(EVENTS.ROOM_STATE, (room) => {
    useLobbyStore.getState().setRoom(room);
    useGameStore.getState().setPlayers(room.players);
    rememberRoom(room.roomId);
  });
  socket.on(EVENTS.GAME_START, (payload) => {
    const roomId = useLobbyStore.getState().room?.roomId ?? rememberedRoom() ?? '';
    snapshots.reset(payload.snapshot, performance.now());
    effectBus.clear();
    useGameStore.getState().start(roomId, useAuthStore.getState().user?.id ?? null, payload);
  });
  socket.on(EVENTS.GAME_SNAPSHOT, (snap) => {
    snapshots.push(snap, performance.now());
    useGameStore.getState().applySnapshot(snap);
  });
  socket.on(EVENTS.GAME_EVENT, onGameEvent);
  socket.on(EVENTS.GAME_OVER, (payload) => {
    useGameStore.getState().setGameOver(payload);
    play('gameover');
  });
  socket.on(EVENTS.CHAT_MESSAGE, (m) => useGameStore.getState().addChat(m));
}

type AckOf<E extends keyof ClientToServerEvents> = Parameters<Parameters<ClientToServerEvents[E]>[1]>[0];

/** Emit with ack as a promise; resolves `{ ok: false, code }` on timeout or when offline. */
export function request<E extends keyof ClientToServerEvents>(
  event: E,
  payload: Parameters<ClientToServerEvents[E]>[0],
  timeoutMs = 5000,
): Promise<AckOf<E>> {
  const socket = currentSocket();
  return new Promise((resolve) => {
    if (!socket?.connected) return resolve({ ok: false, code: 'GAME_NOT_RUNNING' } as AckOf<E>);
    (
      socket.timeout(timeoutMs).emit as unknown as (
        e: string,
        p: unknown,
        cb: (err: unknown, res: Ack) => void,
      ) => void
    )(event, payload, (err, res) =>
      resolve((err ? { ok: false, code: 'GAME_NOT_RUNNING' } : res) as AckOf<E>),
    );
  });
}

function report(res: { ok: boolean; code?: ErrorCode }): boolean {
  if (!res.ok && res.code) {
    useGameStore.getState().toast(ERROR_TEXT[res.code] ?? res.code);
    play('error');
  }
  return res.ok;
}

export const commands = {
  place: async (type: TowerType, x: number, y: number) =>
    report(await request(EVENTS.TOWER_PLACE, { type, x, y })),
  upgrade: async (towerId: number, branch?: TowerBranch) =>
    report(await request(EVENTS.TOWER_UPGRADE, branch ? { towerId, branch } : { towerId })),
  choosePerk: async (perk: PerkId) => report(await request(EVENTS.PERK_CHOOSE, { perk })),
  sell: async (towerId: number) => report(await request(EVENTS.TOWER_SELL, { towerId })),
  setTarget: async (towerId: number, mode: TargetMode) =>
    report(await request(EVENTS.TOWER_SET_TARGET, { towerId, mode })),
  skipWave: async () => report(await request(EVENTS.WAVE_SKIP, {})),
  send: async (type: SendType, target?: string | null) =>
    report(await request(EVENTS.SEND_ENEMY, target ? { type, target } : { type })),
  chat: async (text: string) => report(await request(EVENTS.CHAT_SEND, { text })),
};
