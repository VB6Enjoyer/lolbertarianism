// JUST GETTING STARTED 😈: the screens. The rules live in combat.ts and run.ts; this draws them,
// turns clicks into moves, and plays what happened (numbers flying, shakes, the laser eyes).

import './style.css';
import { getAudioContext, note, playTone, type Tone } from '../../shared/audio.ts';
import { openSaveTransfer } from '../../shared/save-transfer.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import { canUpgrade, CARDS, cardDef, cardName, needsTarget } from './cards.ts';
import { canAct, canPlay, costOf, endTurn, fireLaser, intentOf, laserReady, playCard, resolveChoice } from './combat.ts';
import { ENEMIES, enemyDef, type Intent } from './enemies.ts';
import { eventById } from './events.ts';
import { RELICS, relicDef } from './relics.ts';
import {
  ACTS, buyCard, buyRelic, chooseEvent, choiceOpen, enterNode, finishCombat, LANES, leaveEvent, leaveReward, leaveShop, type MapNode, newRun,
  nextAct, nodeAt, reachable, rehearse, removeCard, rest, restHeal, ROWS, type Run, takeRewardCard, takeRewardRelic,
} from './run.ts';
import { BASED_MAX, type Card, type Combat, type Fx, type Status } from './state.ts';
import { ACHIEVEMENTS, achievementById, earnedNow, normalizeUnlocked } from './achievements.ts';
import { dailyFor, normalizeDailyBests, twistById } from './daily.ts';
import { CARD_H, CARD_W, drawShareCard, shareText, type RunSummary } from './share.ts';
import { runScore } from './run.ts';
import { clampStage, MAX_STAGE, STAGES, stageInfo } from './stages.ts';
import { characterById, CHARACTERS, isCharacter, type CharacterId } from './characters.ts';
import { fightSecret, skipSecret } from './run.ts';
import { Phonk, type MoodId } from './music.ts';
import { addHistory, DEFAULT_OPTIONS, historyEntry, normalizeHistory, normalizeOptions, normalizeSeen, noteSeen, type HistoryEntry, type Options, type Seen } from './records.ts';

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

interface Meta {
  runs: number;
  wins: number;
  bestAct: number;
  bestFloor: number;
  lasers: number;
  /** TV appearances ever seen (for Media Darling), and daily runs finished. */
  events: string[];
  dailies: number;
}

interface Save {
  muted: boolean;
  run: Run | null;
  meta: Meta;
  achievements: string[];
  /** The best daily-run score, per date. */
  dailyBests: Record<string, number>;
  /** The highest Late Stage open (win on it to open the next), and the one picked for new runs. */
  stageUnlocked: number;
  stage: number;
  /** Who can be played (David once he's beaten), and who new runs are played as. */
  characters: CharacterId[];
  character: CharacterId;
  /** The last runs (newest first), everything ever come across, and the options. */
  history: HistoryEntry[];
  seen: Seen;
  options: Options;
}

const slot = createSaveSlot<Save>({ game: 'just-getting-started', version: 1 });
const saved = slot.load();
const count = (x: unknown) => Math.max(0, Math.floor(Number(x) || 0));

/** A saved run, if it still makes sense with the cards and enemies this version has. */
function runFrom(raw: unknown): Run | null {
  try {
    const r = raw as Run;
    if (!r || typeof r.seed !== 'number' || !Array.isArray(r.deck) || !Array.isArray(r.map) || !r.rng) return null;
    const cards = [...r.deck, ...(r.combat ? [...r.combat.hand, ...r.combat.draw, ...r.combat.discard, ...r.combat.exhausted, ...r.combat.powers] : [])];
    if (cards.some((c) => !CARDS[c.id])) return null;
    if (r.combat?.enemies.some((e) => !ENEMIES[e.id] || !enemyDef(e.id).moves[e.move])) return null;
    if (r.relics.some((id) => !RELICS[id])) return null;
    if (r.screen === 'lost' || r.screen === 'won') return null;
    r.visited ??= [];
    r.daily ??= null;
    r.stage = clampStage(r.stage);
    r.character = isCharacter(r.character) ? r.character : 'milton';
    r.secret ??= null;
    if (r.combat) {
      r.combat.twist ??= null;
      r.combat.stage = clampStage(r.combat.stage);
      r.combat.character = r.character;
    }
    return r;
  } catch {
    return null;
  }
}

const save: Save = {
  muted: saved?.muted === true,
  run: runFrom(saved?.run),
  meta: {
    runs: count(saved?.meta?.runs),
    wins: count(saved?.meta?.wins),
    bestAct: count(saved?.meta?.bestAct),
    bestFloor: count(saved?.meta?.bestFloor),
    lasers: count(saved?.meta?.lasers),
    events: Array.isArray(saved?.meta?.events) ? saved.meta.events.filter((id): id is string => typeof id === 'string' && !!eventById(id)) : [],
    dailies: count(saved?.meta?.dailies),
  },
  achievements: normalizeUnlocked(saved?.achievements),
  dailyBests: normalizeDailyBests(saved?.dailyBests),
  stageUnlocked: clampStage(saved?.stageUnlocked),
  stage: 1,
  characters: ['milton'],
  character: 'milton',
  history: normalizeHistory(saved?.history),
  seen: normalizeSeen(saved?.seen),
  options: saved?.options ? normalizeOptions(saved.options) : { ...DEFAULT_OPTIONS },
};
save.stage = Math.min(clampStage(saved?.stage), save.stageUnlocked);
save.characters = ['milton', ...(Array.isArray(saved?.characters) && saved.characters.includes('david') ? (['david'] as CharacterId[]) : [])];
save.character = isCharacter(saved?.character) && save.characters.includes(saved.character) ? saved.character : 'milton';
const persist = () => slot.save(save);

// ---------------------------------------------------------------------------
// Elements, sound
// ---------------------------------------------------------------------------

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const els = {
  app: byId('app'),
  screen: byId('screen'),
  hud: byId('hud'),
  overlay: byId('overlay'),
  toasts: byId('toasts'),
  mute: byId<HTMLButtonElement>('mute'),
  options: byId<HTMLButtonElement>('options'),
  home: byId<HTMLButtonElement>('home'),
};

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', html = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html) el.innerHTML = html;
  return el;
}
function button(label: string, className: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const b = h('button', className, label);
  b.type = 'button';
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  return b;
}
const IMG = (name: string) => `${import.meta.env.BASE_URL}vidya/img/${name}.webp`;

/** The soundtrack: starts on the first click or key (browsers won't play audio before one). */
const music = new Phonk();
function startMusic() {
  if (music.playing || save.muted || save.options.music <= 0) return;
  const ctx = getAudioContext();
  void ctx.resume().catch(() => {});
  music.setVolume(save.options.music);
  music.start(ctx);
  updateMusic();
}
/** The mood follows the screen (calm, a fight, a boss), and the Based meter brings in the lead. */
function updateMusic() {
  if (!music.playing) return;
  const run = save.run;
  const c = view === 'run' && run?.screen === 'combat' ? run.combat : null;
  const mood: MoodId = !c ? 'calm' : c.kind === 'boss' ? 'boss' : 'fight';
  music.setMood(mood);
  music.setIntensity(c ? c.based / BASED_MAX : 0);
}
for (const type of ['pointerdown', 'keydown'] as const) document.addEventListener(type, startMusic, { once: true });
document.addEventListener('pointerdown', () => void getAudioContext().resume().catch(() => {}), { once: true });
/** A sound effect at the options' volume. */
function tone(t: Tone, delay = 0) {
  const v = save.options.sound;
  if (v <= 0) return;
  playTone({ ...t, gain: t.gain.map((p) => [p[0], Math.max(0.0001, p[1] * v), p[2]] as typeof p) }, delay);
}
const sweep = (from: number, to: number, duration: number, volume = 0.06, wave: OscillatorType = 'sawtooth'): Tone => ({
  wave,
  duration,
  frequency: [[0, from], [duration, to, 'exp']],
  gain: [[0, volume], [duration, 0.001, 'exp']],
});
const SOUNDS = {
  card: () => tone(note(660, 0.06, 0.04, 'triangle')),
  hit: () => tone(sweep(220, 80, 0.12, 0.08, 'square')),
  hurt: () => tone(sweep(160, 50, 0.2, 0.09, 'sawtooth')),
  block: () => tone(note(1200, 0.05, 0.035, 'triangle')),
  heal: () => [523, 659, 784].forEach((hz, i) => tone(note(hz, 0.09, 0.04, 'triangle'), i * 0.06)),
  laser: () => {
    tone(sweep(180, 2400, 0.5, 0.07));
    tone(sweep(2400, 300, 0.6, 0.05, 'square'), 0.45);
  },
  win: () => [392, 523, 659, 784, 1047].forEach((hz, i) => tone(note(hz, 0.14, 0.05), i * 0.09)),
  lose: () => [392, 330, 262, 196].forEach((hz, i) => tone(note(hz, 0.22, 0.05, 'sawtooth'), i * 0.16)),
  buy: () => [880, 1320].forEach((hz, i) => tone(note(hz, 0.08, 0.04, 'triangle'), i * 0.07)),
};
function play(name: keyof typeof SOUNDS) {
  if (!save.muted) SOUNDS[name]();
}
function renderMute() {
  els.mute.textContent = save.muted ? '🔇' : '🔊';
  els.mute.setAttribute('aria-pressed', String(save.muted));
}
els.mute.addEventListener('click', () => {
  save.muted = !save.muted;
  persist();
  renderMute();
  if (save.muted) music.stop();
  else startMusic();
});
renderMute();

// ---------------------------------------------------------------------------
// Shared bits: Friedman, cards, relics, statuses
// ---------------------------------------------------------------------------

const ACT_NAMES: Record<number, string> = { 1: 'The Doomscroll', 2: 'The Money Printer', 3: 'Late Stage' };

/** Friedman, deep-fried, with laser eyes that glow brighter as the Based meter fills. */
/** A Friedman (Milton unless told otherwise), deep-fried, with laser eyes on his actual pupils. */
function friedman(className = '', who: CharacterId = 'milton'): HTMLElement {
  const ch = characterById(who);
  const el = h('div', `friedman ${who} ${className}`);
  const [[lx, ly], [rx, ry]] = ch.eyes;
  el.style.setProperty('--eye-lx', `${lx * 100}%`);
  el.style.setProperty('--eye-ly', `${ly * 100}%`);
  el.style.setProperty('--eye-rx', `${rx * 100}%`);
  el.style.setProperty('--eye-ry', `${ry * 100}%`);
  el.style.setProperty('--eye-tilt', `${ch.tilt}deg`);
  const img = h('img');
  img.src = IMG(ch.image);
  img.alt = `${ch.name}, with glowing red laser eyes`;
  img.draggable = false;
  el.append(img, h('span', 'eye l'), h('span', 'eye r'), h('span', 'beam l'), h('span', 'beam r'));
  return el;
}

const TYPE_LABEL: Record<string, string> = { argument: 'Argument', rebuttal: 'Rebuttal', principle: 'Principle', status: 'Status', curse: 'Curse' };

/** The game's words, explained wherever they turn up (hover, or long-press on a phone). */
const KEYWORDS: Record<string, string> = {
  Composure: 'Blocks damage. It’s gone at the start of your next turn.',
  Credibility: 'Your health. Hit 0 and you’re ratio’d.',
  Exposed: 'Takes 50% more damage. Goes down by 1 each turn.',
  Rattled: 'Deals 25% less damage. Goes down by 1 each turn.',
  Momentum: '+1 damage on every hit for each point, for the rest of the fight.',
  Airtime: 'What cards cost. You get 3 every turn.',
  Exhaust: 'Gone for the rest of the fight once played.',
  Inflation: 'Can’t be played. Lose 2 Credibility if it’s in your hand when your turn ends. Laser Eyes burn it up.',
  Shortage: 'Does nothing, and costs 1 Airtime to get rid of.',
  Agency: 'A Protection Agency: at the end of your turn, each one hits a random enemy for 1 (up to 6 of them). They last the fight.',
  Agencies: 'Protection Agencies: at the end of your turn, each one hits a random enemy for 1 (up to 6 of them). They last the fight.',
  Regret: 'A curse that stays in your deck for the whole run. Lose 1 Credibility if it’s in your hand when your turn ends.',
};
const KEYWORD_RE = new RegExp(`\\b(${Object.keys(KEYWORDS).join('|')})\\b`, 'g');
const TYPE_TIP: Record<string, string> = {
  argument: '<b>Argument</b>: hits an enemy.',
  rebuttal: '<b>Rebuttal</b>: defends, or sets something up.',
  principle: '<b>Principle</b>: stays in play for the rest of the fight.',
  status: '<b>Status</b>: junk that clogs your hand for one fight.',
  curse: '<b>Curse</b>: stays in your deck for the run.',
};

/** What a card's tooltip says: its type, and every keyword on it. */
function cardTip(card: Card): string {
  const def = cardDef(card.id);
  const words = [...new Set([...def.text(card.up).matchAll(KEYWORD_RE)].map((m) => m[1]))];
  return [TYPE_TIP[def.type], ...words.map((w) => `<b>${w}</b>: ${KEYWORDS[w]}`)].join('<br>');
}

function cardEl(card: Card, opts: { cost?: number | null; playable?: boolean; selected?: boolean; flavor?: boolean } = {}): HTMLElement {
  const def = cardDef(card.id);
  const cost = opts.cost !== undefined ? opts.cost : def.cost === null ? null : card.up && def.upCost !== undefined ? def.upCost : def.cost;
  const el = h('div', `card type-${def.type} rarity-${def.rarity}${card.up ? ' upgraded' : ''}${opts.playable === false ? ' unplayable' : ''}${opts.selected ? ' selected' : ''}`);
  el.innerHTML = `
    <span class="cost">${cost === null ? '✕' : cost}</span>
    <span class="art">${def.emoji}</span>
    <b class="name"></b>
    <small class="kind">${TYPE_LABEL[def.type]}</small>
    <span class="text">${def.text(card.up).replace(KEYWORD_RE, '<span class="kw">$1</span>')}</span>
    ${opts.flavor && def.flavor ? `<i class="flavor"></i>` : ''}`;
  el.querySelector('.name')!.textContent = cardName(card.id, card.up);
  if (opts.flavor && def.flavor) el.querySelector('.flavor')!.textContent = def.flavor;
  el.dataset.tip = cardTip(card);
  return el;
}

function relicEl(id: string, extra = ''): HTMLElement {
  const r = relicDef(id);
  const el = h('span', `relic ${extra}`, r.emoji);
  el.dataset.tip = `<b>${r.emoji} ${r.name}</b><br>${r.text}`;
  el.setAttribute('aria-label', `${r.name}: ${r.text}`);
  el.tabIndex = 0;
  return el;
}

const STATUS_INFO: Record<Status, [string, string]> = {
  momentum: ['💪', 'Momentum: +1 damage per hit for each point.'],
  exposed: ['🎯', 'Exposed: takes 50% more damage. Counts down each turn.'],
  rattled: ['😵‍💫', 'Rattled: deals 25% less damage. Counts down each turn.'],
  savings: ['🐷', 'Savings: Composure gained at the start of the next turn.'],
  monetarism: ['💹', 'Monetarism: gain this much Momentum every turn.'],
  flatTax: ['📐', 'Flat Tax: deal this much damage to every enemy at the end of each turn.'],
  vouchers: ['🎒', 'School Vouchers: each Rebuttal deals this much damage to a random enemy.'],
  primeTime: ['📺', 'Prime Time: draw this many extra cards each turn.'],
  spiral: ['🌀', 'Spiral: gains this much Momentum every turn.'],
  decay: ['🏚️', 'Decay: loses this much Credibility every turn.'],
  agency: ['🏢', 'Agencies: at the end of your turn, each one hits a random enemy for 1 (up to 6 of them).'],
  machinery: ['⚙️', 'The Machinery of Freedom: at the end of your turn, gain 1 Composure for each Agency.'],
  marketLaw: ['🏪', 'A Market for Law: gain this many Agencies at the start of each turn.'],
  polycentric: ['🕸️', 'Polycentric Law: gain this many Agencies whenever you play a Rebuttal.'],
};

function statusRow(status: Partial<Record<Status, number>>): HTMLElement {
  const row = h('div', 'statuses');
  for (const [id, n] of Object.entries(status) as [Status, number][]) {
    if (!n) continue;
    const [emoji, text] = STATUS_INFO[id];
    const chip = h('span', 'status', `${emoji}<b>${n}</b>`);
    const [name, rest] = text.split(': ');
    chip.dataset.tip = `<b>${emoji} ${name} ${n}</b><br>${rest}`;
    chip.setAttribute('aria-label', text);
    row.append(chip);
  }
  return row;
}

function bar(hp: number, max: number, block: number): HTMLElement {
  const el = h('div', 'hp');
  el.innerHTML = `<div class="bar"><i style="width:${Math.max(0, (hp / max) * 100)}%"></i><span>${hp} / ${max}</span></div>${block ? `<span class="block" title="Composure: blocks damage until your next turn">🛡️${block}</span>` : ''}`;
  return el;
}

// --- Tooltips: hover with a mouse; on a touchscreen, tap a chip or long-press a card ---

const tipBox = h('div', 'tip-box');
tipBox.hidden = true;
tipBox.setAttribute('role', 'tooltip');
document.body.append(tipBox);
let tipFor: Element | null = null;
let tipTimer = 0;

function showTip(el: HTMLElement) {
  const html = el.dataset.tip;
  if (!html) return;
  tipFor = el;
  tipBox.innerHTML = html;
  tipBox.hidden = false;
  const r = el.getBoundingClientRect();
  const w = tipBox.offsetWidth;
  const hgt = tipBox.offsetHeight;
  const left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  const above = r.top - hgt - 10;
  tipBox.style.left = `${left}px`;
  tipBox.style.top = `${above > 8 ? above : Math.min(innerHeight - hgt - 8, r.bottom + 10)}px`;
}

function hideTip() {
  tipBox.hidden = true;
  tipFor = null;
  window.clearTimeout(tipTimer);
}

const tipTarget = (e: Event) => (e.target as Element | null)?.closest?.<HTMLElement>('[data-tip]') ?? null;
document.addEventListener('pointerover', (e) => {
  if (e.pointerType !== 'mouse') return;
  const el = tipTarget(e);
  if (el && el !== tipFor) showTip(el);
});
document.addEventListener('pointerout', (e) => {
  if (e.pointerType !== 'mouse' || !tipFor) return;
  const to = (e as PointerEvent).relatedTarget as Node | null;
  if (!to || !tipFor.contains(to)) hideTip();
});
/** On a touchscreen, a long press on a card shows its tooltip (and doesn't play it). */
let longPressed = false;
document.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  const el = tipTarget(e);
  hideTip();
  longPressed = false;
  if (!el) return;
  if (el.classList.contains('card')) {
    tipTimer = window.setTimeout(() => {
      longPressed = true;
      showTip(el);
    }, 450);
  } else {
    // Chips, relics, intents: a tap is enough.
    showTip(el);
    tipTimer = window.setTimeout(hideTip, 3500);
  }
});
document.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'mouse' && tipFor?.classList.contains('card')) window.setTimeout(hideTip, 1600);
  if (e.pointerType !== 'mouse') window.clearTimeout(longPressed ? 0 : tipTimer);
});
/** Swallows the click that ends a long press, so the card isn't played. */
document.addEventListener(
  'click',
  (e) => {
    if (!longPressed) return;
    longPressed = false;
    e.stopPropagation();
    e.preventDefault();
  },
  true,
);

function toast(text: string) {
  const t = h('div', 'toast');
  t.textContent = text;
  els.toasts.append(t);
  window.setTimeout(() => t.remove(), 3200);
}

// ---------------------------------------------------------------------------
// Top bar, deep-fry level
// ---------------------------------------------------------------------------

function renderHud() {
  const run = save.run;
  els.hud.replaceChildren();
  if (!run || view === 'title') {
    els.hud.innerHTML = save.meta.runs ? `<span>Runs <b>${save.meta.runs}</b></span><span>Wins <b>${save.meta.wins}</b></span>` : '';
    return;
  }
  const fight = shownCombat ?? run.combat;
  const hp = fight ? fight.player.hp : run.hp;
  const deck = button(`🃏 <b>${run.deck.length}</b>`, 'hud-button', () => showCards(run.deck, 'Your act (deck)'));
  deck.title = 'Your deck';
  const relics = h('span', 'relics');
  for (const id of run.relics) relics.append(relicEl(id));
  els.hud.append(
    h('span', 'stat hp-stat', `❤️ <b>${hp}</b>/${run.maxHp}`),
    h('span', 'stat', `💵 <b>${run.royalties}</b>`),
    h('span', 'stat', `Act <b>${run.act}</b> · Floor <b>${run.pos ? run.pos.row + 1 : 0}</b>`),
    deck,
    relics,
  );
  if (run.stage > 1) {
    const st = stageInfo(run.stage);
    const badge = h('span', 'stat stage-badge', `LS${run.stage}`);
    badge.dataset.tip = `<b>Late Stage ${run.stage}: ${st.name}</b><br>${STAGES.slice(1, run.stage).map((x) => x.rule).join('<br>')}`;
    badge.tabIndex = 0;
    els.hud.append(badge);
  }
  if (run.daily) {
    const twist = twistById(run.daily.twist);
    if (twist) {
      const badge = h('span', 'stat daily-badge', `📅 ${twist.icon}`);
      badge.dataset.tip = `<b>Daily run ${run.daily.key}: ${twist.name}</b><br>${twist.description}`;
      badge.tabIndex = 0;
      els.hud.append(badge);
    }
  }
}

/** How deep-fried the screen is: the Based meter, plus a bit more each act. */
function setFry() {
  const run = save.run;
  const based = run?.combat?.based ?? run?.based ?? 0;
  // The meme screens (the title, the end of an act, the secret boss, a win) always have full laser eyes.
  const meme = view === 'title' || (!!run && (run.screen === 'act-clear' || run.screen === 'secret' || run.screen === 'won'));
  const stage = meme ? 2 : Math.min(4, Math.floor(based / 25));
  const o = save.options;
  els.app.className = `fry-${stage} act-${run && view !== 'title' ? run.act : 0}${o.reduceFlashing ? ' reduce-flashing' : ''}${o.shake ? '' : ' no-shake'}`;
  els.app.style.setProperty('--based', String(meme ? 1 : based / BASED_MAX));
  updateMusic();
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

let view: 'title' | 'run' = 'title';
/** While the fight's last blow plays out, or the screen is changing. */
let busy = false;
/** A card picked that still needs a target (hand index). */
let selected: number | null = null;

function render() {
  hideTip();
  if (save.run && view === 'run' && !shownCombat) checkAchievements();
  if (save.run && view === 'run' && noteSeen(save.seen, save.run)) persist();
  setFry();
  renderHud();
  els.screen.replaceChildren();
  const run = save.run;
  if (view === 'title' || !run) return renderTitle();
  switch (run.screen) {
    case 'map':
      return renderMap(run);
    case 'combat':
      return renderCombat(shownCombat ?? run.combat!);
    case 'reward':
      return renderReward(run);
    case 'shop':
      return renderShop(run);
    case 'rest':
      return renderRest(run);
    case 'event':
      return renderEvent(run);
    case 'act-clear':
      return renderActClear(run);
    case 'secret':
      return renderSecret(run);
    case 'lost':
    case 'won':
      return renderEnd(run);
  }
}

function renderTitle() {
  const s = h('section', 'title-screen');
  s.append(h('h1', 'meme top', 'LATE STAGE CAPITALISM 😔?'), friedman('big lasers-on'), h('h1', 'meme bottom', 'NAH, WE’RE JUST <span>GETTING STARTED 😈😤</span>'));
  s.append(h('p', 'pitch', 'A deckbuilder. You’re Milton Friedman, booked on every talk show where someone says capitalism is dying. Win the arguments, fill the Based meter, fire the laser eyes. Three acts. No free lunch.'));
  const buttons = h('div', 'menu-buttons');
  const run = save.run;
  if (run) {
    buttons.append(button(`▶ Continue <small>Act ${run.act} · ${run.hp}/${run.maxHp} ❤️</small>`, 'big-button', () => go('run')));
    buttons.append(button('New run', 'big-button secondary', confirmNewRun));
  } else buttons.append(button('▶ Start a run', 'big-button', startRun));
  // The character and stage pickers sit above the buttons (the buttons go in after them).
  if (save.characters.length > 1 && !run) s.append(characterPicker());
  if (save.stageUnlocked > 1 && !run) s.append(stagePicker());
  const d = dailyFor(new Date());
  buttons.append(button(`📅 Daily run <small>${d.twist.icon} ${d.twist.name}</small>`, 'big-button secondary', showDaily));
  buttons.append(button(`🏅 Achievements <small>${save.achievements.length}/${ACHIEVEMENTS.length}</small>`, 'big-button secondary', showAchievements));
  if (save.history.length) buttons.append(button(`📜 Run history <small>last ${save.history.length}</small>`, 'big-button secondary', showHistory));
  buttons.append(button(`📚 Compendium <small>${seenCount()}/${compendiumSize()}</small>`, 'big-button secondary', () => showCompendium()));
  buttons.append(button('📖 How to play', 'big-button secondary', showHowTo));
  buttons.append(button('💾 Save &amp; load', 'big-button secondary', () => openSaveTransfer('just-getting-started')));
  s.append(buttons);
  if (save.meta.runs) {
    const best = save.meta.wins ? `${save.meta.wins} win${save.meta.wins === 1 ? '' : 's'}` : `best: Act ${save.meta.bestAct}, floor ${save.meta.bestFloor}`;
    s.append(h('p', 'meta', `${save.meta.runs} run${save.meta.runs === 1 ? '' : 's'} · ${best} · ${save.meta.lasers} laser blasts`));
  }
  els.screen.append(s);
}

/** Who new runs are played as (once David's unlocked). */
function characterPicker(): HTMLElement {
  const box = h('div', 'character-picker');
  for (const id of save.characters) {
    const ch = CHARACTERS[id];
    const b = button('', `character${save.character === id ? ' picked' : ''}`, () => {
      save.character = id;
      persist();
      render();
    });
    b.append(friedman('mini', id), h('b', '', ch.short), h('small', '', id === 'milton' ? 'Data &amp; Composure' : 'Protection Agencies'));
    b.dataset.tip = `<b>${ch.name}</b><br>${ch.blurb}`;
    b.setAttribute('aria-pressed', String(save.character === id));
    box.append(b);
  }
  return box;
}

/** The other Friedman drops by: take him on, or take the win. */
function renderSecret(run: Run) {
  const boss = characterById(characterById(run.character).secretBoss === 'david' ? 'david' : 'milton');
  const s = h('section', 'title-screen secret-screen');
  s.append(
    h('h1', 'meme top', 'LATE STAGE CAPITALISM: CANCELLED'),
    h('p', 'pitch', run.character === 'milton'
      ? 'The studio empties. You’re packing up your notes when someone knocks on the green room door. Your son. He’s been watching. He has notes.'
      : 'The studio empties. Your phone rings. It’s your father. He watched the whole thing. He has notes.'),
    friedman('big lasers-on', boss.id),
    h('h1', 'meme bottom', run.character === 'milton' ? '“DAD, YOU DIDN’T <span>GO FAR ENOUGH.”</span>' : '“SON, THE STATE IS A <span>NECESSARY EVIL.”</span>'),
  );
  const buttons = h('div', 'menu-buttons');
  buttons.append(
    button(`⚔️ Debate ${boss.short} <small>Secret boss · you get most of your Credibility back</small>`, 'big-button', () => {
      fightSecret(run);
      persist();
      render();
      window.scrollTo(0, 0);
      if (run.combat) playFx(run.combat.fx.splice(0));
    }),
    button('🏆 Take the win', 'big-button secondary', () => {
      skipSecret(run);
      endOfRun(run);
      play('win');
      persist();
      render();
    }),
  );
  s.append(buttons, h('p', 'meta', run.character === 'milton' ? 'Win and you can play as David.' : 'It’s only a family argument. Mostly.'));
  els.screen.append(s);
}

/** Which Late Stage new runs are played on, and what it adds (with everything before it). */
function stagePicker(): HTMLElement {
  const box = h('div', 'stage-picker');
  const info = stageInfo(save.stage);
  const step = (d: number) => {
    save.stage = Math.max(1, Math.min(save.stageUnlocked, save.stage + d));
    persist();
    render();
  };
  const prev = button('◀', 'stage-step', () => step(-1), save.stage <= 1);
  const next = button('▶', 'stage-step', () => step(1), save.stage >= save.stageUnlocked);
  prev.setAttribute('aria-label', 'Easier stage');
  next.setAttribute('aria-label', 'Harder stage');
  const label = h('div', 'stage-label', `<b>LATE STAGE ${save.stage}</b><small></small>`);
  label.querySelector('small')!.textContent = info.name;
  const rules = h('ul', 'stage-rules');
  for (const st of STAGES.slice(1, save.stage)) {
    const li = h('li');
    li.textContent = `${st.n}. ${st.rule}`;
    rules.append(li);
  }
  if (save.stage === 1) rules.append(Object.assign(h('li'), { textContent: STAGES[0].rule }));
  box.append(prev, label, next, rules);
  box.dataset.tip = `Win on your highest stage to open the next one (${save.stageUnlocked}/${MAX_STAGE} open). Each stage keeps every twist before it, and scores 15% more.`;
  return box;
}

function go(to: 'title' | 'run') {
  view = to;
  selected = null;
  render();
  window.scrollTo(0, 0);
}

function startRun() {
  save.run = newRun((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, null, save.stage, save.character);
  persist();
  go('run');
}

function confirmNewRun() {
  openOverlay('Start over?', (box) => {
    box.append(h('p', '', 'Your current run will be abandoned (it counts as a loss).'));
    box.append(
      button('Yes, new run', 'big-button', () => {
        if (save.run) recordEnd(save.run, false);
        closeOverlay();
        startRun();
        checkAchievements();
      }),
      button('Keep playing', 'big-button secondary', closeOverlay),
    );
  });
}

function showHowTo() {
  openOverlay('How to play', (box) => {
    box.append(
      h(
        'ul',
        'how',
        `<li>🗺️ <b>Pick bookings</b> on the map: 🎙️ debates, 😡 hostile panels (elites, with a relic), 📺 TV appearances, 🛒 bookstores and 🛋️ the green room. Each act ends with a boss.</li>
        <li>📺 Each turn you get <b>3 Airtime</b> to play cards. <b>Arguments</b> hit, <b>Rebuttals</b> defend and set up, <b>Principles</b> last the whole fight.</li>
        <li>🛡️ <b>Composure</b> blocks damage until your next turn. ❤️ <b>Credibility</b> is your health: hit 0 and you’re ratio’d.</li>
        <li>👀 Enemies show their <b>intent</b>: what they’ll do next turn. ⚔️ attack, 🛡️ defend, 💪 buff, 🌀 debuff.</li>
        <li>🔴 Every point of damage fills the <b>Based meter</b>. Full meter: <b>LASER EYES</b> hit everyone and burn the Inflation out of your hand. The screen gets more deep-fried as it fills.</li>
        <li>🎈 <b>Inflation</b> clogs your hand and costs Credibility. 😔 <b>Regret</b> is forever. You know what you did.</li>
        <li>❔ Not sure what a word means? <b>Hover</b> over it (on a phone, <b>long-press</b> a card, or tap a chip or an intent).</li>
        <li>📅 A <b>daily run</b>: the same run for everyone each day, with a twist, and a best score to beat.</li>
        <li>🤫 Beat the last boss with <b>no Regret</b> in your deck, and someone drops by. Win that argument and you can play as him.</li>
        <li>🪜 Win a run and <b>Late Stage 2</b> opens: harder, and worth more points. Up to Late Stage 10. Each stage keeps every twist before it. It’s never over.</li>
        <li>⌨️ Keys: <kbd>1</kbd>–<kbd>9</kbd> play a card, <kbd>L</kbd> laser eyes, <kbd>E</kbd> end turn, <kbd>Esc</kbd> cancel.</li>`,
      ),
      button('Got it', 'big-button', closeOverlay),
    );
  });
}

// --- The map ---

const NODE_LOOK: Record<MapNode['type'], [string, string]> = {
  fight: ['🎙️', 'Debate'],
  elite: ['😡', 'Hostile panel (elite)'],
  event: ['📺', 'TV appearance'],
  shop: ['🛒', 'Bookstore'],
  rest: ['🛋️', 'Green room'],
  boss: ['💀', 'Boss'],
};
const BOSS_EMOJI: Record<number, string> = { 1: '🧵', 2: '🖨️', 3: '😔' };
const ROW_H = 74;

function renderMap(run: Run) {
  const s = h('section', 'map-screen');
  s.append(h('h2', 'screen-title', `Act ${run.act}: ${ACT_NAMES[run.act]}`), h('p', 'screen-sub', run.pos ? 'Pick your next booking.' : 'Pick your first booking. The boss is waiting at the top.'));
  const wrap = h('div', 'map-wrap');
  const map = h('div', 'map');
  const height = (ROWS + 1) * ROW_H;
  map.style.height = `${height}px`;
  const x = (col: number) => ((col + 0.5) / LANES) * 100;
  const y = (row: number) => height - (row + 0.5) * ROW_H;
  const open = reachable(run);
  const visited = new Set(run.visited);
  let lines = '';
  for (const row of run.map)
    for (const node of row)
      for (const col of node.next) {
        const to = nodeAt(run, node.row + 1, col);
        if (!to) continue;
        const walked = visited.has(`${node.row}:${node.col}`) && visited.has(`${to.row}:${to.col}`);
        lines += `<line x1="${x(node.col)}" y1="${y(node.row)}" x2="${x(to.col)}" y2="${y(to.row)}" class="${walked ? 'walked' : ''}"/>`;
      }
  map.innerHTML = `<svg viewBox="0 0 100 ${height}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>`;
  let focus: HTMLElement | null = null;
  for (const row of run.map)
    for (const node of row) {
      const [emoji, label] = NODE_LOOK[node.type];
      const canGo = open.includes(node);
      const here = run.pos?.row === node.row && run.pos?.col === node.col;
      const b = button(node.type === 'boss' ? BOSS_EMOJI[run.act] : emoji, `node node-${node.type}${canGo ? ' open' : ''}${visited.has(`${node.row}:${node.col}`) ? ' visited' : ''}${here ? ' here' : ''}`, () => {
        if (busy || !enterNode(run, node.row, node.col)) return;
        play('card');
        persist();
        render();
        window.scrollTo(0, 0);
        // A fight starts with the enemies saying hello (and relics kicking in): show it now.
        if (run.combat) playFx(run.combat.fx.splice(0));
      }, !canGo);
      b.style.left = `${x(node.col)}%`;
      b.style.top = `${y(node.row)}px`;
      b.title = node.type === 'boss' ? `Boss: ${enemyDef(run.act === 1 ? 'doomposter' : run.act === 2 ? 'fedchair' : 'latestage').name}` : label;
      b.setAttribute('aria-label', b.title);
      map.append(b);
      if (canGo && !focus) focus = b;
    }
  wrap.append(map);
  s.append(wrap);
  const legend = h('p', 'legend');
  legend.innerHTML = Object.entries(NODE_LOOK)
    .filter(([k]) => k !== 'boss')
    .map(([, [e, l]]) => `<span>${e} ${l}</span>`)
    .join('');
  s.append(legend);
  els.screen.append(s);
  // Show the next row of choices.
  if (focus) requestAnimationFrame(() => focus!.scrollIntoView({ block: 'center' }));
}

// --- A fight ---

const INTENT_ICON: Record<Intent, string> = { attack: '⚔️', defend: '🛡️', buff: '💪', debuff: '🌀', special: '✨' };
const INTENT_TIP: Record<Intent, string> = {
  attack: '⚔️ Attacks you.',
  defend: '🛡️ Gains Composure.',
  buff: '💪 Makes itself stronger.',
  debuff: '🌀 Weakens you, or clogs your deck.',
  special: '✨ Something unusual.',
};

function renderCombat(c: Combat) {
  const s = h('section', 'combat-screen');
  const arena = h('div', 'arena');
  const me = h('div', 'player-side');
  me.dataset.target = 'player';
  const portrait = friedman(c.based >= BASED_MAX ? 'ready' : '', c.character ?? 'milton');
  me.append(portrait, bar(c.player.hp, c.player.maxHp, c.player.block), statusRow(c.player.status));
  const foes = h('div', 'foes');
  c.enemies.forEach((e, i) => {
    if (e.dead) return;
    const def = enemyDef(e.id);
    const { move, damage } = intentOf(c, e);
    const foe = h('div', `foe${def.boss ? ' boss' : ''}${selected !== null ? ' targetable' : ''}`);
    foe.dataset.target = String(e.uid);
    const intent = h('div', `intent intent-${move.intent}`, `${INTENT_ICON[move.intent]}${move.also ? INTENT_ICON[move.also] : ''}${damage ? `<b>${damage}</b>` : ''}`);
    intent.dataset.tip = `<b>Next turn: ${move.name}</b><br>${INTENT_TIP[move.intent]}${move.also ? `<br>${INTENT_TIP[move.also]}` : ''}${damage ? `<br>Damage: ${damage} (after its Momentum, and your Exposed)` : ''}`;
    const name = h('b', 'foe-name');
    name.textContent = def.name;
    // The secret bosses have a photo; everyone else is an emoji.
    const look = def.image ? friedman('foe-photo', def.image === 'dfriedman' ? 'david' : 'milton') : h('div', 'foe-emoji', def.emoji);
    foe.append(intent, h('small', 'move-name', ''), look, name, bar(e.hp, e.maxHp, e.block), statusRow(e.status));
    foe.querySelector('.move-name')!.textContent = move.name;
    foe.addEventListener('click', () => {
      if (selected === null || busy) return;
      const pick = selected;
      selected = null;
      act(() => playCard(c, pick, i));
    });
    foes.append(foe);
  });
  arena.append(me, foes);

  const console_ = h('div', 'console');
  const top = h('div', 'console-top');
  const energy = h('div', 'energy', `<b>${c.player.energy}</b><small>/${c.player.maxEnergy + (c.relics.includes('press') ? 1 : 0)}</small>`);
  energy.dataset.tip = `<b>Airtime</b><br>${KEYWORDS.Airtime}`;
  const based = h('div', 'based');
  based.innerHTML = `<div class="based-bar"><i style="width:${(c.based / BASED_MAX) * 100}%"></i><span>BASED ${Math.floor(c.based)}%</span></div>`;
  const laser = button('🔴 LASER EYES', `laser-button${laserReady(c) ? ' ready' : ''}`, () => !busy && act(() => fireLaser(c)), !laserReady(c));
  laser.dataset.tip = '<b>🔴 Laser Eyes</b><br>Every point of damage fills the Based meter. When it’s full, fire: 20 damage to every enemy, and the Inflation in your hand burns up.';
  based.append(laser);
  const piles = h('div', 'piles');
  piles.append(
    button(`🂠 <b>${c.draw.length}</b>`, 'pile', () => showCards([...c.draw].sort((a, b) => a.id.localeCompare(b.id)), 'Draw pile (in no particular order)')),
    button(`🗑️ <b>${c.discard.length}</b>`, 'pile', () => showCards(c.discard, 'Discard pile')),
  );
  if (c.exhausted.length) piles.append(button(`🔥 <b>${c.exhausted.length}</b>`, 'pile', () => showCards(c.exhausted, 'Exhausted (gone for this fight)')));
  (piles.children[0] as HTMLElement).dataset.tip = '<b>Draw pile</b><br>You draw 5 a turn. When it runs out, the discard pile is shuffled back in.';
  (piles.children[1] as HTMLElement).dataset.tip = '<b>Discard pile</b><br>Played cards, and your hand at the end of each turn.';
  const end = button('End turn ▶', 'end-turn', () => {
    if (busy) return;
    selected = null;
    act(() => endTurn(c), { enemyTurn: true });
  }, !canAct(c));
  top.append(energy, based, piles, end);

  const hand = h('div', `hand${c.hand.length > 6 ? ' crowded' : ''}`);
  c.hand.forEach((card, i) => {
    const el = cardEl(card, { cost: costOf(card), playable: canPlay(c, i), selected: selected === i });
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.title = `${cardName(card.id, card.up)} (${i + 1})`;
    if (card.free) el.classList.add('free');
    el.addEventListener('click', () => clickCard(c, i));
    hand.append(el);
  });
  console_.append(top, hand);
  if (selected !== null) console_.append(h('p', 'hint', 'Pick a target. (Esc to cancel)'));
  s.append(arena, console_);
  // While the enemies' turn plays out: a banner, and nothing to press.
  if (c === shownCombat) {
    arena.append(h('div', 'turn-banner', 'THEIR TURN'));
    for (const b of console_.querySelectorAll<HTMLButtonElement>('button')) b.disabled = true;
  }
  els.screen.append(s);

  if (c.pending?.kind === 'choose') {
    const options = c.pending.options;
    openOverlay('Free to Choose', (box) => {
      box.append(h('p', '', 'Pick one. It costs 0 this turn.'));
      const row = h('div', 'card-row');
      options.forEach((card, i) => {
        const el = cardEl(card, { flavor: true });
        el.addEventListener('click', () => {
          closeOverlay();
          act(() => resolveChoice(c, i));
        });
        row.append(el);
      });
      box.append(row);
    }, false);
  }
}

function clickCard(c: Combat, i: number) {
  if (busy) return;
  if (selected === i) {
    selected = null;
    return render();
  }
  if (!canPlay(c, i)) {
    const cost = costOf(c.hand[i]);
    toast(cost === null ? 'That one can’t be played.' : 'Not enough Airtime.');
    return;
  }
  if (needsTarget(c, c.hand[i].id)) {
    selected = i;
    return render();
  }
  selected = null;
  act(() => playCard(c, i));
}

/** The fight as it was before the enemies' turn, shown while their turn plays out (null the rest of the time). */
let shownCombat: Combat | null = null;

/**
 * Runs a move, saves, redraws, and plays what happened. Ending your turn plays the enemies' turn
 * out one enemy at a time: the board as it was, then each move called out and its effects, in order.
 */
function act(move: () => unknown, opts: { enemyTurn?: boolean } = {}) {
  const run = save.run;
  if (!run) return;
  const before = opts.enemyTurn && run.combat ? structuredClone(run.combat) : null;
  move();
  const c = run.combat;
  const fx = c ? c.fx.splice(0) : [];
  play('card');
  persist();
  if (before && c && fx.some((e) => e.kind === 'act')) {
    before.hand = [];
    before.fx = [];
    busy = true;
    shownCombat = before;
    render();
    const maxHp = (t: 'player' | number) => (t === 'player' ? before.player.maxHp : (c.enemies.find((e) => e.uid === t)?.maxHp ?? 1));
    const ms = playFx(fx, maxHp);
    window.setTimeout(() => {
      shownCombat = null;
      busy = false;
      render();
      afterMove(run, c);
    }, ms + 450);
    return;
  }
  render();
  playFx(fx);
  afterMove(run, c);
}

/** Once a fight's over: a beat to see it, then the reward (or the end of the run). */
function afterMove(run: Run, c: Combat | null) {
  checkAchievements();
  if (!c?.result || busy) return;
  busy = true;
  window.setTimeout(() => {
    busy = false;
    finishCombat(run);
    if (run.screen === 'lost' || run.screen === 'won') {
      endOfRun(run);
      play(run.screen === 'won' ? 'win' : 'lose');
    } else play('win');
    persist();
    render();
    window.scrollTo(0, 0);
  }, c.result === 'won' ? 1000 : 1400);
}

/** Sets a health bar (and the Composure badge) to new values. */
function setBar(target: HTMLElement, hp: number, max: number, block?: number) {
  const fill = target.querySelector<HTMLElement>('.bar i');
  const label = target.querySelector<HTMLElement>('.bar span');
  if (fill) fill.style.width = `${Math.max(0, (hp / max) * 100)}%`;
  if (label) label.textContent = `${hp} / ${max}`;
  if (block === undefined) return;
  const hpRow = target.querySelector('.hp');
  let badge = target.querySelector<HTMLElement>('.block');
  if (!block) badge?.remove();
  else {
    if (!badge && hpRow) {
      badge = h('span', 'block');
      hpRow.append(badge);
    }
    if (badge) badge.textContent = `🛡️${block}`;
  }
}

/**
 * Shows what happened: numbers flying off, shakes, speech, the laser. With `maxHp` (the enemies'
 * turn), it plays step by step and moves the bars as it goes. Returns how long it takes (ms).
 */
function playFx(fx: Fx[], maxHp?: (t: 'player' | number) => number): number {
  const stepByStep = !!maxHp;
  const targetEl = (t: 'player' | number) => els.screen.querySelector<HTMLElement>(`[data-target="${t}"]`);
  const float = (t: 'player' | number, text: string, cls: string) => {
    const el = targetEl(t);
    if (!el) return;
    const f = h('span', `float ${cls}`, text);
    f.style.left = `${35 + Math.random() * 30}%`;
    el.append(f);
    window.setTimeout(() => f.remove(), 1100);
  };
  let at = 0;
  for (const e of fx) {
    at += stepByStep ? (e.kind === 'act' ? 800 : 170) : 90;
    window.setTimeout(() => {
      switch (e.kind) {
        case 'act': {
          // An enemy takes its turn: it steps forward and its move is called out.
          for (const el of els.screen.querySelectorAll('.foe.acting')) el.classList.remove('acting');
          const el = targetEl(e.target);
          if (!el) return;
          el.classList.add('acting');
          const call = h('div', 'move-call');
          call.textContent = e.text;
          el.append(call);
          window.setTimeout(() => call.remove(), 1100);
          play('card');
          break;
        }
        case 'damage': {
          if (stepByStep) {
            const el = targetEl(e.target);
            if (el) setBar(el, e.hp, maxHp!(e.target), e.block);
            if (e.target === 'player') {
              const stat = els.hud.querySelector('.hp-stat b');
              if (stat) stat.textContent = String(e.hp);
            }
          }
          if (!e.amount && !e.blocked) return;
          float(e.target, e.amount ? `−${e.amount}` : `🛡️${e.blocked}`, e.amount ? 'dmg' : 'blocked');
          const el = targetEl(e.target);
          el?.classList.remove('hit');
          void el?.offsetWidth;
          el?.classList.add('hit');
          play(e.target === 'player' ? 'hurt' : 'hit');
          break;
        }
        case 'block': {
          if (stepByStep) {
            const el = targetEl(e.target);
            if (el) setBar(el, Number(el.querySelector('.bar span')?.textContent?.split(' / ')[0] ?? 0), maxHp!(e.target), e.block);
          }
          float(e.target, `+${e.amount}🛡️`, 'blk');
          play('block');
          break;
        }
        case 'heal': {
          if (stepByStep) {
            const el = targetEl(e.target);
            if (el) setBar(el, e.hp, maxHp!(e.target));
          }
          float(e.target, `+${e.amount}❤️`, 'heal');
          play('heal');
          break;
        }
        case 'status': {
          const [emoji] = STATUS_INFO[e.status];
          float(e.target, `${emoji}${e.amount > 0 ? '+' : ''}${e.amount}`, 'stat');
          break;
        }
        case 'say': {
          const el = targetEl(e.target);
          if (!el) return;
          el.querySelector('.speech')?.remove();
          const bubble = h('div', 'speech');
          bubble.textContent = e.text;
          el.append(bubble);
          window.setTimeout(() => bubble.remove(), 3200);
          break;
        }
        case 'laser':
          els.app.classList.add('lasering');
          window.setTimeout(() => els.app.classList.remove('lasering'), 1000);
          play('laser');
          save.meta.lasers++;
          persist();
          break;
        case 'death':
          targetEl(e.target)?.classList.add('dying');
          break;
      }
    }, at);
  }
  return at;
}

function recordEnd(run: Run, won: boolean) {
  noteSeen(save.seen, run);
  save.history = addHistory(save.history, historyEntry(run, { abandoned: run.screen !== 'won' && run.screen !== 'lost' }));
  const m = save.meta;
  m.runs++;
  if (won) m.wins++;
  const floor = run.pos ? run.pos.row + 1 : 0;
  if (run.act > m.bestAct || (run.act === m.bestAct && floor > m.bestFloor)) {
    m.bestAct = run.act;
    m.bestFloor = floor;
  }
}

/** The run's over (won or lost): the records, the daily best, the achievements. */
function endOfRun(run: Run) {
  recordEnd(run, run.screen === 'won');
  // Win on your highest stage, and the next one opens (and becomes the one you'll play).
  unlockedNow = null;
  unlockedChar = null;
  // Out-argue David as Milton, and David's yours to play.
  if (run.secret === 'won' && run.character === 'milton' && !save.characters.includes('david')) {
    save.characters.push('david');
    unlockedChar = 'david';
  }
  if (run.screen === 'won' && !run.daily && run.stage >= save.stageUnlocked && save.stageUnlocked < MAX_STAGE) {
    save.stageUnlocked = run.stage + 1;
    save.stage = save.stageUnlocked;
    unlockedNow = save.stageUnlocked;
  }
  if (run.daily) {
    save.meta.dailies++;
    save.dailyBests[run.daily.key] = Math.max(save.dailyBests[run.daily.key] ?? 0, runScore(run));
  }
  checkAchievements();
}

/** The stage (and the character) that the run just ended opened (for the end screen). */
let unlockedNow: number | null = null;
let unlockedChar: CharacterId | null = null;

/** Unlocks whatever the run (and the fight) has earned since the last look. */
function checkAchievements() {
  const run = save.run;
  if (!run) return;
  if (run.event && !save.meta.events.includes(run.event.id)) save.meta.events.push(run.event.id);
  const fresh = earnedNow({ run, combat: run.combat, lasers: save.meta.lasers, eventsSeen: save.meta.events.length, dailies: save.meta.dailies }).filter((id) => !save.achievements.includes(id));
  if (!fresh.length) return;
  save.achievements.push(...fresh);
  persist();
  fresh.forEach((id, i) => window.setTimeout(() => achievementToast(id), i * 600));
}

function achievementToast(id: string) {
  const a = achievementById(id);
  if (!a) return;
  const t = h('div', 'toast achievement', '<span class="icon"></span><small>ACHIEVEMENT UNLOCKED</small><b></b>');
  t.querySelector('.icon')!.textContent = a.icon;
  t.querySelector('b')!.textContent = a.name;
  els.toasts.append(t);
  window.setTimeout(() => t.remove(), 4200);
  if (!save.muted) [784, 988, 1175, 1568].forEach((hz, i) => tone(note(hz, 0.1, 0.05, 'triangle'), i * 0.07));
}

function showAchievements() {
  openOverlay(`🏅 Achievements · ${save.achievements.length}/${ACHIEVEMENTS.length}`, (box) => {
    const grid = h('div', 'achievement-grid');
    for (const a of ACHIEVEMENTS) {
      const got = save.achievements.includes(a.id);
      const hidden = a.secret && !got;
      const card = h('div', `achievement${got ? '' : ' locked'}`, '<span class="icon"></span><b></b><small></small>');
      card.querySelector('.icon')!.textContent = hidden ? '❓' : a.icon;
      card.querySelector('b')!.textContent = hidden ? 'Secret' : a.name;
      card.querySelector('small')!.textContent = hidden ? 'Keep playing. You’ll know it when it happens.' : a.description;
      grid.append(card);
    }
    box.append(grid);
  });
}

// --- Run history, the compendium, options ---

const enemyLabel = (id: string) => `${enemyDef(id).emoji} ${enemyDef(id).name}`;

function showHistory() {
  openOverlay('📜 Run history', (box) => {
    const runs = save.history;
    const best = Math.max(...runs.map((r) => r.score));
    // Who ratio'd you most (abandoned runs don't count).
    const tally: Record<string, number> = {};
    for (const r of runs) if (r.killer && !r.abandoned) tally[r.killer] = (tally[r.killer] ?? 0) + 1;
    const nemesis = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    const wins = runs.filter((r) => r.won).length;
    const top = h('p', 'history-summary');
    top.innerHTML = `Last ${runs.length} run${runs.length === 1 ? '' : 's'} · <b>${wins}</b> won · best <b>${best}</b> points`;
    if (nemesis) {
      const n = h('span', 'nemesis');
      n.textContent = ` · Nemesis: ${enemyLabel(nemesis[0])} (${nemesis[1]}×)`;
      top.append(n);
    }
    const list = h('ol', 'history-list');
    for (const r of runs) {
      const li = h('li', `history-run ${r.won ? 'won' : r.abandoned ? 'abandoned' : 'lost'}`);
      const when = new Date(r.at);
      const result = r.won
        ? `🏆 Won${r.secret === 'won' ? ' · 🤝 beat the secret boss' : r.secret === 'lost' ? ' · 🤝 lost to the secret boss' : ''}`
        : r.abandoned
          ? `🏳️ Abandoned · Act ${r.act}, floor ${r.floor}`
          : `💀 Ratio’d${r.killer ? ` by ${enemyLabel(r.killer)}` : ''} · Act ${r.act}, floor ${r.floor}`;
      li.innerHTML = '<span class="result"></span><span class="who"></span><b class="score"></b><small class="when"></small>';
      li.querySelector('.result')!.textContent = result;
      li.querySelector('.who')!.textContent = [characterById(r.character).short, r.daily ? `📅 Daily ${r.daily}` : `Late Stage ${r.stage}`].join(' · ');
      li.querySelector('.score')!.textContent = `${r.score}${r.score === best && best > 0 ? ' 👑' : ''}`;
      li.querySelector('.when')!.textContent = when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      list.append(li);
    }
    box.append(top, list);
  });
}

type CompendiumTab = 'cards' | 'relics' | 'enemies';
const CARD_ORDER = Object.values(CARDS);
const RELIC_ORDER = Object.values(RELICS);
const ENEMY_ORDER = Object.values(ENEMIES);
const compendiumSize = () => CARD_ORDER.length + RELIC_ORDER.length + ENEMY_ORDER.length;
const seenCount = () => save.seen.cards.length + save.seen.relics.length + save.seen.enemies.length;

/** Everything you've come across; the rest as silhouettes. */
function showCompendium(tab: CompendiumTab = 'cards') {
  const seen = save.seen;
  openOverlay(`📚 Compendium · ${seenCount()}/${compendiumSize()}`, (box) => {
    const tabs = h('div', 'compendium-tabs');
    const counts: Record<CompendiumTab, [string, number, number]> = {
      cards: ['🃏 Cards', seen.cards.length, CARD_ORDER.length],
      relics: ['🏺 Relics', seen.relics.length, RELIC_ORDER.length],
      enemies: ['😡 Enemies', seen.enemies.length, ENEMY_ORDER.length],
    };
    for (const id of Object.keys(counts) as CompendiumTab[]) {
      const [label, got, all] = counts[id];
      const b = button(`${label} <small>${got}/${all}</small>`, `compendium-tab${id === tab ? ' picked' : ''}`, () => showCompendium(id));
      b.setAttribute('aria-pressed', String(id === tab));
      tabs.append(b);
    }
    box.append(tabs);
    const grid = h('div', `compendium ${tab}`);
    if (tab === 'cards') {
      for (const def of CARD_ORDER) {
        if (seen.cards.includes(def.id)) {
          const el = cardEl({ uid: 0, id: def.id, up: false }, { flavor: true });
          if (def.who === 'david') el.classList.add('davids');
          grid.append(el);
        } else grid.append(h('div', `card unseen type-${def.type}`, `<span class="cost">?</span><span class="art">${def.emoji}</span><b class="name">???</b><small class="kind">${TYPE_LABEL[def.type]}</small>`));
      }
    } else if (tab === 'relics') {
      for (const r of RELIC_ORDER) {
        const known = seen.relics.includes(r.id);
        const el = h('div', `relic-entry${known ? '' : ' unseen'}`, '<span class="relic-emoji"></span><b></b><small></small>');
        el.querySelector('.relic-emoji')!.textContent = r.emoji;
        el.querySelector('b')!.textContent = known ? r.name : '???';
        el.querySelector('small')!.textContent = known ? r.text : r.tier === 'boss' ? 'A boss relic.' : r.tier === 'starter' ? 'Someone’s starting relic.' : 'Not found yet.';
        grid.append(el);
      }
    } else {
      for (const def of ENEMY_ORDER) {
        const known = seen.enemies.includes(def.id);
        const el = h('div', `enemy-entry${known ? '' : ' unseen'}${def.boss ? ' boss' : ''}`);
        const look = def.image ? friedman('mini', def.image === 'dfriedman' ? 'david' : 'milton') : h('span', 'foe-emoji', def.emoji);
        const ratiod = save.history.filter((r) => r.killer === def.id && !r.abandoned).length;
        const info = h('div', 'enemy-info', '<b></b><small class="hp"></small><i></i>');
        info.querySelector('b')!.textContent = known ? def.name : def.image ? '??? (a secret)' : '???';
        info.querySelector('.hp')!.textContent = known ? `${def.boss ? '💀 Boss · ' : ''}❤️ ${def.hp[0]}–${def.hp[1]}${ratiod ? ` · ratio’d you ${ratiod}×` : ''}` : def.boss ? '💀 Boss' : '';
        info.querySelector('i')!.textContent = known ? `“${def.intro}”` : '';
        el.append(look, info);
        grid.append(el);
      }
    }
    box.append(grid);
  });
}

function showOptions() {
  openOverlay('⚙️ Options', (box) => {
    const o = save.options;
    const form = h('div', 'options');
    const changed = () => {
      persist();
      setFry();
      music.setVolume(o.music);
      if (o.music > 0) startMusic();
      else music.stop();
    };
    const slider = (label: string, key: 'music' | 'sound') => {
      const row = h('label', 'option-row', `<span>${label}</span><input type="range" min="0" max="100" step="5"><output></output>`);
      const input = row.querySelector('input')!;
      const out = row.querySelector('output')!;
      input.value = String(Math.round(o[key] * 100));
      out.textContent = `${input.value}%`;
      input.addEventListener('input', () => {
        o[key] = Number(input.value) / 100;
        out.textContent = `${input.value}%`;
        changed();
      });
      if (key === 'sound') input.addEventListener('change', () => play('card'));
      return row;
    };
    const toggle = (label: string, hint: string, get: () => boolean, set: (v: boolean) => void) => {
      const row = h('label', 'option-row toggle', `<span>${label}<small>${hint}</small></span><input type="checkbox">`);
      const input = row.querySelector('input')!;
      input.checked = get();
      input.addEventListener('change', () => {
        set(input.checked);
        changed();
      });
      return row;
    };
    form.append(
      slider('🎵 Music', 'music'),
      slider('🔊 Sound effects', 'sound'),
      toggle('⚡ Reduce flashing', 'No red flash on Laser Eyes, no jitter when the screen’s fully deep-fried.', () => o.reduceFlashing, (v) => (o.reduceFlashing = v)),
      toggle('📳 Screen shake', 'Laser Eyes and big hits shake the screen.', () => o.shake, (v) => (o.shake = v)),
    );
    box.append(form);
    if (save.muted) box.append(h('p', 'meta', '🔇 Sound is muted (the speaker button up top). Unmute to hear any of it.'));
  });
}
els.options.addEventListener('click', showOptions);

// --- The daily run ---

function showDaily() {
  const d = dailyFor(new Date());
  const best = save.dailyBests[d.key];
  openOverlay('📅 Daily run', (box) => {
    box.append(
      h('p', 'daily-twist', `<span>${d.twist.icon}</span><b></b><small></small>`),
      h('p', '', `The same run for everyone today (${d.key}): same map, same cards, same fights.${best !== undefined ? ` Your best today: <b>${best}</b> points.` : ''}`),
    );
    box.querySelector('.daily-twist b')!.textContent = d.twist.name;
    box.querySelector('.daily-twist small')!.textContent = d.twist.description;
    const playing = save.run?.daily?.key === d.key;
    box.append(
      button(playing ? '▶ Continue today’s run' : '▶ Play today’s run', 'big-button', () => {
        if (playing) {
          closeOverlay();
          return go('run');
        }
        const start = () => {
          save.run = newRun(d.seed, { key: d.key, twist: d.twist.id });
          persist();
          closeOverlay();
          go('run');
        };
        if (!save.run) return start();
        openOverlay('Start the daily run?', (b2) => {
          b2.append(h('p', '', 'Your current run will be abandoned (it counts as a loss).'));
          b2.append(
            button('Yes, play the daily', 'big-button', () => {
              if (save.run) recordEnd(save.run, false);
              start();
            }),
            button('Keep my run', 'big-button secondary', closeOverlay),
          );
        });
      }),
    );
  });
}

// --- Sharing ---

function summaryOf(run: Run): RunSummary {
  const twist = run.daily ? twistById(run.daily.twist) : undefined;
  return {
    won: run.screen === 'won',
    score: runScore(run),
    act: run.act,
    floor: run.pos ? run.pos.row + 1 : 0,
    fights: run.stats.fights,
    damage: run.stats.damage,
    lasers: run.stats.lasers,
    deck: run.deck.length,
    stage: run.stage,
    character: characterById(run.character).short,
    beatSecret: run.secret === 'won' ? characterById(characterById(run.character).secretBoss === 'david' ? 'david' : 'milton').name : null,
    daily: run.daily && twist ? { key: run.daily.key, name: twist.name, icon: twist.icon } : null,
    url: `${location.origin}${location.pathname}`,
  };
}

async function shareResult(run: Run, status: HTMLElement) {
  const text = shareText(summaryOf(run));
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
    status.textContent = '📋 Copied! Paste it anywhere.';
  } catch {
    status.textContent = 'Couldn’t copy it. Here it is:\n' + text;
  }
  award('shared');
}

async function shareImage(run: Run, status: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const face = new Image();
  face.src = IMG('mfriedman');
  await Promise.all([face.decode().catch(() => {}), document.fonts?.load('40px Anton').catch(() => {}), document.fonts?.load('26px Oswald').catch(() => {})]);
  drawShareCard(ctx, summaryOf(run), face.naturalWidth ? face : null);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const file = new File([blob], 'just-getting-started.png', { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch {
    // fall through to a download
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'just-getting-started.png';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = '🖼️ Saved the card.';
}

/** For the one achievement that isn't about the run itself. */
function award(id: string) {
  if (save.achievements.includes(id) || !achievementById(id)) return;
  save.achievements.push(id);
  persist();
  achievementToast(id);
}

// --- After a fight ---

function renderReward(run: Run) {
  const r = run.reward!;
  const s = h('section', 'panel-screen reward-screen');
  const headline = r.kind === 'boss' ? '🏆 BOSS DEBUNKED' : r.kind === 'elite' ? '😤 Panel destroyed' : '🎙️ Argument won';
  s.append(h('h2', 'screen-title', headline), h('p', 'royalties', `💵 +${r.royalties} Royalties`));
  if (r.bossRelics.length && !r.relicTaken) {
    s.append(h('h3', '', 'Pick a boss relic'));
    const row = h('div', 'relic-row');
    for (const id of r.bossRelics) {
      const rel = relicDef(id);
      row.append(button(`<span class="relic-emoji">${rel.emoji}</span><b>${rel.name}</b><small>${rel.text}</small>`, 'relic-choice', () => {
        takeRewardRelic(run, id);
        play('buy');
        persist();
        render();
      }));
    }
    s.append(row);
  }
  if (r.relic && !r.relicTaken) {
    const rel = relicDef(r.relic);
    s.append(h('h3', '', 'A relic for your trouble'));
    s.append(button(`<span class="relic-emoji">${rel.emoji}</span><b>${rel.name}</b><small>${rel.text}</small>`, 'relic-choice', () => {
      takeRewardRelic(run);
      play('buy');
      persist();
      render();
    }));
  }
  if (!r.cardTaken) {
    s.append(h('h3', '', 'Add a card to your act'));
    const row = h('div', 'card-row');
    s.append(previewToggle(render));
    r.cards.forEach((card, i) => {
      const el = cardEl(previewed(card), { flavor: true });
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      el.addEventListener('click', () => {
        takeRewardCard(run, i);
        play('buy');
        persist();
        render();
      });
      row.append(el);
    });
    s.append(row);
  } else s.append(h('p', 'done', '✓ Card added.'));
  s.append(button(r.cardTaken || r.kind === 'boss' ? 'Continue ▶' : 'Skip the card ▶', 'big-button', () => {
    leaveReward(run);
    persist();
    render();
    window.scrollTo(0, 0);
  }));
  els.screen.append(s);
}

function renderActClear(run: Run) {
  const s = h('section', 'title-screen act-clear');
  s.append(
    h('h1', 'meme top', run.act === 1 ? 'DOOMPOSTER DEBUNKED 😔?' : 'MONEY PRINTER STOPPED 😔?'),
    friedman('big lasers-on'),
    h('h1', 'meme bottom', 'NAH, WE’RE JUST <span>GETTING STARTED 😈😤</span>'),
    button(`On to Act ${run.act + 1}: ${ACT_NAMES[run.act + 1]} ▶`, 'big-button', () => {
      nextAct(run);
      persist();
      render();
      window.scrollTo(0, 0);
    }),
  );
  els.screen.append(s);
}

function renderEnd(run: Run) {
  const won = run.screen === 'won';
  const s = h('section', `title-screen end-screen ${won ? 'won' : 'lost'}`);
  s.append(
    h('h1', 'meme top', won ? 'LATE STAGE CAPITALISM 😔' : 'RATIO’D 😔'),
    friedman(won ? 'big lasers-on' : 'big defeated', run.character),
    h('h1', 'meme bottom', won ? 'CANCELLED. <span>AGAIN. 😈😤</span>' : '<span>THE DOOMERS WIN THIS ROUND</span>'),
  );
  const other = characterById(characterById(run.character).secretBoss === 'david' ? 'david' : 'milton');
  if (run.secret === 'won') s.append(h('p', 'secret-line', `🤝 And you out-argued <b>${other.name}</b>. ${run.character === 'milton' ? 'He still thinks you didn’t go far enough.' : 'He’s proud of you. He’d never say so on air.'}`));
  if (run.secret === 'lost') s.append(h('p', 'secret-line', `🤝 ${other.name} won the argument. You still won the run. Family dinners will be interesting.`));
  if (unlockedChar) s.append(h('p', 'stage-unlocked', `🔓 <b>${characterById(unlockedChar).name}</b> is now playable: pick him on the title screen. ${characterById(unlockedChar).blurb}`));
  const st = run.stats;
  s.append(
    h(
      'p',
      'pitch',
      won
        ? 'It announced its own death one more time, and once again it was wrong. Capitalism: still not dead. You: very based.'
        : `Act ${run.act}, floor ${run.pos ? run.pos.row + 1 : 0}. The studio audience boos. Somewhere, a thread gets 40,000 likes.`,
    ),
    h('p', 'score-line', `🏆 <b>${runScore(run)}</b> points${run.stage > 1 ? ` <small>on Late Stage ${run.stage}</small>` : ''}`),
    h('p', 'meta', `${st.fights} arguments won · ${st.damage} Credibility knocked off · ${st.lasers} laser blasts · ${st.cardsPlayed} cards played · ${run.deck.length} cards in your act`),
  );
  if (run.daily) {
    const twist = twistById(run.daily.twist);
    s.append(h('p', 'meta', `📅 Daily run ${run.daily.key} · ${twist?.icon ?? ''} ${twist?.name ?? ''} · your best today: <b>${save.dailyBests[run.daily.key] ?? runScore(run)}</b>`));
  }
  if (unlockedNow) {
    const st = stageInfo(unlockedNow);
    const note = h('p', 'stage-unlocked', `🔓 <b>Late Stage ${st.n}: ${st.name}</b> is open. <span></span> It’s never over.`);
    note.querySelector('span')!.textContent = st.rule;
    s.append(note);
  }
  const status = h('p', 'share-status');
  const share = h('div', 'menu-buttons');
  share.append(
    button('📋 Share result', 'big-button secondary', () => void shareResult(run, status)),
    button('🖼️ Save image', 'big-button secondary', () => void shareImage(run, status)),
  );
  s.append(share, status);
  const buttons = h('div', 'menu-buttons');
  buttons.append(
    button('▶ New run', 'big-button', () => {
      save.run = null;
      startRun();
    }),
    button('Title screen', 'big-button secondary', () => {
      save.run = null;
      persist();
      go('title');
    }),
  );
  s.append(buttons);
  els.screen.append(s);
}

// --- Bookstore, green room, TV ---

function renderShop(run: Run) {
  const shop = run.shop!;
  const s = h('section', 'panel-screen shop-screen');
  s.append(h('h2', 'screen-title', '🛒 The Bookstore'), h('p', 'screen-sub', 'Everything has a price. That’s how you know it’s worth something.'));
  s.append(previewToggle(render));
  const row = h('div', 'card-row shop-row');
  shop.cards.forEach((item, i) => {
    const wrap = h('div', `shop-item${item.sold ? ' sold' : ''}`);
    const el = cardEl(previewed(item.card), { flavor: true });
    const price = button(item.sold ? 'Sold' : `💵 ${item.price}`, 'price', () => {
      if (buyCard(run, i)) {
        play('buy');
        persist();
        render();
      }
    }, item.sold || run.royalties < item.price);
    wrap.append(el, price);
    row.append(wrap);
  });
  s.append(row);
  const relics = h('div', 'relic-row');
  shop.relics.forEach((item, i) => {
    const rel = relicDef(item.id);
    relics.append(button(`<span class="relic-emoji">${rel.emoji}</span><b>${rel.name}</b><small>${rel.text}</small><span class="tag">${item.sold ? 'Sold' : `💵 ${item.price}`}</span>`, 'relic-choice', () => {
      if (buyRelic(run, i)) {
        play('buy');
        persist();
        render();
      }
    }, item.sold || run.royalties < item.price));
  });
  const remove = button(`<span class="relic-emoji">✂️</span><b>Cut a card</b><small>Remove a card from your act. Once per visit.</small><span class="tag">${shop.removed ? 'Done' : `💵 ${run.removeCost}`}</span>`, 'relic-choice', () => {
    pickCard(run.deck, 'Cut which card?', (card) => {
      if (removeCard(run, card.uid)) {
        play('buy');
        persist();
        render();
      }
    });
  }, shop.removed || run.royalties < run.removeCost);
  relics.append(remove);
  s.append(relics);
  s.append(button('Leave ▶', 'big-button', () => {
    leaveShop(run);
    persist();
    render();
  }));
  els.screen.append(s);
}

function renderRest(run: Run) {
  const s = h('section', 'panel-screen rest-screen');
  const heal = Math.min(run.maxHp - run.hp, Math.round(run.maxHp * restHeal(run)));
  s.append(h('h2', 'screen-title', '🛋️ The Green Room'), h('p', 'screen-sub', 'Ten minutes to air. Coffee, a pipe, and a choice.'));
  const row = h('div', 'relic-row');
  row.append(
    button(`<span class="relic-emoji">☕</span><b>Rest</b><small>Heal ${heal} Credibility.</small>`, 'relic-choice', () => {
      rest(run);
      play('heal');
      persist();
      render();
    }),
    button('<span class="relic-emoji">🎭</span><b>Rehearse</b><small>Upgrade a card.</small>', 'relic-choice', () => {
      pickCard(run.deck.filter((c) => canUpgrade(c.id, c.up)), 'Rehearse which card?', (card) => {
        if (rehearse(run, card.uid)) {
          play('buy');
          persist();
          render();
        }
      }, true);
    }, !run.deck.some((c) => canUpgrade(c.id, c.up))),
  );
  s.append(row);
  els.screen.append(s);
}

function renderEvent(run: Run) {
  const ev = eventById(run.event!.id)!;
  const s = h('section', 'panel-screen event-screen');
  const art = h('div', 'event-art');
  if (ev.image) {
    const img = h('img');
    img.src = IMG(ev.image);
    img.alt = '';
    art.append(img);
  } else art.textContent = ev.emoji;
  s.append(art, h('h2', 'screen-title', `📺 ${ev.title}`));
  const text = h('p', 'event-text');
  text.textContent = ev.text;
  s.append(text);
  if (run.event!.result === null) {
    const choices = h('div', 'choices');
    ev.choices.forEach((ch, i) => {
      const open = choiceOpen(run, ch.needs);
      choices.append(button(`<b></b><small></small>`, 'choice', () => {
        if (chooseEvent(run, i)) {
          play('card');
          persist();
          render();
        }
      }, !open));
      const b = choices.lastElementChild!;
      b.querySelector('b')!.textContent = ch.label;
      b.querySelector('small')!.textContent = open ? ch.detail : `${ch.detail} (not enough Credibility)`;
    });
    s.append(choices);
  } else {
    const result = h('p', 'event-result');
    result.textContent = run.event!.result;
    s.append(result, button('Continue ▶', 'big-button', () => {
      leaveEvent(run);
      persist();
      render();
    }));
  }
  els.screen.append(s);
}

// ---------------------------------------------------------------------------
// Overlays: the deck, picking a card
// ---------------------------------------------------------------------------

let overlayClosable = true;

function openOverlay(title: string, fill: (box: HTMLElement) => void, closable = true) {
  overlayClosable = closable;
  els.overlay.replaceChildren();
  const box = h('div', 'overlay-box');
  box.append(h('h2', 'screen-title', title));
  fill(box);
  if (closable) box.append(button('Close', 'close-button', closeOverlay));
  els.overlay.append(box);
  els.overlay.hidden = false;
}

function closeOverlay() {
  els.overlay.hidden = true;
  els.overlay.replaceChildren();
}
els.overlay.addEventListener('click', (e) => {
  if (e.target === els.overlay && overlayClosable) closeOverlay();
});

function showCards(cards: Card[], title: string) {
  openOverlay(title, (box) => {
    if (!cards.length) box.append(h('p', '', 'Empty.'));
    const row = h('div', 'card-grid');
    const fill = () => row.replaceChildren(...cards.map((card) => cardEl(previewed(card), { flavor: true })));
    if (cards.some((c) => canUpgrade(c.id, c.up))) box.append(previewToggle(fill));
    fill();
    box.append(row);
  });
}

/** Whether card lists show what each card becomes upgraded (rewards, the bookstore, the deck). */
let previewUp = false;
const previewed = (card: Card): Card => (previewUp && canUpgrade(card.id, card.up) ? { ...card, up: true } : card);

function previewToggle(redraw: () => void): HTMLButtonElement {
  const b = button(`👁️ Preview upgrades: <b>${previewUp ? 'on' : 'off'}</b>`, 'preview-toggle', () => {
    previewUp = !previewUp;
    b.innerHTML = `👁️ Preview upgrades: <b>${previewUp ? 'on' : 'off'}</b>`;
    b.setAttribute('aria-pressed', String(previewUp));
    redraw();
  });
  b.setAttribute('aria-pressed', String(previewUp));
  b.dataset.tip = 'Shows what each card does once upgraded (in the green room, or when you find a + card). You still get the card as it is.';
  return b;
}

function pickCard(cards: Card[], title: string, onPick: (card: Card) => void, showUpgrade = false) {
  openOverlay(title, (box) => {
    const row = h('div', 'card-grid');
    for (const card of cards) {
      const el = cardEl(showUpgrade ? { ...card, up: true } : card, { flavor: !showUpgrade });
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      el.addEventListener('click', () => {
        closeOverlay();
        onPick(card);
      });
      row.append(el);
    }
    box.append(row);
  });
}

// ---------------------------------------------------------------------------
// Keys, start
// ---------------------------------------------------------------------------

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!els.overlay.hidden && overlayClosable) return closeOverlay();
    if (selected !== null) {
      selected = null;
      render();
    }
    return;
  }
  const run = save.run;
  const c = run?.combat;
  if (view !== 'run' || !c || run.screen !== 'combat' || !els.overlay.hidden || busy || e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^[1-9]$/.test(e.key)) {
    const i = Number(e.key) - 1;
    if (selected !== null && c.enemies.filter((x) => !x.dead).length > 1) {
      // With a card picked, the number keys pick the target instead (1 = leftmost enemy standing).
      const standing = c.enemies.map((x, k) => (x.dead ? -1 : k)).filter((k) => k >= 0);
      if (standing[i] === undefined) return;
      const pick = selected;
      selected = null;
      act(() => playCard(c, pick, standing[i]));
      return;
    }
    if (c.hand[i]) clickCard(c, i);
  } else if (e.key === 'e' || e.key === 'E') {
    selected = null;
    act(() => endTurn(c), { enemyTurn: true });
  } else if (e.key === 'l' || e.key === 'L') {
    if (laserReady(c)) act(() => fireLaser(c));
  }
});

els.home.addEventListener('click', () => go('title'));

render();

// ?debug: poke at the run from the console.
if (new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, { jgs: { save, render, act, go, ACTS } });
}
