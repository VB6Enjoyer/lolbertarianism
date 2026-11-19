// The soundtrack, synthesized: deep-fried phonk. An 808 bass that slides down, the cowbell every
// laser-eyes edit has, hi-hats and a clap, in F# minor. Calmer between fights, harder in them,
// harsher for bosses, and a distorted lead joins in as the Based meter fills.

export type MoodId = 'calm' | 'fight' | 'boss';

interface Mood {
  bpm: number;
  /** Bass and cowbell, and whether the drums play in full. */
  drums: 'light' | 'full';
  /** Notes on each sixteenth of the cowbell line (chance). */
  busy: number;
  volume: number;
}

const MOODS: Record<MoodId, Mood> = {
  calm: { bpm: 84, drums: 'light', busy: 0.18, volume: 0.45 },
  fight: { bpm: 128, drums: 'full', busy: 0.4, volume: 0.55 },
  boss: { bpm: 142, drums: 'full', busy: 0.55, volume: 0.6 },
};

/** F# minor: i – VI – VII – v (F#m, D, E, C#m), the bass roots (MIDI). */
const ROOTS = [30, 26, 28, 25];
/** F# minor pentatonic, two octaves up, for the cowbell and the lead. */
const SCALE = [66, 69, 71, 73, 76, 78, 81];
const STEPS = 16;
const BARS = ROOTS.length;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** A small seeded generator, so each mood's tune is the same every time (it sticks). */
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

/** The cowbell line for a mood: a note (or a rest) on every sixteenth of the four bars. */
export function cowbellLine(mood: MoodId): (number | null)[] {
  const m = MOODS[mood];
  const rng = seeded(mood.length * 7919 + m.bpm);
  const line: (number | null)[] = [];
  for (let i = 0; i < STEPS * BARS; i++) {
    const strong = i % 4 === 0 || i % 16 === 10;
    line.push(rng() < (strong ? m.busy + 0.3 : m.busy) ? SCALE[Math.floor(rng() * SCALE.length)] : null);
  }
  return line;
}

export class Phonk {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private drive: WaveShaperNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private mood: MoodId = 'calm';
  private line: (number | null)[] = cowbellLine('calm');
  private volume = 0.6;
  /** 0–1: how much of the distorted lead plays (the Based meter). */
  private intensity = 0;

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
    // A little saturation on everything: it's deep-fried.
    this.drive = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(2.4 * x);
    }
    this.drive.curve = curve;
    this.drive.connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
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

  setMood(mood: MoodId): void {
    if (mood === this.mood) return;
    this.mood = mood;
    this.line = cowbellLine(mood);
    this.applyVolume();
  }

  /** 0–1 (the options' music volume). */
  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
  }

  setIntensity(x: number): void {
    this.intensity = Math.max(0, Math.min(1, x));
  }

  private applyVolume() {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(Math.max(0.0001, MOODS[this.mood].volume * this.volume * 0.5), this.ctx.currentTime, 0.3);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const sixteenth = 60 / MOODS[this.mood].bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step = (this.step + 1) % (STEPS * BARS);
    }
  }

  private playStep(i: number, t: number, sixteenth: number) {
    const m = MOODS[this.mood];
    const inBar = i % STEPS;
    const root = ROOTS[Math.floor(i / STEPS)];
    // 808: on the one, and a syncopated hit later in the bar; it slides down like they do.
    if (inBar === 0 || inBar === 10 || (m.drums === 'full' && inBar === 6)) this.bass(t, hz(root + 12), sixteenth * (inBar === 0 ? 6 : 4));
    // Hi-hats on the eighths (sixteenths in a fight), the clap on two and four.
    if (m.drums === 'full' ? true : inBar % 2 === 0) this.hat(t, inBar % 4 === 2 ? 0.05 : 0.03);
    if (inBar === 4 || inBar === 12) this.clap(t, m.drums === 'full' ? 0.22 : 0.12);
    // The cowbell line.
    const note = this.line[i];
    if (note !== null) this.cowbell(t, hz(note), 0.11);
    // The Based meter brings in a distorted saw an octave down, on the off-beats.
    if (this.intensity > 0.45 && note !== null && inBar % 2 === 1) this.lead(t, hz(note - 12), sixteenth * 1.8, 0.05 * this.intensity);
  }

  private env(t: number, peak: number, decay: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    return g;
  }

  private bass(t: number, freq: number, length: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.5, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.84, t + length);
    const g = this.env(t, 0.5, length);
    osc.connect(g).connect(this.drive!);
    osc.start(t);
    osc.stop(t + length + 0.05);
  }

  /** The 808 cowbell: two square waves a fifth-ish apart through a band-pass, quick decay. */
  private cowbell(t: number, freq: number, volume: number) {
    const ctx = this.ctx!;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = freq * 1.4;
    band.Q.value = 3;
    const g = this.env(t, volume, 0.28);
    band.connect(g).connect(this.master!);
    for (const ratio of [1, 1.48]) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq * ratio;
      osc.connect(band);
      osc.start(t);
      osc.stop(t + 0.3);
    }
  }

  private hat(t: number, volume: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 7000;
    const g = this.env(t, volume, 0.04);
    src.connect(high).connect(g).connect(this.master!);
    src.start(t, Math.random() * 0.5, 0.06);
  }

  private clap(t: number, volume: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1500;
    band.Q.value = 0.8;
    const g = this.env(t, volume, 0.16);
    src.connect(band).connect(g).connect(this.drive!);
    src.start(t, Math.random() * 0.5, 0.2);
  }

  private lead(t: number, freq: number, length: number, volume: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const g = this.env(t, volume, length);
    osc.connect(g).connect(this.drive!);
    osc.start(t);
    osc.stop(t + length + 0.05);
  }
}
