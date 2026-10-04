import { randomInt, randomUUID } from 'node:crypto';
import {
  GAME,
  ROOM,
  VERSUS,
  type Difficulty,
  type ErrorCode,
  type GameMode,
  type RoomPlayer,
  type RoomSpectator,
  type RoomState,
  type RoomStatus,
} from '@maze/shared';

export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  hostId: string;
  mode: GameMode;
  mapId: string;
  difficulty: Difficulty;
  players: RoomPlayer[];
  spectators: RoomSpectator[];
  countdownEndsAt?: number;
}

export interface UserRef {
  userId: string;
  name: string;
}

export type RoomResult = { ok: true; room: Room } | { ok: false; code: ErrorCode };

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion with 1/0

/** In-memory room registry. Pure state: timers and networking live in RoomCoordinator. */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly codes = new Map<string, string>();
  private readonly userRoom = new Map<string, string>();

  constructor(private readonly randomIndex: (n: number) => number = (n) => randomInt(n)) {}

  get size(): number {
    return this.rooms.size;
  }

  get playerCount(): number {
    let n = 0;
    for (const r of this.rooms.values()) n += r.players.length;
    return n;
  }

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  byCode(code: string): Room | undefined {
    const id = this.codes.get(code.toUpperCase());
    return id ? this.rooms.get(id) : undefined;
  }

  roomOf(userId: string): Room | undefined {
    const id = this.userRoom.get(userId);
    return id ? this.rooms.get(id) : undefined;
  }

  isSpectator(room: Room, userId: string): boolean {
    return room.spectators.some((s) => s.userId === userId);
  }

  maxPlayers(room: Room): number {
    return room.mode === 'solo' ? 1 : GAME.MAX_PLAYERS;
  }

  create(user: UserRef, opts: { mode?: GameMode; mapId: string; difficulty: Difficulty }): RoomResult {
    if (this.userRoom.has(user.userId)) return { ok: false, code: 'ALREADY_IN_ROOM' };
    const room: Room = {
      id: randomUUID(),
      code: this.uniqueCode(),
      status: 'lobby',
      hostId: user.userId,
      mode: opts.mode ?? 'versus',
      mapId: opts.mapId,
      difficulty: opts.difficulty,
      players: [{ userId: user.userId, name: user.name, ready: false, connected: true }],
      spectators: [],
    };
    this.rooms.set(room.id, room);
    this.codes.set(room.code, room.id);
    this.userRoom.set(user.userId, room.id);
    return { ok: true, room };
  }

  join(code: string, user: UserRef): RoomResult {
    const room = this.byCode(code);
    if (!room) return { ok: false, code: 'ROOM_NOT_FOUND' };
    const current = this.userRoom.get(user.userId);
    if (current === room.id && room.players.some((p) => p.userId === user.userId)) return { ok: true, room };
    if (current) return { ok: false, code: 'ALREADY_IN_ROOM' };
    if (room.status !== 'lobby') return { ok: false, code: 'GAME_IN_PROGRESS' };
    if (room.players.length >= this.maxPlayers(room)) return { ok: false, code: 'ROOM_FULL' };
    room.players.push({ userId: user.userId, name: user.name, ready: false, connected: true });
    this.userRoom.set(user.userId, room.id);
    return { ok: true, room };
  }

  spectate(code: string, user: UserRef): RoomResult {
    const room = this.byCode(code);
    if (!room) return { ok: false, code: 'ROOM_NOT_FOUND' };
    const current = this.userRoom.get(user.userId);
    if (current === room.id && this.isSpectator(room, user.userId)) return { ok: true, room };
    if (current) return { ok: false, code: 'ALREADY_IN_ROOM' };
    if (room.spectators.length >= ROOM.MAX_SPECTATORS) return { ok: false, code: 'ROOM_FULL' };
    room.spectators.push({ userId: user.userId, name: user.name });
    this.userRoom.set(user.userId, room.id);
    return { ok: true, room };
  }

  /** Removes the user; transfers host; destroys the room when no players remain. */
  leave(userId: string): { room: Room; destroyed: boolean } | null {
    const room = this.roomOf(userId);
    if (!room) return null;
    this.userRoom.delete(userId);
    room.spectators = room.spectators.filter((s) => s.userId !== userId);
    room.players = room.players.filter((p) => p.userId !== userId);
    if (room.players.length === 0) {
      this.destroy(room.id);
      return { room, destroyed: true };
    }
    if (room.hostId === userId) {
      room.hostId = (room.players.find((p) => p.connected) ?? room.players[0]).userId;
    }
    return { room, destroyed: false };
  }

  setReady(userId: string, ready: boolean): RoomResult {
    const room = this.roomOf(userId);
    if (!room) return { ok: false, code: 'NOT_IN_ROOM' };
    const p = room.players.find((x) => x.userId === userId);
    if (!p) return { ok: false, code: 'SPECTATOR' };
    if (room.status !== 'lobby' && room.status !== 'countdown')
      return { ok: false, code: 'GAME_IN_PROGRESS' };
    p.ready = ready;
    return { ok: true, room };
  }

  setConnected(userId: string, connected: boolean): Room | undefined {
    const room = this.roomOf(userId);
    const p = room?.players.find((x) => x.userId === userId);
    if (p) p.connected = connected;
    return room;
  }

  /** Versus needs at least two players, all ready. */
  allReady(room: Room): boolean {
    const min = room.mode === 'versus' ? VERSUS.MIN_PLAYERS : 1;
    return room.players.length >= min && room.players.every((p) => p.ready);
  }

  anyConnected(room: Room): boolean {
    return room.players.some((p) => p.connected);
  }

  destroy(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    for (const p of room.players) this.userRoom.delete(p.userId);
    for (const s of room.spectators) this.userRoom.delete(s.userId);
    this.codes.delete(room.code);
    this.rooms.delete(roomId);
  }

  toState(room: Room): RoomState {
    return {
      roomId: room.id,
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      mode: room.mode,
      mapId: room.mapId,
      difficulty: room.difficulty,
      players: room.players.map((p) => ({ ...p })),
      spectators: room.spectators.map((s) => ({ ...s })),
      countdownEndsAt: room.countdownEndsAt,
    };
  }

  private uniqueCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < ROOM.CODE_LENGTH; i++)
        code += CODE_ALPHABET[this.randomIndex(CODE_ALPHABET.length)];
      if (!this.codes.has(code)) return code;
    }
  }
}
