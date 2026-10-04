import { CELL, type MapData, type Vec2 } from '../types';

/** Rows use: '.' buildable, '#' rock, 'S' spawn, 'G' goal. */
export function parseMap(id: string, name: string, rows: string[]): MapData {
  const height = rows.length;
  const width = rows[0].length;
  const cells: number[] = [];
  const spawns: Vec2[] = [];
  let goal: Vec2 | null = null;
  rows.forEach((row, y) => {
    if (row.length !== width)
      throw new Error(`map ${id}: row ${y} has length ${row.length}, expected ${width}`);
    [...row].forEach((ch, x) => {
      if (ch === '#') cells.push(CELL.ROCK);
      else if (ch === 'S') {
        cells.push(CELL.SPAWN);
        spawns.push({ x, y });
      } else if (ch === 'G') {
        cells.push(CELL.GOAL);
        goal = { x, y };
      } else cells.push(CELL.BUILDABLE);
    });
  });
  if (!goal) throw new Error(`map ${id}: no goal`);
  if (spawns.length === 0) throw new Error(`map ${id}: no spawns`);
  return { id, name, width, height, cells, spawns, goal };
}

export const MAPS: Record<string, MapData> = {
  meadow: parseMap('meadow', 'Meadow', [
    '....................',
    '..##..........#.....',
    '..#.......#.........',
    'S.........#.....##..',
    '......#.............',
    '......#.........#...',
    '..........##........',
    '...................G',
    '..........##........',
    '......#.........#...',
    'S.....#.............',
    '..#..........#......',
    '..##.....#.......##.',
    '....................',
  ]),
  canyon: parseMap('canyon', 'Canyon', [
    'S..#......#.........',
    '...#..#...#...##....',
    '...#..#.......#.....',
    '......#...#...#..#..',
    '.####.#...#......#..',
    '......###.####...#..',
    '..#..............#..',
    '..#...####..####....',
    '..#......#.....#.###',
    '.....#...#..#.......',
    '.#####...#..#..#....',
    '.....#......#..#.##.',
    '..#..#..###....#....',
    '..#.......#........G',
  ]),
  crossroads: parseMap('crossroads', 'Crossroads', [
    '.........S..........',
    '..#...........#.....',
    '..#....##.....#..#..',
    '.....#.........#....',
    '.#.........#........',
    '......##.......##...',
    'S..................G',
    '...#.....#..#.......',
    '.......#......#.....',
    '.##..........#...#..',
    '.....#..#...........',
    '..#.........##...#..',
    '......#.............',
    '.........S..........',
  ]),
  fortress: parseMap('fortress', 'Fortress', [
    'S..................S',
    '....................',
    '...#............#...',
    '.......#....#.......',
    '........#..#........',
    '.....##......##.....',
    '.......#.....#......',
    '..........G.........',
    '.......#.....#......',
    '.....##......##.....',
    '........#..#........',
    '.......#....#.......',
    '...#............#...',
    'S..................S',
  ]),
};

export const DEFAULT_MAP_ID = 'meadow';
