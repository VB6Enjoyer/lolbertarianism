import './style.css';
import { getAudioContext, note, playTone } from '../../shared/audio.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import { ACHIEVEMENTS, achievementById, normalizeUnlocked } from './achievements.ts';
import { build, CONFIG, handPosition, ITEM_USES, ITEMS, multiplier, newGame, nextWave, pileAt, press, resize, shout, slap, slapRadius, spawnHand, step, useItem, type GameEvent, type GameState, type ItemId } from './logic.ts';
import { attraction, buildingById, BUILDINGS, nextCost, type BuildId } from './capital.ts';
import { bossFor, dayName, isBoss, isFriday, newToday, periodAt, weekOf, type Grade, type Role } from './school.ts';
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
  shout: byId<HTMLButtonElement>('shout'),
  meter: byId('meter'),
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
  superintendent: ['District policy, young man.', 'This comes from the top.', 'For the children. All of them. Except you.'],
  board: ['The board has voted.', 'Motion carried!', 'All in favor? Your blocks are ours.'],
  doe: ['Federal mandate!', 'Your blocks are now a national priority.', 'We’re from the government. We’re here to help.'],
  items: {
    cookie: 'Cookies for everyone! Now freeze.',
    juice: 'SUGAR RUSH!',
    slime: 'Enjoy the slime, statists.',
    dino: 'RAWR! Get off my property!',
    car: 'Look, a toy car! Go get it!',
    yoyo: 'Walk the dog… into your face.',
    crayons: 'A fence. Like the Founders intended.',
    card: 'Shiny card for a gold star? Deal.',
  } as Record<string, string>,
};
const BOSS_STEAL: Partial<Record<Role, string>> = { principal: 'EMINENT DOMAIN!', superintendent: 'DISTRICT POLICY!', board: 'THE BOARD VOTED!', doe: 'FEDERAL MANDATE!' };

// ---------------------------------------------------------------------------
// The game
// ---------------------------------------------------------------------------

const ctx = els.canvas.getContext('2d')!;
let state: GameState = newGame(els.canvas.clientWidth || 800, els.canvas.clientHeight || 600);
state.phase = 'break'; // nothing happens behind the title screen
const scene: Scene = { time: 0, floaters: [], bubbles: [], shake: 0, slapAt: null, guardAt: null, pointer: null, banner: null, touch: matchMedia('(pointer: coarse)').matches };
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
      } else if (isBoss(e.hand.role)) {
        float(at.x, at.y, `${e.hand.role === 'board' ? 'MOTION DENIED!' : 'BOSS RETREATS!'} +${e.points}`, '#c0392b', true);
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
      const label = role === 'fraud' ? `💵 Monopoly money?! −${e.blocks}🧱` : role === 'president' ? `🗳️ 10% TAX −${e.blocks}🧱` : isBoss(role) ? `${BOSS_STEAL[role!]} −${e.blocks}🧱` : `−${e.blocks}🧱`;
      float(pile.x, pile.y, label, '#c0392b', true);
      if (role === 'fraud') say('kid', pick(LINES.fraudGotAway), handPosition(e.hand));
      else if (role === 'president') say('teacher', pick(LINES.president));
      else if (role === 'principal') say('teacher', pick(LINES.principal));
      else if (role === 'superintendent' || role === 'board' || role === 'doe') say('teacher', pick(LINES[role]));
      else if (Math.random() < 0.45) say('teacher', pick(LINES.teacherSteal));
      scene.shake = isBoss(role) ? 0.6 : 0.2;
      break;
    }
    case 'period': {
      // The bell: what period it is (and who's new today, at the start of the day)
      const fresh = e.period.id === 'circle' ? newToday(state.wave).filter((r) => r.id !== 'principal') : [];
      const boss = e.period.id === 'show' && isFriday(state.wave) ? bossFor(weekOf(state.wave)) : null;
      scene.banner = {
        text: boss ? `📢 ${boss.title} IS COMING` : e.period.id === 'circle' ? `${dayName(state.wave)}: ${e.period.icon} ${e.period.name}` : `${e.period.icon} ${e.period.name}!`,
        sub: boss ? boss.warning : fresh.map((r) => r.intro).join(' ') || undefined,
        until: scene.time + (fresh.length || boss ? 4.5 : 2),
      };
      say('teacher', e.period.line);
      if (e.period.id === 'recess') play('wave');
      break;
    }
    case 'bounce': {
      const at = handPosition(e.hand);
      play('miss');
      const hint = e.needs === 'pinch' ? (scene.touch ? '🧤 DOUBLE-TAP it!' : '🧤 RIGHT-CLICK it!') : e.needs === 'hold' ? '🍯 HOLD on it!' : '👋 That one needs a slap';
      float(at.x, at.y, hint, '#1f618d');
      break;
    }
    case 'use': {
      play('recover');
      float(pile.x, pile.y - state.h * 0.12, `${ITEMS[e.item].icon} ${e.hit ? `×${e.hit}` : ''}`.trim(), '#1e8449', true);
      say('jack', LINES.items[e.item] ?? 'Mine!');
      break;
    }
    case 'shout':
      play('wave');
      scene.shake = 0.5;
      scene.banner = { text: '📢 PROPERTY RIGHTS!', sub: e.hit ? `${e.hit} hand${e.hit === 1 ? '' : 's'} blown away` : 'Nobody to blow away. Still felt good.', until: scene.time + 1.6 };
      say('jack', 'PROPERTY RIGHTS!!!');
      break;
    case 'blown': {
      const at = handPosition(e.hand);
      float(at.x, at.y, `WHOOSH! +${e.points}`, '#8e44ad');
      break;
    }
    case 'fenced': {
      const at = handPosition(e.hand);
      play('miss');
      float(at.x, at.y, '🖍️ Fenced off!', '#c0392b');
      break;
    }
    case 'meter':
      play('recover');
      float(state.w / 2, state.h * 0.35, scene.touch ? '📢 PROPERTY RIGHTS! is ready: tap the button' : '📢 PROPERTY RIGHTS! is ready: press Space', '#8e44ad', true);
      break;
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
let run: { interest: number; cleanDays: number; napStolen: number | null; board: number } = { interest: 0, cleanDays: 0, napStolen: null, board: 0 };

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
      if (e.hand.role === 'mitten') award('mitten');
      if (e.hand.role === 'superintendent') award('superintendent');
      if (e.hand.role === 'doe') award('doe');
      if (e.hand.role === 'board') {
        run.board++;
        if (run.board >= 3) award('board');
      }
      if (e.hand.role === 'sticky') award('sticky');
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
    case 'blown':
      if (e.hand.role === 'board') {
        run.board++;
        if (run.board >= 3) award('board');
      }
      if (e.hand.role === 'superintendent') award('superintendent');
      if (e.hand.role === 'doe') award('doe');
      break;
    case 'shout':
      award('shout');
      if (e.hit >= 5) award('shout-5');
      break;
    case 'use':
      award('item');
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

/** The stash's groups (one button per kind of item), in the order they were first got. */
const stashGroups = () => {
  const counts = new Map<ItemId, number>();
  for (const o of state.stash) counts.set(o.item, (counts.get(o.item) ?? 0) + 1);
  return [...counts];
};
let stashKey = '';

function renderStash() {
  const groups = stashGroups();
  const key = groups.map(([id, n]) => `${id}${n}`).join() + state.phase + state.stars;
  if (key === stashKey) return;
  stashKey = key;
  els.stash.replaceChildren(
    ...groups.map(([id, n], i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'item';
      b.textContent = `${ITEMS[id].icon}${n > 1 ? `×${n}` : ''}`;
      b.title = `${ITEMS[id].name}: ${id === 'money' ? 'worthless' : ITEM_USES[id]} Tap (or press ${i + 1}) to use it, or sell it to a classmate who wants it.`;
      b.disabled = state.phase !== 'playing' || (id === 'card' && state.stars >= CONFIG.maxStars);
      b.addEventListener('click', () => use(id));
      return b;
    }),
  );
  if (!groups.length) els.stash.textContent = '—';
}

function use(item: ItemId) {
  if (paused || !useItem(state, item)) return;
  for (const ev of state.events) handle(ev);
  state.events = [];
}

function shoutNow() {
  if (paused || !shout(state)) return;
  for (const ev of state.events) handle(ev);
  state.events = [];
}
els.shout.addEventListener('click', shoutNow);

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
  renderStash();
  els.meter.style.width = `${(state.meter / CONFIG.meterMax) * 100}%`;
  const ready = state.meter >= CONFIG.meterMax && state.phase === 'playing';
  els.shout.disabled = !ready;
  els.shout.classList.toggle('ready', ready);
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) {
    scene.time += dt;
    // Holding on to Sticky Fingers
    if (pressing && state.phase === 'playing') press(state, pressing.x, pressing.y, dt);
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

/** The pointer being held down (for Sticky Fingers), and the last tap (a quick second one is a pinch). */
let pressing: { id: number; x: number; y: number } | null = null;
let lastTap: { x: number; y: number; t: number } | null = null;
const DOUBLE_TAP = 0.32;

// Right-click is a pinch, not a menu.
els.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

els.canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const rect = els.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  scene.pointer = { x, y };
  scene.touch = e.pointerType !== 'mouse';
  if (state.phase !== 'playing' || paused) return;
  getAudioContext();
  // Right button: a pinch. On a touch screen, a quick second tap on the same spot is one.
  let how: 'slap' | 'pinch' = e.button === 2 ? 'pinch' : 'slap';
  if (e.pointerType !== 'mouse') {
    if (lastTap && scene.time - lastTap.t < DOUBLE_TAP && Math.hypot(lastTap.x - x, lastTap.y - y) < slapRadius(state) * 1.5) {
      how = 'pinch';
      lastTap = null;
    } else lastTap = { x, y, t: scene.time };
  }
  if (e.button === 0) {
    pressing = { id: e.pointerId, x, y };
    els.canvas.setPointerCapture(e.pointerId);
  }
  scene.slapAt = { x, y, t: scene.time };
  slap(state, x, y, how);
  for (const ev of state.events) handle(ev);
  state.events = [];
});

els.canvas.addEventListener('pointermove', (e) => {
  if (!pressing || e.pointerId !== pressing.id) return;
  const rect = els.canvas.getBoundingClientRect();
  pressing.x = e.clientX - rect.left;
  pressing.y = e.clientY - rect.top;
});
const letGo = (e: PointerEvent) => {
  if (pressing && e.pointerId === pressing.id) pressing = null;
};
els.canvas.addEventListener('pointerup', letGo);
els.canvas.addEventListener('pointercancel', letGo);

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
  run = { interest: 0, cleanDays: 0, napStolen: null, board: 0 };
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
  const overlay = !els.title.hidden || !els.pause.hidden || !els.over.hidden || !els.achievements.hidden;
  if (!overlay && state.phase === 'playing') {
    if (e.key === ' ') {
      e.preventDefault();
      shoutNow();
      return;
    }
    const n = Number(e.key);
    if (n >= 1 && n <= 9) {
      const group = stashGroups()[n - 1];
      if (group) use(group[0]);
      return;
    }
  }
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
