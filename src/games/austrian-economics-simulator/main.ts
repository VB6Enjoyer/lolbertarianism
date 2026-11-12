import './style.css';
import { note, playTone, getAudioContext } from '../../shared/audio.ts';
import { spawnText } from '../../shared/effects.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import { COLS, DISTRICTS, isRoad, nearestRoad, placeAtBlock, ROWS, type DistrictId, type Tile } from './map.ts';
import { act, sell, cityEvent, COVER_VALUE, borrow, buyDrug, buyGear, buyGold, capacity, cargoValue, context, creditLimit, deposit, drugPrice, GEAR, gearPrice, goldPrice, loanRate, loanSize, newGame, phaseAt, repay, savingsRate, scrapPrice, sellGold, tileOf, update, walkTo, withdraw, type GameEvent, type GameState } from './logic.ts';
import { ACHIEVEMENTS, achievementById, normalizeUnlocked, Tracker } from './achievements.ts';
import { fitView, render, type View } from './render.ts';
import { pickLine, URGENT, type Cue } from './rothbard.ts';
import { Jazz } from './music.ts';
import { dailyFor, normalizeDailyBests, seededRng, type Daily } from './daily.ts';

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const els = {
  app: byId('app'),
  map: byId<HTMLCanvasElement>('map'),
  mapWrap: document.querySelector<HTMLElement>('.map-wrap')!,
  action: byId<HTMLButtonElement>('action'),
  shop: byId('shop'),
  shopTitle: byId('shop-title'),
  shopItems: byId('shop-items'),
  phase: byId('phase'),
  rate: byId('rate'),
  ticker: byId('ticker'),
  mute: byId<HTMLButtonElement>('mute'),
  music: byId<HTMLButtonElement>('music'),
  cash: byId('cash'),
  utils: byId('utils'),
  fixBar: byId('fix-bar'),
  heatBar: byId('heat-bar'),
  carried: byId('carried'),
  stash: byId('stash'),
  gear: byId('gear'),
  savings: byId('savings'),
  debt: byId('debt'),
  gold: byId('gold'),
  finance: document.querySelector<HTMLElement>('.finance')!,
  event: byId('event'),
  speech: byId('speech'),
  speechText: byId('speech-text'),
  contract: byId('contract'),
  daily: byId('daily'),
  dailyLine: byId('daily-line'),
  districts: byId('districts'),
  laps: byId('laps'),
  cycle: document.querySelector<HTMLElement>('.cycle')!,
  priceNear: byId('price-near'),
  priceFar: byId('price-far'),
  priceHeroin: byId('price-heroin'),
  priceCrack: byId('price-crack'),
  graphScrap: byId<HTMLCanvasElement>('graph-scrap'),
  graphDrugs: byId<HTMLCanvasElement>('graph-drugs'),
  title: byId('title'),
  titleBest: byId('title-best'),
  achievements: byId('achievements'),
  achievementsGrid: byId('achievements-grid'),
  achievementsCount: byId('achievements-count'),
  paused: byId('paused'),
  over: byId('over'),
  toasts: byId('toasts'),
};

const ctx = els.map.getContext('2d')!;
const rothbard = new Image();
rothbard.src = `${import.meta.env.BASE_URL}vidya/img/rothbard.webp`;

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

interface Save {
  /** The best downtown (kept under its old name), and in the suburbs. */
  best: number;
  bestSuburbs: number;
  muted: boolean;
  achievements: string[];
  runs: number;
  district: DistrictId;
  /** Your best daily-cycle score, per date. */
  dailyBests: Record<string, number>;
  /** The elevator jazz (on unless you turned it off). */
  music: boolean;
}

const slot = createSaveSlot<Save>({ game: 'austrian-economics-simulator', version: 1 });
const saved = slot.load();
const save: Save = {
  best: Math.max(0, Math.floor(Number(saved?.best) || 0)),
  muted: saved?.muted === true,
  achievements: [...normalizeUnlocked(saved?.achievements)],
  runs: Math.max(0, Math.floor(Number(saved?.runs) || 0)),
  bestSuburbs: Math.max(0, Math.floor(Number(saved?.bestSuburbs) || 0)),
  district: saved?.district === 'suburbs' ? 'suburbs' : 'downtown',
  dailyBests: normalizeDailyBests(saved?.dailyBests),
  music: saved?.music !== false,
};

const bestIn = (id: DistrictId) => (id === 'suburbs' ? save.bestSuburbs : save.best);
const districtOpen = (id: DistrictId) => save.best >= DISTRICTS.find((d) => d.id === id)!.unlockUtils;
if (!districtOpen(save.district)) save.district = 'downtown';
const unlocked = new Set(save.achievements);
const tracker = new Tracker(unlocked);

// ---------------------------------------------------------------------------
// Sound
// ---------------------------------------------------------------------------

const sfx = {
  pry: () => playTone({ wave: 'sawtooth', duration: 0.5, frequency: [[0, 90], [0.5, 140, 'linear']], gain: [[0, 0.05], [0.5, 0.001, 'exp']] }),
  clank: () => {
    playTone({ wave: 'square', duration: 0.18, frequency: [[0, 520], [0.18, 180, 'exp']], gain: [[0, 0.08], [0.18, 0.001, 'exp']] });
    playTone(note(1240, 0.25, 0.03, 'triangle'), 0.04);
  },
  cash: () => [988, 1319, 1568].forEach((hz, i) => playTone(note(hz, 0.08, 0.05, 'square'), i * 0.06)),
  buy: () => playTone({ wave: 'sine', duration: 0.6, frequency: [[0, 300], [0.6, 900, 'exp']], gain: [[0, 0.06], [0.6, 0.001, 'exp']] }),
  gear: () => [440, 660, 880].forEach((hz, i) => playTone(note(hz, 0.09, 0.05), i * 0.07)),
  fell: () => playTone({ wave: 'triangle', duration: 0.9, frequency: [[0, 700], [0.9, 80, 'exp']], gain: [[0, 0.08], [0.9, 0.001, 'exp']] }),
  bell: () => [1047, 784].forEach((hz, i) => playTone(note(hz, 0.4, 0.05, 'sine'), i * 0.3)),
  boom: () => [392, 523, 659, 784].forEach((hz, i) => playTone(note(hz, 0.12, 0.05), i * 0.08)),
  bust: () => [659, 523, 392, 262].forEach((hz, i) => playTone(note(hz, 0.16, 0.05, 'sawtooth'), i * 0.1)),
  alert: () => playTone(note(880, 0.12, 0.05, 'square')),
  lap: () => [523, 659, 784, 1047, 1319].forEach((hz, i) => playTone(note(hz, 0.1, 0.05, 'triangle'), i * 0.07)),
  over: () => [523, 440, 349, 262].forEach((hz, i) => playTone(note(hz, 0.25, 0.06), i * 0.22)),
  broke: () => playTone(note(150, 0.2, 0.06, 'square')),
  coin: () => [1319, 1760].forEach((hz, i) => playTone(note(hz, 0.08, 0.05, 'triangle'), i * 0.06)),
  achievement: () => [784, 988, 1175, 1568].forEach((hz, i) => playTone(note(hz, 0.1, 0.04, 'triangle'), i * 0.07)),
};

function play(name: keyof typeof sfx) {
  if (!save.muted) sfx[name]();
}

function toggleMute() {
  save.muted = !save.muted;
  slot.save(save);
  els.mute.textContent = save.muted ? '🔇' : '🔊';
  syncMusic();
}

// ---------------------------------------------------------------------------
// Music: elevator jazz, following the economy
// ---------------------------------------------------------------------------

const jazz = new Jazz();

/** Plays while you're playing (and the sound and music are on); quiet otherwise. */
function syncMusic() {
  const want = mode === 'playing' && save.music && !save.muted;
  if (want && !jazz.playing) jazz.start(getAudioContext());
  else if (!want && jazz.playing) jazz.stop();
  els.music.classList.toggle('off', !save.music);
  els.music.setAttribute('aria-pressed', String(save.music));
}

els.music.addEventListener('click', () => {
  save.music = !save.music;
  slot.save(save);
  syncMusic();
});
els.mute.textContent = save.muted ? '🔇' : '🔊';
els.mute.addEventListener('click', toggleMute);

// ---------------------------------------------------------------------------
// The news ticker
// ---------------------------------------------------------------------------

const IDLE_NEWS = [
  'FED CHAIR: "WE HAVE TOOLS."',
  'MISES: "THE BOOM IS NOT A MALFUNCTION. IT IS THE DISEASE."',
  'LOCAL ECONOMIST PREDICTS 9 OF THE LAST 3 RECESSIONS',
  'HAYEK: "THE CURIOUS TASK OF ECONOMICS IS TO SHOW MEN HOW LITTLE THEY KNOW."',
  'CITY COUNCIL STUDIES "MANHOLE COVER SHORTAGE". BLAMES SPECULATORS.',
  'BASTIAT: "THE STATE IS THE GREAT FICTION BY WHICH EVERYONE TRIES TO LIVE AT THE EXPENSE OF EVERYONE ELSE."',
  'JUNKYARD OWNERS DENY KNOWLEDGE OF WHERE ALL THE COVERS COME FROM',
  'KEYNESIAN PROPOSES PAYING CITIZENS TO DIG HOLES. ALREADY HAPPENING, SAYS CITY.',
  'ROTHBARD: "IT IS NO CRIME TO BE IGNORANT OF ECONOMICS…"',
];

const BOOM_NEWS = ['FED CUTS RATES TO 0.25%. "ECONOMY GOOD."', 'MONEY PRINTER GOES BRRR', 'INFRASTRUCTURE BILL PASSES: NEW MANHOLES FOR EVERYONE'];
const BUST_NEWS = ['FED HIKES RATES. INFLATION "TRANSITORY", SAYS FED.', 'SCRAP MARKET CRASHES. CITY WORKS BUDGET SLASHED.', 'RECESSION: ECONOMISTS SHOCKED, AUSTRIANS SMUG'];

let tickerUntil = 0;
let idleIndex = 0;

function news(text: string, seconds = 8) {
  els.ticker.textContent = text;
  els.ticker.style.animation = 'none';
  void els.ticker.offsetWidth;
  els.ticker.style.animation = '';
  tickerUntil = performance.now() / 1000 + seconds;
}

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

// ---------------------------------------------------------------------------
// Rothbard, in a speech bubble
// ---------------------------------------------------------------------------

/** Seconds (page time): when he last spoke, and when the bubble goes. */
let lastSpoke = -99;
let speechUntil = 0;
const lastLine: Partial<Record<Cue, string>> = {};
const nowSeconds = () => performance.now() / 1000;

function say(cue: Cue) {
  const now = nowSeconds();
  if (now - lastSpoke < (URGENT.has(cue) ? 1.5 : 6)) return;
  const line = pickLine(cue, Math.random(), lastLine[cue]);
  lastLine[cue] = line;
  lastSpoke = now;
  speechUntil = now + 4.2;
  els.speechText.textContent = line;
  els.speech.hidden = false;
  els.speech.style.animation = 'none';
  void els.speech.offsetWidth;
  els.speech.style.animation = '';
}

function updateSpeech() {
  const now = nowSeconds();
  if (!els.speech.hidden && (now > speechUntil || mode === 'title')) els.speech.hidden = true;
  if (mode === 'playing' && now - lastSpoke > 25) say('idle');
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const keys = new Set<string>();
const KEY_DIRS: Record<string, Tile> = {
  arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 },
  arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 },
  arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
};
/** The most recently pressed direction key wins. */
let dirOrder: string[] = [];

/** A direction held on the on-screen d-pad, or swiped on the map (finger still down). */
let dpadDir: Tile | null = null;
let swipe: { id: number; x: number; y: number; dir: Tile | null } | null = null;

function heldDir(): Tile | null {
  if (dpadDir) return dpadDir;
  if (swipe?.dir) return swipe.dir;
  for (let i = dirOrder.length - 1; i >= 0; i--) if (keys.has(dirOrder[i])) return KEY_DIRS[dirOrder[i]];
  return null;
}

document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (KEY_DIRS[key]) {
    if (mode === 'playing') e.preventDefault();
    keys.add(key);
    dirOrder = [...dirOrder.filter((k) => k !== key), key];
    return;
  }
  if (key === 'p' || key === 'escape') {
    if (mode === 'playing') pause();
    else if (mode === 'paused') resume();
    return;
  }
  if (key === 'm') {
    toggleMute();
    return;
  }
  if (mode !== 'playing') {
    if ((key === 'enter' || key === ' ') && !e.repeat && els.achievements.hidden && (document.activeElement === document.body || document.activeElement?.id === 'start' || document.activeElement?.id === 'restart')) {
      e.preventDefault();
      if (mode === 'paused') resume();
      else startGame(mode === 'over' && runDaily !== null);
    }
    return;
  }
  if (key === 'e' || key === ' ' || key === 'enter') {
    e.preventDefault();
    if (!e.repeat) doAction();
    return;
  }
  if (/^[1-4]$/.test(key)) shopKey(Number(key) - 1);
});
document.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

// Tap or click the map to walk there (a building takes you to its door).
// On the map: a tap walks you there (a building takes you to its door); a
// swipe walks in that direction for as long as your finger stays down.
const SWIPE = 22;

function tapWalk(clientX: number, clientY: number) {
  const rect = els.map.getBoundingClientRect();
  const tx = (clientX - rect.left - view.ox) / view.tile - 0.5;
  const ty = (clientY - rect.top - view.oy) / view.tile - 0.5;
  const tile = { x: Math.round(tx), y: Math.round(ty) };
  const place = placeAtBlock(tile);
  const target = place ? place.door : isRoad(tile.x, tile.y) ? tile : nearestRoad(tx, ty);
  walkTo(state, target);
  ripple(target);
}

els.map.addEventListener('pointerdown', (e) => {
  if (mode !== 'playing') return;
  els.map.setPointerCapture(e.pointerId);
  swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, dir: null };
});
els.map.addEventListener('pointermove', (e) => {
  if (!swipe || swipe.id !== e.pointerId) return;
  const dx = e.clientX - swipe.x;
  const dy = e.clientY - swipe.y;
  if (Math.hypot(dx, dy) < SWIPE) return;
  swipe.dir = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
  // Re-anchor, so you can steer by moving your finger the other way.
  swipe.x = e.clientX;
  swipe.y = e.clientY;
});
for (const type of ['pointerup', 'pointercancel'] as const) {
  els.map.addEventListener(type, (e) => {
    if (!swipe || swipe.id !== e.pointerId) return;
    const tapped = !swipe.dir && type === 'pointerup';
    swipe = null;
    if (tapped && mode === 'playing') tapWalk(e.clientX, e.clientY);
  });
}

// The on-screen d-pad (on touch screens): hold a direction to walk.
for (const b of document.querySelectorAll<HTMLButtonElement>('.dpad button')) {
  const dir = KEY_DIRS[b.dataset.dir!];
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    dpadDir = dir;
    b.classList.add('held');
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    b.addEventListener(type, () => {
      if (dpadDir === dir) dpadDir = null;
      b.classList.remove('held');
    });
  }
}
byId('touch-action').addEventListener('click', () => doAction());

els.action.addEventListener('click', () => doAction());

function doAction() {
  if (mode !== 'playing') return;
  handle(act(state));
}

// ---------------------------------------------------------------------------
// The shops: the Corner, Roundabout Hardware, the Fed's discount window and the pawn shop
// ---------------------------------------------------------------------------

type ShopKind = 'dealer' | 'hardware' | 'bank' | 'pawn' | 'yard';

interface ShopItem {
  label: string;
  detail: () => string;
  /** What it costs or pays, shown on the right. */
  price: () => string;
  enabled: () => boolean;
  buy: () => GameEvent[];
}

const pct = (perSecond: number) => `${(perSecond * 100).toFixed(2)}%/s`;

const coverName = { iron: 'iron', brass: 'brass', fed: "the Fed's", plastic: 'plastic' } as const;

/** What you'd get for one cover here, contract and all. */
function yardPrice(kind: keyof typeof coverName) {
  const c = context(state);
  if (c?.kind !== 'sell') return 0;
  const order = state.contract?.yard === c.yard ? state.contract : null;
  const fits = order && order.delivered < order.count && (order.kind === 'brass' ? kind === 'brass' : kind !== 'plastic');
  return scrapPrice(state, c.yard) * COVER_VALUE[kind] * (fits ? order.pay : 1);
}

const byValue = () => [...state.cargo].sort((a, b) => COVER_VALUE[a] - COVER_VALUE[b]);

const SHOPS: Record<ShopKind, { title: string; items: () => ShopItem[] }> = {
  yard: {
    title: '🏗️ The Junkyard',
    items: () => [
      {
        label: '⚙️ Sell one (the cheapest)',
        detail: () => (state.cargo.length ? `Your ${coverName[byValue()[0]]} cover. Keep the rest for the boom.` : 'Nothing to sell.'),
        price: () => (state.cargo.length ? money(yardPrice(byValue()[0])) : '—'),
        enabled: () => state.cargo.length > 0,
        buy: () => sell(state, 'cheapest'),
      },
      {
        label: '✨ Sell one (the best)',
        detail: () => (state.cargo.length ? `Your ${coverName[byValue()[state.cargo.length - 1]]} cover.` : 'Nothing to sell.'),
        price: () => (state.cargo.length ? money(yardPrice(byValue()[state.cargo.length - 1])) : '—'),
        enabled: () => state.cargo.length > 0,
        buy: () => sell(state, 'best'),
      },
      {
        label: '💰 Sell them all (E)',
        detail: () => `${state.cargo.length} cover${state.cargo.length === 1 ? '' : 's'}.`,
        price: () => money(state.cargo.reduce((sum, k) => sum + yardPrice(k), 0)),
        enabled: () => state.cargo.length > 0,
        buy: () => sell(state, 'all'),
      },
    ],
  },
  dealer: {
    title: '💊 The Corner',
    items: () =>
      (['heroin', 'crack'] as const).map((drug) => ({
        label: drug === 'heroin' ? '💉 Heroin' : '🪨 Crack',
        detail: () => (drug === 'heroin' ? 'Full fix · slows you down a bit' : 'Half a fix · makes you fast'),
        price: () => money(drugPrice(state, drug)),
        enabled: () => state.cash >= drugPrice(state, drug),
        buy: () => buyDrug(state, drug),
      })),
  },
  hardware: {
    title: '🔧 Roundabout Hardware',
    items: () =>
      GEAR.map((g) => ({
        label: `${g.icon} ${g.name}`,
        detail: () => g.description,
        price: () => (state.gear[g.id] ? 'OWNED' : money(gearPrice(state, g.id))),
        enabled: () => !state.gear[g.id] && state.cash >= gearPrice(state, g.id),
        buy: () => buyGear(state, g.id),
      })),
  },
  bank: {
    title: '🏛️ The Discount Window',
    items: () => [
      {
        label: '🏦 Deposit all your cash',
        detail: () => `Earns ${pct(savingsRate(state))} at the Fed's ${state.rate.toFixed(2)}%. Inflation is ${state.phase === 'boom' ? 'eating it' : state.phase === 'bust' ? 'slow' : 'ticking along'}.`,
        price: () => money(state.cash),
        enabled: () => state.cash >= 1,
        buy: () => deposit(state),
      },
      {
        label: '💵 Withdraw your savings',
        detail: () => (state.stats.interest > 0 ? `Interest earned this run: ${money(state.stats.interest)}` : 'Nothing saved yet.'),
        price: () => money(state.savings),
        enabled: () => state.savings >= 0.01,
        buy: () => withdraw(state),
      },
      {
        label: '💳 Borrow',
        detail: () => `${pct(loanRate(state))}. The loan is called in at the next bust: repay before it ends or lose everything.`,
        price: () => money(Math.min(loanSize(state), Math.max(0, creditLimit(state) - state.debt))),
        enabled: () => creditLimit(state) - state.debt >= 1,
        buy: () => borrow(state),
      },
      {
        label: '🤝 Repay',
        detail: () => (state.debt > 0 ? `You owe ${money(state.debt)}${state.loanDue !== null ? `, due in ${Math.ceil(state.loanDue - state.time)}s` : ''}.` : 'You owe nothing. Sound finances.'),
        price: () => money(Math.min(state.cash, state.debt)),
        enabled: () => state.debt > 0 && state.cash > 0,
        buy: () => repay(state),
      },
    ],
  },
  pawn: {
    title: '🪙 Gresham Pawn & Gold',
    items: () => [
      {
        label: '🪙 Buy an ounce of gold',
        detail: () => 'Keeps up with inflation, and rallies in a bust.',
        price: () => money(goldPrice(state, 'buy')),
        enabled: () => state.cash >= goldPrice(state, 'buy'),
        buy: () => buyGold(state),
      },
      {
        label: '💰 Sell an ounce',
        detail: () => `You have ${state.gold} oz.`,
        price: () => money(goldPrice(state, 'sell')),
        enabled: () => state.gold > 0,
        buy: () => sellGold(state),
      },
      {
        label: '💰 Sell it all',
        detail: () => 'The pawn shop takes its cut both ways.',
        price: () => money(goldPrice(state, 'sell') * state.gold),
        enabled: () => state.gold > 1,
        buy: () => sellGold(state, true),
      },
    ],
  },
};

let shopKind: ShopKind | null = null;
let shopItems: ShopItem[] = [];
const shopButtons: HTMLButtonElement[] = [];

function openShop(kind: ShopKind) {
  shopKind = kind;
  els.shop.hidden = false;
  // Keep it clear of you: at the bottom when you're up top.
  els.shop.classList.toggle('bottom', state.player.mover.y < 5);
  els.shopTitle.textContent = SHOPS[kind].title;
  shopItems = SHOPS[kind].items();
  shopButtons.length = 0;
  els.shopItems.replaceChildren(
    ...shopItems.map((item, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'shop-item';
      b.innerHTML = `<kbd>${i + 1}</kbd><span class="name"></span><span class="price"></span><small></small>`;
      b.querySelector('.name')!.textContent = item.label;
      b.addEventListener('click', () => handle(item.buy()));
      shopButtons.push(b);
      return b;
    }),
  );
  refreshShop();
}

function closeShop() {
  shopKind = null;
  els.shop.hidden = true;
}

function refreshShop() {
  shopItems.forEach((item, i) => {
    const b = shopButtons[i];
    setText(b.querySelector<HTMLElement>('.price')!, item.price());
    setText(b.querySelector<HTMLElement>('small')!, item.detail());
    b.disabled = !item.enabled();
  });
}

function shopKey(i: number) {
  const item = shopItems[i];
  if (!shopKind || !item) return;
  // Pressing a key for something you can't afford still says how much you need.
  handle(item.buy());
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

type Mode = 'title' | 'playing' | 'paused' | 'over';
let mode: Mode = 'title';
let state: GameState = newGame(Math.random, save.district);
let runUnlocked: string[] = [];
/** Today's daily cycle while playing one (null for a normal run), and the random numbers driving the run. */
let runDaily: Daily | null = null;
let runRng: () => number = Math.random;

function startGame(daily = false) {
  runDaily = daily ? dailyFor(new Date()) : null;
  runRng = runDaily ? seededRng(runDaily.seed) : Math.random;
  state = runDaily ? newGame(runRng, 'downtown', runDaily.twist.id) : newGame(Math.random, save.district);
  fitMap();
  els.daily.hidden = true;
  lastSpoke = -99;
  mode = 'playing';
  runUnlocked = [];
  tracker.startRun();
  els.title.hidden = true;
  els.over.hidden = true;
  els.paused.hidden = true;
  closeShop();
  keys.clear();
  getAudioContext();
  news(runDaily ? `📅 DAILY CYCLE ${runDaily.key}: ${runDaily.twist.name.toUpperCase()}. ${runDaily.twist.description.toUpperCase()}` : 'THE FED IS HOLDING RATES AT 2.50%. FOR NOW.', 10);
  say('start');
  if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { aes: state });
}

function pause() {
  mode = 'paused';
  els.paused.hidden = false;
  keys.clear();
}

function resume() {
  mode = 'playing';
  els.paused.hidden = true;
}

byId('pause').addEventListener('click', () => (mode === 'playing' ? pause() : mode === 'paused' ? resume() : undefined));
byId('resume').addEventListener('click', resume);
byId('start').addEventListener('click', () => startGame(false));
byId('restart').addEventListener('click', () => startGame(runDaily !== null));
byId('start-daily').addEventListener('click', () => startGame(true));
byId('show-daily').addEventListener('click', () => {
  const today = dailyFor(new Date());
  byId('daily-icon').textContent = today.twist.icon;
  byId('daily-name').textContent = today.twist.name;
  byId('daily-description').textContent = today.twist.description;
  const best = save.dailyBests[today.key];
  byId('daily-best').textContent = best ? `${best} utils` : 'none yet';
  els.title.hidden = true;
  els.daily.hidden = false;
  byId('start-daily').focus();
});
byId('hide-daily').addEventListener('click', () => {
  els.daily.hidden = true;
  els.title.hidden = false;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'playing') pause();
});

const OVER_TEXT = {
  withdrawal: {
    title: '🤢 Withdrawal',
    lines: ['The fix wore off. Your time preference was too high.', 'The market for your body cleared. Badly.', 'You should have saved some covers for the bust.'],
  },
  arrested: {
    title: '🚔 Arrested',
    lines: ['Charged with theft of public property. Taxation is still legal, though.', 'Caught red-handed. The State wants its monopoly on stealing back.', 'Arrested. The public defender is also a public good, unfortunately.'],
  },
} as const;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function gameOver() {
  mode = 'over';
  play('over');
  closeShop();
  const reason = state.over ?? 'withdrawal';
  // Daily runs have their own best per day, and don't count for the districts.
  const previousDaily = runDaily ? save.dailyBests[runDaily.key] ?? 0 : 0;
  const isBest = runDaily ? state.utils > previousDaily : state.utils > bestIn(state.district);
  if (runDaily) save.dailyBests[runDaily.key] = Math.max(previousDaily, state.utils);
  else if (state.district === 'suburbs') save.bestSuburbs = Math.max(save.bestSuburbs, state.utils);
  else save.best = Math.max(save.best, state.utils);
  els.dailyLine.hidden = !runDaily;
  if (runDaily) {
    els.dailyLine.textContent = `📅 ${runDaily.twist.name}: ${isBest ? 'a new best today!' : `today's best ${previousDaily} utils`}`;
    announce(tracker.checkDaily(Object.keys(save.dailyBests).length));
  }
  save.runs++;
  slot.save(save);
  byId('over-title').textContent = OVER_TEXT[reason].title;
  byId('over-line').textContent = pick(OVER_TEXT[reason].lines);
  byId('final-utils').textContent = String(state.utils);
  byId('final-laps').textContent = String(state.laps);
  byId('final-covers').textContent = `${state.stats.stolen} / ${state.stats.sold}`;
  byId('final-time').textContent = clock(state.time);
  byId('final-best').textContent = String(runDaily ? save.dailyBests[runDaily.key] : bestIn(state.district));
  renderDistricts();
  byId('new-best').hidden = !isBest;
  byId('run-achievements').hidden = runUnlocked.length === 0;
  byId('run-achievements-list').replaceChildren(
    ...runUnlocked.map((id) => {
      const a = achievementById(id)!;
      const li = document.createElement('li');
      li.textContent = `${a.icon} ${a.name}`;
      li.title = a.description;
      return li;
    }),
  );
  setTimeout(() => {
    if (mode !== 'over') return;
    els.over.hidden = false;
    byId('restart').focus();
  }, 900);
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

function toast(icon: string, label: string, name: string) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = '<span class="icon"></span><small></small><b></b>';
  el.querySelector('.icon')!.textContent = icon;
  el.querySelector('small')!.textContent = label;
  el.querySelector('b')!.textContent = name;
  els.toasts.append(el);
  setTimeout(() => el.remove(), 4100);
}

function announce(ids: readonly string[]) {
  if (!ids.length) return;
  for (const id of ids) {
    const a = achievementById(id);
    if (!a) continue;
    runUnlocked.push(id);
    toast(a.icon, 'ACHIEVEMENT UNLOCKED', a.name);
  }
  play('achievement');
  save.achievements = [...unlocked];
  slot.save(save);
}

function renderAchievements() {
  els.achievementsCount.textContent = `${unlocked.size} / ${ACHIEVEMENTS.length}`;
  els.achievementsGrid.replaceChildren(
    ...ACHIEVEMENTS.map((a) => {
      const card = document.createElement('div');
      card.className = `achievement${unlocked.has(a.id) ? '' : ' locked'}`;
      card.innerHTML = '<span class="icon"></span><b></b><small></small>';
      card.querySelector('.icon')!.textContent = unlocked.has(a.id) ? a.icon : '🔒';
      card.querySelector('b')!.textContent = a.name;
      card.querySelector('small')!.textContent = a.description;
      return card;
    }),
  );
}

let achievementsReturn: HTMLElement = els.title;
function showAchievements(from: HTMLElement) {
  achievementsReturn = from;
  renderAchievements();
  from.hidden = true;
  els.achievements.hidden = false;
  byId('hide-achievements').focus();
}
byId('show-achievements').addEventListener('click', () => showAchievements(els.title));
byId('over-achievements').addEventListener('click', () => showAchievements(els.over));
byId('hide-achievements').addEventListener('click', () => {
  els.achievements.hidden = true;
  achievementsReturn.hidden = false;
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const money = (n: number) => `$${n < 100 ? n.toFixed(2) : Math.round(n).toLocaleString('en-US')}`;

function floater(text: string, tile: { x: number; y: number }, color = '#5fff8f') {
  spawnText({
    text,
    className: 'aes-floater',
    x: view.ox + (tile.x + 0.5) * view.tile,
    y: view.oy + tile.y * view.tile,
    parent: els.mapWrap,
    ttl: 1300,
    style: { color },
  });
}

function ripple(t: Tile) {
  spawnText({ text: '', className: 'aes-ripple', x: view.ox + (t.x + 0.5) * view.tile, y: view.oy + (t.y + 0.5) * view.tile, parent: els.mapWrap, ttl: 500 });
}

const playerTile = () => tileOf(state.player.mover);

function handle(events: GameEvent[]) {
  for (const e of events) {
    switch (e.type) {
      case 'pry-start':
        play('pry');
        break;
      case 'pry-cancel':
        floater('INTERRUPTED', playerTile(), '#ffab40');
        break;
      case 'stole':
        say(e.kind === 'fed' ? 'stole-fed' : e.kind === 'brass' ? 'stole-brass' : 'stole');
        play('clank');
        floater(e.kind === 'fed' ? '+1 FED COVER (×8)' : e.kind === 'brass' ? '+1 BRASS COVER (×3)' : '+1 COVER', playerTile(), e.kind === 'iron' ? '#5fff8f' : '#ffd54f');
        break;
      case 'alarm':
        play('alert');
        floater('🚨 ALARM! THE FED WANTS ITS COVER BACK', playerTile(), '#ff5f5f');
        news('BREAKING: FEDERAL RESERVE MANHOLE COVER STOLEN. CHAIR CALLS IT "TRANSITORY".');
        break;
      case 'fed-refit':
        news('THE FED REPLACES ITS OWN MANHOLE COVER. PAID FOR WITH NEW MONEY.');
        break;
      case 'deposited':
        say('saved');
        play('cash');
        floater(`🏦 ${money(e.amount)} SAVED`, playerTile(), '#80d8ff');
        break;
      case 'withdrew':
        play('cash');
        floater(`💵 +${money(e.amount)}`, playerTile(), '#80d8ff');
        break;
      case 'borrowed':
        if (e.phase === 'boom') say('borrowed');
        play('cash');
        floater(`💳 +${money(e.amount)} ON CREDIT`, playerTile(), '#ffab40');
        if (e.phase === 'boom') news('CHEAP CREDIT! WHAT COULD POSSIBLY GO WRONG?');
        break;
      case 'repaid':
        play('cash');
        floater(e.cleared ? '🤝 DEBT-FREE' : `🤝 -${money(e.amount)} OWED`, playerTile(), '#80d8ff');
        break;
      case 'loan-called':
        say('loan-called');
        play('bell');
        news(`📞 YOUR LOAN HAS BEEN CALLED: REPAY ${money(e.debt)} AT THE FED WITHIN ${Math.ceil(e.seconds)}s`);
        floater('📞 LOAN CALLED!', playerTile(), '#ff5f5f');
        break;
      case 'default':
        say('default');
        play('over');
        news(`DEFAULT! THE BANK SEIZED EVERYTHING YOU OWNED (${money(e.lost)}). NO BAILOUT FOR YOU.`, 10);
        floater('💸 DEFAULT: EVERYTHING SEIZED', playerTile(), '#ff5f5f');
        break;
      case 'city-event': {
        const ce = cityEvent(e.kind);
        say(e.kind === 'stimulus' ? 'stimulus' : e.kind === 'recall' ? 'recall' : e.kind === 'clunkers' ? 'clunkers' : 'min-wage');
        play('bell');
        news(`${ce.icon} ${ce.name.toUpperCase()}: ${ce.description.toUpperCase()}`, ce.seconds);
        break;
      }
      case 'city-event-over':
        if (e.kind === 'stimulus') news('THE STIMULUS IS SPENT. PRICES UP 10%. ECONOMISTS BAFFLED.');
        else if (e.kind === 'recall') news('RECALL OVER: THE CITY PUTS THE IRON COVERS BACK.');
        else if (e.kind === 'clunkers') news('CASH FOR CLUNKERS ENDS. THE JUNKYARDS GO BACK TO NORMAL.');
        break;
      case 'stimulus':
        play('cash');
        floater(`🚁 STIMULUS CHECK +${money(e.amount)}`, playerTile(), '#5fff8f');
        break;
      case 'rival-arrives':
        say('rival-arrives');
        news('NEW IN TOWN: A RIVAL SCRAPPER IN A HI-VIS VEST. THE CREWS THINK HE WORKS FOR THE CITY.');
        break;
      case 'rival-stole':
        floater('🦺 THE RIVAL GOT ONE', e, '#ffab40');
        break;
      case 'rival-fell':
        if (e.pushed) say('rival-fell');
        play('fell');
        floater(e.pushed ? '🕳️ OUTCOMPETED!' : '🕳️ RIVAL FELL IN', e, '#5fff8f');
        if (e.pushed) news('SCRAPPER FALLS INTO MANHOLE. "THE MARKET IS BRUTAL," SAYS WITNESS.');
        break;
      case 'shoved':
        say('shoved');
        play('clank');
        floater(e.took ? '🤼 TOOK HIS COVER' : '🤼 SHOVED', playerTile(), '#ffd54f');
        break;
      case 'gold-bought':
        say('gold');
        play('coin');
        floater('🪙 +1 OZ', playerTile(), '#ffd54f');
        break;
      case 'gold-sold':
        play('cash');
        floater(`🪙 +${money(e.total)}`, playerTile(), '#ffd54f');
        break;
      case 'sold':
        if (e.multiplier >= 2) say('sold-peak');
        else if (e.multiplier < 0.6) say('sold-crash');
        play('cash');
        floater(`+${money(e.total)}${e.multiplier >= 2 ? ' 📈' : e.multiplier < 0.6 ? ' 📉' : ''}`, playerTile());
        break;
      case 'stashed':
        say('stash');
        play('clank');
        floater(`${e.count} SAVED FOR LATER`, playerTile(), '#ffe082');
        break;
      case 'took':
        play('clank');
        floater(`TOOK ${e.count}`, playerTile(), '#ffe082');
        break;
      case 'bought':
        say('bought');
        play('buy');
        floater(e.drug === 'heroin' ? '💉 AAAH' : '🪨 ZOOM', playerTile(), '#ff80ab');
        break;
      case 'gear':
        say('gear');
        play('gear');
        floater(`${GEAR.find((g) => g.id === e.id)!.icon} CAPITAL GOOD ACQUIRED`, playerTile(), '#80d8ff');
        break;
      case 'broke':
        play('broke');
        floater(`NEED ${money(e.price)}`, playerTile(), '#ff5f5f');
        break;
      case 'replaced':
        if (e.yours) floater('REPLACED ✔', e, '#5ffbf1');
        break;
      case 'new-covers':
        news(`INFRASTRUCTURE BILL: ${e.count} NEW MANHOLES INSTALLED`);
        break;
      case 'phase':
        say(e.phase === 'boom' ? 'boom' : 'bust');
        play(e.phase === 'boom' ? 'boom' : 'bust');
        news(pick(e.phase === 'boom' ? BOOM_NEWS : BUST_NEWS).replace('HIKES RATES', `HIKES RATES TO ${e.rate.toFixed(2)}%`));
        break;
      case 'fomc':
        say(e.next === 'boom' ? 'fomc-boom' : 'fomc-bust');
        play('bell');
        news(`🔔 FOMC MEETING IN ${e.seconds}s · ${e.next === 'boom' ? 'RATE CUT EXPECTED: SAVE COVERS FOR THE BOOM?' : 'RATE HIKE EXPECTED: SELL WHILE YOU CAN'}`);
        break;
      case 'fell':
        say(e.who === 'cop' ? 'cop-fell' : 'ped-fell');
        play('fell');
        floater(e.who === 'cop' ? '👮 OFFICER DOWN (THE HOLE)' : '🤕 AAAAH', e, e.who === 'cop' ? '#5fff8f' : '#ff5f5f');
        news(e.who === 'cop' ? 'OFFICER FALLS INTO MANHOLE. SUSPECT STILL AT LARGE.' : 'LOCAL MAN FALLS INTO MANHOLE. MAYOR BLAMES "GREED".');
        break;
      case 'step':
        break;
      case 'lap':
        say('lap');
        play('lap');
        floater(`🔄 BUSINESS CYCLE COMPLETE! +${e.bonus} UTILS`, playerTile(), '#ffd54f');
        els.cycle.classList.remove('lapped');
        void els.cycle.offsetWidth;
        els.cycle.classList.add('lapped');
        break;
      case 'dea':
        say('dea');
        play('alert');
        news('🚨 DEA RAID ON THE CORNER: STREET PRICES UP 60%. A SUPPLY SHOCK, LITERALLY.');
        break;
      case 'seen':
        say('seen');
        play('alert');
        floater(e.by === 'cop' ? '👀 COP!' : e.by === 'crew' ? '👀 CITY CREW!' : '👀 WITNESS!', playerTile(), '#ff5f5f');
        break;
      case 'withdrawal':
        say('withdrawal');
        play('alert');
        floater('🤢 WITHDRAWAL! GET TO THE CORNER', playerTile(), '#ff5f5f');
        break;
      case 'heat':
        say('heat');
        floater('🚨 HEAT RISING: LAY LOW', playerTile(), '#ff5f5f');
        break;
      case 'contract-new': {
        say('contract-new');
        play('bell');
        const k = e.contract;
        news(`📋 ORDER: ${k.yard === 'yard-near' ? 'CANTILLON SCRAP' : 'LAST-IN-LINE RECYCLING'} WANTS ${k.count} ${k.kind === 'brass' ? 'BRASS ' : ''}COVER${k.count > 1 ? 'S' : ''} BY THE NEXT FOMC MEETING. PAYS ×${k.pay}.`);
        break;
      }
      case 'contract-done':
        say('contract-done');
        play('lap');
        floater(`📋 ORDER FILLED! +${e.utils} UTILS`, playerTile(), '#ffd54f');
        break;
      case 'contract-failed':
        say('contract-failed');
        news('📋 ORDER EXPIRED. THE JUNKYARD WILL REMEMBER THIS.');
        break;
      case 'cop-joins':
        news('CITY HIRES MORE POLICE TO FIGHT THE "MANHOLE CRISIS"');
        break;
      case 'over':
        break;
    }
  }
  announce(tracker.update(state, events));
  if (state.over && mode === 'playing') gameOver();
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

function setText(el: HTMLElement, text: string) {
  if (el.textContent !== text) el.textContent = text;
}

const ACTION_TEXT: Record<string, string> = {
  pry: 'E · Pry the cover off',
  prying: 'Prying…',
  full: 'Hands full: sell or stash first',
  stash: 'E · Stash covers / take them',
  shove: 'E · Shove the competition',
  dealer: '1 · Heroin   2 · Crack',
  hardware: '1–4 · Buy capital goods',
  bank: '1–4 · Save, withdraw, borrow, repay',
  pawn: '1–3 · Buy or sell gold',
};

let lastStepClass = -1;

function updateHud() {
  const info = phaseAt(state.time, state.daily);
  setText(els.phase, info.phase === 'calm' ? (state.daily === 'gold-standard' ? '🥇 GOLD STANDARD' : 'CALM') : info.phase === 'boom' ? `📈 BOOM ${Math.ceil(info.length - info.into)}s` : `📉 BUST ${Math.ceil(info.length - info.into)}s`);
  els.phase.className = `phase ${info.phase}`;
  setText(els.rate, `${state.rate.toFixed(2)}%`);
  setText(els.cash, money(state.cash));
  setText(els.utils, String(state.utils));
  els.fixBar.style.width = `${state.fix * 100}%`;
  els.fixBar.parentElement!.parentElement!.classList.toggle('low', state.fix < 0.22);
  els.heatBar.style.width = `${state.heat}%`;
  els.heatBar.parentElement!.parentElement!.classList.toggle('high', state.heat > 70);
  setText(els.carried, `${state.cargo.length}/${capacity(state)}`);
  setText(els.stash, String(state.stash.length));
  setText(els.savings, money(state.savings));
  setText(els.debt, state.debt > 0 ? `-${money(state.debt)}${state.loanDue !== null ? ` · ${Math.max(0, Math.ceil(state.loanDue - state.time))}s` : ''}` : '$0');
  setText(els.gold, `${state.gold} oz`);
  els.finance.classList.toggle('due', state.loanDue !== null);
  setText(els.gear, GEAR.filter((g) => state.gear[g.id]).map((g) => g.icon).join(''));
  setText(els.laps, `LAPS ${state.laps}`);
  setText(els.priceNear, money(scrapPrice(state, 'yard-near')));
  setText(els.priceFar, money(scrapPrice(state, 'yard-far')));
  setText(els.priceHeroin, money(drugPrice(state, 'heroin')));
  setText(els.priceCrack, money(drugPrice(state, 'crack')));
  if (state.step !== lastStepClass) {
    lastStepClass = state.step;
    for (let i = 0; i < 4; i++) {
      els.cycle.querySelector(`.step-${i}`)!.classList.toggle('done', i < state.step);
      els.cycle.querySelector(`.step-${i}`)!.classList.toggle('next', i === state.step);
      els.cycle.querySelector(`.arc-${i}`)!.classList.toggle('done', i < state.step);
    }
  }

  // The action button, and the shops
  const c = mode === 'playing' ? context(state) : null;
  const kind = c?.kind ?? null;
  const shop: ShopKind | null = kind === 'sell' ? 'yard' : kind === 'dealer' || kind === 'hardware' || kind === 'bank' || kind === 'pawn' ? kind : null;
  if (shop) {
    if (shopKind !== shop) openShop(shop);
    refreshShop();
  } else if (shopKind) closeShop();
  let text = 'Walk to a manhole cover (or tap the map)';
  if (c?.kind === 'sell') text = `E · Sell ${state.cargo.length} for ${money(scrapPrice(state, c.yard) * cargoValue(state.cargo))}`;
  else if (c?.kind === 'nothing-to-sell') text = `Paying ${money(scrapPrice(state, c.yard))} a cover`;
  else if (kind && ACTION_TEXT[kind]) text = ACTION_TEXT[kind];
  else if (state.loanDue !== null && state.debt > 0) text = `Loan called! Repay ${money(state.debt)} at the Fed in ${Math.max(0, Math.ceil(state.loanDue - state.time))}s`;
  else if (state.cargo.length > 0) text = 'Take it to a junkyard (or your squat)';
  else if (state.fix < 0.35) text = 'Get to the Corner before the fix wears off';
  setText(els.action, text);
  els.action.disabled = !(kind === 'pry' || kind === 'sell' || kind === 'stash' || kind === 'shove');

  // The junkyard's order
  els.contract.hidden = !state.contract;
  if (state.contract) {
    const k = state.contract;
    const yard = k.yard === 'yard-near' ? 'CANTILLON SCRAP' : 'LAST-IN-LINE';
    const what = k.kind === 'brass' ? `${k.count} BRASS COVER${k.count > 1 ? 'S' : ''}` : `${k.count} COVERS`;
    setText(els.contract, `📋 ${yard} WANTS ${what} · ${k.delivered}/${k.count} · ${Math.max(0, Math.ceil(k.deadline - state.time))}s · PAYS ×${k.pay}`);
    els.contract.classList.toggle('urgent', k.deadline - state.time < 10);
  }

  // The city event going on
  els.event.hidden = !state.event;
  if (state.event) {
    const e = cityEvent(state.event.kind);
    setText(els.event, `${e.icon} ${e.name.toUpperCase()} ${Math.ceil(state.event.left)}s`);
    els.event.title = e.description;
  }
}

function drawGraph(canvas: HTMLCanvasElement, series: { values: number[]; color: string }[]) {
  const g = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  g.clearRect(0, 0, w, h);
  g.strokeStyle = '#1a2f38';
  g.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    g.beginPath();
    g.moveTo(0, (h * i) / 4);
    g.lineTo(w, (h * i) / 4);
    g.stroke();
  }
  const max = Math.max(1, ...series.flatMap((s) => s.values)) * 1.1;
  for (const s of series) {
    g.strokeStyle = s.color;
    g.lineWidth = 2 * (window.devicePixelRatio || 1);
    g.beginPath();
    s.values.forEach((v, i) => {
      const x = (i / 79) * w;
      const y = h - (v / max) * h;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.stroke();
  }
}

// ---------------------------------------------------------------------------
// Canvas sizing and the loop
// ---------------------------------------------------------------------------

let view: View = fitView(1, 1);
let cssW = 1;
let cssH = 1;

function resize() {
  const rect = els.map.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cssW = rect.width;
  cssH = rect.height;
  els.map.width = Math.round(rect.width * dpr);
  els.map.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  view = fitView(cssW, cssH);
  els.mapWrap.style.setProperty('--map-aspect', `${COLS} / ${ROWS}`);
  for (const c of [els.graphScrap, els.graphDrugs]) {
    const r = c.getBoundingClientRect();
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
  }
}
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(els.mapWrap);
resize();

let last = performance.now();
let graphAt = 0;

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === 'playing') handle(update(state, { dir: heldDir() }, dt, runRng));
  else if (mode === 'title') state.time += dt; // let the title screen's city breathe
  updateSpeech();
  syncMusic();
  jazz.setPhase(state.phase);

  const c = mode === 'playing' ? context(state) : null;
  const highlight = c && c.kind !== 'pry' && c.kind !== 'prying' && c.kind !== 'full' ? playerTile() : null;
  render(ctx, cssW, cssH, state, view, { rothbard }, highlight);
  updateHud();
  if (now - graphAt > 250) {
    graphAt = now;
    drawGraph(els.graphScrap, [
      { values: state.history.map((s) => s.near), color: '#5ffbf1' },
      { values: state.history.map((s) => s.far), color: '#b388ff' },
    ]);
    drawGraph(els.graphDrugs, [
      { values: state.history.map((s) => s.heroin), color: '#ff80ab' },
      { values: state.history.map((s) => s.crack), color: '#5fff8f' },
    ]);
  }
  if (now / 1000 > tickerUntil) news(IDLE_NEWS[idleIndex++ % IDLE_NEWS.length], 10);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------------------
// Districts
// ---------------------------------------------------------------------------

/** Re-measures the map (each district has its own size). */
function fitMap() {
  els.mapWrap.style.setProperty('--map-aspect', `${COLS} / ${ROWS}`);
  resize();
}

function renderDistricts() {
  els.districts.replaceChildren(
    ...DISTRICTS.map((d) => {
      const open = districtOpen(d.id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `district${d.id === save.district ? ' selected' : ''}${open ? '' : ' locked'}`;
      b.disabled = !open;
      b.innerHTML = '<span class="icon"></span><b></b><small></small><em></em>';
      b.querySelector('.icon')!.textContent = open ? d.icon : '🔒';
      b.querySelector('b')!.textContent = d.name;
      b.querySelector('small')!.textContent = open ? d.description : `Score ${d.unlockUtils} utils downtown to move here.`;
      b.querySelector('em')!.textContent = open && bestIn(d.id) ? `Best: ${bestIn(d.id)} utils` : '';
      b.addEventListener('click', () => {
        save.district = d.id;
        slot.save(save);
        state = newGame(Math.random, d.id);
        fitMap();
        renderDistricts();
      });
      return b;
    }),
  );
  els.titleBest.textContent = bestIn(save.district) ? `🏆 Your best here: ${bestIn(save.district)} utils` : '';
}

renderDistricts();
fitMap();
