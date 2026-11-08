import './style.css';
import { getAudioContext, note, playTone } from '../../shared/audio.ts';
import { spawnText } from '../../shared/effects.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import { CONFIG, curveAt, kmh, newGame, PLAYER_Z, segmentIndex, UNITS_PER_METER, update, type GameEvent, type GameState, type Input } from './logic.ts';
import { buildGauges } from './gauges.ts';
import { copCloseness, renderMirror } from './mirror.ts';
import { render } from './render.ts';

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const els = {
  game: byId('game'),
  canvas: byId<HTMLCanvasElement>('road'),
  score: byId('score'),
  marx: byId('marx-count'),
  combo: byId('combo'),
  best: byId('best'),
  mirror: byId<HTMLCanvasElement>('mirror-view'),
  lights: byId('police-lights'),
  copGap: byId('cop-gap'),
  copDistance: byId('cop-distance'),
  wheel: byId('wheel'),
  arm: byId('arm'),
  brake: byId<HTMLButtonElement>('brake'),
  mute: byId<HTMLButtonElement>('mute'),
  title: byId('title'),
  paused: byId('paused'),
  busted: byId('busted'),
  bustedLine: byId('busted-line'),
  finalScore: byId('final-score'),
  finalMarx: byId('final-marx'),
  finalDistance: byId('final-distance'),
  finalBest: byId('final-best'),
  newBest: byId('new-best'),
};

const ctx = els.canvas.getContext('2d')!;
const mirrorCtx = els.mirror.getContext('2d')!;
const gauges = buildGauges(document.getElementById('speedo') as unknown as SVGSVGElement, document.getElementById('fuel-gauge') as unknown as SVGSVGElement);

// ---------------------------------------------------------------------------
// Save: best score and sound setting
// ---------------------------------------------------------------------------

interface Save {
  best: number;
  bestMarx: number;
  muted: boolean;
}

const slot = createSaveSlot<Save>({ game: 'road-to-liberty', version: 1 });
const saved = slot.load();
const save: Save = {
  best: Math.max(0, Number(saved?.best) || 0),
  bestMarx: Math.max(0, Number(saved?.bestMarx) || 0),
  muted: saved?.muted === true,
};

// ---------------------------------------------------------------------------
// Sound: a continuous engine and siren, plus one-off effects
// ---------------------------------------------------------------------------

let engine: { osc: OscillatorNode; gain: GainNode; siren: OscillatorNode; sirenGain: GainNode } | null = null;

function startEngine() {
  if (engine || save.muted) return;
  const audio = getAudioContext();
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  const osc = audio.createOscillator();
  osc.type = 'sawtooth';
  const gain = audio.createGain();
  gain.gain.value = 0;
  osc.connect(filter).connect(gain).connect(audio.destination);
  const siren = audio.createOscillator();
  siren.type = 'square';
  const sirenGain = audio.createGain();
  sirenGain.gain.value = 0;
  siren.connect(sirenGain).connect(audio.destination);
  osc.start();
  siren.start();
  engine = { osc, gain, siren, sirenGain };
}

function stopEngine() {
  if (!engine) return;
  engine.osc.stop();
  engine.siren.stop();
  engine = null;
}

function updateSound(state: GameState, running: boolean) {
  if (!engine) return;
  const audio = getAudioContext();
  const t = audio.currentTime;
  const share = state.speed / CONFIG.maxSpeed;
  engine.osc.frequency.setTargetAtTime(45 + share * 95, t, 0.05);
  engine.gain.gain.setTargetAtTime(running ? 0.05 : 0, t, 0.1);
  // The siren gets louder as the cops close in (within 100 m).
  const meters = state.copGap / UNITS_PER_METER;
  const closeness = Math.max(0, 1 - meters / 100);
  engine.siren.frequency.setValueAtTime(Math.floor(state.time * 2.5) % 2 ? 960 : 720, t);
  engine.sirenGain.gain.setTargetAtTime(running ? closeness * 0.035 : 0, t, 0.1);
}

const sfx = {
  splat() {
    playTone({ wave: 'square', duration: 0.25, frequency: [[0, 220], [0.25, 60, 'exp']], gain: [[0, 0.12], [0.25, 0.001, 'exp']] });
    playTone(note(880, 0.08, 0.06), 0.05);
    playTone(note(1320, 0.12, 0.06), 0.12);
  },
  coin() {
    playTone(note(988, 0.07, 0.06));
    playTone(note(1319, 0.14, 0.06), 0.07);
  },
  crash() {
    playTone({ wave: 'sawtooth', duration: 0.45, frequency: [[0, 160], [0.45, 30, 'exp']], gain: [[0, 0.16], [0.45, 0.001, 'exp']] });
  },
  busted() {
    [784, 659, 523, 392].forEach((hz, i) => playTone(note(hz, 0.22, 0.08), i * 0.2));
  },
};

function play(effect: keyof typeof sfx) {
  if (!save.muted) sfx[effect]();
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const keys = new Set<string>();
/** Steering from a held pointer (mouse or touch): -1..1, or null when nothing is held. */
let pointerSteer: number | null = null;
let touchBrake = false;
/** Smoothed steering, so keyboard taps ease in instead of snapping. */
let steer = 0;

function readInput(dt: number): Input {
  let target = 0;
  if (keys.has('ArrowLeft') || keys.has('a')) target -= 1;
  if (keys.has('ArrowRight') || keys.has('d')) target += 1;
  if (pointerSteer !== null) target = pointerSteer;
  steer += (target - steer) * Math.min(1, dt * 10);
  return { steer, brake: touchBrake || keys.has('ArrowDown') || keys.has('s') };
}

const STEER_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'a', 'd', 's', 'w', ' ']);

document.addEventListener('keydown', (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (STEER_KEYS.has(key) && mode === 'playing') e.preventDefault();
  if (key === 'p' || key === 'Escape') {
    if (mode === 'playing') pause();
    else if (mode === 'paused') resume();
    return;
  }
  if (key === 'm') {
    toggleMute();
    return;
  }
  if ((key === 'Enter' || key === ' ') && mode !== 'playing' && !e.repeat) {
    e.preventDefault();
    if (mode === 'paused') resume();
    else startGame();
    return;
  }
  keys.add(key);
});
document.addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
window.addEventListener('blur', () => keys.clear());

function steerFromPointer(e: PointerEvent) {
  const rect = els.canvas.getBoundingClientRect();
  pointerSteer = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width - 0.5) * 3));
}

els.canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'playing') return;
  els.canvas.setPointerCapture(e.pointerId);
  steerFromPointer(e);
});
els.canvas.addEventListener('pointermove', (e) => {
  if (pointerSteer !== null) steerFromPointer(e);
});
for (const type of ['pointerup', 'pointercancel'] as const) {
  els.canvas.addEventListener(type, () => (pointerSteer = null));
}

els.brake.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  touchBrake = true;
  els.brake.classList.add('pressed');
});
for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
  els.brake.addEventListener(type, () => {
    touchBrake = false;
    els.brake.classList.remove('pressed');
  });
}

function toggleMute() {
  save.muted = !save.muted;
  slot.save(save);
  els.mute.textContent = save.muted ? '🔇' : '🔊';
  if (save.muted) stopEngine();
  else if (mode === 'playing') startEngine();
}
els.mute.textContent = save.muted ? '🔇' : '🔊';
els.mute.addEventListener('click', toggleMute);

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

type Mode = 'title' | 'playing' | 'paused' | 'busted';
let mode: Mode = 'title';
let state = newGame();
let skyOffset = 0;

function startGame() {
  state = newGame();
  skyOffset = 0;
  steer = 0;
  keys.clear();
  mode = 'playing';
  els.title.hidden = true;
  els.busted.hidden = true;
  els.paused.hidden = true;
  getAudioContext(); // unlock audio on this click/keypress
  startEngine();
}

function pause() {
  mode = 'paused';
  els.paused.hidden = false;
  keys.clear();
  pointerSteer = null;
}

function resume() {
  mode = 'playing';
  els.paused.hidden = true;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'playing') pause();
});

const OUT_OF_GAS_LINES = [
  'Ran out of gas. The State barely had to chase you.',
  'Empty tank. Should have homesteaded an oil field.',
];

const BUSTED_LINES = [
  'The State caught up with you. Hoppe is disappointed.',
  'Pulled over for driving without a permit to exist.',
  'Your assets have been civil-forfeited. Including the car.',
  'Rothbard hung up. He saw this coming.',
  'Charged with 14 counts of unlicensed liberty.',
];

function bust() {
  mode = 'busted';
  play('busted');
  const score = Math.floor(state.score);
  const isBest = score > save.best;
  save.best = Math.max(save.best, score);
  save.bestMarx = Math.max(save.bestMarx, state.stats.marxFlattened);
  slot.save(save);
  const lines = state.fuel === 0 ? OUT_OF_GAS_LINES : BUSTED_LINES;
  els.bustedLine.textContent = lines[Math.floor(Math.random() * lines.length)];
  els.finalScore.textContent = score.toLocaleString('en-US');
  els.finalMarx.textContent = String(state.stats.marxFlattened);
  els.finalDistance.textContent = `${Math.floor(state.stats.meters).toLocaleString('en-US')} m`;
  els.finalBest.textContent = save.best.toLocaleString('en-US');
  els.newBest.hidden = !isBest;
  setTimeout(() => {
    if (mode !== 'busted') return;
    els.busted.hidden = false;
    document.getElementById('restart')?.focus();
  }, 900);
}

byId('start').addEventListener('click', startGame);
byId('restart').addEventListener('click', startGame);
byId('resume').addEventListener('click', resume);

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

const MARX_LINES = ['COMRADE FLATTENED!', 'SEIZED THE MEANS OF LOCOMOTION!', 'DIALECTICALLY RUN OVER!', 'WITHERED AWAY!', 'LABOR THEORY OF SPLAT!', 'CLASS STRUGGLE: OVER!'];

function floater(text: string, color = '#ffeb3b', yShare = 0.55) {
  const rect = els.canvas.getBoundingClientRect();
  spawnText({
    text,
    className: 'rtl-floater',
    x: rect.width / 2 + (Math.random() - 0.5) * rect.width * 0.2,
    y: rect.height * yShare,
    parent: els.game,
    ttl: 1100,
    style: { color },
  });
}

function flash(color: string) {
  const el = document.createElement('div');
  el.className = 'flash';
  el.style.background = color;
  els.game.append(el);
  setTimeout(() => el.remove(), 260);
}

function handle(events: GameEvent[]) {
  for (const e of events) {
    switch (e.type) {
      case 'marx':
        play('splat');
        flash('rgba(211, 47, 47, 0.6)');
        floater(`${MARX_LINES[Math.floor(Math.random() * MARX_LINES.length)]} +$${e.points}`);
        if (e.combo > 1) floater(`COMBO ×${e.combo}`, '#ff8a65', 0.42);
        break;
      case 'fuel':
        play('coin');
        flash('rgba(255, 82, 82, 0.25)');
        floater('⛽ +FUEL', '#ff8a80', 0.6);
        break;
      case 'low-fuel':
        floater('⛽ LOW FUEL!', '#ffb300', 0.35);
        break;
      case 'out-of-gas':
        play('crash');
        floater('OUT OF GAS! FIND A CAN!', '#ff5252', 0.35);
        break;
      case 'gold':
        play('coin');
        flash('rgba(255, 215, 0, 0.35)');
        floater(`+$${e.points}`, '#ffd54f', 0.6);
        break;
      case 'crash':
        play('crash');
        flash('rgba(0, 0, 0, 0.45)');
        floater(e.kind === 'roadblock' ? 'PAPERS, PLEASE!' : 'SLOWPOKE!', '#ff5252');
        break;
      case 'busted':
        bust();
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// HUD and cockpit
// ---------------------------------------------------------------------------

function updateHud() {
  els.score.textContent = Math.floor(state.score).toLocaleString('en-US');
  els.marx.textContent = String(state.stats.marxFlattened);
  els.combo.hidden = state.combo <= 1;
  els.combo.textContent = `×${state.combo}`;
  els.best.textContent = Math.max(save.best, Math.floor(mode === 'playing' ? state.score : 0)).toLocaleString('en-US');
  gauges.setSpeed(kmh(state.speed));
  gauges.setFuel(state.fuel, state.fuel < CONFIG.lowFuel);

  // The flashing lights fill the mirror as the cops close in.
  const meters = Math.max(0, state.copGap / UNITS_PER_METER);
  els.lights.style.opacity = String(0.05 + copCloseness(state.copGap) * 0.55);
  els.copDistance.textContent = String(Math.round(meters));
  els.copGap.classList.toggle('close', meters < 80);

  // Turn the wheel and lean the arm with the steering.
  els.wheel.style.transform = `rotate(${steer * 70}deg)`;
  els.arm.style.transform = `translateX(var(--arm-shift, 0px)) scale(var(--arm-scale, 1)) translateX(${steer * 14}px) rotate(${steer * 4}deg)`;
}

// ---------------------------------------------------------------------------
// Canvas sizing and the loop
// ---------------------------------------------------------------------------

let cssWidth = 0;
let cssHeight = 0;
let mirrorWidth = 0;
let mirrorHeight = 0;

/** Sizes a canvas for the screen's pixel density; returns its size in CSS pixels. */
function fitCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): [number, number] {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [rect.width, rect.height];
}

function resize() {
  [cssWidth, cssHeight] = fitCanvas(els.canvas, ctx);
  [mirrorWidth, mirrorHeight] = fitCanvas(els.mirror, mirrorCtx);
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (mode === 'playing') {
    handle(update(state, readInput(dt), dt));
  } else if (mode === 'title') {
    // Attract mode: cruise down the road behind the title screen.
    state.position += CONFIG.maxSpeed * 0.6 * dt;
    state.time += dt;
    state.copGap = CONFIG.copStartGap;
    state.fuel = 1;
  }
  if (mode === 'playing' || mode === 'title') {
    const share = state.speed / CONFIG.maxSpeed;
    skyOffset += curveAt(segmentIndex(state.position + PLAYER_Z)) * share * dt * 0.02;
  }

  render(ctx, cssWidth, cssHeight, state, skyOffset);
  renderMirror(mirrorCtx, mirrorWidth, mirrorHeight, state);
  updateHud();
  updateSound(state, mode === 'playing');
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
