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

/** Plays one synthesized tone, e.g. a hit or a victory jingle. */
export function playTone({ wave, duration, frequency, gain }: Tone): void {
  const audio = getAudioContext();
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.connect(amp);
  amp.connect(audio.destination);

  const now = audio.currentTime;
  osc.type = wave;
  applyEnvelope(osc.frequency, frequency, now);
  applyEnvelope(amp.gain, gain, now);
  osc.start();
  osc.stop(now + duration);
}
