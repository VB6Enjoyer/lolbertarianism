// Tiny Web Audio helpers for synthesized sound effects (no audio files needed).

type Ramp = 'set' | 'linear' | 'exp';

/** [seconds from start, value, how to reach it]. The first point should use 'set'. */
export type EnvelopePoint = [time: number, value: number, ramp?: Ramp];

export interface Tone {
  wave: OscillatorType;
  /** Seconds until the oscillator stops. */
  duration: number;
  frequency: EnvelopePoint[];
  gain: EnvelopePoint[];
}

let ctx: AudioContext | null = null;

/** One shared AudioContext per page, created on first use. */
export function getAudioContext(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  // Browsers keep audio suspended until the user interacts with the page.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function applyEnvelope(param: AudioParam, points: EnvelopePoint[], start: number) {
  for (const [time, value, ramp = 'set'] of points) {
    const at = start + time;
    if (ramp === 'linear') param.linearRampToValueAtTime(value, at);
    else if (ramp === 'exp') param.exponentialRampToValueAtTime(value, at);
    else param.setValueAtTime(value, at);
  }
}

/**
 * Plays one synthesized tone, e.g. a hit or a victory jingle. `delay` (seconds)
 * schedules it a little later, for multi-note jingles.
 *
 * While the browser still has audio locked (no click on the page yet), the sound
 * is skipped rather than queued, so locked-up sounds don't all burst out at once.
 */
export function playTone({ wave, duration, frequency, gain }: Tone, delay = 0): void {
  const audio = getAudioContext();
  if (audio.state !== 'running') return;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.connect(amp);
  amp.connect(audio.destination);

  const start = audio.currentTime + delay;
  osc.type = wave;
  applyEnvelope(osc.frequency, frequency, start);
  applyEnvelope(amp.gain, gain, start);
  osc.start(start);
  osc.stop(start + duration);
}

/** A short note with a quick fade, handy for jingles. */
export function note(hz: number, duration: number, volume = 0.08, wave: OscillatorType = 'square'): Tone {
  return {
    wave,
    duration,
    frequency: [[0, hz]],
    gain: [[0, volume], [duration, 0.001, 'exp']],
  };
}
