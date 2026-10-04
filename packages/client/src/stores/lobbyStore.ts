import { create } from 'zustand';
import type { RoomState } from '@maze/shared';

interface LobbyState {
  room: RoomState | null;
  connected: boolean;
  setRoom(room: RoomState | null): void;
  setConnected(connected: boolean): void;
}

export const useLobbyStore = create<LobbyState>((set) => ({
  room: null,
  connected: false,
  setRoom: (room) => set({ room }),
  setConnected: (connected) => set({ connected }),
}));
