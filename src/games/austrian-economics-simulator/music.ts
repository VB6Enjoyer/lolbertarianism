// Elevator jazz, synthesized: electric piano, walking bass, brushed hi-hat
// and a vibraphone noodling on top. Calm is a gentle ii–V–I in C; the boom
// speeds it up; the bust drops into C minor and drags.

import type { Phase } from './logic.ts';

interface Mood {
  bpm: number;
  /** One chord per bar: the bass root and the chord tones (MIDI note numbers). */
  bars: { root: number; chord: number[] }[];
  scale: number[];
  /** How often the vibes play an eighth note. */
  busy: number;
}

const MAJOR: Mood['bars'] = [
  { root: 38, chord: [53, 57, 60, 64] }, // Dm9
  { root: 43, chord: [53, 57, 59, 64] }, // G13
  { root: 36, chord: [52, 55, 59, 62] }, // Cmaj9
  { root: 45, chord: [55, 60, 61, 64] }, // A7(b9-ish)
];

const MINOR: Mood['bars'] = [
  { root: 36, chord: [51, 55, 58, 62] }, // Cm9
  { root: 41, chord: [51, 56, 60, 63] }, // Fm7
  { root: 38, chord: [50, 53, 56, 60] }, // Dm7b5
  { root: 43, chord: [53, 56, 59, 62] }, // G7b9
];

const MOODS: Record<Phase, Mood> = {
  calm: { bpm: 88, bars: MAJOR, scale: [72, 74, 76, 79, 81, 84], busy: 0.3 },
  boom: { bpm: 118, bars: MAJOR, scale: [72, 74, 76, 79, 81, 84, 86, 88], busy: 0.5 },
  bust: { bpm: 70, bars: MINOR, scale: [72, 75, 77, 78, 79, 82, 84], busy: 0.22 },
};

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class Jazz {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  /** The next eighth note to schedule (audio-clock seconds), and which one it is. */
  private nextTime = 0;
  private eighth = 0;
  private mood: Mood = MOODS.calm;
  private wanted: Phase = 'calm';

  /** Starts playing (call from a click or key press, so the browser allows audio). */
  start(ctx: AudioContext): void {
    if (this.timer !== null) return;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.nextTime = ctx.currentTime + 0.1;
    this.eighth = 0;
    this.timer = window.setInterval(() => this.schedule(), 60);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.master && this.ctx) {
      const m = this.master;
      m.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      window.setTimeout(() => m.disconnect(), 600);
    }
    this.master = null;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  /** The economy's mood: takes effect at the start of the next bar. */
  setPhase(phase: Phase): void {
    this.wanted = phase;
  }

  private schedule() {
    const ctx = this.ctx!;
    while (this.nextTime < ctx.currentTime + 0.25) {
      if (this.eighth % 8 === 0) this.mood = MOODS[this.wanted];
      this.play(this.eighth, this.nextTime);
      // Swing: long-short eighths
      const beat = 60 / this.mood.bpm;
      this.nextTime += this.eighth % 2 === 0 ? beat * 0.62 : beat * 0.38;
      this.eighth++;
    }
  }

  private play(n: number, t: number) {
    const mood = this.mood;
    const bar = mood.bars[Math.floor(n / 8) % mood.bars.length];
    const beatInBar = Math.floor((n % 8) / 2);
    const onBeat = n % 2 === 0;
    const beat = 60 / mood.bpm;
    // Walking bass: root, a chord tone, another, then a step towards the next root
    if (onBeat) {
      const next = mood.bars[(Math.floor(n / 8) + 1) % mood.bars.length].root;
      const walk = [bar.root, bar.chord[1] - 12, bar.chord[2] - 12, next + (next > bar.root ? -1 : 1)][beatInBar];
      this.tone('triangle', hz(walk), t, beat * 0.9, 0.16, 900);
    }
    // Piano comping on 2 and 4 (and a push on the "and" of 4 sometimes)
    if ((onBeat && (beatInBar === 1 || beatInBar === 3)) || (n % 8 === 7 && Math.random() < 0.3)) {
      for (const note of bar.chord) this.epiano(hz(note), t, beat * 0.8, 0.035);
    }
    // Brushed hi-hat on 2 and 4, and the swung "and"s
    if ((onBeat && beatInBar % 2 === 1) || !onBeat) this.hat(t, onBeat ? 0.05 : 0.025);
    // The vibes, noodling
    if (Math.random() < mood.busy) {
      const note = mood.scale[Math.floor(Math.random() * mood.scale.length)];
      this.vibes(hz(note), t, beat * (onBeat ? 1.2 : 0.7), 0.045);
    }
  }

  private tone(wave: OscillatorType, freq: number, t: number, dur: number, gain: number, cutoff: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(filter).connect(amp).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** A soft electric piano: a sine with a little bell on top. */
  private epiano(freq: number, t: number, dur: number, gain: number) {
    this.tone('sine', freq, t, dur, gain, 3000);
    this.tone('sine', freq * 2, t, dur * 0.5, gain * 0.3, 4000);
  }

  /** Vibraphone: a sine with tremolo. */
  private vibes(freq: number, t: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const depth = ctx.createGain();
    depth.gain.value = gain * 0.4;
    lfo.connect(depth).connect(amp.gain);
    osc.connect(amp).connect(this.master!);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  private hat(t: number, gain: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6500;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    src.connect(filter).connect(amp).connect(this.master!);
    src.start(t);
    src.stop(t + 0.08);
  }
}
