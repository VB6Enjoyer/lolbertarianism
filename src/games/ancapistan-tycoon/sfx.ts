// Sound effects, synthesized on the fly (no audio files). Volumes are kept low.

import { note, playTone, type Tone } from '../../shared/audio.ts';

let muted = false;

export function setMuted(value: boolean): void {
  muted = value;
}

/** Plays notes as [tone, delay in seconds] pairs. */
function play(...notes: [Tone, number][]) {
  if (muted) return;
  for (const [tone, delay] of notes) playTone(tone, delay);
}

// Note frequencies (Hz)
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1568;

export const sfx = {
  /** Snake button. Slight random pitch so rapid clicking doesn't drone. */
  click() {
    const hz = 420 + Math.random() * 80;
    play([{ wave: 'triangle', duration: 0.06, frequency: [[0, hz], [0.06, hz * 0.6, 'exp']], gain: [[0, 0.06], [0.06, 0.001, 'exp']] }, 0]);
  },

  crit() {
    play([note(G5, 0.07, 0.06), 0], [note(C6, 0.12, 0.06), 0.06]);
  },

  /** Cha-ching. */
  purchase() {
    play([note(E6, 0.06, 0.04), 0], [note(G6, 0.14, 0.04), 0.06]);
  },

  perk() {
    play([note(C5, 0.08, 0.05), 0], [note(E5, 0.08, 0.05), 0.08], [note(G5, 0.08, 0.05), 0.16], [note(C6, 0.2, 0.05), 0.24]);
  },

  sticker() {
    play([note(A5, 0.06, 0.04, 'triangle'), 0], [note(E6, 0.12, 0.04, 'triangle'), 0.05]);
  },

  achievement() {
    play([note(G5, 0.1, 0.05), 0], [note(C6, 0.1, 0.05), 0.1], [note(E6, 0.25, 0.05), 0.2]);
  },

  /** A shimmer when a golden sticker drops in. */
  goldenAppear() {
    [C6, E6, G6, E6].forEach((hz, i) => play([note(hz, 0.09, 0.025, 'sine'), i * 0.07]));
  },

  goldenCatch() {
    [C5, E5, G5, C6, E6, G6].forEach((hz, i) => play([note(hz, 0.1, 0.045, 'triangle'), i * 0.05]));
  },

  /** Wee-woo, for about two seconds. */
  raid() {
    for (let i = 0; i < 4; i++) {
      play([{ wave: 'sawtooth', duration: 0.25, frequency: [[0, 700], [0.25, 950, 'linear']], gain: [[0, 0.035], [0.25, 0.001, 'exp']] }, i * 0.5]);
      play([{ wave: 'sawtooth', duration: 0.25, frequency: [[0, 950], [0.25, 700, 'linear']], gain: [[0, 0.035], [0.25, 0.001, 'exp']] }, i * 0.5 + 0.25]);
    }
  },

  /** A quick downward whoosh: assets hidden. */
  evade() {
    play([{ wave: 'triangle', duration: 0.35, frequency: [[0, 900], [0.35, 150, 'exp']], gain: [[0, 0.06], [0.35, 0.001, 'exp']] }, 0]);
  },

  /** A little anthem for founding a new city. */
  secede() {
    const melody: [number, number][] = [[C5, 0.15], [C5, 0.15], [G5, 0.3], [E5, 0.15], [G5, 0.15], [C6, 0.5]];
    let t = 0;
    for (const [hz, len] of melody) {
      play([note(hz, len, 0.06), t]);
      t += len;
    }
  },
};
