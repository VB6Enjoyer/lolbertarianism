import './style.css';
import { getAudioContext, note, playTone } from '../../shared/audio.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import { ACHIEVEMENTS, achievementById, normalizeUnlocked } from './achievements.ts';
import { build, CONFIG, handPosition, ITEMS, multiplier, newGame, nextWave, pileAt, resize, slap, spawnHand, step, type GameEvent, type GameState } from './logic.ts';
import { attraction, buildingById, BUILDINGS, nextCost, type BuildId } from './capital.ts';
import { dayName, isFriday, newToday, periodAt, weekOf, type Grade, type Role } from './school.ts';
import { render, type Scene } from './render.ts';

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const els = {
  canvas: byId<HTMLCanvasElement>('stage'),
  blocks: byId('blocks'),
  stars: byId('stars'),
  score: byId('score'),
  wave: byId('wave'),
  period: byId('period'),
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
  shop: byId('shop'),
  next: byId<HTMLButtonElement>('next'),
  over: byId('over'),
  overTitle: byId('over-title'),
  overBody: byId('over-body'),
  again: byId<HTMLButtonElement>('again'),
  toasts: byId('toasts'),
  achievements: byId('achievements'),
  achievementsGrid: byId('achievements-grid'),
  achievementsCount: byId('achievements-count'),
};

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

interface Save {
  best: number;
  bestWave: number;
  muted: boolean;
  achievements: string[];
}
const slot = createSaveSlot<Save>({ game: 'kindergarten-property-defender', version: 1 });
const saved = slot.load();
const save: Save = {
  best: Math.max(0, Math.floor(Number(saved?.best) || 0)),
  bestWave: Math.max(0, Math.floor(Number(saved?.bestWave) || 0)),
  muted: saved?.muted === true,
  achievements: [...normalizeUnlocked(saved?.achievements)],
};
const persist = () => slot.save(save);
const unlocked = new Set(save.achievements);

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
  fraudGotAway: ['It’s legal tender at MY house!', 'Pleasure doing business, sucker!', 'Backed by the full faith and credit of my mom!'],
  fraudCaught: ['Fraud is aggression!', 'Nice try. That’s Monopoly money.', 'Counterfeit! Get out!'],
  president: ['Democracy has spoken!', 'The majority voted for your blocks!', 'It’s only fair, Jack.'],
  principal: ['This land is needed for a new nap mat.', 'Eminent domain, young man.', 'It’s for the common good.'],
  monitor: ['Just following orders!', 'Rules are rules!', 'I’m writing you up!'],
};

// ---------------------------------------------------------------------------
// The game
// ---------------------------------------------------------------------------

const ctx = els.canvas.getContext('2d')!;
let state: GameState = newGame(els.canvas.clientWidth || 800, els.canvas.clientHeight || 600);
state.phase = 'break'; // nothing happens behind the title screen
const scene: Scene = { time: 0, floaters: [], bubbles: [], shake: 0, slapAt: null, guardAt: null, pointer: null, banner: null };
let paused = false;
/** The interest and wages from the last recess, for its summary. */
let recessEvents: GameEvent[] = [];

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
  checkAchievements(e);
  const pile = pileAt(state);
  switch (e.type) {
    case 'slap': {
      const at = handPosition(e.hand);
      play('slap');
      if (e.hand.role === 'fraud') {
        float(at.x, at.y, `FRAUD! +${e.points}`, '#c0392b', true);
        say('jack', pick(LINES.fraudCaught));
      } else if (e.hand.role === 'principal') {
        float(at.x, at.y, `THE PRINCIPAL RETREATS! +${e.points}`, '#c0392b', true);
        say('jack', 'Not on my property!');
        scene.shake = 0.4;
      } else {
        float(at.x, at.y, `SLAP! +${e.points}`, '#c0392b', e.combo >= 5);
        if (Math.random() < 0.3) say('jack', pick(LINES.jackSlap));
      }
      break;
    }
    case 'bonk': {
      const at = handPosition(e.hand);
      play('slap');
      if (e.by === 'guard') scene.guardAt = { x: at.x, y: at.y, t: scene.time };
      float(at.x, at.y, `BONK! ${e.hp} to go`, '#e67e22');
      if (e.hand.role === 'monitor' && Math.random() < 0.4) say('teacher', pick(LINES.monitor));
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
    case 'steal': {
      play('steal');
      const role = e.hand.role;
      const label = role === 'fraud' ? `💵 Monopoly money?! −${e.blocks}🧱` : role === 'president' ? `🗳️ 10% TAX −${e.blocks}🧱` : role === 'principal' ? `EMINENT DOMAIN! −${e.blocks}🧱` : `−${e.blocks}🧱`;
      float(pile.x, pile.y, label, '#c0392b', true);
      if (role === 'fraud') say('kid', pick(LINES.fraudGotAway), handPosition(e.hand));
      else if (role === 'president') say('teacher', pick(LINES.president));
      else if (role === 'principal') say('teacher', pick(LINES.principal));
      else if (Math.random() < 0.45) say('teacher', pick(LINES.teacherSteal));
      scene.shake = role === 'principal' ? 0.6 : 0.2;
      break;
    }
    case 'period': {
      // The bell: what period it is (and who's new today, at the start of the day)
      const fresh = e.period.id === 'circle' ? newToday(state.wave).filter((r) => r.id !== 'principal') : [];
      const principal = e.period.id === 'show' && isFriday(state.wave);
      scene.banner = {
        text: principal ? '📢 THE PRINCIPAL IS COMING' : e.period.id === 'circle' ? `${dayName(state.wave)}: ${e.period.icon} ${e.period.name}` : `${e.period.icon} ${e.period.name}!`,
        sub: principal ? 'Eminent domain: it takes 30% of your pile. Eight slaps to send it away.' : fresh.map((r) => r.intro).join(' ') || undefined,
        until: scene.time + (fresh.length || principal ? 4.5 : 2),
      };
      say('teacher', e.period.line);
      if (e.period.id === 'recess') play('wave');
      break;
    }
    case 'report':
    case 'allowance':
      break;
    case 'trade': {
      const at = handPosition(e.hand);
      play('trade');
      float(at.x, at.y, `${e.offer.wants === 'blocks' ? `+${ITEMS[e.offer.item].icon}` : `+${e.offer.price}🧱`}${e.toll ? ` +${e.toll}🧱 toll` : ''}  +${e.points}`, '#1e8449');
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
    case 'produce':
      play('homestead');
      float(Math.max(state.w * 0.3, 0), state.h * 0.82, '🍋 +1🧱', '#b9770e');
      break;
    case 'scared': {
      const at = handPosition(e.hand);
      float(at.x, at.y, '🐍 Don’t tread on me!', '#b9770e');
      break;
    }
    case 'glued': {
      const at = handPosition(e.hand);
      float(at.x, at.y, 'STUCK!', '#9a7d0a');
      break;
    }
    case 'guard': {
      const at = handPosition(e.hand);
      play('slap');
      scene.guardAt = { x: at.x, y: at.y, t: scene.time };
      float(at.x, at.y, `🕶️ SLAP! +${e.points}`, '#2471a3');
      break;
    }
    case 'interest':
    case 'wages':
    case 'built':
      break;
  }
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

/** Counters for this game: interest earned, days in a row without a violation, blocks stolen when nap time began. */
let run: { interest: number; cleanDays: number; napStolen: number | null } = { interest: 0, cleanDays: 0, napStolen: null };

function award(id: string) {
  if (unlocked.has(id)) return;
  const a = achievementById(id);
  if (!a) return;
  unlocked.add(id);
  save.achievements = [...unlocked];
  persist();
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = '<span class="icon"></span><small>ACHIEVEMENT UNLOCKED</small><b></b>';
  el.querySelector('.icon')!.textContent = a.icon;
  el.querySelector('b')!.textContent = a.name;
  els.toasts.append(el);
  setTimeout(() => el.remove(), 4200);
  if (!save.muted) [784, 988, 1175, 1568].forEach((hz, i) => playTone(note(hz, 0.1, 0.05, 'triangle'), i * 0.07));
}

function checkAchievements(e: GameEvent) {
  switch (e.type) {
    case 'slap':
      award('first-slap');
      if (e.combo >= 10) award('combo-10');
      if (e.combo >= 25) award('combo-25');
      if (e.hand.role === 'monitor') award('monitor');
      if (e.hand.role === 'fraud') award('fraud');
      if (e.hand.role === 'president') award('president');
      if (e.hand.role === 'principal') award('principal');
      break;
    case 'guard':
      if (e.hand.role === 'monitor') award('monitor');
      break;
    case 'recover':
      award('repossess');
      if (state.stats.recovered >= 10) award('repo-10');
      break;
    case 'steal':
      if (e.hand.role === 'fraud' && e.blocks > 0) award('funny-money');
      break;
    case 'trade':
      award('first-trade');
      if (e.offer.wants === 'item') award('flip');
      if (e.profit >= 2) award('middleman');
      if (state.stash.length >= 5) award('collector');
      if (state.stats.trades >= 50) award('tycoon');
      break;
    case 'violation':
      award('my-bad');
      break;
    case 'star':
      award('redemption');
      break;
    case 'built':
      award('first-build');
      if (e.id === 'lemonade' && e.level >= 3) award('lemonade');
      if (e.id === 'guard') award('security');
      if (Object.values(state.built).every((level) => level > 0)) award('diversified');
      break;
    case 'interest':
      run.interest += e.blocks;
      if (run.interest >= 20) award('compound');
      break;
    case 'wages':
      if (e.quit) award('unpaid');
      break;
    case 'period':
      // Nap time: note what's been stolen so far, and check at the next bell.
      if (e.period.id === 'nap') run.napStolen = state.stats.stolen;
      else if (run.napStolen !== null) {
        if (state.stats.stolen === run.napStolen) award('night-watch');
        run.napStolen = null;
      }
      break;
    case 'report': {
      const c = e.card;
      if (c.defence === 'A' && c.economics === 'A' && c.citizenship === 'A') award('straight-a');
      if (c.citizenship === 'F') award('nightmare');
      run.cleanDays = state.day.violations ? 0 : run.cleanDays + 1;
      if (run.cleanDays >= 5) award('model-citizen');
      break;
    }
    case 'wave-end':
      if (isFriday(state.wave)) {
        award('tgif');
        if (weekOf(state.wave) >= 2) award('week-2');
        if (weekOf(state.wave) >= 3) award('week-3');
      }
      break;
    case 'over':
      if (e.reason === 'expelled') award('expelled');
      break;
    default:
      break;
  }
  if (state.blocks >= CONFIG.maxBlocks) award('capitalist-pig');
  if (state.score >= 10000) award('score-10k');
  if (state.score >= 50000) award('score-50k');
}

function renderAchievements() {
  els.achievementsCount.textContent = `${unlocked.size} / ${ACHIEVEMENTS.length}`;
  els.achievementsGrid.replaceChildren(
    ...ACHIEVEMENTS.map((a) => {
      const got = unlocked.has(a.id);
      const hidden = a.secret && !got;
      const card = document.createElement('div');
      card.className = `achievement${got ? '' : ' locked'}${a.secret ? ' secret' : ''}`;
      card.innerHTML = '<span class="icon"></span><b></b><small></small>';
      card.querySelector('.icon')!.textContent = got ? a.icon : hidden ? '❔' : '🔒';
      card.querySelector('b')!.textContent = hidden ? 'Secret achievement' : a.name;
      card.querySelector('small')!.textContent = hidden ? 'Keep playing. You’ll know it when it happens.' : a.description;
      return card;
    }),
  );
}

let pausedForAchievements = false;
byId('show-achievements').addEventListener('click', () => {
  renderAchievements();
  els.achievements.hidden = false;
  // Pause the class while you're reading.
  if (state.phase === 'playing' && !paused) {
    paused = true;
    pausedForAchievements = true;
  }
  byId('hide-achievements').focus();
});
byId('hide-achievements').addEventListener('click', () => {
  els.achievements.hidden = true;
  if (pausedForAchievements) {
    paused = false;
    pausedForAchievements = false;
    last = performance.now();
  }
});

function renderHud() {
  els.blocks.textContent = String(state.blocks);
  els.stars.textContent = '⭐'.repeat(state.stars) + '☆'.repeat(Math.max(0, CONFIG.maxStars - state.stars));
  els.stars.classList.toggle('low', state.stars <= 2);
  els.blocks.parentElement!.classList.toggle('low', state.blocks <= 3);
  els.score.textContent = state.score.toLocaleString('en-US');
  els.wave.textContent = `${dayName(state.wave).slice(0, 3)} · week ${weekOf(state.wave)}`;
  const period = periodAt(state.waveTime);
  els.period.textContent = `${period.icon} ${period.name}`;
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
    if (state.events.some((e) => e.type === 'wave-end')) recessEvents = state.events.filter((e) => e.type === 'interest' || e.type === 'wages' || e.type === 'allowance');
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

els.canvas.addEventListener('pointermove', (e) => {
  const rect = els.canvas.getBoundingClientRect();
  scene.pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
});

els.canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  {
    const rect = els.canvas.getBoundingClientRect();
    scene.pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
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
  run = { interest: 0, cleanDays: 0, napStolen: null };
  scene.floaters = [];
  scene.bubbles = [];
  els.title.hidden = true;
  els.over.hidden = true;
  els.pause.hidden = true;
  say('teacher', 'Jack, you should share your toys.');
  setTimeout(() => say('jack', 'Have you not heard about property rights?'), 1200);
}

function showBreak() {
  const day = state.day;
  const card = state.report;
  const friday = isFriday(state.wave);
  els.breakTitle.textContent = `📝 ${dayName(state.wave)}’s report card`;
  const gradeRow = (subject: string, g: Grade, detail: string) => `<tr><th>${subject}</th><td class="grade g${g}">${g}</td><td>${detail}</td></tr>`;
  const report = card
    ? `<table class="report">
        ${gradeRow('Property defence', card.defence, `stopped ${day.stopped} of ${day.thieves} grabby hands`)}
        ${gradeRow('Economics', card.economics, `${day.trades} trade${day.trades === 1 ? '' : 's'}${day.profit > 0 ? `, ${Math.round(day.profit)}🧱 better off` : ''}`)}
        ${gradeRow('Plays well with others', card.citizenship, day.violations ? `${day.violations} NAP violation${day.violations === 1 ? '' : 's'}` : 'no NAP violations')}
      </table>
      <p class="comment">“${card.comment}” <span>— Teacher</span></p>`
    : '';
  const lines = [
    card ? `⭐ Grades: +${card.bonus} points.` : '',
    `🧱 ${state.blocks} blocks left: +${state.blocks * CONFIG.waveBonusPerBlock} points.`,
    state.stash.length ? `🎒 Stash: ${state.stash.map((o) => ITEMS[o.item].icon).join(' ')}` : '',
  ].filter(Boolean);
  // What recess paid, and cost
  const interest = recessEvents.find((e) => e.type === 'interest');
  const wages = recessEvents.find((e) => e.type === 'wages');
  if (interest && interest.type === 'interest') lines.push(`🐷 The piggy bank paid ${interest.blocks}🧱 interest.`);
  if (wages && wages.type === 'wages') lines.push(wages.quit ? '🕶️ You couldn’t pay the security kid. They quit.' : `🕶️ Paid the security kid ${wages.blocks}🧱.`);
  const pay = recessEvents.find((e) => e.type === 'allowance');
  if (pay && pay.type === 'allowance') lines.push(`🎉 It’s the weekend! Your parents give you ${pay.blocks}🧱 allowance.`);
  els.breakBody.innerHTML = report;
  const facts = document.createElement('div');
  facts.className = 'facts';
  facts.replaceChildren(...lines.map((t) => Object.assign(document.createElement('p'), { textContent: t })));
  els.breakBody.append(facts);
  els.next.textContent = friday ? 'See you Monday ▶' : `On to ${dayName(state.wave + 1)} ▶`;
  renderShop();
  els.pause.hidden = false;
  els.next.focus();
}

/** The recess shop: spend blocks on things that make blocks, or protect them. */
function renderShop() {
  const card = (id: BuildId) => {
    const b = buildingById(id);
    const level = state.built[id];
    const cost = nextCost(b, level);
    const pips = b.costs.map((_, i) => (i < level ? '●' : '○')).join('');
    const now = level ? b.effect(level) : 'not built yet';
    const next = cost !== null ? b.effect(level + 1) : '';
    return `<button type="button" class="build ${b.kind}" data-id="${id}" ${cost === null || state.blocks - cost < 1 ? 'disabled' : ''}>
      <span class="icon">${b.icon}</span>
      <span class="what"><b>${b.name}</b> <i>${pips}</i><small>${level ? `Now: ${now}` : 'Not built yet'}</small>${cost !== null ? `<small class="next">${level ? 'Next' : 'Build'}: ${next}</small>` : '<small class="next">Fully built</small>'}</span>
      <span class="cost">${cost === null ? 'MAX' : `${cost}🧱`}</span>
    </button>`;
  };
  const pull = attraction(state.blocks);
  els.shop.innerHTML = `
    <h2>${isFriday(state.wave) ? '🏖️ The weekend: spend your blocks' : '🏗️ After school: spend your blocks'} <span>${state.blocks}🧱</span></h2>
    <p class="shop-note">Blocks you spend can't be stolen, but they're not growing either. Keep at least one.${pull > 1.05 ? ` A pile this big draws ${Math.round((pull - 1) * 100)}% more hands.` : ''}</p>
    <h3>Makes blocks</h3><div class="builds">${BUILDINGS.filter((b) => b.kind === 'income').map((b) => card(b.id)).join('')}</div>
    <h3>Keeps them</h3><div class="builds">${BUILDINGS.filter((b) => b.kind === 'defence').map((b) => card(b.id)).join('')}</div>`;
  for (const b of els.shop.querySelectorAll<HTMLButtonElement>('.build')) {
    b.addEventListener('click', () => {
      if (!build(state, b.dataset.id as BuildId)) return;
      for (const ev of state.events) handle(ev);
      state.events = [];
      play('trade');
      renderShop();
    });
  }
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
    `Made it to ${dayName(state.wave)}, week ${weekOf(state.wave)} · ${state.score.toLocaleString('en-US')} points${newBest ? ' · 🏆 new best!' : ` · best ${save.best.toLocaleString('en-US')}`}`,
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

// ?debug: the state, for testing from the console
if (new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, { kpd: { state: () => state, showBreak, handAt: handPosition, spawn: (role: string) => spawnHand(state, Math.random, role === 'trader' ? 'trader' : 'thief', role === 'trader' ? undefined : (role as Role)) } });
}

els.best.textContent = [save.best ? `Best: ${save.best.toLocaleString('en-US')} points` : '', unlocked.size ? `🏅 ${unlocked.size} / ${ACHIEVEMENTS.length} achievements` : ''].filter(Boolean).join(' · ');
