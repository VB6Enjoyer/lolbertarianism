// The city: a grid of streets and blocks. Tile (x, y) has its center at (x, y);
// streets run along a few columns and rows, everything else is buildings.
//
// There are two districts. The exports below describe the current one and
// change with setDistrict() (ES modules hand out live bindings, so every
// importer sees the switch).

export interface Tile {
  x: number;
  y: number;
}

export type PlaceId = 'fed' | 'pawn' | 'yard-near' | 'hardware' | 'squat' | 'dealer' | 'yard-far';

export interface Place {
  id: PlaceId;
  name: string;
  icon: string;
  /** The block it fills (tiles), and the street tile in front of its door. */
  block: { x: number; y: number; w: number; h: number };
  door: Tile;
}

export type DistrictId = 'downtown' | 'suburbs';

export interface District {
  id: DistrictId;
  name: string;
  icon: string;
  description: string;
  cols: number;
  rows: number;
  roadCols: readonly number[];
  roadRows: readonly number[];
  places: readonly Place[];
  /** Where manholes can be (street tiles away from doors and crossings), and how many have a cover at the start. */
  slots: readonly Tile[];
  startingSlots: number;
  /** The Fed's own manhole, right outside: worth a fortune, and alarmed. */
  fedCover: Tile;
  /** City Works trucks come in from here. */
  depot: Tile;
  /** Where you start (your squat's door), and where the first cop starts. */
  start: Tile;
  copStart: Tile;
  /** Cops on patrol at the start, and at most. */
  startCops: number;
  maxCops: number;
  /** How often a cover is brass. */
  brassChance: number;
  /** Utils you need downtown to move here (0: open from the start). */
  unlockUtils: number;
}

const NAMES: Record<PlaceId, [string, string]> = {
  fed: ['Federal Reserve', '🏛️'],
  pawn: ['Gresham Pawn & Gold', '🪙'],
  'yard-near': ['Cantillon Scrap & Salvage', '🏗️'],
  hardware: ['Roundabout Hardware', '🔧'],
  squat: ['Your Squat', '🛏️'],
  dealer: ['The Corner', '💊'],
  'yard-far': ['Last-in-Line Recycling', '♻️'],
};

const place = (id: PlaceId, block: Place['block'], door: Tile): Place => ({ id, name: NAMES[id][0], icon: NAMES[id][1], block, door });

export const DISTRICTS: readonly District[] = [
  {
    id: 'downtown',
    name: 'Downtown',
    icon: '🏙️',
    description: 'Tight streets, the Fed next door, and cops everywhere.',
    cols: 18,
    rows: 11,
    roadCols: [1, 6, 11, 16],
    roadRows: [1, 5, 9],
    places: [
      place('fed', { x: 2, y: 2, w: 4, h: 3 }, { x: 3, y: 1 }),
      place('pawn', { x: 7, y: 0, w: 2, h: 1 }, { x: 7, y: 1 }),
      place('yard-near', { x: 7, y: 2, w: 4, h: 3 }, { x: 9, y: 1 }),
      place('hardware', { x: 12, y: 2, w: 4, h: 3 }, { x: 13, y: 5 }),
      place('squat', { x: 2, y: 6, w: 4, h: 3 }, { x: 4, y: 5 }),
      place('dealer', { x: 7, y: 6, w: 4, h: 3 }, { x: 8, y: 9 }),
      place('yard-far', { x: 12, y: 6, w: 4, h: 3 }, { x: 14, y: 9 }),
    ],
    slots: [
      { x: 4, y: 1 }, { x: 13, y: 1 }, { x: 15, y: 1 },
      { x: 2, y: 5 }, { x: 8, y: 5 }, { x: 10, y: 5 }, { x: 14, y: 5 },
      { x: 3, y: 9 }, { x: 10, y: 9 }, { x: 12, y: 9 }, { x: 15, y: 9 },
      { x: 1, y: 3 }, { x: 1, y: 7 }, { x: 6, y: 3 }, { x: 6, y: 7 },
      { x: 11, y: 3 }, { x: 11, y: 7 }, { x: 16, y: 3 }, { x: 16, y: 7 },
    ],
    startingSlots: 11,
    fedCover: { x: 2, y: 1 },
    depot: { x: 17, y: 5 },
    start: { x: 4, y: 5 },
    copStart: { x: 16, y: 1 },
    startCops: 1,
    maxCops: 3,
    brassChance: 0.15,
    unlockUtils: 0,
  },
  {
    id: 'suburbs',
    name: 'The Suburbs',
    icon: '🏡',
    description: 'Long streets, more brass, fewer cops (at first). The Fed is far, far away.',
    cols: 21,
    rows: 13,
    roadCols: [1, 7, 13, 19],
    roadRows: [1, 6, 11],
    places: [
      place('squat', { x: 2, y: 2, w: 5, h: 4 }, { x: 3, y: 6 }),
      place('pawn', { x: 9, y: 0, w: 2, h: 1 }, { x: 9, y: 1 }),
      place('hardware', { x: 8, y: 2, w: 5, h: 4 }, { x: 10, y: 6 }),
      place('fed', { x: 14, y: 2, w: 5, h: 4 }, { x: 15, y: 1 }),
      place('yard-far', { x: 2, y: 7, w: 5, h: 4 }, { x: 4, y: 11 }),
      place('dealer', { x: 8, y: 7, w: 5, h: 4 }, { x: 10, y: 11 }),
      place('yard-near', { x: 14, y: 7, w: 5, h: 4 }, { x: 16, y: 6 }),
    ],
    slots: [
      { x: 3, y: 1 }, { x: 5, y: 1 }, { x: 11, y: 1 }, { x: 12, y: 1 },
      { x: 5, y: 6 }, { x: 9, y: 6 }, { x: 12, y: 6 }, { x: 14, y: 6 }, { x: 18, y: 6 },
      { x: 2, y: 11 }, { x: 6, y: 11 }, { x: 9, y: 11 }, { x: 12, y: 11 }, { x: 15, y: 11 }, { x: 18, y: 11 },
      { x: 1, y: 3 }, { x: 1, y: 9 }, { x: 7, y: 4 }, { x: 7, y: 9 },
      { x: 13, y: 3 }, { x: 13, y: 8 }, { x: 19, y: 4 }, { x: 19, y: 9 },
    ],
    startingSlots: 13,
    fedCover: { x: 17, y: 1 },
    depot: { x: 20, y: 6 },
    start: { x: 3, y: 6 },
    copStart: { x: 19, y: 11 },
    startCops: 0,
    maxCops: 2,
    brassChance: 0.25,
    unlockUtils: 150,
  },
];

export const districtById = (id: DistrictId) => DISTRICTS.find((d) => d.id === id) ?? DISTRICTS[0];

export let DISTRICT: District = DISTRICTS[0];
export let COLS = 0;
export let ROWS = 0;
export let ROAD_COLS: readonly number[] = [];
export let ROAD_ROWS: readonly number[] = [];
export let PLACES: readonly Place[] = [];
export let MANHOLE_SLOTS: readonly Tile[] = [];
export let STARTING_SLOTS = 0;
export let FED_COVER: Tile = { x: 0, y: 0 };
export let DEPOT: Tile = { x: 0, y: 0 };
export let ROAD_TILES: readonly Tile[] = [];

export const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
export const isRoad = (x: number, y: number) => inBounds(x, y) && (ROAD_COLS.includes(x) || ROAD_ROWS.includes(y));
export const isIntersection = (x: number, y: number) => ROAD_COLS.includes(x) && ROAD_ROWS.includes(y);
export const sameTile = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y;

/** Switches the whole map to another district. */
export function setDistrict(id: DistrictId): District {
  const d = districtById(id);
  DISTRICT = d;
  COLS = d.cols;
  ROWS = d.rows;
  ROAD_COLS = d.roadCols;
  ROAD_ROWS = d.roadRows;
  PLACES = d.places;
  MANHOLE_SLOTS = d.slots;
  STARTING_SLOTS = d.startingSlots;
  FED_COVER = d.fedCover;
  DEPOT = d.depot;
  const tiles: Tile[] = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (isRoad(x, y)) tiles.push({ x, y });
  ROAD_TILES = tiles;
  return d;
}

setDistrict('downtown');

export const placeById = (id: PlaceId) => PLACES.find((p) => p.id === id)!;

/** The place whose door is on this tile (the Fed's door is its discount window). */
export const placeAtDoor = (t: Tile) => PLACES.find((p) => sameTile(p.door, t)) ?? null;

/** The place whose block covers this tile. */
export const placeAtBlock = (t: Tile) =>
  PLACES.find((p) => t.x >= p.block.x && t.x < p.block.x + p.block.w && t.y >= p.block.y && t.y < p.block.y + p.block.h) ?? null;

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
