// Photo finish: the run's best moment, snapped from the road and shown on
// the busted screen (and on the share card).

import { COMMIES, type GameEvent } from './logic.ts';

export interface Moment {
  /** Bigger is better: the photo is retaken only for a better moment. */
  value: number;
  caption: string;
}

const CRASH_CAPTION = {
  roadblock: 'STOPPED AT AN IRS CHECKPOINT',
  traffic: 'REAR-ENDED A SLOWPOKE',
  spikes: 'TIRES MEET SPIKE STRIP',
  cruiser: 'RAMMED BY A CRUISER',
  tank: 'BRAKE-CHECKED BY A TANK',
} as const;

const SMASH_CAPTION: Record<string, string> = {
  traffic: 'KILLDOZER VS. TRAFFIC',
  roadblock: 'KILLDOZER VS. THE IRS',
  spikes: 'KILLDOZER VS. SPIKES',
  cruiser: 'KILLDOZER VS. THE COPS',
};

/** How photo-worthy an event is, or null if it isn't. Combos beat everything; a crash is the fallback. */
export function momentFor(e: GameEvent): Moment | null {
  switch (e.type) {
    case 'commie': {
      const name = COMMIES.find((c) => c.id === e.who)!.name.toUpperCase();
      return { value: e.points * e.combo, caption: e.combo > 1 ? `COMBO ×${e.combo}: ${name} FLATTENED` : `${name} FLATTENED` };
    }
    case 'smash':
      return { value: e.points * 2, caption: SMASH_CAPTION[e.kind] ?? 'PLOWED THROUGH' };
    case 'boss-survived':
      return {
        value: e.smashed ? e.bonus * 1.5 : e.bonus,
        caption: e.smashed ? 'TANK FLATTENED BY A KILLDOZER' : e.kind === 'tank' ? 'OUTLASTED THE TANK' : 'SHOOK OFF IRS AIR SUPPORT',
      };
    case 'border':
      return { value: e.bonus * 0.5, caption: `CROSSING INTO ${e.name.toUpperCase()}` };
    case 'toll-evaded':
      return { value: e.bonus, caption: 'TOLL EVADED' };
    case 'crash':
      return { value: 100, caption: CRASH_CAPTION[e.kind] };
    default:
      return null;
  }
}

/** The best moment among these events (or null). */
export function bestMoment(events: readonly GameEvent[]): Moment | null {
  let best: Moment | null = null;
  for (const e of events) {
    const m = momentFor(e);
    if (m && (!best || m.value > best.value)) best = m;
  }
  return best;
}

export const PHOTO_WIDTH = 480;
export const PHOTO_HEIGHT = 270;

/**
 * Copies the road canvas into `target` (cropped to fill it, keeping the part
 * above the dashboard where the action is).
 */
export function frameInto(target: HTMLCanvasElement, source: HTMLCanvasElement): void {
  const ctx = target.getContext('2d');
  if (!ctx || !source.width || !source.height) return;
  const w = target.width;
  const h = target.height;
  const scale = Math.max(w / source.width, h / source.height);
  const sw = w / scale;
  const sh = h / scale;
  const sy = Math.max(0, Math.min(source.height - sh, source.height * 0.6 - sh / 2));
  ctx.drawImage(source, (source.width - sw) / 2, sy, sw, sh, 0, 0, w, h);
}

/** Puts a film frame in the photo and prints the caption along the bottom. */
export function develop(photo: HTMLCanvasElement, frame: HTMLCanvasElement, caption: string): void {
  const ctx = photo.getContext('2d');
  if (!ctx) return;
  const w = photo.width;
  const h = photo.height;
  ctx.drawImage(frame, 0, 0, w, h);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, h - 34, w, 34);
  ctx.fillStyle = '#ffd54f';
  ctx.font = "bold 17px 'Courier New', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(caption, w / 2, h - 17, w - 16);
}

/**
 * A few recent frames of the road, so the photo can show the moment just
 * before the hit (when the commie is still in front of the car, not under it).
 */
export class Film {
  private frames: { canvas: HTMLCanvasElement; time: number }[] = [];
  private lastTaken = -Infinity;

  constructor(count = 5, private every = 0.06) {
    for (let i = 0; i < count; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = PHOTO_WIDTH;
      canvas.height = PHOTO_HEIGHT;
      this.frames.push({ canvas, time: -Infinity });
    }
  }

  reset() {
    for (const f of this.frames) f.time = -Infinity;
    this.lastTaken = -Infinity;
  }

  /** Records the road every `every` seconds of game time. */
  record(source: HTMLCanvasElement, time: number) {
    if (time - this.lastTaken < this.every) return;
    this.lastTaken = time;
    const oldest = this.frames.reduce((a, b) => (a.time <= b.time ? a : b));
    frameInto(oldest.canvas, source);
    oldest.time = time;
  }

  /** The frame from about `before` seconds ago (or the closest one there is). */
  from(time: number, before = 0.2): HTMLCanvasElement | null {
    const taken = this.frames.filter((f) => f.time > -Infinity);
    if (!taken.length) return null;
    return taken.reduce((a, b) => (Math.abs(time - before - a.time) <= Math.abs(time - before - b.time) ? a : b)).canvas;
  }
}
