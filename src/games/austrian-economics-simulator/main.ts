import './style.css';
import { note, playTone, getAudioContext } from '../../shared/audio.ts';
import { spawnText } from '../../shared/effects.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import { isRoad, nearestRoad, placeAtBlock, type Tile } from './map.ts';
import { act, buyDrug, buyGear, capacity, context, drugPrice, GEAR, gearPrice, newGame, phaseAt, scrapPrice, tileOf, update, walkTo, type Drug, type GameEvent, type GameState, type GearId } from './logic.ts';
import { ACHIEVEMENTS, achievementById, normalizeUnlocked, Tracker } from './achievements.ts';
import { fitView, render, type View } from './render.ts';

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
  cash: byId('cash'),
  utils: byId('utils'),
  fixBar: byId('fix-bar'),
  heatBar: byId('heat-bar'),
  carried: byId('carried'),
  stash: byId('stash'),
  gear: byId('gear'),
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
  best: number;
  muted: boolean;
  achievements: string[];
  runs: number;
}

const slot = createSaveSlot<Save>({ game: 'austrian-economics-simulator', version: 1 });
const saved = slot.load();
const save: Save = {
  best: Math.max(0, Math.floor(Number(saved?.best) || 0)),
  muted: saved?.muted === true,
  achievements: [...normalizeUnlocked(saved?.achievements)],
  runs: Math.max(0, Math.floor(Number(saved?.runs) || 0)),
};
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
  achievement: () => [784, 988, 1175, 1568].forEach((hz, i) => playTone(note(hz, 0.1, 0.04, 'triangle'), i * 0.07)),
};

function play(name: keyof typeof sfx) {
  if (!save.muted) sfx[name]();
}

function toggleMute() {
  save.muted = !save.muted;
  slot.save(save);
  els.mute.textContent = save.muted ? '🔇' : '🔊';
}
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

function heldDir(): Tile | null {
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
      else startGame();
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
els.map.addEventListener('pointerdown', (e) => {
  if (mode !== 'playing') return;
  const rect = els.map.getBoundingClientRect();
  const tx = (e.clientX - rect.left - view.ox) / view.tile - 0.5;
  const ty = (e.clientY - rect.top - view.oy) / view.tile - 0.5;
  const tile = { x: Math.round(tx), y: Math.round(ty) };
  const place = placeAtBlock(tile);
  const target = place && place.id !== 'fed' ? place.door : isRoad(tile.x, tile.y) ? tile : nearestRoad(tx, ty);
  walkTo(state, target);
  ripple(target);
});

els.action.addEventListener('click', () => doAction());

function doAction() {
  if (mode !== 'playing') return;
  handle(act(state));
}

// ---------------------------------------------------------------------------
// The shops: the Corner and Roundabout Hardware
// ---------------------------------------------------------------------------

let shopKind: 'dealer' | 'hardware' | null = null;
const shopButtons: HTMLButtonElement[] = [];

function openShop(kind: 'dealer' | 'hardware') {
  shopKind = kind;
  els.shop.hidden = false;
  els.shopTitle.textContent = kind === 'dealer' ? '💊 The Corner' : '🔧 Roundabout Hardware';
  shopButtons.length = 0;
  const items: { label: string; detail: string; buy: () => GameEvent[] }[] =
    kind === 'dealer'
      ? (['heroin', 'crack'] as Drug[]).map((drug) => ({
          label: drug === 'heroin' ? '💉 Heroin' : '🪨 Crack',
          detail: drug === 'heroin' ? 'Full fix · slows you down a bit' : 'Half a fix · makes you fast',
          buy: () => buyDrug(state, drug),
        }))
      : GEAR.map((g) => ({ label: `${g.icon} ${g.name}`, detail: g.description, buy: () => buyGear(state, g.id) }));
  els.shopItems.replaceChildren(
    ...items.map((item, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'shop-item';
      b.innerHTML = `<kbd>${i + 1}</kbd><span class="name"></span><span class="price"></span><small></small>`;
      b.querySelector('.name')!.textContent = item.label;
      b.querySelector('small')!.textContent = item.detail;
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
  if (!shopKind) return;
  shopButtons.forEach((b, i) => {
    let price: number;
    let owned = false;
    if (shopKind === 'dealer') price = drugPrice(state, i === 0 ? 'heroin' : 'crack');
    else {
      const id = GEAR[i].id as GearId;
      price = gearPrice(state, id);
      owned = state.gear[id];
    }
    const text = owned ? 'OWNED' : money(price);
    const el = b.querySelector('.price')!;
    if (el.textContent !== text) el.textContent = text;
    b.disabled = owned || state.cash < price;
  });
}

function shopKey(i: number) {
  if (shopKind && shopButtons[i] && !shopButtons[i].disabled) shopButtons[i].click();
  else if (shopKind && shopButtons[i]) handle(shopKind === 'dealer' ? buyDrug(state, i === 0 ? 'heroin' : 'crack') : buyGear(state, GEAR[i].id));
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

type Mode = 'title' | 'playing' | 'paused' | 'over';
let mode: Mode = 'title';
let state: GameState = newGame();
let runUnlocked: string[] = [];

function startGame() {
  state = newGame();
  mode = 'playing';
  runUnlocked = [];
  tracker.startRun();
  els.title.hidden = true;
  els.over.hidden = true;
  els.paused.hidden = true;
  closeShop();
  keys.clear();
  getAudioContext();
  news('THE FED IS HOLDING RATES AT 2.50%. FOR NOW.');
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
byId('start').addEventListener('click', startGame);
byId('restart').addEventListener('click', startGame);
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
  const isBest = state.utils > save.best;
  save.best = Math.max(save.best, state.utils);
  save.runs++;
  slot.save(save);
  byId('over-title').textContent = OVER_TEXT[reason].title;
  byId('over-line').textContent = pick(OVER_TEXT[reason].lines);
  byId('final-utils').textContent = String(state.utils);
  byId('final-laps').textContent = String(state.laps);
  byId('final-covers').textContent = `${state.stats.stolen} / ${state.stats.sold}`;
  byId('final-time').textContent = clock(state.time);
  byId('final-best').textContent = String(save.best);
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
        play('clank');
        floater('+1 COVER', playerTile());
        break;
      case 'sold':
        play('cash');
        floater(`+${money(e.total)}${e.multiplier >= 2 ? ' 📈' : e.multiplier < 0.6 ? ' 📉' : ''}`, playerTile());
        break;
      case 'stashed':
        play('clank');
        floater(`${e.count} SAVED FOR LATER`, playerTile(), '#ffe082');
        break;
      case 'took':
        play('clank');
        floater(`TOOK ${e.count}`, playerTile(), '#ffe082');
        break;
      case 'bought':
        play('buy');
        floater(e.drug === 'heroin' ? '💉 AAAH' : '🪨 ZOOM', playerTile(), '#ff80ab');
        break;
      case 'gear':
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
        play(e.phase === 'boom' ? 'boom' : 'bust');
        news(pick(e.phase === 'boom' ? BOOM_NEWS : BUST_NEWS).replace('HIKES RATES', `HIKES RATES TO ${e.rate.toFixed(2)}%`));
        break;
      case 'fomc':
        play('bell');
        news(`🔔 FOMC MEETING IN ${e.seconds}s · ${e.next === 'boom' ? 'RATE CUT EXPECTED: SAVE COVERS FOR THE BOOM?' : 'RATE HIKE EXPECTED: SELL WHILE YOU CAN'}`);
        break;
      case 'fell':
        play('fell');
        floater(e.who === 'cop' ? '👮 OFFICER DOWN (THE HOLE)' : '🤕 AAAAH', e, e.who === 'cop' ? '#5fff8f' : '#ff5f5f');
        news(e.who === 'cop' ? 'OFFICER FALLS INTO MANHOLE. SUSPECT STILL AT LARGE.' : 'LOCAL MAN FALLS INTO MANHOLE. MAYOR BLAMES "GREED".');
        break;
      case 'step':
        break;
      case 'lap':
        play('lap');
        floater(`🔄 BUSINESS CYCLE COMPLETE! +${e.bonus} UTILS`, playerTile(), '#ffd54f');
        els.cycle.classList.remove('lapped');
        void els.cycle.offsetWidth;
        els.cycle.classList.add('lapped');
        break;
      case 'dea':
        play('alert');
        news('🚨 DEA RAID ON THE CORNER: STREET PRICES UP 60%. A SUPPLY SHOCK, LITERALLY.');
        break;
      case 'seen':
        play('alert');
        floater(e.by === 'cop' ? '👀 COP!' : e.by === 'crew' ? '👀 CITY CREW!' : '👀 WITNESS!', playerTile(), '#ff5f5f');
        break;
      case 'withdrawal':
        play('alert');
        floater('🤢 WITHDRAWAL! GET TO THE CORNER', playerTile(), '#ff5f5f');
        break;
      case 'heat':
        floater('🚨 HEAT RISING: LAY LOW', playerTile(), '#ff5f5f');
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
  dealer: '1 · Heroin   2 · Crack',
  hardware: '1–4 · Buy capital goods',
};

let lastStepClass = -1;

function updateHud() {
  const info = phaseAt(state.time);
  setText(els.phase, info.phase === 'calm' ? 'CALM' : info.phase === 'boom' ? `📈 BOOM ${Math.ceil(info.length - info.into)}s` : `📉 BUST ${Math.ceil(info.length - info.into)}s`);
  els.phase.className = `phase ${info.phase}`;
  setText(els.rate, `${state.rate.toFixed(2)}%`);
  setText(els.cash, money(state.cash));
  setText(els.utils, String(state.utils));
  els.fixBar.style.width = `${state.fix * 100}%`;
  els.fixBar.parentElement!.parentElement!.classList.toggle('low', state.fix < 0.22);
  els.heatBar.style.width = `${state.heat}%`;
  els.heatBar.parentElement!.parentElement!.classList.toggle('high', state.heat > 70);
  setText(els.carried, `${state.carried}/${capacity(state)}`);
  setText(els.stash, String(state.stash));
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
  if (kind === 'dealer' || kind === 'hardware') {
    if (shopKind !== kind) openShop(kind);
    refreshShop();
  } else if (shopKind) closeShop();
  let text = 'Walk to a manhole cover (or tap the map)';
  if (c?.kind === 'sell') text = `E · Sell ${state.carried} for ${money(scrapPrice(state, c.yard) * state.carried)}`;
  else if (c?.kind === 'nothing-to-sell') text = `Paying ${money(scrapPrice(state, c.yard))} a cover`;
  else if (kind && ACTION_TEXT[kind]) text = ACTION_TEXT[kind];
  else if (state.carried > 0) text = 'Take it to a junkyard (or your squat)';
  else if (state.fix < 0.35) text = 'Get to the Corner before the fix wears off';
  setText(els.action, text);
  els.action.disabled = !(kind === 'pry' || kind === 'sell' || kind === 'stash');
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
  if (mode === 'playing') handle(update(state, { dir: heldDir() }, dt));
  else if (mode === 'title') state.time += dt; // let the title screen's city breathe

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

els.titleBest.textContent = save.best ? `🏆 Your best: ${save.best} utils` : '';
