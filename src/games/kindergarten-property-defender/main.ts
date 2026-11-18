import './style.css';
import { getAudioContext, note, playTone } from '../../shared/audio.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import { openSaveTransfer } from '../../shared/save-transfer.ts';
import { ACHIEVEMENTS, achievementById, normalizeUnlocked } from './achievements.ts';
import { GRADUATION_WEEK, honours, perkById, PERKS, type PerkId } from './perks.ts';
import { Playground, type MoodId } from './music.ts';
import { build, comboCap, CONFIG, edgeAt, gpa, meterMax, permitWeek, startDaily, takePerk, todayLength, handPosition, ITEM_USES, ITEMS, multiplier, newGame, nextWave, pileAt, press, resize, shout, slap, slapRadius, spawnHand, step, useItem, type GameEvent, type GameState, type Hand, type ItemId } from './logic.ts';
import { attraction, buildingById, BUILDINGS, nextCost, nextWeek, type BuildId } from './capital.ts';
import { bossFor, dayName, isBoss, isFriday, newToday, periodAt, weekOf, type Grade, type Role } from './school.ts';
import { render, type Scene } from './render.ts';
import { specialById, SPECIAL_DAYS } from './days.ts';
import { dailyFor, dateKey, difficultyById, DIFFICULTIES, isDifficulty, normalizeDailyBests, normalizeHistory, recordRun, seededRng, type Daily, type DifficultyId, type RunEnding } from './modes.ts';
import { CLASSMATES, classmateById, FRIEND_AT, isFriend, regularsMet, regularsNewToday, type ClassmateId } from './classmates.ts';

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
  perks: byId('perks'),
  graduation: byId('graduation'),
  diploma: byId('diploma'),
  summer: byId<HTMLButtonElement>('summer'),
  retire: byId<HTMLButtonElement>('retire'),
  pauseButton: byId<HTMLButtonElement>('pause'),
  pauseMenu: byId('paused'),
  resume: byId<HTMLButtonElement>('resume'),
  restart: byId<HTMLButtonElement>('restart'),
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
  toTitle: byId<HTMLButtonElement>('to-title'),
  difficulty: byId('difficulty'),
  difficultyNote: byId('difficulty-note'),
  daily: byId('daily'),
  dailyBody: byId('daily-body'),
  history: byId('history'),
  historyBody: byId('history-body'),
  coach: byId('coach'),
  coachText: byId('coach-text'),
  coachSkip: byId<HTMLButtonElement>('coach-skip'),
};

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

interface Save {
  /** The best score on each difficulty. */
  bests: Record<DifficultyId, number>;
  bestWave: number;
  /** Times Jack has graduated, and the best GPA. */
  graduations: number;
  bestGpa: number;
  muted: boolean;
  achievements: string[];
  /** Orange and blue instead of red and green, with a ✊/✋ on every sleeve. */
  colorblind: boolean;
  difficulty: DifficultyId;
  music: boolean;
  /** Whether the guided first morning has been played (or skipped). */
  tutorialDone: boolean;
  /** The ten best runs, and the best daily-challenge score per date. */
  history: ReturnType<typeof normalizeHistory>;
  dailyBests: Record<string, number>;
}
const slot = createSaveSlot<Save>({ game: 'kindergarten-property-defender', version: 1 });
const saved = slot.load();
const save: Save = {
  // Saves from before there were difficulties kept one best: it was on Normal.
  bests: Object.fromEntries(
    DIFFICULTIES.map((d) => [d.id, Math.max(0, Math.floor(Number(saved?.bests?.[d.id]) || 0), d.id === 'normal' ? Math.floor(Number((saved as { best?: unknown } | null)?.best) || 0) : 0)]),
  ) as Record<DifficultyId, number>,
  bestWave: Math.max(0, Math.floor(Number(saved?.bestWave) || 0)),
  graduations: Math.max(0, Math.floor(Number(saved?.graduations) || 0)),
  bestGpa: Math.max(0, Math.min(4, Number(saved?.bestGpa) || 0)),
  muted: saved?.muted === true,
  achievements: [...normalizeUnlocked(saved?.achievements)],
  colorblind: saved?.colorblind === true,
  difficulty: isDifficulty(saved?.difficulty) ? saved.difficulty : 'normal',
  music: saved?.music !== false,
  // Anyone who's already played (a best score, or achievements) has seen the classroom before.
  tutorialDone: saved?.tutorialDone === true || Number((saved as { best?: unknown } | null)?.best) > 0 || (Array.isArray(saved?.achievements) && saved.achievements.length > 0),
  history: normalizeHistory(saved?.history),
  dailyBests: normalizeDailyBests(saved?.dailyBests),
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
  shutter: () => {
    playTone({ wave: 'square', duration: 0.05, frequency: [[0, 2200], [0.05, 500, 'exp']], gain: [[0, 0.07], [0.05, 0.001, 'exp']] });
    playTone({ wave: 'square', duration: 0.05, frequency: [[0, 1600], [0.05, 400, 'exp']], gain: [[0, 0.06], [0.05, 0.001, 'exp']] }, 0.07);
  },
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
  lunchGotAway: ['Nothing’s free, Jack!', 'Thanks for buying lunch!', 'Someone always pays. Today it’s you.'],
  lunchCaught: ['There’s no such thing as a free lunch!', 'TANSTAAFL!', 'Nice try. Milton warned me about you.'],
  tattle: ['TEACHER! Jack hit me!', 'I’m telling!', 'Teacher, teacher! Jack’s being mean!'],
  tattleTeacher: ['Jack! Did you just hit my helper?!', 'That’s it. Hand them over, mister.', 'Somebody fetch the redistribution committee.'],
  petCaught: ['Ow! I’m telling! …Telling who, though?', 'You can’t pinch me, I’m the teacher’s favourite!', 'My apple!'],
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
/** What the regulars say when you trade, when you become best friends, and when you slap them. */
const REGULAR_LINES: Record<ClassmateId, { trade: string[]; friend: string; grudge: string[] }> = {
  timmy: { trade: ['Fair’s fair!', 'Thanks, Jack!', 'Same time tomorrow?'], friend: 'You’re my best friend, Jack!', grudge: ['Ow! I thought we were friends!', 'I’m telling my mom!'] },
  becky: { trade: ['Pleasure doing business. Mostly mine.', 'I’d have taken one less. Kidding!', 'You drive a soft bargain, Jack.'], friend: 'Fine. You’re my favourite customer.', grudge: ['Hmph! Don’t talk to me.', 'You’ll regret that, Jack.'] },
  dave: { trade: ['I know a guy who’ll pay double.', 'Buy low, sell high, Jack.', 'Got any more of those?'], friend: 'Partners, Jack. Fifty-fifty.', grudge: ['You just lost your best customer.', 'I’m taking my business elsewhere.'] },
};
/** What the teacher says on a special morning. */
const SPECIAL_LINES: Record<string, string> = {
  substitute: 'Hi, I’m the sub. Your teacher left notes. I can’t read them.',
  picture: 'Picture day! Everyone look nice, and freeze when I say cheese.',
  'field-trip': 'Field trip! Everyone on the bus. Yes, Jack, your blocks too.',
  snow: 'Snow day! We’re closing early. Hands to yourselves till then.',
};
const BOSS_STEAL: Partial<Record<Role, string>> = { principal: 'EMINENT DOMAIN!', superintendent: 'DISTRICT POLICY!', board: 'THE BOARD VOTED!', doe: 'FEDERAL MANDATE!' };

// ---------------------------------------------------------------------------
// The game
// ---------------------------------------------------------------------------

const ctx = els.canvas.getContext('2d')!;
let state: GameState = newGame(els.canvas.clientWidth || 800, els.canvas.clientHeight || 600);
state.phase = 'break'; // nothing happens behind the title screen
const scene: Scene = { time: 0, floaters: [], bubbles: [], shake: 0, slapAt: null, guardAt: null, pointer: null, banner: null, flash: -99, mood: null, hits: [], struck: {}, pointAt: null, touch: matchMedia('(pointer: coarse)').matches, colorblind: false };
renderColorblind();
const pauseReasons = new Set<'menu' | 'user'>();
let paused = false;
function setPaused(reason: 'menu' | 'user', on: boolean) {
  if (on) pauseReasons.add(reason);
  else pauseReasons.delete(reason);
  paused = pauseReasons.size > 0;
  last = performance.now();
}
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
  juice(e);
  if (lesson) lessonEvent(e);
  const pile = pileAt(state);
  switch (e.type) {
    case 'slap': {
      const at = handPosition(e.hand);
      play('slap');
      if (e.hand.role === 'fraud') {
        float(at.x, at.y, `FRAUD! +${e.points}`, '#c0392b', true);
        say('jack', pick(LINES.fraudCaught));
      } else if (e.hand.role === 'lunch') {
        float(at.x, at.y, `NO FREE LUNCH! +${e.points}`, '#c0392b', true);
        say('jack', pick(LINES.lunchCaught));
      } else if (e.hand.role === 'pet') {
        float(at.x, at.y, `PINCHED! +${e.points}`, '#c0392b', true);
        say('kid', pick(LINES.petCaught), at);
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
      const label = role === 'fraud' ? `💵 Monopoly money?! −${e.blocks}🧱` : role === 'lunch' ? `🥪 “FREE” ${ITEMS[e.hand.offer!.item].icon}?! −${e.blocks}🧱` : role === 'president' ? `🗳️ 10% TAX −${e.blocks}🧱` : isBoss(role) ? `${BOSS_STEAL[role!]} −${e.blocks}🧱` : `−${e.blocks}🧱`;
      float(pile.x, pile.y, label, '#c0392b', true);
      if (role === 'fraud') say('kid', pick(LINES.fraudGotAway), handPosition(e.hand));
      else if (role === 'lunch') say('kid', pick(LINES.lunchGotAway), handPosition(e.hand));
      else if (role === 'president') say('teacher', pick(LINES.president));
      else if (role === 'principal') say('teacher', pick(LINES.principal));
      else if (role === 'superintendent' || role === 'board' || role === 'doe') say('teacher', pick(LINES[role]));
      else if (Math.random() < 0.45) say('teacher', pick(LINES.teacherSteal));
      scene.shake = isBoss(role) ? 0.6 : 0.2;
      break;
    }
    case 'period': {
      // The bell: what period it is (and who's new today, at the start of the day)
      const fresh = e.period.id === 'circle' ? [...newToday(state.wave).filter((r) => r.id !== 'principal'), ...regularsNewToday(state.wave)] : [];
      const boss = e.period.id === 'show' && isFriday(state.wave) ? bossFor(weekOf(state.wave)) : null;
      const special = e.period.id === 'circle' && state.special ? specialById(state.special) : null;
      scene.banner = {
        text: boss
          ? `📢 ${boss.title} IS COMING`
          : e.period.id === 'circle'
            ? `${state.daily ? '📅 ' : ''}${dayName(state.wave)}: ${special ? `${special.icon} ${special.name}!` : `${e.period.icon} ${e.period.name}`}`
            : `${e.period.icon} ${e.period.name}!`,
        sub: boss ? boss.warning : [special?.description, ...fresh.map((r) => r.intro)].filter(Boolean).join(' ') || undefined,
        until: scene.time + (fresh.length || boss || special ? 5 : 2),
      };
      say('teacher', special ? SPECIAL_LINES[special.id] : state.special === 'snow' && e.period.id === 'recess' ? 'Last period! Snow’s coming down. Everyone home after this.' : e.period.line);
      if (e.period.id === 'recess') play('wave');
      break;
    }
    case 'cheese':
      say('teacher', 'Everybody freeze! Say cheese!');
      play('homestead');
      break;
    case 'flash':
      scene.flash = scene.time;
      play('shutter');
      float(state.w / 2, state.h * 0.25, '📸 FLASH! Here they come!', '#c0392b', true);
      break;
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
      if (e.hand.classmate) {
        if (Math.random() < 0.6) say('kid', pick(REGULAR_LINES[e.hand.classmate].trade), at);
      } else if (Math.random() < 0.4) say('kid', pick(LINES.kidTrade), at);
      break;
    }
    case 'friend': {
      const c = classmateById(e.id);
      play('recover');
      float(state.w / 2, state.h * 0.3, `💛 ${c.icon} ${c.name} is your best friend now`, '#b9770e', true);
      say('kid', REGULAR_LINES[e.id].friend);
      break;
    }
    case 'grudge': {
      const c = classmateById(e.id);
      say('kid', pick(REGULAR_LINES[e.id].grudge));
      float(state.w / 2, state.h * 0.36, `😤 ${c.icon} ${c.name} won’t trade with you for a while`, '#c0392b');
      break;
    }
    case 'tattle': {
      const at = handPosition(e.hand);
      play('violation');
      float(at.x, at.y, '🍎 TATTLETALE!', '#e84393', true);
      float(pile.x, pile.y, `CONFISCATED −${e.blocks}🧱`, '#c0392b', true);
      say('kid', pick(LINES.tattle), at);
      say('teacher', pick(LINES.tattleTeacher));
      scene.shake = 0.4;
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
      setTimeout(() => (state.daily ? showDailyDone() : pendingGraduation !== null ? showGraduation() : showBreak()), 500);
      break;
    case 'graduation':
      pendingGraduation = e.gpa;
      break;
    case 'perk':
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
      if (e.hand.role === 'lunch') award('lunch');
      if (e.hand.role === 'pet') award('pet');
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
      if (e.hand.role === 'lunch' && e.blocks > 0) award('free-lunch');
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
    case 'friend':
      award('friend');
      if (CLASSMATES.every((c) => isFriend(state.regulars[c.id]))) award('all-friends');
      break;
    case 'grudge':
      if (e.wasFriend) award('grudge');
      break;
    case 'tattle':
      award('tattle');
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
      if (state.special === 'substitute' && !state.day.violations) award('substitute');
      if (state.special === 'picture') award('picture');
      if (state.special === 'field-trip') award('field-trip');
      if (state.special === 'snow' && !state.day.stolen) award('snow');
      if (state.daily && runDaily) {
        award('daily');
        if (new Set([...Object.keys(save.dailyBests), runDaily.key]).size >= 5) award('daily-5');
      }
      if (state.difficulty === 'hard' && isFriday(state.wave)) award('hard');
      if (weekOf(state.wave) > GRADUATION_WEEK) award('summer');
      if (isFriday(state.wave)) {
        award('tgif');
        if (weekOf(state.wave) >= 2) award('week-2');
        if (weekOf(state.wave) >= 3) award('week-3');
      }
      break;
    case 'perk':
      award('perk');
      if (PERKS.filter((p) => state.perks[p.id] > 0).length >= 5) award('perks-5');
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

byId('show-achievements').addEventListener('click', () => {
  renderAchievements();
  els.achievements.hidden = false;
  // The class waits while you're reading.
  setPaused('menu', true);
  byId('hide-achievements').focus();
});
byId('hide-achievements').addEventListener('click', () => {
  els.achievements.hidden = true;
  setPaused('menu', false);
});

// --- Pause ---

function openPause() {
  if (state.phase !== 'playing' || !els.pauseMenu.hidden) return;
  pressing = null;
  setPaused('user', true);
  renderColorblind();
  els.pauseMenu.hidden = false;
  els.resume.focus();
}

function closePause() {
  if (els.pauseMenu.hidden) return;
  els.pauseMenu.hidden = true;
  setPaused('user', false);
}

els.pauseButton.addEventListener('click', () => (els.pauseMenu.hidden ? openPause() : closePause()));
els.resume.addEventListener('click', closePause);
els.restart.addEventListener('click', () => {
  closePause();
  startGame(state.daily);
});

// --- Colour-blind mode ---

function renderColorblind() {
  scene.colorblind = save.colorblind;
  document.body.classList.toggle('colorblind', save.colorblind);
  for (const el of document.querySelectorAll('.cb-thief')) el.textContent = save.colorblind ? 'Orange' : 'Red';
  for (const el of document.querySelectorAll('.cb-trader')) el.textContent = save.colorblind ? 'Blue' : 'Green';
  for (const b of document.querySelectorAll<HTMLButtonElement>('.colorblind-toggle')) {
    b.textContent = `🎨 Colour-blind mode: ${save.colorblind ? 'on' : 'off'}`;
    b.setAttribute('aria-pressed', String(save.colorblind));
  }
}
for (const b of document.querySelectorAll<HTMLButtonElement>('.colorblind-toggle')) {
  b.addEventListener('click', () => {
    save.colorblind = !save.colorblind;
    persist();
    renderColorblind();
  });
}

function renderMusicToggle() {
  for (const b of document.querySelectorAll<HTMLButtonElement>('.music-toggle')) {
    b.textContent = `🎵 Music: ${save.music ? 'on' : 'off'}`;
    b.setAttribute('aria-pressed', String(save.music));
  }
}
// Copy your progress to another device, or load it from one.
for (const b of document.querySelectorAll<HTMLButtonElement>('.save-transfer')) b.addEventListener('click', () => openSaveTransfer('kindergarten-property-defender'));
for (const b of document.querySelectorAll<HTMLButtonElement>('.music-toggle')) {
  b.addEventListener('click', () => {
    save.music = !save.music;
    persist();
    renderMusicToggle();
  });
}
renderMusicToggle();

// ---------------------------------------------------------------------------
// Music: a playground chiptune that follows the school day
// ---------------------------------------------------------------------------

const music = new Playground();

/** Plays while a day's on (and the sound and music are on); quiet otherwise. Follows the period, or the boss. */
function syncMusic() {
  const want = !save.muted && save.music && state.phase === 'playing' && !paused && els.title.hidden && !state.tutorial;
  if (want && !music.playing) {
    const audio = getAudioContext();
    if (audio.state === 'running') music.start(audio);
  } else if (!want && music.playing) music.stop();
  if (!music.playing) return;
  const boss = state.hands.some((h) => isBoss(h.role) && !h.slapped);
  music.setMood(boss ? 'boss' : (periodAt(state.waveTime).id as MoodId));
}

// ---------------------------------------------------------------------------
// Juice: bursts where slaps land, a moment of hit-stop, and Jack's face
// ---------------------------------------------------------------------------

let hitStop = 0;

function landed(hand: Hand, big: boolean) {
  const at = handPosition(hand);
  scene.hits.push({ x: at.x, y: at.y, t: scene.time, big, miss: false });
  scene.struck[hand.id] = scene.time;
  hitStop = Math.max(hitStop, big ? 0.07 : 0.035);
}

function juice(e: GameEvent) {
  switch (e.type) {
    case 'slap':
      landed(e.hand, e.combo >= 5 || isBoss(e.hand.role));
      if (e.combo >= 5) scene.shake = Math.max(scene.shake, 0.12 + Math.min(0.2, e.combo * 0.01));
      break;
    case 'bonk':
    case 'recover':
    case 'guard':
    case 'blown':
    case 'tattle':
      landed(e.hand, e.type === 'recover' || isBoss(e.hand.role));
      if (e.type === 'tattle') scene.mood = { kind: 'upset', until: scene.time + 1.6 };
      break;
    case 'violation':
      landed(e.hand, false);
      scene.mood = { kind: 'upset', until: scene.time + 1.2 };
      break;
    case 'miss':
      scene.hits.push({ x: e.x, y: e.y, t: scene.time, big: false, miss: true });
      break;
    case 'steal':
      if (e.blocks > 0) scene.mood = { kind: 'upset', until: scene.time + 1.5 };
      break;
    case 'trade':
      scene.mood = { kind: 'happy', until: scene.time + 1.1 };
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// The guided first morning: three hands, one at a time, with the clock stopped
// ---------------------------------------------------------------------------

/** Which lesson it's on, the hand it's about, and what happens next (and when). */
let lesson: { step: number; hand: Hand | null; next: { step: number; at: number } | null; release: number } | null = null;

function coach(html: string) {
  els.coachText.innerHTML = html;
  els.coach.hidden = false;
}

function lessonHand(kind: 'thief' | 'trader', degrees: number, travel: number): Hand {
  const hand = spawnHand(state, Math.random, kind, kind === 'thief' ? 'grabby' : undefined);
  const root = edgeAt(state, degrees);
  hand.rootX = root.x;
  hand.rootY = root.y;
  hand.wobble = 0;
  hand.surge = 0;
  hand.travel = travel;
  if (kind === 'trader') {
    hand.classmate = null;
    hand.offer = { wants: 'blocks', item: 'cookie', price: 1, value: 2.5 };
  }
  scene.pointAt = hand.id;
  return hand;
}

function startLesson() {
  if (state.phase !== 'playing' || !els.title.hidden || state.daily) return;
  state.tutorial = true;
  state.hands = [];
  lesson = { step: 0, hand: null, next: null, release: 0 };
  goLesson(0);
}

function goLesson(step: number) {
  if (!lesson) return;
  lesson.step = step;
  lesson.next = null;
  switch (step) {
    case 0:
      lesson.hand = lessonHand('thief', 180, 3);
      lesson.hand.pauseAt = 0.45;
      coach('👋 <b>Red sleeve, grabby fist:</b> the teacher, coming to redistribute your blocks. <b>Tap it to slap it!</b>');
      break;
    case 1:
      lesson.hand = lessonHand('trader', 55, 3.2);
      lesson.hand.pauseAt = 0.45;
      lesson.release = scene.time + 3.2;
      coach('🤝 <b>Green sleeve, open hand:</b> a classmate offering a trade, 🍪 for 1🧱. <b>Don’t slap this one.</b> Let it reach your pile.');
      break;
    case 2:
      lesson.hand = lessonHand('thief', 165, 2.6);
      coach('Here comes another grabby hand. This time, <b>let it grab</b>…');
      break;
    case 3:
      lesson.hand = null;
      scene.pointAt = null;
      coach('🔔 That’s the job, Jack. <b>Survive five periods, till 3pm.</b> Trade with your classmates, slap the teacher, and keep an eye out for new troublemakers: you’ll meet them as they turn up.');
      lesson.next = { step: 4, at: scene.time + 5 };
      break;
    default:
      endLesson(true);
  }
}

/** Waits for the player to do the thing. */
function lessonEvent(e: GameEvent) {
  if (!lesson || !('hand' in e) || e.hand !== lesson.hand) return;
  const later = (step: number, delay: number) => (lesson!.next = { step, at: scene.time + delay });
  if (lesson.step === 0 && e.type === 'slap') {
    coach('💥 <b>SLAP!</b> That’s the spirit. Thieves get faster every day, so keep those hands ready.');
    scene.pointAt = null;
    later(1, 2.2);
  }
  if (lesson.step === 1 && e.type === 'trade') {
    coach('🤝 <b>Deal!</b> The 🍪 is in your stash (up top). Use it in a pinch, or sell it to the next kid for more than you paid.');
    scene.pointAt = null;
    later(2, 3.2);
  }
  if (lesson.step === 1 && e.type === 'violation') {
    // Forgiven, this once.
    state.stars = CONFIG.maxStars;
    state.stats.violations--;
    state.day.violations--;
    coach('😬 Whoa, that was a <b>classmate</b>! On a real day that costs you a gold star. Let’s try that again.');
    scene.pointAt = null;
    later(1, 2.4);
  }
  if (lesson.step === 2 && e.type === 'steal') {
    e.hand.travel = 9; // a slow getaway, so there's time
    coach('😱 It got a block! Quick: <b>slap it on its way out</b> to get it back.');
  }
  if (lesson.step === 2 && e.type === 'slap') {
    coach('Ha, good reflexes! But let this one <b>reach your pile</b>, so you can see what happens.');
    scene.pointAt = null;
    later(2, 2);
  }
  if (lesson.step === 2 && e.type === 'recover') {
    coach('🔙 <b>Repossessed!</b> Catch a thief on its way out and the blocks come back.');
    scene.pointAt = null;
    later(3, 2.6);
  }
}

function lessonTick() {
  if (!lesson) return;
  if (lesson.next && scene.time >= lesson.next.at) {
    goLesson(lesson.next.step);
    return;
  }
  const hand = lesson.hand;
  // The trader waits a moment (so you can read it), then comes in.
  if (lesson.step === 1 && hand && hand.pauseAt !== null && scene.time >= lesson.release) hand.pauseAt = null;
  // The thief got away with it: give the block back and send another.
  if (lesson.step === 2 && hand && !lesson.next && !state.hands.includes(hand)) {
    state.blocks++;
    coach('Too slow! Here’s another one.');
    lesson.hand = null;
    lesson.next = { step: 2, at: scene.time + 1.5 };
  }
}

/** The guided morning's over (or skipped): the bell rings and the day starts properly. */
function endLesson(done: boolean) {
  els.coach.hidden = true;
  scene.pointAt = null;
  if (!lesson) return;
  lesson = null;
  state.tutorial = false;
  state.hands = [];
  state.waveTime = 0;
  state.period = -1;
  state.spawnIn = 1;
  if (done || !save.tutorialDone) {
    save.tutorialDone = true;
    persist();
  }
}
els.coachSkip.addEventListener('click', () => endLesson(true));

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
  els.wave.textContent = `${state.daily ? '📅 ' : ''}${state.special ? `${specialById(state.special).icon} ` : ''}${dayName(state.wave).slice(0, 3)} · ${weekOf(state.wave) > GRADUATION_WEEK ? `summer school, week ${weekOf(state.wave) - GRADUATION_WEEK}` : `week ${weekOf(state.wave)}`}`;
  const period = periodAt(state.waveTime);
  els.period.textContent = `${period.icon} ${period.name}`;
  els.waveBar.style.width = `${Math.min(100, (state.waveTime / todayLength(state)) * 100)}%`;
  const m = multiplier(state.combo, comboCap(state));
  els.combo.textContent = state.combo >= 2 ? `${state.combo} in a row${m > 1 ? ` · ×${m}` : ''}` : '';
  renderStash();
  els.meter.style.width = `${(state.meter / meterMax(state)) * 100}%`;
  const ready = state.meter >= meterMax(state) && state.phase === 'playing';
  els.shout.disabled = !ready;
  els.shout.classList.toggle('ready', ready);
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) {
    scene.time += dt;
    // A slap that lands freezes the action for a few hundredths of a second (hit-stop).
    const frozen = hitStop > 0;
    hitStop = Math.max(0, hitStop - dt);
    // Holding on to Sticky Fingers
    if (pressing && state.phase === 'playing' && !frozen) press(state, pressing.x, pressing.y, dt);
    if (!frozen) step(state, dt, runRng);
    if (lesson) lessonTick();
    scene.hits = scene.hits.filter((h) => scene.time - h.t < 0.5);
    if (state.events.some((e) => e.type === 'wave-end')) recessEvents = state.events.filter((e) => e.type === 'interest' || e.type === 'wages' || e.type === 'allowance');
    for (const e of state.events) handle(e);
    state.events = [];
    scene.shake = Math.max(0, scene.shake - dt);
    scene.floaters = scene.floaters.filter((f) => scene.time - f.born < 1.2);
  }
  render(ctx, state, scene);
  renderHud();
  syncMusic();
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
  if (document.hidden) openPause();
  last = performance.now();
});

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

/** Today's daily challenge, while one's being played, and the random numbers driving the run (seeded for the daily). */
let runDaily: Daily | null = null;
let runRng: () => number = Math.random;

function startGame(daily = false, guided = !save.tutorialDone && !daily) {
  getAudioContext();
  runDaily = daily ? dailyFor(new Date()) : null;
  runRng = runDaily ? seededRng(runDaily.seed) : Math.random;
  state = newGame(els.canvas.clientWidth, els.canvas.clientHeight, daily ? 'normal' : save.difficulty);
  if (runDaily) startDaily(state, runDaily);
  run = { interest: 0, cleanDays: 0, napStolen: null, board: 0 };
  pendingGraduation = null;
  scene.floaters = [];
  scene.bubbles = [];
  els.title.hidden = true;
  els.over.hidden = true;
  els.pause.hidden = true;
  els.daily.hidden = true;
  els.history.hidden = true;
  endLesson(false);
  say('teacher', 'Jack, you should share your toys.');
  setTimeout(() => say('jack', 'Have you not heard about property rights?'), 1200);
  if (guided) {
    // The clock waits from the first second; the first lesson comes after the teacher's said her piece.
    state.tutorial = true;
    setTimeout(startLesson, 1800);
  }
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
    regularsMet(state.wave)
      .map((c) => {
        const r = state.regulars[c.id];
        const how = r.grudge > 1 ? '😤 still mad tomorrow' : r.grudge === 1 ? '🙂 over it by tomorrow' : isFriend(r) ? '💛 best friends' : `${r.trades}/${FRIEND_AT} trades to best friends`;
        return `${c.icon} ${c.name}: ${how}`;
      })
      .join(' · '),
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
  renderPerks();
  renderShop();
  els.pause.hidden = false;
  els.next.focus();
}

/** The weekend's perk choice (and the perks Jack already has). */
function renderPerks() {
  const offer = state.perkOffer;
  const owned = PERKS.filter((p) => state.perks[p.id] > 0)
    .map((p) => `<span class="owned-perk" title="${p.description}">${p.icon} ${p.name}${state.perks[p.id] > 1 ? ` ×${state.perks[p.id]}` : ''}</span>`)
    .join('');
  els.perks.innerHTML = `${offer.length ? `<h2>🏖️ Weekend: pick a perk</h2><div class="perk-choices">${offer
    .map((id) => {
      const p = perkById(id);
      return `<button type="button" class="perk" data-id="${id}"><span class="icon">${p.icon}</span><b>${p.name}${state.perks[id] ? ` (${state.perks[id] + 1}/${p.max})` : ''}</b><small>${p.description}</small></button>`;
    })
    .join('')}</div>` : ''}${owned ? `<p class="owned-perks">Your perks: ${owned}</p>` : ''}`;
  for (const b of els.perks.querySelectorAll<HTMLButtonElement>('.perk')) {
    b.addEventListener('click', () => {
      if (!takePerk(state, b.dataset.id as PerkId)) return;
      for (const ev of state.events) handle(ev);
      state.events = [];
      play('recover');
      renderPerks();
      renderShop();
      els.next.disabled = false;
      els.next.focus();
    });
  }
  // Pick one before Monday.
  els.next.disabled = offer.length > 0;
}

// --- Graduation ---

/** The GPA when Jack graduated, until the diploma's been shown. */
let pendingGraduation: number | null = null;

function showGraduation() {
  const score = pendingGraduation ?? gpa(state);
  pendingGraduation = null;
  save.graduations++;
  save.bestGpa = Math.max(save.bestGpa, score);
  persist();
  const honour = honours(score);
  award('graduate');
  if (honour === 'summa cum laude') award('summa');
  if (state.difficulty === 'hard') award('hard-grad');
  els.diploma.innerHTML = `
    <p class="seal">🎓</p>
    <p class="certify">This certifies that</p>
    <p class="name">Jack</p>
    <p class="certify">has completed <b>Kindergarten</b>${honour ? `, <i>${honour}</i>,` : ''} with a major in <b>Property Rights</b> and a minor in <b>Austrian Economics</b>.</p>
    <p class="gpa">GPA ${score.toFixed(2)} · ${state.score.toLocaleString('en-US')} points · ${state.stats.slapped} hands slapped · ${state.stats.trades} trades</p>
    <p class="signed">Signed, the Teacher <span>(reluctantly)</span></p>`;
  if (!save.muted) [523, 659, 784, 1047, 1319].forEach((hz, i) => playTone(note(hz, 0.18, 0.06, 'triangle'), i * 0.12));
  els.graduation.hidden = false;
  els.summer.focus();
}

els.summer.addEventListener('click', () => {
  els.graduation.hidden = true;
  showBreak();
});
els.retire.addEventListener('click', () => {
  els.graduation.hidden = true;
  endRun('retired');
  persist();
  startGame();
});

/** The recess shop: spend blocks on things that make blocks, or protect them. */
function renderShop() {
  const card = (id: BuildId) => {
    const b = buildingById(id);
    const level = state.built[id];
    const cost = nextCost(b, level);
    // Bigger builds need a permit, and permits come through week by week.
    const week = nextWeek(b, level);
    const locked = week !== null && week > permitWeek(state);
    const pips = b.costs.map((_, i) => (i < level ? '●' : '○')).join('');
    const now = level ? b.effect(level) : 'not built yet';
    const next = cost !== null ? b.effect(level + 1) : '';
    return `<button type="button" class="build ${b.kind}${locked ? ' locked' : ''}" data-id="${id}" ${cost === null || locked || state.blocks - cost < 1 ? 'disabled' : ''}>
      <span class="icon">${b.icon}</span>
      <span class="what"><b>${b.name}</b> <i>${pips}</i><small>${level ? `Now: ${now}` : 'Not built yet'}</small>${cost !== null ? `<small class="next">${level ? 'Next' : 'Build'}: ${next}${locked ? ` · permit in week ${week}` : ''}</small>` : '<small class="next">Fully built</small>'}</span>
      <span class="cost">${cost === null ? 'MAX' : locked ? `🔒 Wk ${week}<em>${cost}🧱</em>` : `${cost}🧱`}</span>
    </button>`;
  };
  const pull = attraction(state.blocks);
  els.shop.innerHTML = `
    <h2>${isFriday(state.wave) ? '🏖️ The weekend: spend your blocks' : '🏗️ After school: spend your blocks'} <span>${state.blocks}🧱</span></h2>
    <p class="shop-note">Blocks you spend can't be stolen, but they're not growing either. Keep at least one. Bigger builds need a permit: new ones come through every weekend.${pull > 1.05 ? ` A pile this big draws ${Math.round((pull - 1) * 100)}% more hands.` : ''}</p>
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

/** A run's over (not a daily): the best on its difficulty, and the history table. Returns its place in the table (-1 if none). */
function endRun(ending: RunEnding): number {
  save.bests[state.difficulty] = Math.max(save.bests[state.difficulty], state.score);
  save.bestWave = Math.max(save.bestWave, state.wave);
  return recordRun(save.history, { score: state.score, day: state.wave, ending, difficulty: state.difficulty, graduated: state.graduated, date: dateKey(new Date()) });
}

/** Records today's daily score. Returns the best before this one. */
function endDaily(): number {
  const previous = save.dailyBests[runDaily!.key] ?? 0;
  save.dailyBests[runDaily!.key] = Math.max(previous, state.score);
  save.dailyBests = normalizeDailyBests(save.dailyBests);
  persist();
  return previous;
}

const statsLine = () => {
  const st = state.stats;
  return `🖐️ ${st.slapped} slapped · 🧱 ${st.recovered} recovered · 🤝 ${st.trades} trades · 😢 ${st.stolen} stolen · ⚠️ ${st.violations} violations · 🔥 best streak ${st.bestCombo}`;
};

function showOverScreen(title: string, lines: string[], again: string) {
  els.overTitle.textContent = title;
  els.overBody.replaceChildren(...lines.map((t) => Object.assign(document.createElement('p'), { textContent: t })));
  els.again.textContent = again;
  els.over.hidden = false;
  els.again.focus();
}

function showOver() {
  const why =
    state.over === 'expelled'
      ? 'You slapped one too many classmates who only wanted to trade. That’s aggression, Jack. The NAP cuts both ways.'
      : 'The teacher redistributed every last block. It’s for the greater good, apparently.';
  const title = state.over === 'expelled' ? '🚸 Sent to the Principal' : '🧱 Property Seized';
  if (state.daily) {
    const previous = endDaily();
    showOverScreen(title, [why, dailyLine(previous), statsLine()], 'Try today’s day again');
    return;
  }
  const previous = save.bests[state.difficulty];
  const rank = endRun(state.over === 'expelled' ? 'expelled' : 'seized');
  persist();
  const d = difficultyById(state.difficulty);
  showOverScreen(
    title,
    [
      why,
      `Made it to ${dayName(state.wave)}, week ${weekOf(state.wave)} · ${state.score.toLocaleString('en-US')} points${state.score > previous ? ` · 🏆 new best on ${d.name}!` : ` · best on ${d.name}: ${previous.toLocaleString('en-US')}`}`,
      rank >= 0 ? `📜 #${rank + 1} in your run history` : '',
      statsLine(),
    ].filter(Boolean),
    'Try again',
  );
}

const dailyLine = (previous: number) =>
  `📅 Daily challenge, ${runDaily!.key}: ${state.score.toLocaleString('en-US')} points · ${state.score > previous ? (previous ? `🏆 new best today (was ${previous.toLocaleString('en-US')})` : '🏆 your first score today') : `today’s best ${previous.toLocaleString('en-US')}`}`;

/** The daily challenge's one day is done. */
function showDailyDone() {
  const previous = endDaily();
  const special = specialById(runDaily!.special);
  const card = state.report;
  showOverScreen(
    '📅 School’s out!',
    [
      `You made it through today’s ${special.icon} ${special.name} with ${state.blocks}🧱 left.`,
      card ? `Report card: ${card.defence} in defence, ${card.economics} in economics, ${card.citizenship} for playing well with others.` : '',
      dailyLine(previous),
      statsLine(),
      'Same day for everyone today. A new one tomorrow.',
    ].filter(Boolean),
    'Try today’s day again',
  );
}

// --- The title screen: difficulty, the daily challenge, the run history ---

function renderTitle() {
  const d = difficultyById(save.difficulty);
  for (const b of els.difficulty.querySelectorAll<HTMLButtonElement>('button')) b.setAttribute('aria-checked', String(b.dataset.difficulty === save.difficulty));
  els.difficultyNote.textContent = d.description;
  const best = save.bests[save.difficulty];
  els.best.textContent = [
    best ? `Best on ${d.name}: ${best.toLocaleString('en-US')} points` : '',
    save.graduations ? `🎓 Graduated ×${save.graduations} (best GPA ${save.bestGpa.toFixed(2)})` : '',
    unlocked.size ? `🏅 ${unlocked.size} / ${ACHIEVEMENTS.length} achievements` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

els.difficulty.replaceChildren(
  ...DIFFICULTIES.map((d) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.difficulty = d.id;
    b.textContent = `${d.icon} ${d.name}`;
    b.addEventListener('click', () => {
      save.difficulty = d.id;
      persist();
      renderTitle();
    });
    return b;
  }),
);

function toTitle() {
  els.over.hidden = true;
  els.pause.hidden = true;
  state = newGame(els.canvas.clientWidth, els.canvas.clientHeight);
  state.phase = 'break';
  runDaily = null;
  renderTitle();
  els.title.hidden = false;
  els.start.focus();
}
els.toTitle.addEventListener('click', toTitle);

byId('show-tutorial').addEventListener('click', () => startGame(false, true));

byId('show-daily').addEventListener('click', () => {
  const today = dailyFor(new Date());
  const special = specialById(today.special);
  const best = save.dailyBests[today.key];
  const perk = perkById(today.perk);
  const b = buildingById(today.built);
  els.dailyBody.innerHTML = `
    <p class="daily-special"><span class="icon">${special.icon}</span><b>${special.name}</b><small>${special.description}</small></p>
    <ul class="daily-kit">
      <li>📅 ${dayName(today.day)} of week ${weekOf(today.day)}</li>
      <li>🧱 ${today.blocks} blocks</li>
      <li>🎒 ${today.stash.map((i) => ITEMS[i].icon).join(' ')} in your stash</li>
      <li>${b.icon} A ${b.name.toLowerCase()} already built</li>
      <li>${perk.icon} ${perk.name}</li>
    </ul>
    <p class="daily-best">Your best today: <b>${best ? best.toLocaleString('en-US') : 'none yet'}</b></p>`;
  els.daily.hidden = false;
  byId('start-daily').focus();
});
byId('hide-daily').addEventListener('click', () => {
  els.daily.hidden = true;
  els.start.focus();
});
byId('start-daily').addEventListener('click', () => startGame(true));

const ENDINGS: Record<RunEnding, string> = { seized: '🧱 Property seized', expelled: '🚸 Sent to the Principal', retired: '🎓 Retired undefeated' };
byId('show-history').addEventListener('click', () => {
  els.historyBody.innerHTML = save.history.length
    ? `<table class="history-table"><thead><tr><th>#</th><th>Score</th><th>Made it to</th><th>Ended</th><th>Mode</th><th>Date</th></tr></thead><tbody>${save.history
        .map((r, i) => {
          const d = difficultyById(r.difficulty);
          return `<tr><td>${i + 1}</td><td><b>${r.score.toLocaleString('en-US')}</b></td><td>${dayName(r.day).slice(0, 3)} · week ${weekOf(r.day)}${r.graduated ? ' 🎓' : ''}</td><td>${ENDINGS[r.ending]}</td><td>${d.icon} ${d.name}</td><td>${r.date}</td></tr>`;
        })
        .join('')}</tbody></table>`
    : '<p class="tagline">No runs yet. Go defend some property.</p>';
  els.history.hidden = false;
  byId('hide-history').focus();
});
byId('hide-history').addEventListener('click', () => {
  els.history.hidden = true;
  els.start.focus();
});

els.start.addEventListener('click', () => startGame(false));
els.again.addEventListener('click', () => startGame(state.daily));
els.next.addEventListener('click', () => {
  els.pause.hidden = true;
  nextWave(state, runRng);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    if (!els.pauseMenu.hidden) closePause();
    else if (els.achievements.hidden && els.title.hidden) openPause();
    else if (e.key === 'Escape' && !els.achievements.hidden) byId('hide-achievements').click();
    return;
  }
  if (!els.pauseMenu.hidden) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      closePause();
    }
    return;
  }
  if (!els.daily.hidden || !els.history.hidden) {
    if (e.key === 'Escape') (els.daily.hidden ? byId('hide-history') : byId('hide-daily')).click();
    return;
  }
  if (!els.graduation.hidden) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      els.summer.click();
    }
    return;
  }
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
  Object.assign(window, { kpd: { scene: () => scene, lesson: () => lesson, musicOn: () => music.playing, specials: SPECIAL_DAYS.map((d) => d.id), daily: () => startGame(true), state: () => state, showBreak, handAt: handPosition, spawn: (role: string) => (CLASSMATES.some((c) => c.id === role) ? spawnHand(state, Math.random, 'trader', undefined, role as ClassmateId) : spawnHand(state, Math.random, role === 'trader' ? 'trader' : 'thief', role === 'trader' ? undefined : (role as Role))) } });
}

renderTitle();
