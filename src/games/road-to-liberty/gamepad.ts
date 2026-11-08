// Gamepad support, for pads with the browser's "standard" layout (Xbox,
// PlayStation and most others): stick or d-pad to steer, LT/B to brake,
// A/RB for nitro, X/Y/LB for the horn, Start to pause.

/** The parts of a browser Gamepad this reads (so tests can pass plain objects). */
export interface PadLike {
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

export interface PadInput {
  /** -1..1, or null when the pad isn't steering (so the keyboard still works). */
  steer: number | null;
  brake: boolean;
  /** These are true only on the frame the button goes down. */
  nitro: boolean;
  horn: boolean;
  pause: boolean;
  /** A or Start: press the focused button, start a run. */
  confirm: boolean;
  /** B: back out of a menu. */
  back: boolean;
  /** D-pad or stick up/down in menus: -1, 0 or 1. */
  move: -1 | 0 | 1;
  mute: boolean;
}

export const BUTTON = {
  a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9,
  up: 12, down: 13, left: 14, right: 15,
} as const;

export const DEADZONE = 0.2;

/** A stick axis with a dead zone, rescaled so it still reaches ±1. */
export function stickAxis(value: number): number {
  const size = Math.abs(value);
  if (size < DEADZONE) return 0;
  return Math.sign(value) * Math.min(1, (size - DEADZONE) / (1 - DEADZONE));
}

/** Reads a pad once per frame, remembering what was held so presses fire once. */
export class PadReader {
  private held = new Set<string>();

  read(pad: PadLike | null): PadInput {
    const down = (i: number, threshold = 0.5) => {
      const b = pad?.buttons[i];
      return !!b && (b.pressed || b.value > threshold);
    };
    const axis = (i: number) => stickAxis(pad?.axes[i] ?? 0);
    const now = {
      nitro: down(BUTTON.a) || down(BUTTON.rb),
      horn: down(BUTTON.x) || down(BUTTON.y) || down(BUTTON.lb),
      pause: down(BUTTON.start),
      confirm: down(BUTTON.a) || down(BUTTON.start),
      back: down(BUTTON.b),
      up: down(BUTTON.up) || axis(1) < -0.6,
      down: down(BUTTON.down) || axis(1) > 0.6,
      mute: down(BUTTON.back),
    };
    const pressed = (name: keyof typeof now) => {
      const was = this.held.has(name);
      if (now[name]) this.held.add(name);
      else this.held.delete(name);
      return now[name] && !was;
    };
    const dpad = (down(BUTTON.right) ? 1 : 0) - (down(BUTTON.left) ? 1 : 0);
    const stick = axis(0);
    const up = pressed('up');
    const dn = pressed('down');
    return {
      steer: dpad !== 0 ? dpad : stick !== 0 ? stick : null,
      brake: down(BUTTON.b) || down(BUTTON.lt, 0.25) || down(BUTTON.down),
      nitro: pressed('nitro'),
      horn: pressed('horn'),
      pause: pressed('pause'),
      confirm: pressed('confirm'),
      back: pressed('back'),
      move: up ? -1 : dn ? 1 : 0,
      mute: pressed('mute'),
    };
  }
}

/** The first connected pad, if any. */
export function firstPad(): Gamepad | null {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const pad of pads) if (pad?.connected) return pad;
  return null;
}
