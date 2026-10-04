'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { EVENTS } from '@maze/shared';
import { GameView } from '@/components/game/GameView';
import { RequireAuth } from '@/components/RequireAuth';
import { RoomLobby } from '@/components/room/RoomLobby';
import { ERROR_TEXT } from '@/lib/errors';
import { rememberRoom, request } from '@/lib/net';
import { useGameStore } from '@/stores/gameStore';
import { useLobbyStore } from '@/stores/lobbyStore';

export default function RoomPage() {
  return (
    <RequireAuth>
      <Room />
    </RequireAuth>
  );
}

function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const room = useLobbyStore((s) => s.room);
  const connected = useLobbyStore((s) => s.connected);
  const phase = useGameStore((s) => s.phase);
  const gameRoom = useGameStore((s) => s.roomId);
  const asked = useRef(false);

  // Page refresh / direct link: ask the server for the full state of this room.
  useEffect(() => {
    // Only ask once, and never after we have been in this room (leaving must not trigger a rejoin attempt).
    if (room?.roomId === roomId) {
      asked.current = true;
      return;
    }
    if (!connected || asked.current) return;
    asked.current = true;
    rememberRoom(roomId);
    void request(EVENTS.ROOM_RECONNECT, { roomId }).then((res) => {
      if (!res.ok) {
        rememberRoom(null);
        useGameStore.getState().toast(ERROR_TEXT[res.code] ?? 'Room not found');
        router.replace('/lobby');
      }
    });
  }, [connected, room, roomId, router]);

  const inGame = (phase === 'playing' || phase === 'over') && gameRoom === roomId;
  if (inGame) return <GameView />;
  if (!room || room.roomId !== roomId) {
    return (
      <div className="p-16 text-center text-slate-400">
        {connected ? 'Joining room…' : 'Connecting to server…'}
      </div>
    );
  }
  return <RoomLobby room={room} />;
}
