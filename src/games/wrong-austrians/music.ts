// The soundtrack, synthesized: a Viennese waltz. Oom-pah-pah in 3/4 (a bass note on the one, a
// chord on two and three) under a little tune made up from the chords. Calm between sessions,
// livelier in the council, and in a minor key when a meter is running out. As Ancapball the tune is
// a jaunty clarinet; as Austria, a pompous accordion.

import type { Mode } from './council.ts';

export type MoodId = 'calm' | 'council' | 'tense';

interface Mood {
  /** Quarter notes a minute (a bar is three). */
  bpm: number;
  /** Chords as MIDI notes, one per bar: [bass root, chord tones…]. */
  bars: number[][];
  /** The scale the tune moves in (MIDI, an octave or so above middle C). */
  scale: number[];
  /** How busy the tune is (chance of eighth notes). */
  busy: number;
  volume: number;
}

// D major: I I V7 V7 V7 V7 I I, then IV I V7 I: a sixteen-bar waltz with a turn in the middle.
const D = [38, 62, 66, 69];
const A7 = [33, 61, 64, 67];
const G = [43, 62, 67, 71];
const DM = [38, 62, 65, 69];
const A7m = [33, 61, 64, 67];
const GM = [43, 62, 65, 70];

const MOODS: Record<MoodId, Mood> = {
  calm: { bpm: 132, bars: [D, D, A7, A7, A7, A7, D, D, G, G, D, D, A7, A7, D, D], scale: [74, 76, 78, 79, 81, 83, 85, 86], busy: 0.15, volume: 0.45 },
  council: { bpm: 168, bars: [D, D, A7, A7, A7, A7, D, D, G, G, D, D, A7, A7, D, D], scale: [74, 76, 78, 79, 81, 83, 85, 86], busy: 0.35, volume: 0.5 },
  tense: { bpm: 176, bars: [DM, DM, A7m, A7m, DM, DM, GM, A7m, DM, DM, A7m, A7m, GM, GM, A7m, DM], scale: [74, 76, 77, 79, 81, 82, 85, 86], busy: 0.45, volume: 0.5 },
};

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A tune note: on which eighth of the bar (0–5), which MIDI note, how many eighths long. */
export interface TuneNote {
  step: number;
  midi: number;
  len: number;
}

/** Waltz rhythms, in eighths: three quarters; half and quarter; quarter and two eighths and a quarter; a dotted half. */
const RHYTHMS = [
  [[0, 2], [2, 2], [4, 2]],
  [[0, 4], [4, 2]],
  [[0, 2], [2, 1], [3, 1], [4, 2]],
  [[0, 6]],
];

/** The tune for a mood: per bar, notes near the chord's tones, moving mostly by step. Same every time. */
export function tuneFor(mood: MoodId): TuneNote[][] {
  const m = MOODS[mood];
  const rng = seeded(mood.length * 104_729 + m.bpm);
  let at = 2; // index in the scale
  return m.bars.map((chord, bar) => {
    // Cadences (the last bar of each phrase) hold a long note on the chord.
    const last = bar % 8 === 7;
    const pattern = last ? RHYTHMS[3] : rng() < m.busy ? RHYTHMS[2] : RHYTHMS[rng() < 0.5 ? 0 : 1];
    return pattern.map(([step, len], i) => {
      const tones = chord.slice(1).map((n) => n + 12);
      if (i === 0 || last) {
        // Land on a chord tone close to where the tune is.
        const here = m.scale[at];
        const target = tones.reduce((best, n) => (Math.abs(n - here) < Math.abs(best - here) ? n : best), tones[0]);
        at = m.scale.reduce((bi, n, k) => (Math.abs(n - target) < Math.abs(m.scale[bi] - target) ? k : bi), 0);
      } else {
        at = Math.max(0, Math.min(m.scale.length - 1, at + (rng() < 0.5 ? -1 : 1) * (rng() < 0.8 ? 1 : 2)));
      }
      return { step, midi: m.scale[at], len };
    });
  });
}

const STEPS = 6;

export class Waltz {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private mood: MoodId = 'calm';
  private tune: TuneNote[][] = tuneFor('calm');
  private mode: Mode = 'ancap';
  private volume = 0.6;

  get playing() {
    return this.timer !== null;
  }

  /** Starts playing (call from a click or a key press, so the browser allows audio). */
  start(ctx: AudioContext): void {
    if (this.timer !== null) return;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(ctx.destination);
    this.nextTime = ctx.currentTime + 0.1;
    this.step = 0;
    this.applyVolume();
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    if (this.timer === null || !this.ctx || !this.master) return;
    window.clearInterval(this.timer);
    this.timer = null;
    const master = this.master;
    master.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
    window.setTimeout(() => master.disconnect(), 800);
    this.master = null;
  }

  /** The mood, and whose side it's played for (the tune's instrument). */
  set(mood: MoodId, mode: Mode): void {
    this.mode = mode;
    if (mood === this.mood) return;
    this.mood = mood;
    this.tune = tuneFor(mood);
    this.applyVolume();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
  }

  private applyVolume() {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(Math.max(0.0001, MOODS[this.mood].volume * this.volume * 0.5), this.ctx.currentTime, 0.3);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const eighth = 60 / MOODS[this.mood].bpm / 2;
    const total = STEPS * MOODS[this.mood].bars.length;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step % total, this.nextTime, eighth);
      this.nextTime += eighth;
      this.step = (this.step + 1) % total;
    }
  }

  private playStep(i: number, t: number, eighth: number) {
    const m = MOODS[this.mood];
    const bar = Math.floor(i / STEPS);
    const inBar = i % STEPS;
    const chord = m.bars[bar];
    // Oom: the bass on the one. Pah, pah: the chord on two and three.
    if (inBar === 0) this.pluck(t, hz(chord[0]), eighth * 2.2, 0.32, 'triangle');
    if (inBar === 2 || inBar === 4) for (const n of chord.slice(1)) this.pluck(t, hz(n), eighth * 0.9, 0.06, 'square', 1800);
    for (const note of this.tune[bar]) if (note.step === inBar) this.lead(t, hz(note.midi), eighth * note.len * 0.92);
  }

  private pluck(t: number, freq: number, length: number, volume: number, wave: OscillatorType, cutoff = 0) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    let out: AudioNode = osc;
    if (cutoff) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = cutoff;
      osc.connect(lp);
      out = lp;
    }
    out.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + length + 0.05);
  }

  /** The tune: a clarinet-ish triangle with vibrato (Ancapball), or a reedy, detuned accordion (Austria). */
  private lead(t: number, freq: number, length: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.11, t + 0.03);
    g.gain.setValueAtTime(0.09, t + Math.max(0.04, length - 0.06));
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = this.mode === 'mirror' ? 2400 : 3200;
    lp.connect(g).connect(this.master!);
    const voices = this.mode === 'mirror' ? [[1, 'sawtooth'], [1.006, 'sawtooth']] : [[1, 'triangle']];
    for (const [ratio, wave] of voices as [number, OscillatorType][]) {
      const osc = ctx.createOscillator();
      osc.type = wave;
      osc.frequency.value = freq * ratio;
      if (this.mode !== 'mirror') {
        // A little vibrato.
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = 5.5;
        depth.gain.value = freq * 0.006;
        lfo.connect(depth).connect(osc.frequency);
        lfo.start(t);
        lfo.stop(t + length + 0.05);
      }
      osc.connect(lp);
      osc.start(t);
      osc.stop(t + length + 0.05);
    }
  }
}
