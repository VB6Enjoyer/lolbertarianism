// WITHER AWAY: the screens around the run (pick your libertarian, level-up cards, pause, the end),
// the loop that steps the game sixty times a second and draws it, and the controls: keys, a
// gamepad, or a thumb anywhere on a touch screen. Aiming is automatic.

import './style.css';
import { getAudioContext, note, playTone, type Tone } from '../../shared/audio.ts';
import { openSaveTransfer } from '../../shared/save-transfer.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import { ballSvg, loadSprites, RESTING, type Sprite } from './balls.ts';
import { CHARACTER_ORDER, CHARACTERS, type CharacterId, ENEMIES, EVOLUTIONS, LAFFER_SVG, PASSIVES, RUN_LENGTH, type WeaponId, WEAPONS } from './data.ts';
import { choose, DT, type Game, goldEarned, newGame, type Offer, reroll, step } from './game.ts';
import { Metal, type TrackId } from './music.ts';
import { draw, GUNS, normalizeGun, particleColor, type Visuals } from './render.ts';
import {
  buy, CARD_ORDER, type CardId, HEAT, HEAT_ORDER, heatBonus, loadShop, price, rank, setupFor, type ShopItem, type ShopState, toggleHeat,
  UPGRADE_ORDER, UPGRADES,
} from './shop.ts';

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

interface Save {
  muted: boolean;
  /** Music on or off (the speaker mutes everything). */
  music: boolean;
  character: CharacterId;
  meta: {
    runs: number;
    wins: number;
    kills: number;
    gold: number;
    /** Longest survived, per character (seconds). */
    best: Partial<Record<CharacterId, number>>;
  };
  /** What's been bought in the Free Market, and the Bitcoin left to spend. */
  shop: ShopState;
}

const slot = createSaveSlot<Save>({ game: 'wither-away', version: 1 });
const saved = slot.load();
const count = (x: unknown) => Math.max(0, Math.floor(Number(x) || 0));
const save: Save = {
  muted: saved?.muted === true,
  music: saved?.music !== false,
  character: CHARACTER_ORDER.includes(saved?.character as CharacterId) ? (saved!.character as CharacterId) : 'ancap',
  meta: {
    runs: count(saved?.meta?.runs),
    wins: count(saved?.meta?.wins),
    kills: count(saved?.meta?.kills),
    gold: count(saved?.meta?.gold),
    best: Object.fromEntries(CHARACTER_ORDER.map((id) => [id, count(saved?.meta?.best?.[id])]).filter(([, v]) => (v as number) > 0)),
  },
  // Before the shop opened, Bitcoin only piled up: it all becomes spendable.
  shop: loadShop(saved?.shop, count(saved?.meta?.gold)),
};
const persist = () => slot.save(save);

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const els = {
  canvas: byId<HTMLCanvasElement>('view'),
  hud: byId('hud'),
  hp: byId('hp'),
  xp: byId('xp'),
  level: byId('level'),
  timer: byId('timer'),
  kills: byId('kills'),
  screen: byId('screen'),
  modal: byId('modal'),
  pause: byId<HTMLButtonElement>('pause'),
  mute: byId<HTMLButtonElement>('mute'),
  music: byId<HTMLButtonElement>('music'),
  banner: byId('banner'),
};
const ctx = els.canvas.getContext('2d')!;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', html = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html) el.innerHTML = html;
  return el;
}
function t<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: string): HTMLElementTagNameMap[K] {
  const el = h(tag, className);
  el.textContent = text;
  return el;
}
function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const b = h('button', className, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const ballImg = (id: string, className = 'ball') => {
  const span = h('span', className);
  span.innerHTML = ballSvg(id as CharacterId, RESTING[id as CharacterId] ?? 'normal', 120);
  return span;
};

// ---------------------------------------------------------------------------
// Sound: short synthesized blips, rate-limited so a hundred kills don't become noise
// ---------------------------------------------------------------------------

document.addEventListener('pointerdown', () => void getAudioContext().resume().catch(() => {}), { once: true });
const sweep = (from: number, to: number, duration: number, volume: number, wave: OscillatorType): Tone => ({
  wave,
  duration,
  frequency: [[0, from], [duration, to, 'exp']],
  gain: [[0, volume], [duration, 0.001, 'exp']],
});
const SOUNDS = {
  shoot: () => playTone(note(880, 0.03, 0.012, 'square')),
  boom: () => playTone(sweep(120, 40, 0.25, 0.06, 'sawtooth')),
  zap: () => playTone(sweep(2400, 300, 0.12, 0.03, 'square')),
  evolve: () => [262, 330, 392, 523, 659, 784].forEach((hz, i) => playTone(note(hz, 0.12, 0.05, 'sawtooth'), i * 0.05)),
  buy: () => [880, 1320].forEach((hz, i) => playTone(note(hz, 0.08, 0.04, 'triangle'), i * 0.07)),
  kill: () => playTone(sweep(420, 140, 0.08, 0.025, 'square')),
  pickup: () => playTone(note(1320, 0.04, 0.018, 'triangle')),
  hurt: () => playTone(sweep(200, 70, 0.18, 0.06, 'sawtooth')),
  nein: () => playTone(sweep(160, 60, 0.3, 0.07, 'sawtooth')),
  level: () => [523, 659, 784, 1047].forEach((hz, i) => playTone(note(hz, 0.1, 0.045, 'triangle'), i * 0.06)),
  boss: () => [196, 185, 196, 185].forEach((hz, i) => playTone(note(hz, 0.25, 0.06, 'sawtooth'), i * 0.28)),
  win: () => [392, 523, 659, 784, 1047, 1319].forEach((hz, i) => playTone(note(hz, 0.16, 0.05), i * 0.1)),
  lose: () => [392, 330, 262, 196].forEach((hz, i) => playTone(note(hz, 0.25, 0.05, 'sawtooth'), i * 0.18)),
};
const lastPlayed: Record<string, number> = {};
function play(name: keyof typeof SOUNDS, gap = 0.05) {
  if (save.muted) return;
  const now = performance.now() / 1000;
  if ((lastPlayed[name] ?? 0) > now - gap) return;
  lastPlayed[name] = now;
  SOUNDS[name]();
}
function renderMute() {
  els.mute.textContent = save.muted ? '🔇' : '🔊';
  els.mute.setAttribute('aria-pressed', String(save.muted));
}
els.mute.addEventListener('click', () => {
  save.muted = !save.muted;
  persist();
  renderMute();
  if (save.muted) metal.stop();
  else startMusic();
});

// ---------------------------------------------------------------------------
// Music: thrash metal, made in code. The menu loop; two run tracks taking turns; the boss's own.
// ---------------------------------------------------------------------------

const metal = new Metal();
/** The run track playing now (they swap each time one finishes a loop). */
let runTrack: TrackId = 'rip';
metal.onLoop = (track) => {
  if (track === 'rip' || track === 'hyper') runTrack = track === 'rip' ? 'hyper' : 'rip';
};
function startMusic() {
  if (metal.playing || save.muted || !save.music) return;
  const ctx = getAudioContext();
  void ctx.resume().catch(() => {});
  metal.play(wantTrack(), true);
  metal.start(ctx);
}
function wantTrack(): TrackId {
  if (!g || g.over) return 'menu';
  if (g.enemies.some((e) => e.type === 'bank')) return 'boss';
  return runTrack;
}
function renderMusic() {
  els.music.classList.toggle('off', !save.music);
  els.music.setAttribute('aria-pressed', String(save.music));
  els.music.title = save.music ? 'Music on (tap to turn it off)' : 'Music off (tap to turn it on)';
}
els.music.addEventListener('click', () => {
  save.music = !save.music;
  persist();
  renderMusic();
  if (save.music) startMusic();
  else metal.stop();
});
for (const type of ['pointerdown', 'keydown'] as const) document.addEventListener(type, startMusic, { once: true });
renderMute();
renderMusic();

// ---------------------------------------------------------------------------
// Input: keys, a gamepad's left stick, or a thumb anywhere on a touch screen
// ---------------------------------------------------------------------------

const keys = new Set<string>();
document.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === 'Escape' || e.key.toLowerCase() === 'p') togglePause();
  if (g?.offer && ['1', '2', '3'].includes(e.key)) pick(Number(e.key) - 1);
  if (g?.offer && e.key.toLowerCase() === 'r') rerollCards();
});
document.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => {
  keys.clear();
  if (g && !g.over && !g.offer) setPaused(true);
});

const vis: Visuals = { particles: [], texts: [], rings: [], booms: [], zaps: [], hurt: 0, happy: 0, stick: null };
let stickId: number | null = null;
els.canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  stickId = e.pointerId;
  vis.stick = { ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
  els.canvas.setPointerCapture(e.pointerId);
});
els.canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== stickId || !vis.stick) return;
  const dx = e.clientX - vis.stick.ox;
  const dy = e.clientY - vis.stick.oy;
  const d = Math.hypot(dx, dy);
  const max = 50;
  vis.stick.x = vis.stick.ox + (d > max ? (dx / d) * max : dx);
  vis.stick.y = vis.stick.oy + (d > max ? (dy / d) * max : dy);
});
const release = (e: PointerEvent) => {
  if (e.pointerId !== stickId) return;
  stickId = null;
  vis.stick = null;
};
els.canvas.addEventListener('pointerup', release);
els.canvas.addEventListener('pointercancel', release);

function readInput() {
  let x = 0;
  let y = 0;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  if (keys.has('w') || keys.has('arrowup')) y -= 1;
  if (keys.has('s') || keys.has('arrowdown')) y += 1;
  if (vis.stick) {
    x += (vis.stick.x - vis.stick.ox) / 50;
    y += (vis.stick.y - vis.stick.oy) / 50;
  }
  for (const pad of navigator.getGamepads?.() ?? []) {
    if (!pad) continue;
    const [ax = 0, ay = 0] = pad.axes;
    if (Math.hypot(ax, ay) > 0.2) {
      x += ax;
      y += ay;
    }
    if (pad.buttons[9]?.pressed && !padStart) togglePause();
    padStart = !!pad.buttons[9]?.pressed;
  }
  return { x, y };
}
let padStart = false;

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

let sprites: Map<string, Sprite> | null = null;
let g: Game | null = null;
let paused = false;
let last = 0;
let acc = 0;
let shownOffer: Offer[] | null = null;

function startRun(character: CharacterId) {
  save.character = character;
  persist();
  g = newGame((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, character, setupFor(save.shop, character));
  // Runs take turns opening with each track; the change happens at the next bar line.
  runTrack = save.meta.runs % 2 ? 'hyper' : 'rip';
  metal.play(runTrack);
  vis.particles = [];
  vis.texts = [];
  vis.rings = [];
  vis.booms = [];
  vis.zaps = [];
  paused = false;
  shownOffer = null;
  els.screen.hidden = true;
  els.modal.hidden = true;
  els.hud.hidden = false;
  last = performance.now();
  acc = 0;
  banner(`Survive ${clock(RUN_LENGTH)}. The state withers away.`);
}

function frame(now: number) {
  requestAnimationFrame(frame);
  resize();
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (metal.playing) metal.play(wantTrack());
  if (!g || !sprites) return;
  if (!paused && !g.offer && !g.over) {
    acc += dt;
    const input = readInput();
    while (acc >= DT && !g.offer && !g.over) {
      step(g, input, DT);
      react(g);
      acc -= DT;
    }
  } else acc = 0;
  updateVisuals(paused || !!g.offer ? 0 : dt);
  const w = els.canvas.clientWidth;
  const hgt = els.canvas.clientHeight;
  draw(ctx, g, sprites, w, hgt, dpr, vis);
  renderHud(g);
  if (g.offer && shownOffer !== g.offer) showOffer(g);
  if (g.over && els.screen.hidden) showEnd(g);
}

/** Turns what happened into particles, numbers, rings and sounds. */
function react(g: Game) {
  for (const f of g.fx) {
    switch (f.kind) {
      case 'hit':
        // The Non-Aggression Pact's little ticks would bury the screen in numbers.
        if (f.from !== 'nap' && vis.texts.length < 40) vis.texts.push({ x: f.x + (Math.random() - 0.5) * 10, y: f.y, text: String(f.amount), life: 0.6, color: '#fff' });
        break;
      case 'kill': {
        const color = particleColor(f.type);
        if (f.type === 'bank') vis.happy = 3;
        for (let i = 0; i < (f.type === 'bank' ? 40 : 6); i++) {
          if (vis.particles.length > 500) break;
          const a = Math.random() * Math.PI * 2;
          const v = 60 + Math.random() * 120;
          vis.particles.push({ x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.45, max: 0.45, color, size: 4 });
        }
        play('kill', 0.04);
        break;
      }
      case 'hurt':
        vis.hurt = 0.3;
        play('hurt', 0.15);
        break;
      case 'nein':
        vis.rings.push({ x: f.x, y: f.y, radius: f.radius, life: 0.4 });
        play('nein', 0.3);
        break;
      case 'boom':
        if (vis.booms.length < 12) vis.booms.push({ x: f.x, y: f.y, radius: f.radius, life: 0.35 });
        play('boom', 0.15);
        break;
      case 'zap':
        if (vis.zaps.length < 8) vis.zaps.push({ points: f.points, life: 0.22 });
        play('zap', 0.12);
        break;
      case 'evolve':
        play('evolve', 1);
        vis.happy = 3;
        banner(`⬆️ ${WEAPONS[f.weapon].name}!`);
        break;
      case 'shoot':
        play('shoot', 0.09);
        break;
      case 'pickup':
        play('pickup', 0.04);
        break;
      case 'level':
        play('level', 0.3);
        break;
      case 'boss':
        play('boss', 1);
        banner('💸 THE CENTRAL BANK IS HERE. It prints.');
        break;
      case 'revolution':
        banner('🚩 THE REVOLUTION! They’re coming from every side.');
        break;
      case 'wither':
        play('win', 1);
        break;
    }
  }
}

function updateVisuals(dt: number) {
  for (const q of vis.particles) {
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.life -= dt;
  }
  vis.particles = vis.particles.filter((q) => q.life > 0);
  for (const f of vis.texts) {
    f.y -= 40 * dt;
    f.life -= dt;
  }
  vis.texts = vis.texts.filter((f) => f.life > 0);
  for (const r of vis.rings) r.life -= dt;
  vis.rings = vis.rings.filter((r) => r.life > 0);
  for (const b of vis.booms) b.life -= dt;
  vis.booms = vis.booms.filter((b) => b.life > 0);
  for (const z of vis.zaps) z.life -= dt;
  vis.zaps = vis.zaps.filter((z) => z.life > 0);
  vis.hurt = Math.max(0, vis.hurt - dt);
  vis.happy = Math.max(0, vis.happy - dt);
}

let dpr = 1;
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = els.canvas.clientWidth;
  const hgt = els.canvas.clientHeight;
  if (els.canvas.width !== Math.round(w * dpr) || els.canvas.height !== Math.round(hgt * dpr)) {
    els.canvas.width = Math.round(w * dpr);
    els.canvas.height = Math.round(hgt * dpr);
  }
}

function renderHud(g: Game) {
  const p = g.player;
  els.hp.style.setProperty('--fill', String(Math.max(0, p.hp / p.maxHp)));
  els.hp.querySelector('span')!.textContent = `❤️ ${Math.ceil(p.hp)} / ${p.maxHp}`;
  els.xp.style.setProperty('--fill', String(Math.min(1, g.xp / g.next)));
  els.level.textContent = `Lv ${g.level}`;
  els.timer.textContent = clock(Math.min(RUN_LENGTH, g.time));
  els.kills.textContent = `💀 ${g.kills}`;
}

let bannerTimer = 0;
function banner(text: string) {
  els.banner.textContent = text;
  els.banner.hidden = false;
  els.banner.classList.remove('show');
  void els.banner.offsetWidth;
  els.banner.classList.add('show');
  window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => (els.banner.hidden = true), 3200);
}

// ---------------------------------------------------------------------------
// Level-ups, pause
// ---------------------------------------------------------------------------

const IMG = `${import.meta.env.BASE_URL}vidya/img/`;
/** A weapon's icon as HTML: its picture or drawing if it has one, else its emoji. */
function weaponIcon(id: WeaponId): string {
  const w = WEAPONS[id];
  if (w.img) return `<img class="gun" src="${IMG}${w.img}" alt="${w.icon}">`;
  return w.svg ?? w.icon;
}
const BTC_IMG = `<img class="btc" src="${IMG}bitcoin.webp" alt="₿">`;

function describe(o: Offer): { icon: string; name: string; tag: string; text: string } {
  if (o.kind === 'weapon') {
    const w = WEAPONS[o.id];
    return { icon: weaponIcon(o.id), name: w.name, tag: o.level === 1 ? 'NEW WEAPON' : `LEVEL ${o.level}`, text: w.levels[o.level - 1] };
  }
  if (o.kind === 'passive') {
    const p = PASSIVES[o.id];
    return { icon: p.icon, name: p.name, tag: o.level === 1 ? 'NEW' : `LEVEL ${o.level}`, text: p.text };
  }
  if (o.kind === 'evolve') {
    const w = WEAPONS[o.id];
    return { icon: weaponIcon(o.id), name: w.name, tag: `WEAPON UPGRADE: ${WEAPONS[o.from].name.toUpperCase()}`, text: `${w.text} ${w.levels[0]}` };
  }
  if (o.kind === 'heal') return { icon: '🥨', name: 'A Free Lunch', tag: 'EVERYTHING’S MAXED', text: 'Heal 30% of your Credibility. There is such a thing, apparently.' };
  return { icon: BTC_IMG, name: 'Bitcoin', tag: 'EVERYTHING’S MAXED', text: '+25 ₿. Stack sats.' };
}

function showOffer(g: Game) {
  shownOffer = g.offer;
  els.modal.replaceChildren();
  const box = h('div', 'modal-box');
  box.append(t('h2', 'modal-title', `LEVEL ${g.level - g.pending + 1}!`), t('p', 'muted', 'Pick one. (1, 2, 3 on a keyboard.)'));
  const cards = h('div', 'cards');
  g.offer!.forEach((o, i) => {
    const d = describe(o);
    const card = button('', `card${o.kind === 'weapon' ? ' weapon' : o.kind === 'evolve' ? ' evolve' : ''}`, () => pick(i));
    // Icons are our own emoji or drawings (never player text), so they can go in as HTML.
    card.append(h('span', 'card-icon', d.icon), t('small', 'card-tag', d.tag), t('b', 'card-name', d.name), t('span', 'card-text', d.text));
    cards.append(card);
  });
  box.append(cards);
  if (g.rerolls > 0) box.append(button(`🎲 Reroll (${g.rerolls} left)`, 'big secondary reroll', rerollCards));
  box.append(loadout(g));
  els.modal.append(box);
  els.modal.hidden = false;
}

function rerollCards() {
  if (!g || !reroll(g)) return;
  play('pickup', 0);
  showOffer(g);
}

/** What you're carrying, as a row of icons with levels. */
function loadout(g: Game): HTMLElement {
  const row = h('div', 'loadout');
  for (const w of g.weapons) row.append(h('span', 'slot weapon', `${weaponIcon(w.id)}${w.level}`));
  for (const p of g.passives) row.append(t('span', 'slot', `${PASSIVES[p.id].icon}${p.level}`));
  return row;
}

function pick(i: number) {
  if (!g?.offer) return;
  choose(g, i);
  shownOffer = null;
  vis.happy = 1.6;
  if (!g.offer) {
    els.modal.hidden = true;
    last = performance.now();
  }
}

function setPaused(on: boolean) {
  if (!g || g.over || g.offer) return;
  paused = on;
  if (!on) {
    els.modal.hidden = true;
    last = performance.now();
    return;
  }
  els.modal.replaceChildren();
  const box = h('div', 'modal-box');
  box.append(t('h2', 'modal-title', 'PAUSED'), loadout(g));
  box.append(
    button('▶ Resume', 'big', () => setPaused(false)),
    button('Give up', 'big secondary', () => {
      if (g) g.player.hp = 0;
      paused = false;
      els.modal.hidden = true;
      if (g) {
        g.over = 'lost';
        showEnd(g);
      }
    }),
  );
  els.modal.append(box);
  els.modal.hidden = false;
}
function togglePause() {
  if (!g || g.over || g.offer) return;
  setPaused(!paused);
}
els.pause.addEventListener('click', togglePause);

// ---------------------------------------------------------------------------
// Title, end
// ---------------------------------------------------------------------------

function showTitle() {
  g = null;
  els.hud.hidden = true;
  els.modal.hidden = true;
  els.screen.replaceChildren();
  const s = h('section', 'title');
  s.append(t('h1', 'logo', 'WITHER AWAY'), t('p', 'tagline', 'Marx promised the state would wither away. It didn’t. Make it.'));
  const picker = h('div', 'characters');
  for (const id of CHARACTER_ORDER) {
    const c = CHARACTERS[id];
    const card = button('', `character${save.character === id ? ' picked' : ''}`, () => {
      save.character = id;
      persist();
      showTitle();
    });
    card.append(ballImg(id), t('b', 'char-name', c.name), t('small', 'char-weapon', `${WEAPONS[c.weapon].icon} ${WEAPONS[c.weapon].name}`), t('small', 'char-perk', c.perk));
    const best = save.meta.best[id];
    if (best) card.append(t('small', 'char-best', best >= RUN_LENGTH ? '🏆 Won' : `Best: ${clock(best)}`));
    card.setAttribute('aria-pressed', String(save.character === id));
    picker.append(card);
  }
  s.append(picker);
  const c = CHARACTERS[save.character];
  s.append(t('p', 'blurb', c.blurb));
  const buttons = h('div', 'menu');
  buttons.append(
    button(`▶ Play as ${c.name}`, 'big', () => startRun(save.character)),
    button(`${BTC_IMG} The Free Market (${save.shop.bank.toLocaleString()})`, 'big secondary shop-button', showShop),
    button('📖 How to play', 'big secondary', showHowTo),
    button('💾 Save &amp; load', 'big secondary', () => openSaveTransfer('wither-away')),
  );
  s.append(buttons);
  if (save.shop.heatOn.length) {
    s.append(t('p', 'heat-line', `Regulations in force: ${save.shop.heatOn.map((id) => `${HEAT[id].icon} ${HEAT[id].name}`).join(', ')} (×${heatBonus(save.shop).toFixed(2)} ₿)`));
  }
  if (save.meta.runs) s.append(t('p', 'meta', `${save.meta.runs} run${save.meta.runs === 1 ? '' : 's'} · ${save.meta.wins} won · ${save.meta.kills} statists sent packing · ₿ ${save.meta.gold} earned`));
  s.append(t('p', 'proto', 'PROTOTYPE'));
  els.screen.append(s);
  els.screen.hidden = false;
}

// ---------------------------------------------------------------------------
// The Free Market
// ---------------------------------------------------------------------------

/** One thing for sale: its icon, name, what it does, its ranks, and a button with the price. */
function shopRow(item: ShopItem, icon: string, name: string, text: string, ranks?: [number, number]): HTMLElement {
  const cost = price(save.shop, item);
  const row = h('div', `ware${cost === null ? ' owned' : ''}`);
  row.append(h('span', 'ware-icon', icon));
  const body = h('div', 'ware-body');
  body.append(t('b', 'ware-name', name), t('span', 'ware-text', text));
  if (ranks) {
    const pips = h('span', 'pips');
    pips.setAttribute('aria-label', `Rank ${ranks[0]} of ${ranks[1]}`);
    for (let i = 0; i < ranks[1]; i++) pips.append(h('i', i < ranks[0] ? 'on' : ''));
    body.append(pips);
  }
  row.append(body);
  if (cost === null) row.append(t('span', 'ware-owned', ranks ? 'Maxed' : 'Owned'));
  else {
    const b = button(`${BTC_IMG} ${cost}`, 'buy', () => {
      if (!buy(save.shop, item)) return;
      persist();
      play('buy', 0);
      showShop();
    });
    b.disabled = cost > save.shop.bank;
    b.setAttribute('aria-label', `Buy ${name} for ${cost} Bitcoin`);
    row.append(b);
  }
  return row;
}

function showShop() {
  g = null;
  els.hud.hidden = true;
  els.modal.hidden = true;
  const scroll = els.screen.scrollTop;
  els.screen.replaceChildren();
  const s = h('section', 'title shop');
  s.append(t('h1', 'logo', 'THE FREE MARKET'), t('p', 'tagline', 'Voluntary exchange only. No refunds: this isn’t a government programme.'));
  s.append(h('p', 'bank', `${BTC_IMG} <b>${save.shop.bank.toLocaleString()}</b> Bitcoin to spend`));

  const section = (title: string, note: string) => {
    const sec = h('section', 'shop-section');
    sec.append(t('h2', 'shop-title', title), t('p', 'muted', note));
    const grid = h('div', 'wares');
    sec.append(grid);
    s.append(sec);
    return grid;
  };

  const ups = section('Permanent upgrades', 'For every libertarian, every run.');
  for (const id of UPGRADE_ORDER) {
    const u = UPGRADES[id];
    ups.append(shopRow({ kind: 'upgrade', id }, u.icon, u.name, u.text, [rank(save.shop, id), u.costs.length]));
  }

  const evo = section('Weapon upgrades', 'Once your starting weapon reaches level 5, its upgrade turns up as a level-up card.');
  for (const id of CHARACTER_ORDER) {
    const { from, to } = EVOLUTIONS[id];
    const icon = `<span class="evo-icons">${weaponIcon(from)}<span class="arrow">➜</span>${weaponIcon(to)}</span>`;
    evo.append(shopRow({ kind: 'evolution', id }, icon, `${CHARACTERS[id].name}: ${WEAPONS[to].name}`, `${WEAPONS[from].name} becomes ${WEAPONS[to].name}. ${WEAPONS[to].levels[0]}`));
  }

  const cards = section('New cards', 'Bought cards join the level-up pool for everyone.');
  for (const id of CARD_ORDER) {
    const isWeapon = id in WEAPONS;
    const icon = isWeapon ? weaponIcon(id as WeaponId) : PASSIVES[id as Exclude<CardId, WeaponId>].icon;
    const name = isWeapon ? WEAPONS[id as WeaponId].name : PASSIVES[id as Exclude<CardId, WeaponId>].name;
    const text = isWeapon ? WEAPONS[id as WeaponId].text : PASSIVES[id as Exclude<CardId, WeaponId>].text;
    cards.append(shopRow({ kind: 'card', id }, icon, `${name}${isWeapon ? ' (weapon)' : ''}`, text));
  }

  const heat = section('Regulations', `Harder runs, more Bitcoin. Buy one to be able to switch it on. Now: ×${heatBonus(save.shop).toFixed(2)} Bitcoin.`);
  for (const id of HEAT_ORDER) {
    const d = HEAT[id];
    const row = shopRow({ kind: 'heat', id }, d.icon, d.name, `${d.text} +${Math.round(d.bonus * 100)}% Bitcoin.`);
    if (save.shop.heatOwned.includes(id)) {
      const on = save.shop.heatOn.includes(id);
      row.querySelector('.ware-owned')?.remove();
      const sw = button(on ? 'On' : 'Off', `toggle${on ? ' on' : ''}`, () => {
        toggleHeat(save.shop, id);
        persist();
        showShop();
      });
      sw.setAttribute('role', 'switch');
      sw.setAttribute('aria-checked', String(on));
      sw.setAttribute('aria-label', `${d.name}: ${on ? 'on' : 'off'}`);
      row.append(sw);
    }
    heat.append(row);
  }

  const buttons = h('div', 'menu');
  buttons.append(button(`▶ Play as ${CHARACTERS[save.character].name}`, 'big', () => startRun(save.character)), button('Back', 'big secondary', showTitle));
  s.append(buttons);
  els.screen.append(s);
  els.screen.hidden = false;
  els.screen.scrollTop = scroll;
}

function showHowTo() {
  els.modal.replaceChildren();
  const box = h('div', 'modal-box');
  const foes = (['communist', 'socialist', 'keynesian', 'fascist', 'taxman', 'bank'] as const).map((id) => `<li><b>${ENEMIES[id].name}</b>: ${ENEMIES[id].note}</li>`).join('');
  box.append(
    t('h2', 'modal-title', 'HOW TO PLAY'),
    h(
      'ul',
      'how',
      `<li>🕹️ <b>Move</b> with WASD or the arrow keys, a gamepad’s left stick, or a thumb anywhere on a touch screen. You <b>aim and shoot automatically</b>.</li>
      <li>💎 Statists drop <b>XP</b>. Level up and pick one of three cards: a new weapon, or a level for one you have (up to 5 weapons and 5 passives, level 5 each).</li>
      <li>⏱️ Survive <b>${clock(RUN_LENGTH)}</b> and the state finally withers away. It gets busier every minute.</li>
      ${foes}
      <li>🥨 A free lunch heals, 🧲 pulls in all the XP, ₿ is Bitcoin. You also earn 1 Bitcoin for every six seconds you last (and 100 for winning).</li>
      <li>🏪 Spend it in <b>the Free Market</b> between runs: permanent upgrades, new cards, each libertarian’s <b>weapon upgrade</b> (offered once the starting weapon reaches level 5), and regulations that make runs harder for more Bitcoin.</li>
      <li>⏸️ <kbd>Esc</kbd> or <kbd>P</kbd> to pause.</li>`,
    ),
    button('Got it', 'big', () => (els.modal.hidden = true)),
  );
  els.modal.append(box);
  els.modal.hidden = false;
}

function showEnd(g: Game) {
  const won = g.over === 'won';
  play(won ? 'win' : 'lose', 1);
  const m = save.meta;
  m.runs++;
  if (won) m.wins++;
  m.kills += g.kills;
  const earned = goldEarned(g);
  m.gold += earned.total;
  save.shop.bank += earned.total;
  m.best[g.character] = Math.max(m.best[g.character] ?? 0, Math.floor(g.time));
  persist();
  els.modal.hidden = true;
  els.hud.hidden = true;
  els.screen.replaceChildren();
  const s = h('section', `title end ${won ? 'won' : 'lost'}`);
  s.append(ballImg(g.character, 'ball big'));
  s.append(t('h1', 'logo', won ? 'THE STATE HAS WITHERED AWAY' : 'THE STATE WINS THIS ROUND'));
  s.append(t('p', 'tagline', won ? 'Marx was right about one thing, eventually. Ancapistan is open for business.' : `${CHARACTERS[g.character].name} lasted ${clock(g.time)}. The bureaucracy will want that in triplicate.`));
  const stats = h('div', 'stats');
  for (const [label, value] of [
    ['⏱️ Survived', clock(Math.min(RUN_LENGTH, g.time))],
    ['💀 Statists', String(g.kills)],
    ['⭐ Level', String(g.level)],
    ['₿ Bitcoin', `+${earned.total}`],
  ]) {
    const cell = h('div', 'stat');
    cell.append(t('b', '', value), t('small', '', label));
    stats.append(cell);
  }
  s.append(stats);
  const mult = g.mods.gold;
  s.append(
    t(
      'p',
      'muted',
      `₿ ${earned.picked} picked up + ${earned.survived} for ${won ? 'surviving and winning' : 'surviving'}${mult !== 1 ? ` × ${mult.toFixed(2)}` : ''} = ${earned.total}. You have ${save.shop.bank.toLocaleString()} to spend.`,
    ),
  );
  const dmg = Object.entries(g.damageBy).sort((a, b) => b[1] - a[1]);
  if (dmg.length) {
    const list = h('ul', 'damage');
    for (const [id, n] of dmg) list.append(h('li', '', `${weaponIcon(id as WeaponId)} ${WEAPONS[id as WeaponId].name}: ${n.toLocaleString()} damage`));
    s.append(list);
  }
  const buttons = h('div', 'menu');
  buttons.append(button('▶ Again', 'big', () => startRun(g.character)), button(`${BTC_IMG} The Free Market`, 'big secondary shop-button', showShop), button('Pick someone else', 'big secondary', showTitle));
  s.append(buttons);
  els.screen.append(s);
  els.screen.hidden = false;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

showTitle();
loadSprites().then(async (s) => {
  // The pickups and icons that aren't balls: Bitcoin (from Ancapistan Tycoon) and the Laffer Curve.
  const extra: [string, string][] = [
    ['pickup:bitcoin', `${import.meta.env.BASE_URL}vidya/img/bitcoin.webp`],
    ['icon:laffer', `data:image/svg+xml;charset=utf-8,${encodeURIComponent(LAFFER_SVG)}`],
  ];
  const guns = Object.entries(GUNS).map(async ([id, def]) => {
    const img = new Image();
    img.src = `${IMG}${def!.file}`;
    try {
      await img.decode();
      s.set(`gun:${id}`, normalizeGun(img, def!));
    } catch {
      // no gun drawn, then
    }
  });
  await Promise.all([
    ...guns,
    ...extra.map(async ([key, src]) => {
      const img = new Image();
      img.src = src;
      try {
        await img.decode();
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        c.getContext('2d')!.drawImage(img, 0, 0, 64, 64);
        s.set(key, c);
      } catch {
        // fall back to the emoji
      }
    }),
  ]);
  sprites = s;
});
requestAnimationFrame(frame);

if (new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, { wa: { get g() { return g; }, save, startRun, step, choose, showShop, showTitle } });
}
