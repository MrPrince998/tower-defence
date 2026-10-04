import { create } from 'zustand';
import { STORAGE } from '@/lib/config';
import { readJson, writeJson } from '@/lib/storage';

interface SettingsState {
  volume: number; // 0..1
  muted: boolean;
  showPath: boolean;
  hydrate(): void;
  setVolume(v: number): void;
  toggleMute(): void;
  togglePath(): void;
}

type Persisted = Pick<SettingsState, 'volume' | 'muted' | 'showPath'>;

const persist = (s: Persisted) =>
  writeJson(STORAGE.audio, { volume: s.volume, muted: s.muted, showPath: s.showPath });

export const useSettingsStore = create<SettingsState>((set, get) => ({
  volume: 0.6,
  muted: false,
  showPath: true,
  hydrate() {
    const saved = readJson<Persisted>(STORAGE.audio);
    if (saved) set({ volume: saved.volume ?? 0.6, muted: !!saved.muted, showPath: saved.showPath ?? true });
  },
  setVolume(volume) {
    set({ volume, muted: false });
    persist(get());
  },
  toggleMute() {
    set({ muted: !get().muted });
    persist(get());
  },
  togglePath() {
    set({ showPath: !get().showPath });
    persist(get());
  },
}));
