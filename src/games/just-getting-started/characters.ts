// Who you play: Milton (from the start) or his son David (unlocked by beating David, the secret boss).
// Each has a photo (public/vidya/img), where the laser eyes go on it, a starting deck and relic,
// and a secret boss: each one's is the other Friedman.

export type CharacterId = 'milton' | 'david';

export interface Character {
  id: CharacterId;
  name: string;
  short: string;
  /** The photo (public/vidya/img/<image>.webp). */
  image: string;
  /** His pupils on the photo (fractions of width and height), and the tilt of the line between them (degrees). */
  eyes: [[number, number], [number, number]];
  tilt: number;
  starter: string[];
  relic: string;
  /** The secret boss at the end of his runs. */
  secretBoss: string;
  blurb: string;
}

export const CHARACTERS: Record<CharacterId, Character> = {
  milton: {
    id: 'milton',
    name: 'Milton Friedman',
    short: 'Milton',
    image: 'mfriedman',
    eyes: [
      [0.273, 0.454],
      [0.613, 0.429],
    ],
    tilt: -5,
    starter: ['data', 'data', 'data', 'data', 'data', 'calm', 'calm', 'calm', 'calm', 'lunch'],
    relic: 'glasses',
    secretBoss: 'david',
    blurb: 'Monetarist. Nobel laureate. Laser eyes. Argues with the data and keeps his Composure.',
  },
  david: {
    id: 'david',
    name: 'David Friedman',
    short: 'David',
    image: 'dfriedman',
    eyes: [
      [0.294, 0.548],
      [0.576, 0.532],
    ],
    tilt: -4,
    starter: ['theory', 'theory', 'theory', 'theory', 'insure', 'insure', 'insure', 'insure', 'agency', 'iceland'],
    relic: 'machinery-book',
    secretBoss: 'milton',
    blurb: 'Anarcho-capitalist. Physicist. Medieval re-enactor. Hires Protection Agencies that hit an enemy every turn.',
  },
};

export const characterById = (id: unknown): Character => CHARACTERS[id === 'david' ? 'david' : 'milton'];
export const isCharacter = (id: unknown): id is CharacterId => id === 'milton' || id === 'david';
