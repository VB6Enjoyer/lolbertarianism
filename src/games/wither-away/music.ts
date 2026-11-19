// The soundtrack, synthesized: thrash metal. Distorted power chords (two detuned saws through a
// hard clipper and a speaker-cabinet filter), palm-muted chugs, a bass under them, and drums: kick,
// snare, hats, crash. Three tracks and a menu loop; the two run tracks take turns so it doesn't get
// repetitive, and the Central Bank gets its own.
//
// Riffs are written as 16 tokens a bar (sixteenth notes): a number is a palm-muted chug at that fret
// above the track's low root, a number with "o" an open, ringing power chord, "-" holds the last
// note, "." is a rest. Drum patterns are named.

export type TrackId = 'menu' | 'rip' | 'hyper' | 'boss';

interface Note {
  fret: number;
  open: boolean;
  /** In sixteenths. */
  len: number;
}

type Drums = 'none' | 'half' | 'gallop' | 'skank' | 'blast' | 'double';

interface Bar {
  riff: (Note | null)[];
  drums: Drums;
  crash: boolean;
}

interface Track {
  name: string;
  bpm: number;
  /** The low root (MIDI): E2, D2, C2. */
  root: number;
  bars: Bar[];
  volume: number;
}

/** "0 . 0 0 3o - . ." → sixteen steps of notes and rests. */
export function parseRiff(riff: string): (Note | null)[] {
  const out: (Note | null)[] = [];
  let last: Note | null = null;
  for (const tok of riff.trim().split(/\s+/)) {
    if (tok === '.') {
      out.push(null);
      last = null;
    } else if (tok === '-') {
      if (last) last.len++;
      out.push(null);
    } else {
      const open = tok.endsWith('o');
      last = { fret: Number.parseInt(tok, 10), open, len: 1 };
      out.push(last);
    }
  }
  if (out.length !== 16) throw new Error(`A riff bar needs 16 steps, got ${out.length}: ${riff}`);
  return out;
}

/** A section: riffs (each a bar), a drum pattern, repeated `times`, a crash on its first bar. */
function section(riffs: string[], drums: Drums, times = 1): Bar[] {
  const bars: Bar[] = [];
  for (let t = 0; t < times; t++) riffs.forEach((r, i) => bars.push({ riff: parseRiff(r), drums, crash: t === 0 && i === 0 }));
  return bars;
}

export const TRACKS: Record<TrackId, Track> = {
  // The menu: slow, heavy, ominous. Something's coming.
  menu: {
    name: 'The Road to Serfdom',
    bpm: 96,
    root: 40,
    volume: 0.5,
    bars: [
      ...section(['0o - - - - - - - 1o - - - - - - -', '0o - - - - - - - 3o - - - 1o - - -'], 'half', 2),
      ...section(['0o - - - 0 0 0 0 1o - - - 0 0 0 0', '0o - - - 0 0 0 0 6o - - - 5o - - -'], 'half'),
    ],
  },
  // Track one, in E: a gallop, a thrash beat, a chromatic climb.
  rip: {
    name: 'Rip and Tear the Red Tape',
    bpm: 184,
    root: 40,
    volume: 0.62,
    bars: [
      ...section(['0 . 0 0 0 . 0 0 0 . 0 0 1o - 3o -', '0 . 0 0 0 . 0 0 0 . 0 0 5o - 3o 1o'], 'gallop', 2),
      ...section(['0 0 7o - 0 0 6o - 0 0 5o - 0 0 3o 1o', '0 0 7o - 0 0 6o - 0 0 5o - 3o - 1o -'], 'skank', 2),
      ...section(['0 0 0 0 0 0 0 0 1 1 1 1 1 1 1 1', '3 3 3 3 3 3 3 3 1 1 1 1 0 0 0 0'], 'blast'),
      ...section(['0o - - - 1o - - - 3o - - - 1o - 0o -', '0o - - - 1o - - - 5o - - - 6o - - -'], 'double'),
    ],
  },
  // Track two, in D, faster: a skank beat and tremolo picking under a blast.
  hyper: {
    name: 'Hyperinflation',
    bpm: 204,
    root: 38,
    volume: 0.6,
    bars: [
      ...section(['0 0 0 0 3o - 0 0 0 0 5o - 4o - 3o -', '0 0 0 0 3o - 0 0 0 0 5o - 6o - 5o -'], 'skank', 2),
      ...section(['0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0', '1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1', '3 3 3 3 3 3 3 3 3 3 3 3 3 3 3 3', '1 1 1 1 1 1 1 1 0 0 0 0 0 0 0 0'], 'blast'),
      ...section(['0 . 0 0 0 . 0 0 6o - 5o - 3o - 1o -', '0 . 0 0 0 . 0 0 7o - 8o - 7o - 5o -'], 'gallop', 2),
    ],
  },
  // The Central Bank: slower, lower (C), half time with double kick, and tritones.
  boss: {
    name: 'Central Bank Must Die',
    bpm: 144,
    root: 36,
    volume: 0.68,
    bars: [
      ...section(['0o - - - - - 0 0 1o - - - - - 0 0', '0o - - - - - 0 0 6o - - - 5o - 1o -'], 'half', 2),
      ...section(['0 0 0 0 0 0 0 0 6o - - - 5o - 1o -', '0 0 0 0 0 0 0 0 7o - 6o - 1o - 0o -'], 'double', 2),
    ],
  },
};

const DRUMS: Record<Drums, { kick: string; snare: string; hat: string }> = {
  none: { kick: '................', snare: '................', hat: '................' },
  half: { kick: 'x.....x...x.....', snare: '........x.......', hat: 'x...x...x...x...' },
  gallop: { kick: 'x.xxx.xxx.xxx.xx', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
  skank: { kick: 'x...x...x...x...', snare: '..x...x...x...x.', hat: 'x.x.x.x.x.x.x.x.' },
  blast: { kick: 'x.x.x.x.x.x.x.x.', snare: '.x.x.x.x.x.x.x.x', hat: 'xxxxxxxxxxxxxxxx' },
  double: { kick: 'xxxxxxxxxxxxxxxx', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
};

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class Metal {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private guitarIn: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private track: TrackId = 'menu';
  private queued: TrackId | null = null;
  private volume = 0.7;
  /** Called when a track finishes a full loop (so the game can switch to the other one). */
  onLoop: ((track: TrackId) => void) | null = null;

  get playing() {
    return this.timer !== null;
  }

  get current() {
    return this.track;
  }

  /** Starts playing (call from a click or a key press, so the browser allows audio). */
  start(ctx: AudioContext): void {
    if (this.timer !== null) return;
    this.ctx = ctx;
    // Master: a compressor to glue it together, then the volume.
    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    comp.connect(this.master);
    this.master.connect(ctx.destination);
    // Guitar rig: a hard clipper, then a "cabinet" (cut the fizz above ~3.5 kHz and the mud below 90 Hz).
    this.guitarIn = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(9 * x);
    }
    shaper.curve = curve;
    shaper.oversample = '2x';
    const cab = ctx.createBiquadFilter();
    cab.type = 'lowpass';
    cab.frequency.value = 3600;
    cab.Q.value = 0.8;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 90;
    const post = ctx.createGain();
    post.gain.value = 0.16;
    this.guitarIn.connect(shaper).connect(cab).connect(hp).connect(post).connect(comp);
    this.drumsOut = comp;
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.nextTime = ctx.currentTime + 0.1;
    this.step = 0;
    this.applyVolume();
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private drumsOut: AudioNode | null = null;

  stop(): void {
    if (this.timer === null || !this.ctx || !this.master) return;
    window.clearInterval(this.timer);
    this.timer = null;
    const master = this.master;
    master.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1);
    window.setTimeout(() => master.disconnect(), 600);
    this.master = null;
  }

  /** Switch tracks at the next bar line (or right away with `now`). */
  play(track: TrackId, now = false): void {
    // Already playing it: forget any change that was queued (the boss came and went within a bar).
    if (track === this.track) {
      this.queued = null;
      return;
    }
    if (track === this.queued && !now) return;
    if (now || !this.playing) {
      this.track = track;
      this.queued = null;
      this.step = 0;
      this.applyVolume();
    } else this.queued = track;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
  }

  private applyVolume() {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(Math.max(0.0001, TRACKS[this.track].volume * this.volume), this.ctx.currentTime, 0.2);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextTime < ctx.currentTime + 0.1) {
      const tr = TRACKS[this.track];
      const sixteenth = 60 / tr.bpm / 4;
      const total = tr.bars.length * 16;
      this.playStep(tr, this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step++;
      if (this.step % 16 === 0 && this.queued) {
        this.track = this.queued;
        this.queued = null;
        this.step = 0;
        this.applyVolume();
      } else if (this.step >= total) {
        this.step = 0;
        this.onLoop?.(this.track);
      }
    }
  }

  private playStep(tr: Track, i: number, t: number, sixteenth: number) {
    const bar = tr.bars[Math.floor(i / 16) % tr.bars.length];
    const s = i % 16;
    const note = bar.riff[s];
    if (note) {
      this.guitar(t, tr.root + note.fret, note.open, note.open ? note.len * sixteenth : sixteenth * 0.9);
      this.bass(t, tr.root + note.fret - 12, Math.max(sixteenth, note.len * sixteenth));
    }
    const d = DRUMS[bar.drums];
    if (d.kick[s] === 'x') this.kick(t);
    if (d.snare[s] === 'x') this.snare(t);
    if (d.hat[s] === 'x') this.hat(t, s % 4 === 0 ? 0.05 : 0.03);
    if (bar.crash && s === 0) this.crash(t);
  }

  /** A power chord: root, fifth and octave, two detuned saws each, palm-muted (dark, short) or open. */
  private guitar(t: number, midi: number, open: boolean, length: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const peak = open ? 0.5 : 0.42;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    if (open) g.gain.setTargetAtTime(peak * 0.7, t + 0.05, 0.3);
    g.gain.setTargetAtTime(0.0001, t + length, 0.03);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    // Palm mute: the hand on the strings kills the highs.
    tone.frequency.setValueAtTime(open ? 5000 : 1100, t);
    if (!open) tone.frequency.exponentialRampToValueAtTime(420, t + length);
    g.connect(tone).connect(this.guitarIn!);
    for (const interval of open ? [0, 7, 12] : [0, 7]) {
      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = hz(midi + interval);
        osc.detune.value = detune;
        osc.connect(g);
        osc.start(t);
        osc.stop(t + length + 0.15);
      }
    }
  }

  private bass(t: number, midi: number, length: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = hz(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.setTargetAtTime(0.0001, t + length * 0.9, 0.03);
    osc.connect(g).connect(this.drumsOut!);
    osc.start(t);
    osc.stop(t + length + 0.12);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g).connect(this.drumsOut!);
    osc.start(t);
    osc.stop(t + 0.18);
    // The beater's click, so it cuts through the guitars.
    const click = ctx.createBufferSource();
    click.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.12, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    click.connect(hp).connect(cg).connect(this.drumsOut!);
    click.start(t, Math.random() * 0.5, 0.02);
  }

  private snare(t: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    src.connect(bp).connect(g).connect(this.drumsOut!);
    src.start(t, Math.random() * 0.5, 0.2);
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(220, t);
    body.frequency.exponentialRampToValueAtTime(150, t + 0.06);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.3, t);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    body.connect(bg).connect(this.drumsOut!);
    body.start(t);
    body.stop(t + 0.1);
  }

  private hat(t: number, volume: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 8000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    src.connect(hp).connect(g).connect(this.drumsOut!);
    src.start(t, Math.random() * 0.5, 0.05);
  }

  private crash(t: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    src.connect(hp).connect(g).connect(this.drumsOut!);
    src.start(t, 0, 1.4);
  }
}
