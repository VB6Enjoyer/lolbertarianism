import './style.css';
import { getAudioContext, note, playTone } from '../../shared/audio.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import { CONFIG, handPosition, ITEMS, multiplier, newGame, nextWave, pileAt, resize, slap, step, type GameEvent, type GameState } from './logic.ts';
import { render, type Scene } from './render.ts';

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const els = {
  canvas: byId<HTMLCanvasElement>('stage'),
  blocks: byId('blocks'),
  stars: byId('stars'),
  score: byId('score'),
  wave: byId('wave'),
  waveBar: byId('wave-bar'),
  combo: byId('combo'),
  stash: byId('stash'),
  mute: byId<HTMLButtonElement>('mute'),
  title: byId('title'),
  start: byId<HTMLButtonElement>('start'),
  best: byId('best'),
  pause: byId('break'),
  breakTitle: byId('break-title'),
  breakBody: byId('break-body'),
  next: byId<HTMLButtonElement>('next'),
  over: byId('over'),
  overTitle: byId('over-title'),
  overBody: byId('over-body'),
  again: byId<HTMLButtonElement>('again'),
};

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

interface Save {
  best: number;
  bestWave: number;
  muted: boolean;
}
const slot = createSaveSlot<Save>({ game: 'kindergarten-property-defender', version: 1 });
const saved = slot.load();
const save: Save = {
  best: Math.max(0, Math.floor(Number(saved?.best) || 0)),
  bestWave: Math.max(0, Math.floor(Number(saved?.bestWave) || 0)),
  muted: saved?.muted === true,
};
const persist = () => slot.save(save);

// ---------------------------------------------------------------------------
// Sound
// ---------------------------------------------------------------------------

const sfx = {
  slap: () => {
    playTone({ wave: 'square', duration: 0.09, frequency: [[0, 900], [0.09, 120, 'exp']], gain: [[0, 0.14], [0.09, 0.001, 'exp']] });
    playTone({ wave: 'sawtooth', duration: 0.05, frequency: [[0, 2400], [0.05, 600, 'exp']], gain: [[0, 0.05], [0.05, 0.001, 'exp']] });
  },
  recover: () => [784, 1047].forEach((hz, i) => playTone(note(hz, 0.08, 0.06), i * 0.06)),
  steal: () => playTone({ wave: 'triangle', duration: 0.35, frequency: [[0, 420], [0.35, 160, 'exp']], gain: [[0, 0.09], [0.35, 0.001, 'exp']] }),
  trade: () => [1047, 1319].forEach((hz, i) => playTone(note(hz, 0.09, 0.05, 'triangle'), i * 0.07)),
  violation: () => {
    playTone({ wave: 'sine', duration: 0.5, frequency: [[0, 1800], [0.25, 2400], [0.5, 1800]], gain: [[0, 0.07], [0.5, 0.001, 'exp']] });
  },
  homestead: () => playTone(note(660, 0.05, 0.03, 'triangle')),
  miss: () => playTone({ wave: 'sine', duration: 0.12, frequency: [[0, 300], [0.12, 180, 'exp']], gain: [[0, 0.03], [0.12, 0.001, 'exp']] }),
  wave: () => [523, 659, 784, 1047].forEach((hz, i) => playTone(note(hz, 0.12, 0.06), i * 0.1)),
  over: () => [392, 330, 262, 196].forEach((hz, i) => playTone(note(hz, 0.2, 0.06, 'triangle'), i * 0.16)),
};

function play<K extends keyof typeof sfx>(name: K) {
  if (!save.muted) sfx[name]();
}

els.mute.textContent = save.muted ? '🔇' : '🔊';
els.mute.addEventListener('click', () => {
  save.muted = !save.muted;
  els.mute.textContent = save.muted ? '🔇' : '🔊';
  persist();
});

// ---------------------------------------------------------------------------
// What everyone says
// ---------------------------------------------------------------------------

const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

const LINES = {
  teacherSteal: ['Sharing is caring!', 'Think of the other children.', 'It’s for the greater good.', 'Don’t be selfish, Jack.', 'We need to redistribute these.', 'Ownership is a social construct.', 'Jack, you should share your toys.'],
  teacherViolation: ['JACK! We don’t hit our friends!', 'That’s a time-out, young man!', 'I’m telling your parents!'],
  jackSlap: ['Have you not heard about property rights?', 'Taxation is theft!', 'Read some economics!', 'This is my private property!', 'Don’t tread on me!', 'I homesteaded these blocks!', 'Get your own blocks!', 'Not your blocks!'],
  jackViolation: ['…that one was voluntary. My bad.', 'Oops. NAP violation.', 'Sorry! I thought you were the teacher!'],
  jackRecover: ['Repossessed!', 'And STAY out!', 'Thank you, come again. Not.'],
  kidTrade: ['Deal!', 'Pleasure doing business!', 'Nice!', 'Win-win!', 'Thanks, Jack!'],
  kidBroke: ['You’re broke, Jack.', 'Never mind, then.'],
  kidSoldOut: ['You sold it already?!', 'Aw, it’s gone.'],
};

// ---------------------------------------------------------------------------
// The game
// ---------------------------------------------------------------------------

const ctx = els.canvas.getContext('2d')!;
let state: GameState = newGame(els.canvas.clientWidth || 800, els.canvas.clientHeight || 600);
state.phase = 'break'; // nothing happens behind the title screen
const scene: Scene = { time: 0, floaters: [], bubbles: [], shake: 0, slapAt: null };
let paused = false;

function fit() {
  const rect = els.canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  els.canvas.width = Math.round(rect.width * dpr);
  els.canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  resize(state, rect.width, rect.height);
}
window.addEventListener('resize', fit);
fit();

function say(who: 'teacher' | 'jack' | 'kid', text: string, at?: { x: number; y: number }) {
  // One bubble per speaker at a time (a classmate's replaces the last classmate's).
  scene.bubbles = scene.bubbles.filter((b) => b.who !== who && b.until > scene.time);
  scene.bubbles.push({ who, text, until: scene.time + 1.8, x: at?.x, y: at?.y });
}

function float(x: number, y: number, text: string, color: string, big = false) {
  scene.floaters.push({ x, y, text, color, born: scene.time, big });
}

function handle(e: GameEvent) {
  const pile = pileAt(state);
  switch (e.type) {
    case 'slap': {
      const at = handPosition(e.hand);
      play('slap');
      float(at.x, at.y, `SLAP! +${e.points}`, '#c0392b', e.combo >= 5);
      if (Math.random() < 0.3) say('jack', pick(LINES.jackSlap));
      break;
    }
    case 'recover': {
      const at = handPosition(e.hand);
      play('recover');
      float(at.x, at.y, `GOT IT BACK! +${e.blocks}🧱`, '#1e8449', true);
      if (Math.random() < 0.5) say('jack', pick(LINES.jackRecover));
      break;
    }
    case 'violation': {
      const at = handPosition(e.hand);
      play('violation');
      float(at.x, at.y, 'NAP VIOLATION! −⭐', '#c0392b', true);
      say('teacher', pick(LINES.teacherViolation));
      say('jack', pick(LINES.jackViolation));
      scene.shake = 0.35;
      break;
    }
    case 'steal':
      play('steal');
      float(pile.x, pile.y, `−${e.blocks}🧱`, '#c0392b', true);
      if (Math.random() < 0.45) say('teacher', pick(LINES.teacherSteal));
      scene.shake = 0.2;
      break;
    case 'trade': {
      const at = handPosition(e.hand);
      play('trade');
      float(at.x, at.y, e.offer.wants === 'blocks' ? `+${ITEMS[e.offer.item].icon}  +${e.points}` : `+${e.offer.price}🧱  +${e.points}`, '#1e8449');
      if (Math.random() < 0.4) say('kid', pick(LINES.kidTrade), at);
      break;
    }
    case 'broke': {
      const at = handPosition(e.hand);
      say('kid', pick(e.hand.offer?.wants === 'item' ? LINES.kidSoldOut : LINES.kidBroke), at);
      break;
    }
    case 'star':
      float(state.w / 2, state.h * 0.3, '⭐ The class trusts you again', '#b9770e', true);
      break;
    case 'homestead':
      play('homestead');
      float(pile.x + state.w * 0.08, pile.y, '+1🧱', '#8a6a3c');
      break;
    case 'miss':
      play('miss');
      float(e.x, e.y, 'whiff', '#888');
      break;
    case 'wave-end':
      play('wave');
      setTimeout(showBreak, 500);
      break;
    case 'over':
      play('over');
      setTimeout(showOver, 700);
      break;
    case 'spawn':
      break;
  }
}

function renderHud() {
  els.blocks.textContent = String(state.blocks);
  els.stars.textContent = '⭐'.repeat(state.stars) + '☆'.repeat(Math.max(0, CONFIG.maxStars - state.stars));
  els.stars.classList.toggle('low', state.stars <= 2);
  els.blocks.parentElement!.classList.toggle('low', state.blocks <= 3);
  els.score.textContent = state.score.toLocaleString('en-US');
  els.wave.textContent = String(state.wave);
  els.waveBar.style.width = `${Math.min(100, (state.waveTime / CONFIG.waveLength) * 100)}%`;
  const m = multiplier(state.combo);
  els.combo.textContent = state.combo >= 2 ? `${state.combo} in a row${m > 1 ? ` · ×${m}` : ''}` : '';
  const counts = new Map<string, number>();
  for (const o of state.stash) counts.set(o.item, (counts.get(o.item) ?? 0) + 1);
  els.stash.textContent = [...counts].map(([id, n]) => `${ITEMS[id as keyof typeof ITEMS].icon}${n > 1 ? `×${n}` : ''}`).join(' ');
  els.stash.title = state.stash.length ? `Your stash: classmates may want to buy these (for more than you paid)` : '';
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) {
    scene.time += dt;
    step(state, dt, Math.random);
    for (const e of state.events) handle(e);
    state.events = [];
    scene.shake = Math.max(0, scene.shake - dt);
    scene.floaters = scene.floaters.filter((f) => scene.time - f.born < 1.2);
  }
  render(ctx, state, scene);
  renderHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

els.canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (state.phase !== 'playing' || paused) return;
  getAudioContext();
  const rect = els.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  scene.slapAt = { x, y, t: scene.time };
  slap(state, x, y);
  for (const ev of state.events) handle(ev);
  state.events = [];
});

document.addEventListener('visibilitychange', () => {
  paused = document.hidden;
  last = performance.now();
});

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

function startGame() {
  getAudioContext();
  state = newGame(els.canvas.clientWidth, els.canvas.clientHeight);
  scene.floaters = [];
  scene.bubbles = [];
  els.title.hidden = true;
  els.over.hidden = true;
  els.pause.hidden = true;
  say('teacher', 'Jack, you should share your toys.');
  setTimeout(() => say('jack', 'Have you not heard about property rights?'), 1200);
}

function showBreak() {
  const st = state.stats;
  els.breakTitle.textContent = `🔔 Recess! Wave ${state.wave} survived`;
  const lines = [
    'So far:',
    `🖐️ Slapped ${st.slapped} grabby hand${st.slapped === 1 ? '' : 's'}${st.recovered ? `, and got ${st.recovered} block${st.recovered === 1 ? '' : 's'} back` : ''}.`,
    `🤝 ${st.trades} voluntary trade${st.trades === 1 ? '' : 's'}. ${state.stash.length ? `Stash: ${state.stash.map((o) => ITEMS[o.item].icon).join(' ')}` : ''}`,
    st.violations ? `⚠️ ${st.violations} NAP violation${st.violations === 1 ? '' : 's'} so far. Gold stars: ${'⭐'.repeat(state.stars)}` : '😇 No NAP violations. The class trusts you.',
    `🧱 ${state.blocks} blocks left: +${state.blocks * CONFIG.waveBonusPerBlock} points.`,
    `Next wave: faster hands, and more of them${state.wave >= 2 ? ', coming from everywhere' : ''}.`,
  ];
  els.breakBody.replaceChildren(...lines.map((t) => Object.assign(document.createElement('p'), { textContent: t })));
  els.pause.hidden = false;
  els.next.focus();
}

function showOver() {
  const newBest = state.score > save.best;
  save.best = Math.max(save.best, state.score);
  save.bestWave = Math.max(save.bestWave, state.wave);
  persist();
  els.overTitle.textContent = state.over === 'expelled' ? '🚸 Sent to the Principal' : '🧱 Property Seized';
  const st = state.stats;
  const lines = [
    state.over === 'expelled'
      ? 'You slapped one too many classmates who only wanted to trade. That’s aggression, Jack. The NAP cuts both ways.'
      : 'The teacher redistributed every last block. It’s for the greater good, apparently.',
    `Wave ${state.wave} · ${state.score.toLocaleString('en-US')} points${newBest ? ' · 🏆 new best!' : ` · best ${save.best.toLocaleString('en-US')}`}`,
    `🖐️ ${st.slapped} slapped · 🧱 ${st.recovered} recovered · 🤝 ${st.trades} trades · 😢 ${st.stolen} stolen · ⚠️ ${st.violations} violations · 🔥 best streak ${st.bestCombo}`,
  ];
  els.overBody.replaceChildren(...lines.map((t) => Object.assign(document.createElement('p'), { textContent: t })));
  els.over.hidden = false;
  els.again.focus();
}

els.start.addEventListener('click', startGame);
els.again.addEventListener('click', startGame);
els.next.addEventListener('click', () => {
  els.pause.hidden = true;
  nextWave(state);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if (!els.title.hidden) els.start.click();
  else if (!els.pause.hidden) els.next.click();
  else if (!els.over.hidden) els.again.click();
  else return;
  e.preventDefault();
});

els.best.textContent = save.best ? `Best: ${save.best.toLocaleString('en-US')} points · wave ${save.bestWave}` : '';
