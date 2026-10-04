import {
  buildBlocked,
  computeFlowField,
  INF,
  isBuildableCell,
  MAPS,
  parseMap,
  spawnsReachable,
  tracePath,
} from '../src';

describe('computeFlowField', () => {
  const map = parseMap('t', 'T', ['S...G', '.###.', '.....']);

  it('computes BFS step distance to the goal', () => {
    const dist = computeFlowField(map.width, map.height, buildBlocked(map), map.goal);
    expect(dist[4]).toBe(0);
    expect(dist[0]).toBe(4);
    expect(dist[1 * 5 + 1]).toBe(INF); // rock
  });

  it('routes around towers and reports unreachable spawns', () => {
    const blocked = buildBlocked(map, [{ x: 2, y: 0 }]);
    const dist = computeFlowField(map.width, map.height, blocked, map.goal);
    expect(dist[0]).toBe(8);
    expect(spawnsReachable(map, dist)).toBe(true);
    const sealed = buildBlocked(map, [
      { x: 2, y: 0 },
      { x: 2, y: 2 },
    ]);
    expect(spawnsReachable(map, computeFlowField(5, 3, sealed, map.goal))).toBe(false);
  });

  it('traces a path from spawn to goal', () => {
    const dist = computeFlowField(map.width, map.height, buildBlocked(map), map.goal);
    const path = tracePath(map, dist, map.spawns[0]);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 4, y: 0 });
    expect(path).toHaveLength(5);
  });

  it('only plain cells are buildable', () => {
    expect(isBuildableCell(map, 1, 0)).toBe(true);
    expect(isBuildableCell(map, 0, 0)).toBe(false); // spawn
    expect(isBuildableCell(map, 4, 0)).toBe(false); // goal
    expect(isBuildableCell(map, 1, 1)).toBe(false); // rock
    expect(isBuildableCell(map, -1, 0)).toBe(false);
    expect(isBuildableCell(map, 1.5, 0)).toBe(false);
  });
});

describe('maps', () => {
  it.each(Object.values(MAPS))('$id is solvable and 20x14', (map) => {
    expect(map.width).toBe(20);
    expect(map.height).toBe(14);
    const dist = computeFlowField(map.width, map.height, buildBlocked(map), map.goal);
    expect(spawnsReachable(map, dist)).toBe(true);
  });

  it('rejects malformed maps', () => {
    expect(() => parseMap('x', 'X', ['S.G', '..'])).toThrow(/length/);
    expect(() => parseMap('x', 'X', ['S..'])).toThrow(/goal/);
    expect(() => parseMap('x', 'X', ['..G'])).toThrow(/spawns/);
  });
});
