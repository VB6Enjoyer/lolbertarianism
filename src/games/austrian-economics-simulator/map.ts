// The city: a grid of streets and blocks. Tile (x, y) has its center at (x, y);
// streets run along a few columns and rows, everything else is buildings.

export const COLS = 18;
export const ROWS = 11;
export const ROAD_COLS: readonly number[] = [1, 6, 11, 16];
export const ROAD_ROWS: readonly number[] = [1, 5, 9];

export interface Tile {
  x: number;
  y: number;
}

export const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
export const isRoad = (x: number, y: number) => inBounds(x, y) && (ROAD_COLS.includes(x) || ROAD_ROWS.includes(y));
export const isIntersection = (x: number, y: number) => ROAD_COLS.includes(x) && ROAD_ROWS.includes(y);
export const sameTile = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y;

export type PlaceId = 'fed' | 'pawn' | 'yard-near' | 'hardware' | 'squat' | 'dealer' | 'yard-far';

export interface Place {
  id: PlaceId;
  name: string;
  icon: string;
  /** The block it fills (tiles), and the street tile in front of its door. */
  block: { x: number; y: number; w: number; h: number };
  door: Tile;
}

export const PLACES: readonly Place[] = [
  { id: 'fed', name: 'Federal Reserve', icon: '🏛️', block: { x: 2, y: 2, w: 4, h: 3 }, door: { x: 3, y: 1 } },
  { id: 'pawn', name: 'Gresham Pawn & Gold', icon: '🪙', block: { x: 7, y: 0, w: 2, h: 1 }, door: { x: 7, y: 1 } },
  { id: 'yard-near', name: 'Cantillon Scrap & Salvage', icon: '🏗️', block: { x: 7, y: 2, w: 4, h: 3 }, door: { x: 9, y: 1 } },
  { id: 'hardware', name: 'Roundabout Hardware', icon: '🔧', block: { x: 12, y: 2, w: 4, h: 3 }, door: { x: 13, y: 5 } },
  { id: 'squat', name: 'Your Squat', icon: '🛏️', block: { x: 2, y: 6, w: 4, h: 3 }, door: { x: 4, y: 5 } },
  { id: 'dealer', name: 'The Corner', icon: '💊', block: { x: 7, y: 6, w: 4, h: 3 }, door: { x: 8, y: 9 } },
  { id: 'yard-far', name: 'Last-in-Line Recycling', icon: '♻️', block: { x: 12, y: 6, w: 4, h: 3 }, door: { x: 14, y: 9 } },
];

export const placeById = (id: PlaceId) => PLACES.find((p) => p.id === id)!;

/** The place whose door is on this tile (the Fed's door is its discount window). */
export const placeAtDoor = (t: Tile) => PLACES.find((p) => sameTile(p.door, t)) ?? null;

/** The place whose block covers this tile. */
export const placeAtBlock = (t: Tile) =>
  PLACES.find((p) => t.x >= p.block.x && t.x < p.block.x + p.block.w && t.y >= p.block.y && t.y < p.block.y + p.block.h) ?? null;

/** Where manholes can be: street tiles away from doors and crossings. */
export const MANHOLE_SLOTS: readonly Tile[] = [
  { x: 4, y: 1 }, { x: 13, y: 1 }, { x: 15, y: 1 },
  { x: 2, y: 5 }, { x: 8, y: 5 }, { x: 10, y: 5 }, { x: 14, y: 5 },
  { x: 3, y: 9 }, { x: 10, y: 9 }, { x: 12, y: 9 }, { x: 15, y: 9 },
  { x: 1, y: 3 }, { x: 1, y: 7 }, { x: 6, y: 3 }, { x: 6, y: 7 },
  { x: 11, y: 3 }, { x: 11, y: 7 }, { x: 16, y: 3 }, { x: 16, y: 7 },
];

/** The Fed's own manhole, right outside: worth a fortune, and alarmed. */
export const FED_COVER: Tile = { x: 2, y: 1 };

/** The ones with a cover at the start; the rest come with infrastructure bills. */
export const STARTING_SLOTS = 11;

/** City Works trucks come in from here (the right end of the middle street). */
export const DEPOT: Tile = { x: 17, y: 5 };

export const ROAD_TILES: readonly Tile[] = (() => {
  const tiles: Tile[] = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (isRoad(x, y)) tiles.push({ x, y });
  return tiles;
})();

const DIRS: readonly Tile[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

/** The shortest street path from `from` to `to`, not including `from` (empty if already there or unreachable). */
export function findPath(from: Tile, to: Tile): Tile[] {
  if (!isRoad(to.x, to.y) || sameTile(from, to)) return [];
  const key = (t: Tile) => t.y * COLS + t.x;
  const prev = new Map<number, Tile | null>([[key(from), null]]);
  const queue: Tile[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (sameTile(cur, to)) break;
    for (const d of DIRS) {
      const next = { x: cur.x + d.x, y: cur.y + d.y };
      if (!isRoad(next.x, next.y) || prev.has(key(next))) continue;
      prev.set(key(next), cur);
      queue.push(next);
    }
  }
  if (!prev.has(key(to))) return [];
  const path: Tile[] = [];
  for (let t: Tile | null = to; t && !sameTile(t, from); t = prev.get(key(t)) ?? null) path.unshift(t);
  return path;
}

/** The nearest street tile to a point (for taps on buildings). */
export function nearestRoad(x: number, y: number): Tile {
  let best = ROAD_TILES[0];
  let bestD = Infinity;
  for (const t of ROAD_TILES) {
    const d = (t.x - x) ** 2 + (t.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}
