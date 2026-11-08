import './style.css';
import { getAudioContext, note, playTone } from '../../shared/audio.ts';
import { spawnText } from '../../shared/effects.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import { currentTerritory, COMMIES, CONFIG, speedFactor, totalCommies, curveAt, environment, kmh, metersToBorder, newGame, PLAYER_Z, segmentIndex, UNITS_PER_METER, update, type GameEvent, type GameState, type Input } from './logic.ts';
import { pickLine, URGENT, type Cue } from './rothbard.ts';
import { PLAYLIST, shuffledOrder, SONG_SECONDS, songLabel } from './radio.ts';
import { cleanInitials, insertScore, legendName, normalizeScores, qualifies, type ScoreEntry } from './scoreboard.ts';
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
  commies: byId('commie-count'),
  combo: byId('combo'),
  best: byId('best'),
  mirror: byId<HTMLCanvasElement>('mirror-view'),
  speech: byId('speech'),
  speechText: byId('speech-text'),
  borderName: byId('border-name'),
  borderDistance: byId('border-distance'),
  radio: byId<HTMLButtonElement>('radio'),
  radioSong: byId('radio-song'),
  phoneSong: byId('phone-song'),
  telltales: {
    donuts: document.querySelector<HTMLElement>('.telltale.donuts')!,
    killdozer: document.querySelector<HTMLElement>('.telltale.killdozer')!,
    smoke: document.querySelector<HTMLElement>('.telltale.smoke')!,
    engine: document.querySelector<HTMLElement>('.telltale.engine')!,
  },
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
  finalCommies: byId('final-commies'),
  initialsForm: byId<HTMLFormElement>('initials-form'),
  initials: byId<HTMLInputElement>('initials'),
  highRank: byId('high-rank'),
  bustedScores: byId('busted-scores'),
  scores: byId('scores'),
  scoresList: byId('scores-list'),
  finalTally: byId('final-tally'),
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
  /** The high-score table, and the initials you used last. */
  scores: ScoreEntry[];
  initials: string;
}

const slot = createSaveSlot<Save>({ game: 'road-to-liberty', version: 1 });
const saved = slot.load();
const save: Save = {
  best: Math.max(0, Number(saved?.best) || 0),
  bestMarx: Math.max(0, Number(saved?.bestMarx) || 0),
  muted: saved?.muted === true,
  scores: normalizeScores(saved?.scores),
  initials: typeof saved?.initials === 'string' ? cleanInitials(saved.initials) : '',
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
  jingle() {
    [659, 880, 1175].forEach((hz, i) => playTone(note(hz, 0.09, 0.035, 'triangle'), i * 0.09));
  },
  powerUp() {
    [440, 660, 880, 1320].forEach((hz, i) => playTone(note(hz, 0.08, 0.06), i * 0.06));
  },
  smash() {
    playTone({ wave: 'square', duration: 0.2, frequency: [[0, 300], [0.2, 80, 'exp']], gain: [[0, 0.1], [0.2, 0.001, 'exp']] });
  },
  border() {
    [523, 659, 784, 1047].forEach((hz, i) => playTone(note(hz, 0.16, 0.07), i * 0.1));
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
  // Typing your initials: let the text box have the keys.
  if (e.target instanceof HTMLInputElement) return;
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
  if ((key === 'Enter' || key === ' ') && mode !== 'playing' && !e.repeat && els.scores.hidden) {
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
// Liberty FM
// ---------------------------------------------------------------------------

let playOrder = shuffledOrder();
let playIndex = -1;
let nextSongAt = 0;

/** Puts on the next song (reshuffling after the last one), with a little station jingle. */
function nextSong(now: number, jingle = true) {
  playIndex++;
  if (playIndex >= playOrder.length) {
    playOrder = shuffledOrder();
    playIndex = 0;
  }
  const label = `♪ ${songLabel(PLAYLIST[playOrder[playIndex]])}`;
  els.radioSong.textContent = label;
  els.phoneSong.textContent = label;
  nextSongAt = now + SONG_SECONDS;
  if (jingle) play('jingle');
}

function updateRadio(now: number) {
  if (now >= nextSongAt) nextSong(now, mode === 'playing');
}

els.radio.addEventListener('click', () => nextSong(performance.now() / 1000));

// ---------------------------------------------------------------------------
// Rothbard on speakerphone
// ---------------------------------------------------------------------------

/** Seconds of game time: when he last spoke, and when the bubble goes away. */
let lastSpoke = -99;
let speechUntil = 0;
const lastLine: Partial<Record<Cue, string>> = {};
/** So "they're right behind us" fires once per close call. */
let warnedClose = false;

function say(cue: Cue, now: number) {
  const gap = now - lastSpoke;
  if (gap < (URGENT.has(cue) ? 1.2 : 5)) return;
  const line = pickLine(cue, Math.random(), lastLine[cue]);
  lastLine[cue] = line;
  lastSpoke = now;
  speechUntil = now + 3.6;
  els.speechText.textContent = line;
  els.speech.hidden = false;
  // Restart the pop-in animation
  els.speech.style.animation = 'none';
  void els.speech.offsetWidth;
  els.speech.style.animation = '';
}

function updateSpeech(now: number) {
  if (!els.speech.hidden && now > speechUntil) els.speech.hidden = true;
  if (mode !== 'playing') return;
  const meters = state.copGap / UNITS_PER_METER;
  if (meters < 45 && !warnedClose) {
    warnedClose = true;
    say('cops-close', now);
  } else if (meters > 90) {
    warnedClose = false;
  }
  if (now - lastSpoke > 22) say('idle', now);
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

type Mode = 'title' | 'playing' | 'paused' | 'busted';
let mode: Mode = 'title';
let state = newGame();
let skyOffset = 0;

/** Preview: ?time=110 starts the run that many seconds in (night, rain, late-game hazards). */
const START_TIME = Math.max(0, Number(new URLSearchParams(location.search).get('time')) || 0);

function startGame() {
  // Leaving the busted screen without saving still records the score (with your last initials).
  if (pendingScore) commitScore(els.initials.value);
  state = newGame();
  state.time = START_TIME;
  skyOffset = 0;
  steer = 0;
  keys.clear();
  mode = 'playing';
  els.title.hidden = true;
  els.busted.hidden = true;
  els.paused.hidden = true;
  getAudioContext(); // unlock audio on this click/keypress
  startEngine();
  lastSpoke = -99;
  warnedClose = false;
  say('start', state.time);
  // ?debug exposes the run to the console (and to screenshot scripts).
  if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { rtl: state });
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
  save.bestMarx = Math.max(save.bestMarx, totalCommies(state.stats.commies));
  slot.save(save);
  const lines = state.fuel === 0 ? OUT_OF_GAS_LINES : BUSTED_LINES;
  els.bustedLine.textContent = lines[Math.floor(Math.random() * lines.length)];
  els.finalScore.textContent = score.toLocaleString('en-US');
  els.finalCommies.textContent = String(totalCommies(state.stats.commies));
  // Who you ran over, one chip each (only the ones you got).
  els.finalTally.replaceChildren(
    ...COMMIES.filter((c) => state.stats.commies[c.id] > 0).map((c) => {
      const li = document.createElement('li');
      li.textContent = `${c.name} ×${state.stats.commies[c.id]}`;
      return li;
    }),
  );
  els.finalDistance.textContent = `${Math.floor(state.stats.meters).toLocaleString('en-US')} m`;
  els.finalBest.textContent = save.best.toLocaleString('en-US');
  els.newBest.hidden = !isBest;
  // Made the high-score table? Ask for initials before showing it.
  pendingScore = qualifies(save.scores, score)
    ? { initials: save.initials || 'AAA', score, commies: totalCommies(state.stats.commies), meters: Math.floor(state.stats.meters) }
    : null;
  els.initialsForm.hidden = !pendingScore;
  if (pendingScore) {
    const rank = insertScore(save.scores, pendingScore).rank;
    els.highRank.textContent = `#${rank + 1}`;
    els.initials.value = save.initials;
  }
  renderScores(els.bustedScores, save.scores);
  setTimeout(() => {
    if (mode !== 'busted') return;
    els.busted.hidden = false;
    (pendingScore ? els.initials : document.getElementById('restart'))?.focus();
  }, 900);
}

// ---------------------------------------------------------------------------
// High scores
// ---------------------------------------------------------------------------

/** A run that made the table, waiting for its initials. */
let pendingScore: ScoreEntry | null = null;

function renderScores(list: HTMLElement, scores: readonly ScoreEntry[], highlight = -1) {
  list.replaceChildren(
    ...scores.map((entry, i) => {
      const li = document.createElement('li');
      li.className = `${entry.legend ? 'legend' : ''}${i === highlight ? ' mine' : ''}`.trim();
      const initials = document.createElement('span');
      initials.className = 'initials';
      initials.textContent = entry.initials;
      const who = entry.legend ? legendName(entry.initials) : null;
      if (who) initials.title = who;
      const points = document.createElement('span');
      points.className = 'points';
      points.textContent = `$${entry.score.toLocaleString('en-US')}`;
      if (!entry.legend) {
        const detail = document.createElement('small');
        detail.textContent = `☭ ${entry.commies} · ${(entry.meters / 1000).toFixed(1)} km`;
        points.append(detail);
      }
      li.append(initials, points);
      return li;
    }),
  );
}

/** Saves the waiting run with these initials (or the last ones used) and shows where it landed. */
function commitScore(rawInitials: string) {
  if (!pendingScore) return;
  const initials = cleanInitials(rawInitials || save.initials || 'AAA');
  const { scores, rank } = insertScore(save.scores, { ...pendingScore, initials });
  pendingScore = null;
  save.scores = scores;
  save.initials = initials;
  slot.save(save);
  els.initialsForm.hidden = true;
  renderScores(els.bustedScores, save.scores, rank);
}

els.initialsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  commitScore(els.initials.value);
  byId('restart').focus();
});
// Letters only, shown in capitals as you type.
els.initials.addEventListener('input', () => {
  const clean = els.initials.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  if (els.initials.value !== clean) els.initials.value = clean;
});

byId('show-scores').addEventListener('click', () => {
  renderScores(els.scoresList, save.scores);
  els.title.hidden = true;
  els.scores.hidden = false;
  byId('hide-scores').focus();
});
byId('hide-scores').addEventListener('click', () => {
  els.scores.hidden = true;
  els.title.hidden = false;
  byId('start').focus();
});

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

const POWER_UP_TEXT = {
  donuts: '🍩 DONUTS! THE COPS PULLED OVER FOR A SNACK',
  killdozer: '🚜 KILLDOZER! NOTHING STOPS YOU',
  smoke: '💨 SMOKE SCREEN! THE COPS LOST YOU',
} as const;

const POWER_UP_FLASH = {
  donuts: 'rgba(248, 187, 208, 0.45)',
  killdozer: 'rgba(255, 213, 79, 0.45)',
  smoke: 'rgba(207, 216, 220, 0.6)',
} as const;

const CRASH_TEXT = {
  roadblock: 'PAPERS, PLEASE!',
  traffic: 'SLOWPOKE!',
  spikes: 'SPIKE STRIP! TIRES SHREDDED!',
  cruiser: 'RAMMED BY A CRUISER!',
} as const;

function handle(events: GameEvent[]) {
  for (const e of events) {
    switch (e.type) {
      case 'commie': {
        play('splat');
        flash('rgba(211, 47, 47, 0.6)');
        const name = COMMIES.find((c) => c.id === e.who)!.name.toUpperCase();
        const line = e.who === 'marx' ? MARX_LINES[Math.floor(Math.random() * MARX_LINES.length)] : `${name} FLATTENED!`;
        floater(`${line} +$${e.points.toLocaleString('en-US')}`);
        if (e.combo > 1) floater(`COMBO ×${e.combo}`, '#ff8a65', 0.42);
        // Rare ones get their own line; Marx gets the combo or the usual.
        say(e.who !== 'marx' ? e.who : e.combo >= 2 ? 'combo' : 'marx', state.time);
        break;
      }
      case 'biome':
        floater(`ENTERING ${e.name.toUpperCase()}`, '#ffffff', 0.3);
        say(e.id, state.time);
        break;
      case 'repair':
        play('powerUp');
        flash('rgba(129, 212, 250, 0.45)');
        floater('🔧 REPAIRED! BACK TO 100%', '#81d4fa', 0.4);
        say('repair', state.time);
        break;
      case 'fuel':
        play('coin');
        flash('rgba(255, 82, 82, 0.25)');
        floater('⛽ +FUEL', '#ff8a80', 0.6);
        say('fuel', state.time);
        break;
      case 'low-fuel':
        floater('⛽ LOW FUEL!', '#ffb300', 0.35);
        say('low-fuel', state.time);
        break;
      case 'out-of-gas':
        play('crash');
        floater('OUT OF GAS! FIND A CAN!', '#ff5252', 0.35);
        say('out-of-gas', state.time);
        break;
      case 'gold':
        play('coin');
        flash('rgba(255, 215, 0, 0.35)');
        floater(`+$${e.points}`, '#ffd54f', 0.6);
        say('gold', state.time);
        break;
      case 'crash':
        play('crash');
        flash('rgba(0, 0, 0, 0.45)');
        floater(CRASH_TEXT[e.kind], '#ff5252');
        say(e.kind, state.time);
        break;
      case 'warning':
        say(e.kind === 'spikes' ? 'spikes-ahead' : 'cruiser-ahead', state.time);
        break;
      case 'border':
        play('border');
        flash('rgba(255, 255, 255, 0.5)');
        floater(`WELCOME TO ${e.name.toUpperCase()}!`, '#b9f6ca', 0.4);
        floater(`+$${e.bonus.toLocaleString('en-US')} · COPS HELD AT THE BORDER`, '#ffeb3b', 0.55);
        say('border', state.time);
        break;
      case 'nightfall':
        say('nightfall', state.time);
        break;
      case 'power-up':
        play('powerUp');
        flash(POWER_UP_FLASH[e.kind]);
        floater(POWER_UP_TEXT[e.kind], '#ffffff', 0.4);
        say(e.kind, state.time);
        break;
      case 'smash':
        play('smash');
        floater(`PLOWED THROUGH! +$${e.points}`, '#ffd54f');
        say('smash', state.time);
        break;
      case 'rain':
        say('rain', state.time);
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
  els.commies.textContent = String(totalCommies(state.stats.commies));
  els.combo.classList.toggle('on', state.combo > 1);
  els.combo.textContent = `×${state.combo}`;
  els.best.textContent = Math.max(save.best, Math.floor(mode === 'playing' ? state.score : 0)).toLocaleString('en-US');
  gauges.setSpeed(kmh(state.speed));
  gauges.setFuel(state.fuel, state.fuel < CONFIG.lowFuel);

  // The flashing lights fill the mirror as the cops close in.
  const meters = Math.max(0, state.copGap / UNITS_PER_METER);
  els.lights.style.opacity = String(0.05 + copCloseness(state.copGap) * 0.55);
  els.copDistance.textContent = String(Math.round(meters));
  const place = currentTerritory(state.bordersCrossed);
  if (els.borderName.textContent !== place) {
    els.borderName.textContent = place;
    els.borderName.parentElement!.title = place;
  }
  // Warning lights: lit while a power-up runs (seconds left underneath), blinking at the end.
  const light = (el: HTMLElement, left: number, label = left > 0 ? `${Math.ceil(left)}s` : '') => {
    el.classList.toggle('on', left > 0);
    el.classList.toggle('ending', left > 0 && left < 2);
    const small = el.querySelector('small')!;
    if (small.textContent !== label) small.textContent = label;
  };
  light(els.telltales.donuts, state.donutsLeft);
  light(els.telltales.killdozer, state.killdozerLeft);
  light(els.telltales.smoke, state.smokeLeft);
  // Check engine: on while the car is damaged or slowed, showing your top speed.
  const health = speedFactor(state);
  light(els.telltales.engine, health < 0.999 ? 1 : 0, health < 0.999 ? `${Math.round(health * 100)}%` : '');
  els.telltales.engine.classList.remove('ending');
  els.borderDistance.textContent = (metersToBorder(state) / 1000).toFixed(1);
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

  const env = environment(state.time);
  render(ctx, cssWidth, cssHeight, state, skyOffset, env);
  renderMirror(mirrorCtx, mirrorWidth, mirrorHeight, state, env);
  updateSpeech(state.time);
  updateRadio(now / 1000);
  updateHud();
  updateSound(state, mode === 'playing');
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
