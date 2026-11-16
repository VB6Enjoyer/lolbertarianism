// A playground chiptune, synthesized: a square-wave tune over a triangle bass, with
// a noise snare and hi-hat when things get busy. Each period has its own mood (calm
// circle time, bouncy snack time, frantic recess, a quiet music-box lullaby at nap
// time, a march for show and tell) and the Friday boss gets a minor-key theme.
// The tune is made up fresh for each mood and repeats, so it sticks.

export type MoodId = 'circle' | 'snack' | 'recess' | 'nap' | 'show' | 'boss';

export interface Mood {
  bpm: number;
  /** One chord per bar (MIDI note numbers: the root, then the chord tones an octave up). */
  bars: number[][];
  /** Chance of a melody note on each eighth, and whether the drums play. */
  busy: number;
  drums: 'none' | 'light' | 'full' | 'march';
  /** The lead's sound and loudness. */
  lead: 'square' | 'box';
  volume: number;
}

// C major: C, Am, F, G and friends. The boss: A minor.
const C = [48, 60, 64, 67];
const Am = [45, 57, 60, 64];
const F = [41, 57, 60, 65];
const G = [43, 55, 59, 62];
const Dm = [50, 62, 65, 69];
const E = [40, 56, 59, 64];
const Gm = [43, 55, 58, 62];

const MOODS: Record<MoodId, Mood> = {
  circle: { bpm: 96, bars: [C, Am, F, G], busy: 0.35, drums: 'none', lead: 'square', volume: 0.5 },
  snack: { bpm: 116, bars: [C, F, C, G], busy: 0.5, drums: 'light', lead: 'square', volume: 0.55 },
  recess: { bpm: 148, bars: [C, G, Am, F], busy: 0.7, drums: 'full', lead: 'square', volume: 0.6 },
  nap: { bpm: 62, bars: [C, Am, F, G], busy: 0.25, drums: 'none', lead: 'box', volume: 0.25 },
  show: { bpm: 124, bars: [C, G, Am, Dm], busy: 0.5, drums: 'march', lead: 'square', volume: 0.55 },
  boss: { bpm: 138, bars: [Am, F, Gm, E], busy: 0.6, drums: 'full', lead: 'square', volume: 0.6 },
};

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class Playground {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  /** The next eighth note to schedule (audio-clock seconds), and which one it is. */
  private nextTime = 0;
  private eighth = 0;
  private moodId: MoodId = 'circle';
  private wanted: MoodId = 'circle';
  /** This mood's tune: a note (or a rest) for every eighth of the four bars. */
  private tune: (number | null)[] = [];

  /** Starts playing (call from a click or key press, so the browser allows audio). */
  start(ctx: AudioContext): void {
    if (this.timer !== null) return;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.gain.setTargetAtTime(MOODS[this.wanted].volume, ctx.currentTime, 0.3);
    this.master.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.moodId = this.wanted;
    this.tune = compose(MOODS[this.moodId]);
    this.nextTime = ctx.currentTime + 0.1;
    this.eighth = 0;
    this.timer = window.setInterval(() => this.schedule(), 60);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.master && this.ctx) {
      const m = this.master;
      m.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
      window.setTimeout(() => m.disconnect(), 800);
    }
    this.master = null;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  /** The mood to play: it changes at the start of the next bar. */
  setMood(mood: MoodId): void {
    this.wanted = mood;
  }

  private schedule() {
    const ctx = this.ctx!;
    while (this.nextTime < ctx.currentTime + 0.25) {
      if (this.eighth % 8 === 0 && this.wanted !== this.moodId) {
        this.moodId = this.wanted;
        this.tune = compose(MOODS[this.moodId]);
        this.eighth = 0;
        this.master?.gain.setTargetAtTime(MOODS[this.moodId].volume, this.nextTime, 0.4);
      }
      this.play(this.eighth, this.nextTime);
      this.nextTime += 30 / MOODS[this.moodId].bpm;
      this.eighth = (this.eighth + 1) % 32;
    }
  }

  private play(n: number, t: number) {
    const mood = MOODS[this.moodId];
    const bar = mood.bars[Math.floor(n / 8)];
    const beat = 60 / mood.bpm;
    const onBeat = n % 2 === 0;
    const beatInBar = Math.floor((n % 8) / 2);
    // Bass: root on 1 and 3, the fifth on 2 and 4 (a lullaby gets a single soft root)
    if (mood.lead === 'box') {
      if (n % 8 === 0) this.tone('triangle', hz(bar[0]), t, beat * 3.5, 0.08);
    } else if (onBeat) {
      this.tone('triangle', hz(beatInBar % 2 === 0 ? bar[0] : bar[0] + 7), t, beat * 0.8, 0.14);
    }
    // Chords: a quick arpeggio blip on the offbeats when it's busy
    if (!onBeat && mood.drums !== 'none' && mood.lead !== 'box') this.tone('square', hz(bar[1 + (n % 3)]), t, beat * 0.2, 0.015);
    // The tune
    const note = this.tune[n];
    if (note !== null) {
      if (mood.lead === 'box') {
        this.tone('sine', hz(note + 12), t, beat * 1.6, 0.06);
        this.tone('sine', hz(note + 24), t, beat * 0.6, 0.015);
      } else this.tone('square', hz(note), t, beat * 0.42, 0.035);
    }
    // Drums
    if (mood.drums === 'light' && !onBeat) this.hit(t, 0.025, 7000, 0.04);
    if (mood.drums === 'full') {
      if (!onBeat || n % 4 === 0) this.hit(t, 0.03, 7000, 0.04);
      if (beatInBar % 2 === 1 && onBeat) this.hit(t, 0.12, 1500, 0.12);
      if (beatInBar % 2 === 0 && onBeat) this.kick(t);
    }
    if (mood.drums === 'march') {
      if (onBeat) this.hit(t, beatInBar === 0 ? 0.12 : 0.07, 1800, 0.08);
      if (n % 8 === 7) this.hit(t, 0.06, 1800, 0.06);
      if (beatInBar === 0 && onBeat) this.kick(t);
    }
  }

  private tone(wave: OscillatorType, freq: number, t: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = freq;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** A burst of filtered noise: a hi-hat (high cutoff) or a snare (low). */
  private hit(t: number, gain: number, cutoff: number, dur: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = cutoff > 4000 ? 'highpass' : 'bandpass';
    filter.frequency.value = cutoff;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(amp).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.18, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    osc.connect(amp).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.16);
  }
}

/**
 * Makes up a four-bar tune for a mood: mostly chord tones, stepping rather than leaping, a held note
 * at the end of each two-bar phrase, and the second half echoing the first.
 */
export function compose(mood: Mood, rng: () => number = Math.random): (number | null)[] {
  const tune: (number | null)[] = [];
  let last = mood.bars[0][2] + 12;
  for (let bar = 0; bar < 4; bar++) {
    const chord = mood.bars[bar].slice(1).flatMap((n) => [n + 12, n + 24]);
    for (let e = 0; e < 8; e++) {
      // The second phrase starts like the first.
      if (bar >= 2 && e < 4 && tune[(bar - 2) * 8 + e] !== undefined && rng() < 0.7) {
        tune.push(tune[(bar - 2) * 8 + e]);
        continue;
      }
      const downbeat = e % 2 === 0;
      if ((bar === 1 || bar === 3) && e >= 6) {
        tune.push(null); // breathe at the end of a phrase
        continue;
      }
      if (rng() > (downbeat ? Math.min(1, mood.busy + 0.35) : mood.busy)) {
        tune.push(null);
        continue;
      }
      // The nearest chord tones to the last note, so it steps.
      const near = chord.slice().sort((a, b) => Math.abs(a - last) - Math.abs(b - last)).slice(0, 3);
      last = near[Math.floor(rng() * near.length)];
      tune.push(last);
    }
  }
  return tune;
}
