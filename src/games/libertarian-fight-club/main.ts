import './style.css';
import { getAudioContext, note, playTone } from '../../shared/audio.ts';
import { spawnText } from '../../shared/effects.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import { ARG_TYPES, FACTIONS, factionById, makeRoster, normalizeRoster, traitById, type Faction, type Lobster } from './lobsters.ts';
import { argTypesOf, houseOdds, pickBout, revealedSides, ROUNDS, simulate, weighIn, type FightEvent, type FightResult, type Side } from './fight.ts';

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const els = {
  bankroll: byId('bankroll'),
  bout: byId('bout-number'),
  cards: [byId('card-0'), byId('card-1')] as const,
  fighters: [byId('fighter-0'), byId('fighter-1')] as const,
  round: byId('round'),
  result: byId('result'),
  arena: byId('arena'),
  stake: byId<HTMLInputElement>('stake'),
  bets: [byId<HTMLButtonElement>('bet-0'), byId<HTMLButtonElement>('bet-1')] as const,
  watch: byId<HTMLButtonElement>('watch'),
  betRow: document.querySelector<HTMLElement>('.bets')!,
  stakeRow: document.querySelector<HTMLElement>('.stake')!,
  after: document.querySelector<HTMLElement>('.after')!,
  skip: byId<HTMLButtonElement>('skip'),
  next: byId<HTMLButtonElement>('next'),
  log: byId('log'),
  title: byId('title'),
  chart: byId('chart'),
  chartBody: byId('chart-body'),
  mute: byId<HTMLButtonElement>('mute'),
  toasts: byId('toasts'),
  spectators: [...document.querySelectorAll<HTMLElement>('.spectator')],
};

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

interface Save {
  bankroll: number;
  best: number;
  bouts: number;
  roster: Lobster[];
  muted: boolean;
}

const START_BANKROLL = 500;
const slot = createSaveSlot<Save>({ game: 'libertarian-fight-club', version: 1 });
const saved = slot.load();
const save: Save = {
  bankroll: Math.max(0, Math.floor(Number(saved?.bankroll ?? START_BANKROLL) || 0)),
  best: Math.max(START_BANKROLL, Math.floor(Number(saved?.best) || 0)),
  bouts: Math.max(0, Math.floor(Number(saved?.bouts) || 0)),
  roster: normalizeRoster(saved?.roster) ?? makeRoster(Math.random),
  muted: saved?.muted === true,
};
const persist = () => slot.save(save);

// ---------------------------------------------------------------------------
// Sound
// ---------------------------------------------------------------------------

const sfx = {
  hit: (effect: number) => playTone({ wave: 'sawtooth', duration: 0.14, frequency: [[0, effect > 1 ? 220 : effect < 1 ? 110 : 160], [0.14, 40, 'exp']], gain: [[0, 0.1], [0.14, 0.005, 'exp']] }),
  crit: () => [880, 1320].forEach((hz, i) => playTone(note(hz, 0.08, 0.06, 'square'), i * 0.05)),
  miss: () => playTone({ wave: 'triangle', duration: 0.25, frequency: [[0, 500], [0.25, 200, 'exp']], gain: [[0, 0.06], [0.25, 0.001, 'exp']] }),
  bell: () => [1568, 1568].forEach((hz, i) => playTone(note(hz, 0.25, 0.05, 'sine'), i * 0.18)),
  ko: () => playTone({ wave: 'square', duration: 0.6, frequency: [[0, 300], [0.6, 50, 'exp']], gain: [[0, 0.1], [0.6, 0.001, 'exp']] }),
  win: () => [523, 659, 784, 1047].forEach((hz, i) => playTone(note(hz, 0.12, 0.06, 'square'), i * 0.09)),
  lose: () => [392, 330, 262].forEach((hz, i) => playTone(note(hz, 0.2, 0.06, 'triangle'), i * 0.15)),
  coin: () => playTone(note(1319, 0.08, 0.05, 'triangle')),
  reveal: () => [660, 990].forEach((hz, i) => playTone(note(hz, 0.1, 0.05, 'triangle'), i * 0.08)),
};

function play<K extends keyof typeof sfx>(name: K, ...args: Parameters<(typeof sfx)[K]>) {
  // Skipping to the result: only the result's own sounds.
  if (skipping && name !== 'win' && name !== 'lose') return;
  if (!save.muted) (sfx[name] as (...a: unknown[]) => void)(...args);
}

els.mute.textContent = save.muted ? '🔇' : '🔊';
els.mute.addEventListener('click', () => {
  save.muted = !save.muted;
  els.mute.textContent = save.muted ? '🔇' : '🔊';
  persist();
});

// ---------------------------------------------------------------------------
// Drawing: the lobsters and the tale of the tape
// ---------------------------------------------------------------------------

/** A lobster from above, facing right, in its faction's colors. */
function lobsterSvg(f: Faction): string {
  const s = f.color;
  const a = f.accent;
  return `<svg viewBox="0 0 220 130" aria-hidden="true">
  <g stroke="rgba(0,0,0,0.45)" stroke-width="2" stroke-linejoin="round">
    <path d="M168 58 Q 198 38 218 6 M168 72 Q 198 92 218 124" fill="none" stroke="${a}" stroke-width="2"/>
    <path d="M116 50 L104 26 M128 47 L120 20 M140 47 L138 20 M116 80 L104 104 M128 83 L120 110 M140 83 L138 110" stroke="${s}" stroke-width="5" stroke-linecap="round"/>
    <path d="M152 52 Q 164 30 180 26 M152 78 Q 164 100 180 104" fill="none" stroke="${s}" stroke-width="9" stroke-linecap="round"/>
    <path d="M176 14 Q 214 8 214 26 Q 206 22 194 26 Q 206 32 212 38 Q 196 46 176 36 Z" fill="${s}"/>
    <path d="M176 116 Q 214 122 214 104 Q 206 108 194 104 Q 206 98 212 92 Q 196 84 176 94 Z" fill="${s}"/>
    <path d="M8 50 L36 60 L36 70 L8 80 Q 0 65 8 50 Z" fill="${s}"/>
    <ellipse cx="48" cy="65" rx="13" ry="15" fill="${s}"/>
    <ellipse cx="66" cy="65" rx="13" ry="17" fill="${s}"/>
    <ellipse cx="84" cy="65" rx="13" ry="18" fill="${s}"/>
    <ellipse cx="102" cy="65" rx="13" ry="19" fill="${s}"/>
    <ellipse cx="136" cy="65" rx="34" ry="21" fill="${s}"/>
    <path d="M110 65 Q 136 54 162 65 Q 136 76 110 65 Z" fill="${a}" opacity="0.55" stroke="none"/>
    <ellipse cx="166" cy="65" rx="10" ry="12" fill="${s}"/>
    <circle cx="169" cy="58" r="3.5" fill="#111" stroke="none"/>
    <circle cx="169" cy="72" r="3.5" fill="#111" stroke="none"/>
  </g>
</svg>`;
}

const pips = (n: number, max = 10) => `<span class="pips">${'▮'.repeat(Math.round(n))}<i>${'▮'.repeat(Math.max(0, max - Math.round(n)))}</i></span>`;
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function renderCard(side: Side) {
  const l = bout.lobsters[side];
  const f = factionById(l.faction);
  const trait = traitById(l.trait);
  const types = argTypesOf(l).map((t) => `<span title="${ARG_TYPES[t].name}">${ARG_TYPES[t].icon}</span>`).join('');
  const form = l.form.length ? l.form.map((r) => `<i class="${r}">${r}</i>`).join('') : '<em>no fights yet</em>';
  els.cards[side].style.setProperty('--shell', f.color);
  els.cards[side].style.setProperty('--accent', f.accent);
  els.cards[side].innerHTML = `
    <div class="card-head"><span class="badge">${f.icon}</span><div><b>${escapeHtml(l.name)}</b><small>${f.name} · ${l.weight} lb</small></div></div>
    <div class="record">${l.wins}–${l.losses} <span class="form">${form}</span></div>
    <dl class="stats">
      <dt>Claw</dt><dd>${pips(l.claw)}</dd>
      <dt>Shell</dt><dd>${pips(l.shell)}</dd>
      <dt>Wits</dt><dd>${pips(l.wits)}</dd>
      <dt>Stamina</dt><dd><b>${l.stamina}</b></dd>
    </dl>
    <div class="args"><span class="label">Argues with</span> <span class="types">${types}</span></div>
    <div class="args"><span class="label">Weak to</span> <b class="weak">${ARG_TYPES[f.weak].icon} ${ARG_TYPES[f.weak].name}</b></div>
    <div class="args"><span class="label">Shrugs off</span> <b class="resist">${ARG_TYPES[f.resists].icon} ${ARG_TYPES[f.resists].name}</b></div>
    <div class="trait" title="${l.traitKnown ? escapeHtml(trait.description) : 'Watch it fight to find out'}"><span class="label">Trait</span> ${l.traitKnown ? `<b>${trait.name}</b>` : '<b class="unknown">???</b>'}</div>`;
}

function renderChart() {
  const head = `<tr><th></th>${(Object.keys(ARG_TYPES) as (keyof typeof ARG_TYPES)[]).map((t) => `<th title="${ARG_TYPES[t].name}">${ARG_TYPES[t].icon}<small>${ARG_TYPES[t].name}</small></th>`).join('')}<th>Argues with</th></tr>`;
  const rows = FACTIONS.map((f) => {
    const cells = (Object.keys(ARG_TYPES) as (keyof typeof ARG_TYPES)[]).map((t) => (t === f.weak ? '<td class="weak">×1.5</td>' : t === f.resists ? '<td class="resist">×0.65</td>' : '<td>·</td>')).join('');
    const moves = f.moves.map((m) => `${ARG_TYPES[m.type].icon} ${escapeHtml(m.name)}`).join('<br>');
    return `<tr><th>${f.icon} ${f.name}</th>${cells}<td class="moves">${moves}</td></tr>`;
  }).join('');
  els.chartBody.innerHTML = `<p class="chart-note">How much each kind of argument hurts each faction:</p><table>${head}${rows}</table>`;
}

// ---------------------------------------------------------------------------
// Bouts
// ---------------------------------------------------------------------------

type Phase = 'betting' | 'fighting' | 'done';

interface Bout {
  lobsters: [Lobster, Lobster];
  odds: [number, number];
  ids: [number, number];
}

let phase: Phase = 'betting';
let bout: Bout;
let lastPair: [number, number] | null = null;
let bet: { side: Side; stake: number } | null = null;

function newBout() {
  const ids = pickBout(save.roster.length, Math.random, lastPair);
  lastPair = ids;
  const lobsters: [Lobster, Lobster] = [save.roster[ids[0]], save.roster[ids[1]]];
  bout = { lobsters, odds: houseOdds(lobsters[0], lobsters[1]), ids };
  phase = 'betting';
  bet = null;
  els.bout.textContent = String(save.bouts + 1);
  els.round.textContent = '';
  els.result.hidden = true;
  for (const side of [0, 1] as Side[]) {
    renderCard(side);
    const f = factionById(lobsters[side].faction);
    const el = els.fighters[side];
    el.className = `fighter ${side === 0 ? 'left' : 'right'}`;
    el.style.setProperty('--shell', f.color);
    el.querySelector('.lobster')!.innerHTML = `<span class="badge">${f.icon}</span>${lobsterSvg(f)}`;
    setHp(side, lobsters[side].stamina, lobsters[side].stamina);
    el.querySelector<HTMLElement>('.say')!.hidden = true;
    els.bets[side].innerHTML = `Bet on <b>${escapeHtml(lobsters[side].name)}</b> <span>${bout.odds[side].toFixed(2)}×</span>`;
  }
  els.betRow.hidden = false;
  els.stakeRow.hidden = false;
  // Lost some? Don't leave a stake you can't cover.
  if (stake() > save.bankroll) els.stake.value = String(save.bankroll);
  els.after.hidden = true;
  updateBankroll();
  log(`🔔 Bout ${save.bouts + 1}: ${lobsters[0].name} (${factionById(lobsters[0].faction).name}) vs ${lobsters[1].name} (${factionById(lobsters[1].faction).name}). The house says ${bout.odds[0].toFixed(2)}× / ${bout.odds[1].toFixed(2)}×.`, 'bell');
}

function setHp(side: Side, hp: number, max: number) {
  const el = els.fighters[side].querySelector('.hp')!;
  const pct = Math.max(0, (hp / max) * 100);
  (el.querySelector('i') as HTMLElement).style.width = `${pct}%`;
  el.classList.toggle('low', pct < 30);
  el.querySelector('span')!.textContent = `${hp}`;
}

function updateBankroll() {
  els.bankroll.textContent = money(save.bankroll);
  els.bankroll.classList.toggle('broke', save.bankroll < 10);
}

const money = (n: number) => `$${Math.floor(n).toLocaleString('en-US')}`;

function log(text: string, kind = '') {
  const div = document.createElement('div');
  div.className = kind ? `log-entry log-${kind}` : 'log-entry';
  div.textContent = text;
  els.log.prepend(div);
  while (els.log.children.length > 60) els.log.lastChild!.remove();
}

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

// ---------------------------------------------------------------------------
// Betting
// ---------------------------------------------------------------------------

function stake(): number {
  return Math.floor(Number(els.stake.value) || 0);
}

for (const b of document.querySelectorAll<HTMLButtonElement>('.chips button')) {
  b.addEventListener('click', () => {
    const add = b.dataset.add!;
    if (add === 'max') els.stake.value = String(save.bankroll);
    else if (add === 'clear') els.stake.value = '0';
    else els.stake.value = String(Math.min(save.bankroll, stake() + Number(add)));
  });
}

function placeBet(side: Side | null) {
  if (phase !== 'betting') return;
  getAudioContext();
  if (side !== null) {
    const amount = stake();
    if (amount < 10) {
      log('The minimum stake is $10. Even the free market has standards.', 'warn');
      return;
    }
    if (amount > save.bankroll) {
      log('You don’t have the capital for that.', 'warn');
      return;
    }
    bet = { side, stake: amount };
    save.bankroll -= amount;
    updateBankroll();
    play('coin');
    log(`💵 You put ${money(amount)} on ${bout.lobsters[side].name} at ${bout.odds[side].toFixed(2)}×.`, 'bet');
  } else {
    log('👀 You keep your money in your pocket and watch.', '');
  }
  persist();
  void fight();
}

els.bets[0].addEventListener('click', () => placeBet(0));
els.bets[1].addEventListener('click', () => placeBet(1));
els.watch.addEventListener('click', () => placeBet(null));

// ---------------------------------------------------------------------------
// The fight, played back
// ---------------------------------------------------------------------------

const EFFECT_TEXT = (e: number) => (e > 1 ? 'IT’S SUPER EFFECTIVE!' : e < 1 ? 'Not very effective…' : '');
const SHOUTS = ['OTHER LIBERTARIANS LMAO', 'TAXATION IS THEFT!', 'GET HIM!', 'THAT’S NOT REAL LIBERTARIANISM!', 'READ MISES!', 'WHO WILL BUILD THE ROADS?', 'FINISH HIM!', 'NAP VIOLATION!', 'MY MONEY!'];

let skipping = false;
const sleep = (ms: number) => (skipping ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms)));

function shout(text = SHOUTS[Math.floor(Math.random() * SHOUTS.length)]) {
  const s = els.spectators[Math.floor(Math.random() * els.spectators.length)];
  const el = s.querySelector<HTMLElement>('.shout')!;
  el.textContent = text;
  s.classList.remove('shouting');
  void s.offsetWidth;
  s.classList.add('shouting');
}

function say(side: Side, text: string) {
  if (skipping) return;
  const el = els.fighters[side].querySelector<HTMLElement>('.say')!;
  el.textContent = text;
  el.hidden = false;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}

function floatText(side: Side, text: string, color: string, big = false) {
  if (skipping) return;
  const el = els.fighters[side];
  spawnText({ text, className: `fc-floater${big ? ' big' : ''}`, x: '50%', y: '10%', parent: el, ttl: 1100, style: { color } });
}

function pulse(el: HTMLElement, cls: string) {
  if (skipping && cls !== 'revealed') return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

async function showEvent(e: FightEvent) {
  const name = (side: Side) => bout.lobsters[side].name;
  switch (e.type) {
    case 'weigh-in': {
      const t = traitById(e.trait);
      log(`⚖️ At the weigh-in, ${name(e.side)} looks ${e.trait === 'pre-cooked' ? 'suspiciously steamed' : e.trait === 'molting' ? 'soft (molting)' : 'hungry'}: ${t.description}`, 'trait');
      revealTrait(e.side);
      const full = weighIn(bout.lobsters[e.side]).stamina;
      setHp(e.side, full, full);
      await sleep(600);
      break;
    }
    case 'round':
      play('bell');
      els.round.textContent = `ROUND ${e.round}`;
      pulse(els.round, 'show');
      log(`— Round ${e.round} —`, 'round');
      shout();
      await sleep(900);
      break;
    case 'argue': {
      const other: Side = e.side === 0 ? 1 : 0;
      say(e.side, `${ARG_TYPES[e.move.type].icon} “${e.move.name}”`);
      pulse(els.fighters[e.side], 'lunge');
      await sleep(260);
      pulse(els.fighters[other], 'hit');
      play('hit', e.effect);
      if (e.crit) play('crit');
      setHp(other, e.hp[other], weighIn(bout.lobsters[other]).stamina);
      floatText(other, `-${e.damage}${e.crit ? '!' : ''}`, e.effect > 1 ? '#ff5252' : e.effect < 1 ? '#b0bec5' : '#ffeb3b', e.crit || e.effect > 1);
      const flavor = [EFFECT_TEXT(e.effect), e.crit ? 'CRITICAL MARKET CORRECTION!' : ''].filter(Boolean).join(' ');
      log(`${name(e.side)}: “${e.move.name}” ${ARG_TYPES[e.move.type].icon} → ${name(other)} −${e.damage}. ${flavor}`, e.effect > 1 || e.crit ? 'big' : '');
      if (e.crit || e.effect > 1) shout();
      await sleep(700);
      break;
    }
    case 'miss':
      say(e.side, `${ARG_TYPES[e.move.type].icon} “${e.move.name}”`);
      pulse(els.fighters[e.side], 'lunge');
      play('miss');
      floatText(e.side === 0 ? 1 : 0, 'STRAWMANNED!', '#90caf9');
      log(`${name(e.side)} tries “${e.move.name}”, but it’s a strawman. Missed!`, 'miss');
      await sleep(650);
      break;
    case 'trait': {
      const t = traitById(e.trait);
      play('reveal');
      log(`🔍 Trait revealed: ${name(e.side)} is a ${t.name}! ${t.description}`, 'trait');
      if (e.trait === 'lazy') say(e.side, '📖 *reads Rothbard instead*');
      revealTrait(e.side);
      await sleep(500);
      break;
    }
    case 'flee':
      pulse(els.fighters[e.side], 'flee');
      play('ko');
      log(`🏃 ${name(e.side)} flees the ring! Exit over voice.`, 'big');
      shout('COWARD!');
      await sleep(900);
      break;
    case 'ko':
      els.fighters[e.side].classList.add('ko');
      play('ko');
      log(`💥 ${name(e.side)} is out! Flipped on its back like a tax return.`, 'big');
      shout('OTHER LIBERTARIANS LMAO');
      await sleep(900);
      break;
    case 'decision':
      log(`📋 Still standing after ${ROUNDS} rounds. The judges score it ${e.scores[0]}–${e.scores[1]}.`, 'round');
      await sleep(700);
      break;
  }
}

/** Shows a lobster's trait on its card from now on (and saves that you know it). */
function revealTrait(side: Side) {
  const l = bout.lobsters[side];
  if (l.traitKnown) return;
  l.traitKnown = true;
  renderCard(side);
  pulse(els.cards[side], 'revealed');
  toast('🔍', 'TRAIT REVEALED', `${l.name}: ${traitById(l.trait).name}`);
}

async function fight() {
  phase = 'fighting';
  skipping = false;
  els.betRow.hidden = true;
  els.stakeRow.hidden = true;
  els.after.hidden = false;
  els.skip.hidden = false;
  els.next.hidden = true;
  const result = simulate(bout.lobsters[0], bout.lobsters[1]);
  for (const e of result.events) await showEvent(e);
  finish(result);
}

els.skip.addEventListener('click', () => {
  skipping = true;
});

function finish(result: FightResult) {
  phase = 'done';
  skipping = false;
  for (const f of els.fighters) f.querySelector<HTMLElement>('.say')!.hidden = true;
  // A skipped flight still needs its lobster gone.
  if (result.ending === 'flee') els.fighters[result.winner === 0 ? 1 : 0].classList.add('fled');
  const winner = bout.lobsters[result.winner];
  const loser = bout.lobsters[result.winner === 0 ? 1 : 0];
  // Records, form, and any traits the fight showed
  winner.wins++;
  loser.losses++;
  winner.form = [...winner.form, 'W' as const].slice(-5);
  loser.form = [...loser.form, 'L' as const].slice(-5);
  for (const side of revealedSides(result)) bout.lobsters[side].traitKnown = true;
  save.bouts++;
  const how = result.ending === 'ko' ? 'by KO' : result.ending === 'flee' ? 'when the other one ran away' : 'on the judges’ cards';
  let line = `${winner.name} wins ${how}.`;
  if (bet) {
    if (bet.side === result.winner) {
      const payout = Math.floor(bet.stake * bout.odds[bet.side]);
      save.bankroll += payout;
      line += ` You collect ${money(payout)} (+${money(payout - bet.stake)}).`;
      play('win');
      rain();
      log(`💰 You won ${money(payout)}! The market rewards those who read the matchup chart.`, 'win');
    } else {
      line += ` You lose ${money(bet.stake)}.`;
      play('lose');
      log(`📉 You lost ${money(bet.stake)}. No bailouts here.`, 'lose');
    }
  }
  save.best = Math.max(save.best, save.bankroll);
  // Broke: your uncle spots you a fresh bankroll (the loan shark comes later).
  if (save.bankroll < 10) {
    save.bankroll = START_BANKROLL;
    log('💸 You’re broke. Your uncle the Bitcoin maximalist spots you $500. “Have fun staying poor.”', 'warn');
  }
  persist();
  updateBankroll();
  els.result.innerHTML = `<b>${escapeHtml(winner.name)}</b> wins ${how}<small>${escapeHtml(line.replace(`${winner.name} wins ${how}.`, '').trim()) || 'You watched from the sidelines.'}</small>`;
  els.result.hidden = false;
  els.result.classList.toggle('won', !!bet && bet.side === result.winner);
  els.result.classList.toggle('lost', !!bet && bet.side !== result.winner);
  els.skip.hidden = true;
  els.next.hidden = false;
  els.next.focus();
  for (const side of [0, 1] as Side[]) renderCard(side);
  els.fighters[result.winner].classList.add('winner');
}

els.next.addEventListener('click', () => newBout());

function rain() {
  for (let i = 0; i < 18; i++) {
    spawnText({ text: '💵', className: 'fc-rain', x: `${Math.random() * 100}%`, y: '-10%', parent: els.arena, ttl: 2000, vars: { '--d': `${0.6 + Math.random() * 0.8}s` } });
  }
}

// ---------------------------------------------------------------------------
// Keys, screens, start
// ---------------------------------------------------------------------------

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (!els.title.hidden || !els.chart.hidden) return;
  if (phase === 'betting' && (e.key === '1' || e.key === 'ArrowLeft')) placeBet(0);
  else if (phase === 'betting' && (e.key === '2' || e.key === 'ArrowRight')) placeBet(1);
  else if (phase === 'fighting' && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    skipping = true;
  } else if (phase === 'done' && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    newBout();
  }
});

byId('start').addEventListener('click', () => {
  els.title.hidden = true;
  getAudioContext();
});
byId('show-chart').addEventListener('click', () => {
  renderChart();
  els.chart.hidden = false;
  byId('hide-chart').focus();
});
byId('hide-chart').addEventListener('click', () => {
  els.chart.hidden = true;
});

byId('title-best').textContent = save.bouts ? `Bankroll ${money(save.bankroll)} · best ${money(save.best)} · ${save.bouts} bouts watched` : '';
log('Welcome to the free market of violence. Read the tale of the tape, then place your bet.');
newBout();
