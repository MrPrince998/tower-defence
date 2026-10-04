import { create } from 'zustand';
import {
  DIFFICULTY,
  ENEMIES,
  VERSUS,
  type ChatMessage,
  type ClientConfig,
  type GameEvent,
  type GameMode,
  type GameOverPayload,
  type GameStartPayload,
  type MapData,
  type PerkId,
  type RoomPlayer,
  type Snapshot,
  type TowerSnap,
  type TowerType,
  type WavePreview,
  type WaveState,
} from '@maze/shared';

export interface Toast {
  id: number;
  text: string;
  kind: 'error' | 'info' | 'success';
}

export interface Banner {
  id: number;
  title: string;
  subtitle?: string;
  kind: 'wave' | 'boss' | 'clear' | 'info' | 'danger';
}

/** One line in the versus battle feed (sends, knock-outs). */
export interface FeedItem {
  id: number;
  text: string;
  kind: 'incoming' | 'outgoing' | 'other' | 'elimination';
}

export interface BoardHud {
  id: string;
  wave: number;
  waveState: WaveState;
  nextWaveIn: number;
  baseHp: number;
  gold: number;
  income: number;
  alive: boolean;
  placement: number | null;
  perks: PerkId[];
  perkOffer: PerkId[] | null;
}

interface GameState {
  phase: 'idle' | 'playing' | 'over';
  roomId: string | null;
  mode: GameMode;
  myId: string | null;
  map: MapData | null;
  config: ClientConfig | null;
  players: RoomPlayer[];
  boardIds: string[];
  boards: Record<string, BoardHud>;
  maxBaseHp: number;
  nextWave: Record<string, WavePreview | null>;
  towers: Record<string, Record<number, TowerSnap>>;
  towersVersion: number;
  /** Board shown in the main view (your own by default; click an opponent to watch theirs). */
  viewBoard: string | null;
  buildType: TowerType | null;
  selectedTowerId: number | null;
  sendTarget: string | null; // null = next opponent
  toasts: Toast[];
  banner: Banner | null;
  feed: FeedItem[];
  gameOver: GameOverPayload | null;
  chat: ChatMessage[];

  start(roomId: string, myId: string | null, p: GameStartPayload): void;
  applySnapshot(s: Snapshot): void;
  applyEvent(board: string, e: GameEvent): void;
  setGameOver(p: GameOverPayload): void;
  setPlayers(players: RoomPlayer[]): void;
  setBuildType(t: TowerType | null): void;
  selectTower(id: number | null): void;
  setViewBoard(id: string): void;
  setSendTarget(id: string | null): void;
  toast(text: string, kind?: Toast['kind']): void;
  dismissToast(id: number): void;
  showBanner(b: Omit<Banner, 'id'>): void;
  addChat(m: ChatMessage): void;
  reset(): void;
}

let nextId = 1;

export function playerName(players: RoomPlayer[], id: string): string {
  return players.find((p) => p.userId === id)?.name ?? 'someone';
}

/** True when the local player controls the board currently shown. */
export function canControlView(
  s: Pick<GameState, 'myId' | 'viewBoard' | 'boards' | 'config' | 'phase'>,
): boolean {
  return (
    s.phase === 'playing' &&
    s.config?.role === 'player' &&
    !!s.myId &&
    s.viewBoard === s.myId &&
    !!s.boards[s.myId]?.alive
  );
}

const initial = {
  phase: 'idle' as const,
  roomId: null,
  mode: 'solo' as GameMode,
  myId: null,
  map: null,
  config: null,
  players: [],
  boardIds: [],
  boards: {},
  maxBaseHp: 0,
  nextWave: {},
  towers: {},
  viewBoard: null,
  buildType: null,
  selectedTowerId: null,
  sendTarget: null,
  banner: null,
  feed: [],
  gameOver: null,
  chat: [],
};

export const useGameStore = create<GameState>((set, get) => ({
  ...initial,
  towersVersion: 0,
  toasts: [],

  start(roomId, myId, p) {
    const sameGame = get().roomId === roomId && get().phase === 'playing';
    const boardIds = p.snapshot.boards.map((b) => b.id);
    const boards: Record<string, BoardHud> = {};
    const towers: Record<string, Record<number, TowerSnap>> = {};
    const nextWave: Record<string, WavePreview | null> = {};
    for (const b of p.snapshot.boards) {
      boards[b.id] = hudOf(b);
      towers[b.id] = Object.fromEntries((b.towers ?? []).map((t) => [t.id, t]));
      nextWave[b.id] = b.nextWave ?? null;
    }
    const mine = myId && boardIds.includes(myId) ? myId : null;
    const prevView = get().viewBoard;
    set({
      phase: 'playing',
      roomId,
      mode: p.config.mode,
      myId: mine,
      map: p.map,
      config: p.config,
      players: p.players,
      boardIds,
      boards,
      maxBaseHp: p.config.mode === 'versus' ? VERSUS.BASE_HP : DIFFICULTY[p.config.difficulty].baseHp,
      nextWave,
      towers,
      towersVersion: get().towersVersion + 1,
      viewBoard:
        sameGame && prevView && boardIds.includes(prevView) ? prevView : (mine ?? boardIds[0] ?? null),
      gameOver: null,
      buildType: null,
      selectedTowerId: sameGame ? get().selectedTowerId : null,
      feed: sameGame ? get().feed : [],
      chat: sameGame ? get().chat : [],
    });
  },

  applySnapshot(s) {
    const state = get();
    const boards = { ...state.boards };
    let towers = state.towers;
    let nextWave = state.nextWave;
    let towersChanged = false;
    for (const b of s.boards) {
      boards[b.id] = hudOf(b);
      if (b.nextWave !== undefined) nextWave = { ...nextWave, [b.id]: b.nextWave };
      if (b.towers) {
        towers = { ...towers, [b.id]: Object.fromEntries(b.towers.map((t) => [t.id, t])) };
        towersChanged = true;
      }
    }
    const patch: Partial<GameState> = { boards, nextWave };
    if (towersChanged) {
      patch.towers = towers;
      patch.towersVersion = state.towersVersion + 1;
      const view = state.viewBoard;
      if (state.selectedTowerId !== null && view && !towers[view]?.[state.selectedTowerId])
        patch.selectedTowerId = null;
    }
    set(patch);
  },

  applyEvent(board, e) {
    const s = get();
    const boardTowers = s.towers[board] ?? {};
    const setBoardTowers = (next: Record<number, TowerSnap>, bump = true) =>
      set({
        towers: { ...s.towers, [board]: next },
        towersVersion: bump ? s.towersVersion + 1 : s.towersVersion,
      });
    const name = (id: string) => (id === s.myId ? 'You' : playerName(s.players, id));
    const focus = board === s.viewBoard;
    switch (e.t) {
      case 'tower_built':
        setBoardTowers({ ...boardTowers, [e.tower.id]: e.tower });
        break;
      case 'tower_upgraded':
        if (boardTowers[e.id])
          setBoardTowers(
            { ...boardTowers, [e.id]: { ...boardTowers[e.id], level: e.level, branch: e.branch } },
            false,
          );
        break;
      case 'tower_target':
        if (boardTowers[e.id])
          setBoardTowers({ ...boardTowers, [e.id]: { ...boardTowers[e.id], targetMode: e.mode } }, false);
        break;
      case 'tower_sold': {
        const next = { ...boardTowers };
        delete next[e.id];
        setBoardTowers(next);
        if (focus && s.selectedTowerId === e.id) set({ selectedTowerId: null });
        break;
      }
      case 'wave_started':
        if (focus)
          s.showBanner(
            e.boss
              ? { title: `Wave ${e.wave}`, subtitle: 'A BOSS APPROACHES', kind: 'boss' }
              : {
                  title: `Wave ${e.wave}`,
                  subtitle: s.mode === 'versus' ? 'Defend — and strike back!' : 'Here they come!',
                  kind: 'wave',
                },
          );
        break;
      case 'wave_cleared':
        if (focus)
          s.showBanner({ title: `Wave ${e.wave} cleared`, subtitle: `+${e.bonus} gold`, kind: 'clear' });
        break;
      case 'enemy_sent': {
        const kind = e.to === s.myId ? 'incoming' : e.from === s.myId ? 'outgoing' : 'other';
        const unit = ENEMIES[e.type].name;
        const text =
          kind === 'incoming'
            ? `⚔ ${name(e.from)} sent a ${unit} at you`
            : kind === 'outgoing'
              ? `➜ ${unit} sent to ${name(e.to)}`
              : `${name(e.from)} → ${name(e.to)}: ${unit}`;
        set({ feed: [...s.feed.slice(-29), { id: nextId++, text, kind }] });
        break;
      }
      case 'player_eliminated': {
        const text =
          e.placement === 1
            ? `🏆 ${name(e.userId)} ${e.userId === s.myId ? 'win' : 'wins'}!`
            : `💀 ${name(e.userId)} ${e.userId === s.myId ? 'were' : 'was'} knocked out (#${e.placement})`;
        set({ feed: [...s.feed.slice(-29), { id: nextId++, text, kind: 'elimination' }] });
        if (e.userId === s.myId && e.placement > 1)
          s.showBanner({
            title: 'Castle fallen',
            subtitle: `You finished #${e.placement} — watch the rest`,
            kind: 'danger',
          });
        else if (e.placement > 1)
          s.showBanner({ title: `${name(e.userId)} is out`, subtitle: `#${e.placement}`, kind: 'info' });
        break;
      }
      default:
        break;
    }
  },

  setGameOver(p) {
    set({ phase: 'over', gameOver: p, buildType: null });
  },
  setPlayers(players) {
    // Keep players who left mid-match (their boards stay on screen).
    const known = new Map(get().players.map((p) => [p.userId, p]));
    for (const p of players) known.set(p.userId, p);
    for (const [id, p] of known)
      if (!players.some((x) => x.userId === id)) known.set(id, { ...p, connected: false });
    set({ players: [...known.values()] });
  },
  setBuildType(t) {
    set({ buildType: t, selectedTowerId: t ? null : get().selectedTowerId });
  },
  selectTower(id) {
    set({ selectedTowerId: id, buildType: id !== null ? null : get().buildType });
  },
  setViewBoard(id) {
    if (!get().boardIds.includes(id)) return;
    set({ viewBoard: id, selectedTowerId: null, buildType: null });
  },
  setSendTarget(id) {
    set({ sendTarget: id });
  },
  toast(text, kind = 'error') {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-3), { id, text, kind }] });
    setTimeout(() => get().dismissToast(id), 2800);
  },
  dismissToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
  showBanner(b) {
    const id = nextId++;
    set({ banner: { ...b, id } });
    setTimeout(() => {
      if (get().banner?.id === id) set({ banner: null });
    }, 2600);
  },
  addChat(m) {
    set({ chat: [...get().chat.slice(-49), m] });
  },
  reset() {
    set({ ...initial });
  },
}));

function hudOf(b: Snapshot['boards'][number]): BoardHud {
  return {
    id: b.id,
    wave: b.wave,
    waveState: b.waveState,
    nextWaveIn: b.nextWaveIn,
    baseHp: b.baseHp,
    gold: b.gold,
    income: b.income,
    alive: b.alive,
    placement: b.placement,
    perks: b.perks ?? [],
    perkOffer: b.perkOffer ?? null,
  };
}
