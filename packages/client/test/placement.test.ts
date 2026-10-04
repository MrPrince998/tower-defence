import { MAPS, parseMap } from '@maze/shared';
import { previewPlacement } from '../src/game/placement';

const map = parseMap('p', 'P', ['#.###', 'S...G', '#.###']);

describe('previewPlacement', () => {
  const base = { map, towers: [], groundEnemies: [], gold: 500, type: 'arrow' as const };

  it('matches server rules', () => {
    expect(previewPlacement({ ...base, x: 1, y: 0 })).toEqual({ ok: true });
    expect(previewPlacement({ ...base, x: 2, y: 1 })).toEqual({ ok: false, code: 'BLOCKS_PATH' });
    expect(previewPlacement({ ...base, x: 0, y: 1 })).toEqual({ ok: false, code: 'INVALID_CELL' });
    expect(previewPlacement({ ...base, x: 0, y: 0 })).toEqual({ ok: false, code: 'INVALID_CELL' });
    expect(previewPlacement({ ...base, gold: 10, x: 1, y: 0 })).toEqual({
      ok: false,
      code: 'NOT_ENOUGH_GOLD',
    });
    expect(
      previewPlacement({
        ...base,
        towers: [
          {
            id: 1,
            type: 'arrow',
            x: 1,
            y: 0,
            level: 1,
            owner: 'a',
            targetMode: 'first',
            branch: null,
            invested: 50,
          },
        ],
        x: 1,
        y: 0,
      }),
    ).toEqual({ ok: false, code: 'CELL_OCCUPIED' });
    expect(previewPlacement({ ...base, groundEnemies: [{ x: 1.4, y: 0.6 }], x: 1, y: 0 })).toEqual({
      ok: false,
      code: 'CELL_OCCUPIED',
    });
  });

  it('works on the real maps', () => {
    expect(previewPlacement({ ...base, map: MAPS.meadow, x: 5, y: 5 })).toEqual({ ok: true });
  });
});
