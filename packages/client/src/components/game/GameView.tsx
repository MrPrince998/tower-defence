'use client';

import { useEffect } from 'react';
import { SEND_TYPES, TOWER_TYPES } from '@maze/shared';
import { unlockAudio } from '@/lib/audio';
import { commands } from '@/lib/net';
import { canControlView, playerName, useGameStore } from '@/stores/gameStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { ChatBox } from './ChatBox';
import { FeedPanel } from './FeedPanel';
import { GameCanvas } from './GameCanvas';
import { GameOverModal } from './GameOverModal';
import { OpponentsPanel } from './OpponentsPanel';
import { PerkPanel } from './PerkPanel';
import { SEND_KEYS, SendPanel } from './SendPanel';
import { TopBar } from './TopBar';
import { TowerPanel } from './TowerPanel';
import { TowerShop } from './TowerShop';
import { WaveBanner } from './WaveBanner';

export function GameView() {
  const map = useGameStore((s) => s.map);
  const mode = useGameStore((s) => s.mode);
  const spectator = useGameStore((s) => s.config?.role === 'spectator');
  const view = useGameStore((s) => s.viewBoard);
  const myId = useGameStore((s) => s.myId);
  const players = useGameStore((s) => s.players);
  const connected = useLobbyStore((s) => s.connected);
  const paused = useLobbyStore((s) => s.room?.status === 'paused');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      )
        return;
      unlockAudio();
      const s = useGameStore.getState();
      if (s.phase !== 'playing') return;
      const key = e.key.toLowerCase();
      if (key === 'escape') {
        s.setBuildType(null);
        s.selectTower(null);
        return;
      }
      if (key === 'tab' && s.boardIds.length > 1) {
        e.preventDefault();
        const i = s.boardIds.indexOf(s.viewBoard ?? '');
        s.setViewBoard(s.boardIds[(i + (e.shiftKey ? s.boardIds.length - 1 : 1)) % s.boardIds.length]);
        return;
      }
      if (key === 'home' && s.myId) {
        s.setViewBoard(s.myId);
        return;
      }
      if (s.config?.role === 'spectator' || !s.myId) return;
      // Sends work from any view; building only on your own board.
      const sendIndex = (SEND_KEYS as readonly string[]).indexOf(key);
      if (sendIndex >= 0 && s.mode === 'versus') {
        void commands.send(SEND_TYPES[sendIndex], s.sendTarget);
        return;
      }
      if (!canControlView(s)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= TOWER_TYPES.length) {
        const type = TOWER_TYPES[n - 1];
        s.setBuildType(s.buildType === type ? null : type);
      } else if (key === 'u') {
        if (s.selectedTowerId !== null) void commands.upgrade(s.selectedTowerId);
      } else if (key === 's') {
        if (s.selectedTowerId !== null) void commands.sell(s.selectedTowerId);
      } else if (key === ' ' && s.mode === 'solo') {
        e.preventDefault();
        void commands.skipWave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!map) return null;
  const watchingOther = view !== null && view !== myId;

  return (
    <div className="flex h-screen flex-col overflow-hidden" onPointerDown={unlockAudio}>
      <TopBar />
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        {mode === 'versus' && (
          <aside className="flex w-64 shrink-0 flex-col gap-3 overflow-y-auto">
            <OpponentsPanel />
            <FeedPanel />
          </aside>
        )}
        <div
          className={`relative min-w-0 flex-1 overflow-hidden rounded-2xl border bg-black/40 shadow-2xl ${
            watchingOther ? 'border-sky-400/50' : 'border-white/10'
          }`}
        >
          <GameCanvas map={map} />
          <WaveBanner />
          <PerkPanel />
          {(!connected || paused) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="panel px-8 py-6 text-center">
                <div className="font-display text-2xl font-bold">
                  {connected ? 'Paused' : 'Reconnecting…'}
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  {connected ? 'Waiting for players to return.' : 'Hold on, restoring your game.'}
                </p>
              </div>
            </div>
          )}
          {(spectator || watchingOther) && view && (
            <div className="absolute top-3 left-3 flex items-center gap-2 rounded-lg bg-black/70 px-3 py-1 text-sm font-semibold text-slate-200">
              👁 {spectator ? 'Spectating' : 'Watching'} {playerName(players, view)}
              {myId && !spectator && (
                <button
                  className="ml-2 rounded bg-amber-400 px-2 text-xs text-slate-900"
                  onClick={() => useGameStore.getState().setViewBoard(myId)}
                >
                  Back (Home)
                </button>
              )}
            </div>
          )}
        </div>
        <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto">
          {!spectator && <TowerShop />}
          {!spectator && mode === 'versus' && <SendPanel />}
          <TowerPanel />
          <ChatBox />
        </aside>
      </div>
      <GameOverModal />
    </div>
  );
}
