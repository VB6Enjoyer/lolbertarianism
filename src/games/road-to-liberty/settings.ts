// Accessibility options, saved with the game and read by the renderers.

export interface DisplayOptions {
  /** No screen flashes, no blinking lights, steady police lights. */
  reducedFlashing: boolean;
  /** Blue/orange instead of red/green, and shapes on the warning lights. */
  colorblind: boolean;
  /** Shake the screen on crashes. */
  shake: boolean;
}

/** The options in effect (main.ts loads them from the save). */
export const display: DisplayOptions = { reducedFlashing: false, colorblind: false, shake: true };

/** Defaults: reduced flashing if the system asks for reduced motion. */
export function defaultOptions(reducedMotion: boolean): DisplayOptions {
  return { reducedFlashing: reducedMotion, colorblind: false, shake: !reducedMotion };
}

/** Cleans up options from a save, filling in anything missing from the defaults. */
export function normalizeOptions(raw: unknown, defaults: DisplayOptions): DisplayOptions {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = (key: keyof DisplayOptions) => (typeof o[key] === 'boolean' ? (o[key] as boolean) : defaults[key]);
  return { reducedFlashing: pick('reducedFlashing'), colorblind: pick('colorblind'), shake: pick('shake') };
}

/**
 * For alternating lights (police bars, beacons): which half of the cycle we're
 * in at `hz` flips per second. With reduced flashing the light holds still.
 */
export function blink(time: number, hz: number): boolean {
  return display.reducedFlashing ? true : Math.floor(time * hz) % 2 === 0;
}
