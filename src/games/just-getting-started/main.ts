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
  nextAct, nodeAt, reachable, rehearse, removeCard, rest, REST_HEAL, ROWS, type Run, takeRewardCard, takeRewardRelic,
} from './run.ts';
import { BASED_MAX, type Card, type Combat, type Fx, type Status } from './state.ts';

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

interface Meta {
  runs: number;
  wins: number;
  bestAct: number;
  bestFloor: number;
  lasers: number;
}

interface Save {
  muted: boolean;
  run: Run | null;
  meta: Meta;
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
  },
};
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

document.addEventListener('pointerdown', () => void getAudioContext().resume().catch(() => {}), { once: true });
const sweep = (from: number, to: number, duration: number, volume = 0.06, wave: OscillatorType = 'sawtooth'): Tone => ({
  wave,
  duration,
  frequency: [[0, from], [duration, to, 'exp']],
  gain: [[0, volume], [duration, 0.001, 'exp']],
});
const SOUNDS = {
  card: () => playTone(note(660, 0.06, 0.04, 'triangle')),
  hit: () => playTone(sweep(220, 80, 0.12, 0.08, 'square')),
  hurt: () => playTone(sweep(160, 50, 0.2, 0.09, 'sawtooth')),
  block: () => playTone(note(1200, 0.05, 0.035, 'triangle')),
  heal: () => [523, 659, 784].forEach((hz, i) => playTone(note(hz, 0.09, 0.04, 'triangle'), i * 0.06)),
  laser: () => {
    playTone(sweep(180, 2400, 0.5, 0.07));
    playTone(sweep(2400, 300, 0.6, 0.05, 'square'), 0.45);
  },
  win: () => [392, 523, 659, 784, 1047].forEach((hz, i) => playTone(note(hz, 0.14, 0.05), i * 0.09)),
  lose: () => [392, 330, 262, 196].forEach((hz, i) => playTone(note(hz, 0.22, 0.05, 'sawtooth'), i * 0.16)),
  buy: () => [880, 1320].forEach((hz, i) => playTone(note(hz, 0.08, 0.04, 'triangle'), i * 0.07)),
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
});
renderMute();

// ---------------------------------------------------------------------------
// Shared bits: Friedman, cards, relics, statuses
// ---------------------------------------------------------------------------

const ACT_NAMES: Record<number, string> = { 1: 'The Doomscroll', 2: 'The Money Printer', 3: 'Late Stage' };

/** Friedman, deep-fried, with laser eyes that glow brighter as the Based meter fills. */
function friedman(className = ''): HTMLElement {
  const el = h('div', `friedman ${className}`);
  const img = h('img');
  img.src = IMG('mfriedman');
  img.alt = 'Milton Friedman, with glowing red laser eyes';
  img.draggable = false;
  el.append(img, h('span', 'eye l'), h('span', 'eye r'), h('span', 'beam l'), h('span', 'beam r'));
  return el;
}

const TYPE_LABEL: Record<string, string> = { argument: 'Argument', rebuttal: 'Rebuttal', principle: 'Principle', status: 'Status', curse: 'Curse' };

function cardEl(card: Card, opts: { cost?: number | null; playable?: boolean; selected?: boolean; flavor?: boolean } = {}): HTMLElement {
  const def = cardDef(card.id);
  const cost = opts.cost !== undefined ? opts.cost : def.cost === null ? null : card.up && def.upCost !== undefined ? def.upCost : def.cost;
  const el = h('div', `card type-${def.type} rarity-${def.rarity}${card.up ? ' upgraded' : ''}${opts.playable === false ? ' unplayable' : ''}${opts.selected ? ' selected' : ''}`);
  el.innerHTML = `
    <span class="cost">${cost === null ? '✕' : cost}</span>
    <span class="art">${def.emoji}</span>
    <b class="name"></b>
    <small class="kind">${TYPE_LABEL[def.type]}</small>
    <span class="text">${def.text(card.up)}</span>
    ${opts.flavor && def.flavor ? `<i class="flavor"></i>` : ''}`;
  el.querySelector('.name')!.textContent = cardName(card.id, card.up);
  if (opts.flavor && def.flavor) el.querySelector('.flavor')!.textContent = def.flavor;
  return el;
}

function relicEl(id: string, extra = ''): HTMLElement {
  const r = relicDef(id);
  const el = h('span', `relic ${extra}`, r.emoji);
  el.title = `${r.name}: ${r.text}`;
  el.setAttribute('aria-label', el.title);
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
};

function statusRow(status: Partial<Record<Status, number>>): HTMLElement {
  const row = h('div', 'statuses');
  for (const [id, n] of Object.entries(status) as [Status, number][]) {
    if (!n) continue;
    const [emoji, text] = STATUS_INFO[id];
    const chip = h('span', 'status', `${emoji}<b>${n}</b>`);
    chip.title = text;
    row.append(chip);
  }
  return row;
}

function bar(hp: number, max: number, block: number): HTMLElement {
  const el = h('div', 'hp');
  el.innerHTML = `<div class="bar"><i style="width:${Math.max(0, (hp / max) * 100)}%"></i><span>${hp} / ${max}</span></div>${block ? `<span class="block" title="Composure: blocks damage until your next turn">🛡️${block}</span>` : ''}`;
  return el;
}

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
  const hp = run.combat ? run.combat.player.hp : run.hp;
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
}

/** How deep-fried the screen is: the Based meter, plus a bit more each act. */
function setFry() {
  const run = save.run;
  const based = run?.combat?.based ?? run?.based ?? 0;
  const stage = view === 'title' ? 2 : Math.min(4, Math.floor(based / 25));
  els.app.className = `fry-${stage} act-${run && view !== 'title' ? run.act : 0}`;
  els.app.style.setProperty('--based', String(view === 'title' ? 1 : based / BASED_MAX));
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
  setFry();
  renderHud();
  els.screen.replaceChildren();
  const run = save.run;
  if (view === 'title' || !run) return renderTitle();
  switch (run.screen) {
    case 'map':
      return renderMap(run);
    case 'combat':
      return renderCombat(run.combat!);
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
  buttons.append(button('📖 How to play', 'big-button secondary', showHowTo));
  buttons.append(button('💾 Save &amp; load', 'big-button secondary', () => openSaveTransfer('just-getting-started')));
  s.append(buttons);
  if (save.meta.runs) {
    const best = save.meta.wins ? `${save.meta.wins} win${save.meta.wins === 1 ? '' : 's'}` : `best: Act ${save.meta.bestAct}, floor ${save.meta.bestFloor}`;
    s.append(h('p', 'meta', `${save.meta.runs} run${save.meta.runs === 1 ? '' : 's'} · ${best} · ${save.meta.lasers} laser blasts`));
  }
  els.screen.append(s);
}

function go(to: 'title' | 'run') {
  view = to;
  selected = null;
  render();
  window.scrollTo(0, 0);
}

function startRun() {
  save.run = newRun((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
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

function renderCombat(c: Combat) {
  const s = h('section', 'combat-screen');
  const arena = h('div', 'arena');
  const me = h('div', 'player-side');
  me.dataset.target = 'player';
  const portrait = friedman(c.based >= BASED_MAX ? 'ready' : '');
  me.append(portrait, bar(c.player.hp, c.player.maxHp, c.player.block), statusRow(c.player.status));
  const foes = h('div', 'foes');
  c.enemies.forEach((e, i) => {
    if (e.dead) return;
    const def = enemyDef(e.id);
    const { move, damage } = intentOf(c, e);
    const foe = h('div', `foe${def.boss ? ' boss' : ''}${selected !== null ? ' targetable' : ''}`);
    foe.dataset.target = String(e.uid);
    const intent = h('div', `intent intent-${move.intent}`, `${INTENT_ICON[move.intent]}${move.also ? INTENT_ICON[move.also] : ''}${damage ? `<b>${damage}</b>` : ''}`);
    intent.title = `Next: ${move.name}`;
    const name = h('b', 'foe-name');
    name.textContent = def.name;
    foe.append(intent, h('small', 'move-name', ''), h('div', 'foe-emoji', def.emoji), name, bar(e.hp, e.maxHp, e.block), statusRow(e.status));
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
  energy.title = 'Airtime: spend it to play cards';
  const based = h('div', 'based');
  based.innerHTML = `<div class="based-bar"><i style="width:${(c.based / BASED_MAX) * 100}%"></i><span>BASED ${Math.floor(c.based)}%</span></div>`;
  const laser = button('🔴 LASER EYES', `laser-button${laserReady(c) ? ' ready' : ''}`, () => !busy && act(() => fireLaser(c)), !laserReady(c));
  laser.title = 'Fill the Based meter, then fire: damage to every enemy, and the Inflation in your hand burns up.';
  based.append(laser);
  const piles = h('div', 'piles');
  piles.append(
    button(`🂠 <b>${c.draw.length}</b>`, 'pile', () => showCards([...c.draw].sort((a, b) => a.id.localeCompare(b.id)), 'Draw pile (in no particular order)')),
    button(`🗑️ <b>${c.discard.length}</b>`, 'pile', () => showCards(c.discard, 'Discard pile')),
  );
  if (c.exhausted.length) piles.append(button(`🔥 <b>${c.exhausted.length}</b>`, 'pile', () => showCards(c.exhausted, 'Exhausted (gone for this fight)')));
  (piles.children[0] as HTMLElement).title = 'Draw pile';
  (piles.children[1] as HTMLElement).title = 'Discard pile';
  const end = button('End turn ▶', 'end-turn', () => {
    if (busy) return;
    selected = null;
    act(() => endTurn(c));
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

/** Runs a move, saves, redraws, and plays what happened. Ends the fight when it's over. */
function act(move: () => unknown) {
  const run = save.run;
  if (!run) return;
  move();
  const c = run.combat;
  const fx = c ? c.fx.splice(0) : [];
  play('card');
  persist();
  render();
  playFx(fx);
  if (c?.result && !busy) {
    busy = true;
    window.setTimeout(() => {
      busy = false;
      finishCombat(run);
      if (run.screen === 'lost' || run.screen === 'won') {
        recordEnd(run, run.screen === 'won');
        play(run.screen === 'won' ? 'win' : 'lose');
      } else play('win');
      persist();
      render();
      window.scrollTo(0, 0);
    }, c.result === 'won' ? 1000 : 1400);
  }
}

/** Shows what happened: numbers flying off, shakes, speech, the laser. */
function playFx(fx: Fx[]) {
  const targetEl = (t: 'player' | number) => els.screen.querySelector<HTMLElement>(`[data-target="${t}"]`);
  const float = (t: 'player' | number, text: string, cls: string) => {
    const el = targetEl(t);
    if (!el) return;
    const f = h('span', `float ${cls}`, text);
    f.style.left = `${35 + Math.random() * 30}%`;
    el.append(f);
    window.setTimeout(() => f.remove(), 1100);
  };
  fx.forEach((e, k) =>
    window.setTimeout(() => {
      switch (e.kind) {
        case 'damage': {
          if (!e.amount && !e.blocked) return;
          float(e.target, e.amount ? `−${e.amount}` : `🛡️${e.blocked}`, e.amount ? 'dmg' : 'blocked');
          const el = targetEl(e.target);
          el?.classList.remove('hit');
          void el?.offsetWidth;
          el?.classList.add('hit');
          play(e.target === 'player' ? 'hurt' : 'hit');
          break;
        }
        case 'block':
          float(e.target, `+${e.amount}🛡️`, 'blk');
          play('block');
          break;
        case 'heal':
          float(e.target, `+${e.amount}❤️`, 'heal');
          play('heal');
          break;
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
    }, k * 90),
  );
}

function recordEnd(run: Run, won: boolean) {
  const m = save.meta;
  m.runs++;
  if (won) m.wins++;
  const floor = run.pos ? run.pos.row + 1 : 0;
  if (run.act > m.bestAct || (run.act === m.bestAct && floor > m.bestFloor)) {
    m.bestAct = run.act;
    m.bestFloor = floor;
  }
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
    r.cards.forEach((card, i) => {
      const el = cardEl(card, { flavor: true });
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
    friedman(won ? 'big lasers-on' : 'big defeated'),
    h('h1', 'meme bottom', won ? 'CANCELLED. <span>AGAIN. 😈😤</span>' : '<span>THE DOOMERS WIN THIS ROUND</span>'),
  );
  const st = run.stats;
  s.append(
    h(
      'p',
      'pitch',
      won
        ? 'It announced its own death one more time, and once again it was wrong. Capitalism: still not dead. You: very based.'
        : `Act ${run.act}, floor ${run.pos ? run.pos.row + 1 : 0}. The studio audience boos. Somewhere, a thread gets 40,000 likes.`,
    ),
    h('p', 'meta', `${st.fights} arguments won · ${st.damage} Credibility knocked off · ${st.lasers} laser blasts · ${st.cardsPlayed} cards played · ${run.deck.length} cards in your act`),
  );
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
  const row = h('div', 'card-row shop-row');
  shop.cards.forEach((item, i) => {
    const wrap = h('div', `shop-item${item.sold ? ' sold' : ''}`);
    const el = cardEl(item.card, { flavor: true });
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
  const heal = Math.min(run.maxHp - run.hp, Math.round(run.maxHp * REST_HEAL));
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
    for (const card of cards) row.append(cardEl(card, { flavor: true }));
    box.append(row);
  });
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
    act(() => endTurn(c));
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
