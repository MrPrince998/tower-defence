import { RoomManager } from '../src/rooms/RoomManager';

const u = (id: string) => ({ userId: id, name: `user-${id}` });

describe('RoomManager', () => {
  it('creates rooms with unique 4-letter codes', () => {
    const rm = new RoomManager();
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const r = rm.create(u(`h${i}`), { mapId: 'meadow', difficulty: 'normal' });
      if (!r.ok) throw new Error('create failed');
      expect(r.room.code).toMatch(/^[A-Z]{4}$/);
      codes.add(r.room.code);
    }
    expect(codes.size).toBe(50);
  });

  it('retries on code collisions', () => {
    const seq = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1];
    const rm = new RoomManager(() => seq.shift() ?? 2);
    const a = rm.create(u('a'), { mapId: 'meadow', difficulty: 'normal' });
    const b = rm.create(u('b'), { mapId: 'meadow', difficulty: 'normal' });
    expect(a.ok && b.ok && a.room.code !== b.room.code).toBe(true);
  });

  it('rejects joins to a full room (max 4)', () => {
    const rm = new RoomManager();
    const r = rm.create(u('1'), { mapId: 'meadow', difficulty: 'normal' });
    if (!r.ok) throw new Error();
    for (const id of ['2', '3', '4']) expect(rm.join(r.room.code, u(id)).ok).toBe(true);
    expect(rm.join(r.room.code, u('5'))).toEqual({ ok: false, code: 'ROOM_FULL' });
    expect(rm.playerCount).toBe(4);
  });

  it('duplicate join is idempotent; joining another room is rejected', () => {
    const rm = new RoomManager();
    const r1 = rm.create(u('1'), { mapId: 'meadow', difficulty: 'normal' });
    const r2 = rm.create(u('2'), { mapId: 'meadow', difficulty: 'normal' });
    if (!r1.ok || !r2.ok) throw new Error();
    expect(rm.join(r1.room.code, u('3')).ok).toBe(true);
    expect(rm.join(r1.room.code, u('3')).ok).toBe(true);
    expect(r1.room.players).toHaveLength(2);
    expect(rm.join(r2.room.code, u('3'))).toEqual({ ok: false, code: 'ALREADY_IN_ROOM' });
    expect(rm.create(u('3'), { mapId: 'meadow', difficulty: 'normal' })).toEqual({
      ok: false,
      code: 'ALREADY_IN_ROOM',
    });
    expect(rm.join('ZZZZ', u('9'))).toEqual({ ok: false, code: 'ROOM_NOT_FOUND' });
    expect(rm.join(r1.room.code.toLowerCase(), u('4')).ok).toBe(true);
  });

  it('transfers host on leave and destroys empty rooms', () => {
    const rm = new RoomManager();
    const r = rm.create(u('1'), { mapId: 'meadow', difficulty: 'normal' });
    if (!r.ok) throw new Error();
    rm.join(r.room.code, u('2'));
    rm.join(r.room.code, u('3'));
    rm.setConnected('2', false);
    expect(rm.leave('1')).toMatchObject({ destroyed: false });
    expect(r.room.hostId).toBe('3'); // first *connected* player
    expect(rm.leave('3')).toMatchObject({ destroyed: false });
    expect(r.room.hostId).toBe('2');
    expect(rm.leave('2')).toMatchObject({ destroyed: true });
    expect(rm.get(r.room.id)).toBeUndefined();
    expect(rm.byCode(r.room.code)).toBeUndefined();
    expect(rm.leave('2')).toBeNull();
    expect(rm.size).toBe(0);
  });

  it('tracks ready state and rejects joins after the game started', () => {
    const rm = new RoomManager();
    const r = rm.create(u('1'), { mapId: 'meadow', difficulty: 'hard' });
    if (!r.ok) throw new Error();
    rm.join(r.room.code, u('2'));
    expect(rm.allReady(r.room)).toBe(false);
    rm.setReady('1', true);
    rm.setReady('2', true);
    expect(rm.allReady(r.room)).toBe(true);
    expect(rm.setReady('nobody', true)).toEqual({ ok: false, code: 'NOT_IN_ROOM' });
    r.room.status = 'running';
    expect(rm.join(r.room.code, u('3'))).toEqual({ ok: false, code: 'GAME_IN_PROGRESS' });
    expect(rm.setReady('1', false)).toEqual({ ok: false, code: 'GAME_IN_PROGRESS' });
    expect(rm.toState(r.room)).toMatchObject({ status: 'running', difficulty: 'hard', spectators: [] });
  });

  it('solo rooms hold one player; versus needs two ready players', () => {
    const rm = new RoomManager();
    const solo = rm.create(u('s'), { mode: 'solo', mapId: 'meadow', difficulty: 'easy' });
    if (!solo.ok) throw new Error();
    expect(rm.join(solo.room.code, u('t'))).toEqual({ ok: false, code: 'ROOM_FULL' });
    rm.setReady('s', true);
    expect(rm.allReady(solo.room)).toBe(true);
    const vs = rm.create(u('v1'), { mode: 'versus', mapId: 'meadow', difficulty: 'normal' });
    if (!vs.ok) throw new Error();
    rm.setReady('v1', true);
    expect(rm.allReady(vs.room)).toBe(false);
    rm.join(vs.room.code, u('v2'));
    rm.setReady('v2', true);
    expect(rm.allReady(vs.room)).toBe(true);
    expect(rm.toState(vs.room).mode).toBe('versus');
  });

  it('spectators join running rooms but cannot ready up', () => {
    const rm = new RoomManager();
    const r = rm.create(u('1'), { mapId: 'meadow', difficulty: 'normal' });
    if (!r.ok) throw new Error();
    r.room.status = 'running';
    expect(rm.spectate(r.room.code, u('s')).ok).toBe(true);
    expect(rm.spectate(r.room.code, u('s')).ok).toBe(true);
    expect(rm.isSpectator(r.room, 's')).toBe(true);
    expect(rm.setReady('s', true)).toEqual({ ok: false, code: 'SPECTATOR' });
    expect(rm.leave('s')).toMatchObject({ destroyed: false });
    expect(r.room.spectators).toHaveLength(0);
    expect(rm.spectate('QQQQ', u('x'))).toEqual({ ok: false, code: 'ROOM_NOT_FOUND' });
  });
});
