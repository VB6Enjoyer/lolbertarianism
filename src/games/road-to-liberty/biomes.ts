// Biomes: the landscape changes every few km (fields, desert, beach, snowfield,
// mountains, then around again), blending over a short stretch so you see the
// next one coming. Pure data and math, so the rules and the renderer can share it.

export type BiomeId = 'fields' | 'desert' | 'beach' | 'snow' | 'mountains';

export type RGB = [number, number, number];

/** Roadside things that only grow in certain places (on top of the buildings). */
export type NatureKind = 'cactus' | 'skull' | 'palm' | 'surf-shack' | 'lifeguard' | 'pine' | 'snowy-pine' | 'snowman' | 'ski-lodge' | 'rock' | 'cabin';

export interface Biome {
  id: BiomeId;
  /** Shown when you drive in ("ENTERING THE DESERT"). */
  name: string;
  ground: [RGB, RGB];
  road: [RGB, RGB];
  /** Two layers of distant hills, far then near. */
  hills: [RGB, RGB];
  hillShape: 'rolling' | 'dunes' | 'islands' | 'snowdrifts' | 'peaks';
  /** Sky gradient in daylight (top, bottom). */
  sky: [RGB, RGB];
  /** Water beyond the right-hand side of the road (the beach). */
  sea?: [RGB, RGB];
  /** What lines the road here (repeats make something more common). */
  scenery: readonly string[];
  /** Weather: does rain fall here, and as what? */
  precipitation: 'rain' | 'snow' | 'none';
  /** Always a little slippery (as a share of a full downpour). */
  slip: number;
  /** Hills and curves are this much bigger. */
  terrain: number;
}

export const BIOMES: readonly Biome[] = [
  {
    id: 'fields',
    name: 'the Countryside',
    ground: [[69, 168, 79], [61, 154, 71]],
    road: [[94, 94, 94], [88, 88, 88]],
    hills: [[127, 179, 163], [92, 154, 108]],
    hillShape: 'rolling',
    sky: [[58, 143, 217], [191, 230, 255]],
    scenery: ['billboard', 'house', 'house', 'bar', 'gas-station', 'diner', 'barn'],
    precipitation: 'rain',
    slip: 0,
    terrain: 1,
  },
  {
    id: 'desert',
    name: 'the Desert',
    ground: [[227, 194, 122], [217, 181, 107]],
    road: [[106, 98, 90], [100, 92, 84]],
    hills: [[214, 160, 112], [196, 128, 79]],
    hillShape: 'dunes',
    sky: [[74, 163, 224], [253, 231, 176]],
    scenery: ['cactus', 'cactus', 'cactus', 'skull', 'rock', 'billboard', 'gas-station', 'diner'],
    precipitation: 'none',
    slip: 0,
    terrain: 0.7,
  },
  {
    id: 'beach',
    name: 'the Beach',
    ground: [[240, 220, 160], [232, 210, 144]],
    road: [[100, 100, 104], [94, 94, 98]],
    hills: [[156, 207, 232], [124, 197, 160]],
    hillShape: 'islands',
    sky: [[41, 151, 230], [200, 236, 255]],
    sea: [[30, 136, 229], [25, 118, 210]],
    scenery: ['palm', 'palm', 'palm', 'surf-shack', 'lifeguard', 'bar', 'billboard'],
    precipitation: 'rain',
    slip: 0,
    terrain: 0.4,
  },
  {
    id: 'snow',
    name: 'the Snowfield',
    ground: [[244, 248, 251], [230, 238, 245]],
    road: [[107, 112, 120], [101, 106, 114]],
    hills: [[223, 232, 240], [197, 211, 224]],
    hillShape: 'snowdrifts',
    sky: [[143, 184, 221], [238, 245, 251]],
    scenery: ['snowy-pine', 'snowy-pine', 'snowy-pine', 'snowman', 'ski-lodge', 'billboard'],
    precipitation: 'snow',
    slip: 0.35,
    terrain: 1,
  },
  {
    id: 'mountains',
    name: 'the Mountains',
    ground: [[95, 143, 79], [85, 127, 71]],
    road: [[90, 90, 92], [84, 84, 86]],
    hills: [[138, 148, 166], [91, 107, 120]],
    hillShape: 'peaks',
    sky: [[52, 125, 200], [200, 225, 245]],
    scenery: ['pine', 'pine', 'pine', 'rock', 'rock', 'cabin', 'billboard', 'gas-station'],
    precipitation: 'rain',
    slip: 0,
    terrain: 1.9,
  },
];

/** Each biome lasts 5 km (two borders), in world units (180 per meter). */
export const BIOME_LENGTH = 5000 * 180;
/** The blend into the next one takes this long (about 170 m). */
export const BIOME_BLEND = 30_000;

export interface BiomeSample {
  biome: Biome;
  /** The one being blended into, and how far along (0..1). */
  next: Biome;
  t: number;
  /** How many biomes you've been through (for "entering…"). */
  index: number;
}

/** The biome at track position `z`: the blend happens at the end of each stretch. */
export function biomeAt(z: number): BiomeSample {
  const index = Math.max(0, Math.floor(z / BIOME_LENGTH));
  const into = z - index * BIOME_LENGTH;
  const biome = BIOMES[index % BIOMES.length];
  const next = BIOMES[(index + 1) % BIOMES.length];
  const t = Math.max(0, Math.min(1, (into - (BIOME_LENGTH - BIOME_BLEND)) / BIOME_BLEND));
  return { biome, next, t: t * t * (3 - 2 * t), index };
}

/** A number that differs per biome, blended across the transition. */
export function blendNumber(z: number, pick: (b: Biome) => number): number {
  const s = biomeAt(z);
  return pick(s.biome) + (pick(s.next) - pick(s.biome)) * s.t;
}

export const mixRGB = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;

/** A color that differs per biome, blended across the transition. */
export function blendColor(z: number, pick: (b: Biome) => RGB): RGB {
  const s = biomeAt(z);
  return s.t === 0 ? pick(s.biome) : mixRGB(pick(s.biome), pick(s.next), s.t);
}

/** The biome whose scenery belongs at `z` (the next one's, once the blend is half done). */
export const sceneryBiome = (z: number): Biome => {
  const s = biomeAt(z);
  return s.t > 0.5 ? s.next : s.biome;
};
