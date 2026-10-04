import type {
  Ack,
  ChatMessage,
  Difficulty,
  GameMode,
  MatchEvent,
  SendType,
  PerkId,
  TowerBranch,
  GameOverPayload,
  GameStartPayload,
  RoomState,
  Snapshot,
  TargetMode,
  TowerType,
  ErrorCode,
} from '../types';

export const EVENTS = {
  // client -> server
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_READY: 'room:ready',
  ROOM_START: 'room:start',
  ROOM_RECONNECT: 'room:reconnect',
  ROOM_SPECTATE: 'room:spectate',
  TOWER_PLACE: 'tower:place',
  TOWER_UPGRADE: 'tower:upgrade',
  TOWER_SELL: 'tower:sell',
  TOWER_SET_TARGET: 'tower:setTarget',
  WAVE_SKIP: 'wave:skip',
  SEND_ENEMY: 'send:enemy',
  PERK_CHOOSE: 'perk:choose',
  CHAT_SEND: 'chat:send',
  // server -> client
  ROOM_STATE: 'room:state',
  GAME_START: 'game:start',
  GAME_SNAPSHOT: 'game:snapshot',
  GAME_EVENT: 'game:event',
  GAME_OVER: 'game:over',
  CHAT_MESSAGE: 'chat:message',
  ERROR: 'error',
} as const;

export type AckFn<T = object> = (res: Ack<T>) => void;

export interface ClientToServerEvents {
  'room:create': (
    p: { mode: GameMode; mapId: string; difficulty: Difficulty },
    ack: AckFn<{ roomId: string; code: string }>,
  ) => void;
  'room:join': (p: { code: string }, ack: AckFn<{ roomId: string }>) => void;
  'room:leave': (p: Record<string, never>, ack: AckFn) => void;
  'room:ready': (p: { ready: boolean }, ack: AckFn) => void;
  'room:start': (p: Record<string, never>, ack: AckFn) => void; // host force-start
  'room:reconnect': (p: { roomId: string }, ack: AckFn<{ roomId: string }>) => void;
  'room:spectate': (p: { code: string }, ack: AckFn<{ roomId: string }>) => void;
  'tower:place': (p: { type: TowerType; x: number; y: number }, ack: AckFn) => void;
  'tower:upgrade': (p: { towerId: number; branch?: TowerBranch }, ack: AckFn) => void;
  'perk:choose': (p: { perk: PerkId }, ack: AckFn) => void;
  'tower:sell': (p: { towerId: number }, ack: AckFn) => void;
  'tower:setTarget': (p: { towerId: number; mode: TargetMode }, ack: AckFn) => void;
  'wave:skip': (p: Record<string, never>, ack: AckFn) => void;
  'send:enemy': (p: { type: SendType; target?: string }, ack: AckFn) => void;
  'chat:send': (p: { text: string }, ack: AckFn) => void;
}

export interface ServerToClientEvents {
  'room:state': (s: RoomState) => void;
  'game:start': (p: GameStartPayload) => void;
  'game:snapshot': (s: Snapshot) => void;
  'game:event': (e: MatchEvent) => void;
  'game:over': (p: GameOverPayload) => void;
  'chat:message': (m: ChatMessage) => void;
  error: (e: { code: ErrorCode; message: string }) => void;
}

export interface SocketData {
  userId: string;
  name: string;
}
