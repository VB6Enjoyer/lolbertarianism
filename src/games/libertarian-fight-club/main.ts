import './style.css';
import { getAudioContext, note, playTone } from '../../shared/audio.ts';
import { spawnText } from '../../shared/effects.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import { ARG_TYPES, FACTIONS, factionById, makeRoster, normalizeRoster, traitById, type Faction, type Lobster } from './lobsters.ts';
import { argTypesOf, pickBout, publicChance, revealedSides, ROUNDS, simulate, stateAfterRound, weighIn, type FightEvent, type FightResult, type Side } from './fight.ts';
import { BETTORS, bettorById, cashOutValue, crowdBets, lateBet, liveOdds, poolOdds, projectedPayout, TAKEOUT, totals, type PoolBet } from './pool.ts';

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
  pool: byId('pool'),
  poolBar: [byId('pool-bar-0'), byId('pool-bar-1')] as const,
  poolTotal: byId('pool-total'),
  poolBets: byId('pool-bets'),
  preview: byId('preview'),
  live: byId('live'),
  liveTitle: byId('live-title'),
  liveBets: [byId<HTMLButtonElement>('live-bet-0'), byId<HTMLButtonElement>('live-bet-1')] as const,
  yourBets: byId('your-bets'),
  liveTimer: byId('live-timer'),
  liveContinue: byId<HTMLButtonElement>('live-continue'),
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
  cashout: () => [1047, 1319, 1568].forEach((hz, i) => playTone(note(hz, 0.08, 0.05, 'triangle'), i * 0.06)),
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

type Phase = 'opening' | 'betting' | 'fighting' | 'live' | 'done';

interface Bout {
  lobsters: [Lobster, Lobster];
  ids: [number, number];
  /** The public's idea of A's chances (it moves its money accordingly). */
  publicP: number;
  /** Everyone's money in the pool, yours included. */
  pool: PoolBet[];
}

/** Your bets on this bout: the pool bet, and any live bets. `payout` is what it pays if it wins. */
interface YourBet {
  kind: 'pool' | 'live';
  side: Side;
  stake: number;
  payout: number;
  /** Cashed out for this much (and settled), or null. */
  cashedOut: number | null;
}

let phase: Phase = 'opening';
let bout: Bout;
let lastPair: [number, number] | null = null;
let yourBets: YourBet[] = [];
/** Bumped with each new bout, so the old bout's timers know to stop. */
let boutToken = 0;

async function newBout() {
  const token = ++boutToken;
  const ids = pickBout(save.roster.length, Math.random, lastPair);
  lastPair = ids;
  const lobsters: [Lobster, Lobster] = [save.roster[ids[0]], save.roster[ids[1]]];
  bout = { lobsters, ids, publicP: publicChance(lobsters[0], lobsters[1]), pool: [] };
  phase = 'opening';
  yourBets = [];
  els.bout.textContent = String(save.bouts + 1);
  els.round.textContent = '';
  els.result.hidden = true;
  els.live.hidden = true;
  for (const side of [0, 1] as Side[]) {
    renderCard(side);
    const f = factionById(lobsters[side].faction);
    const el = els.fighters[side];
    el.className = `fighter ${side === 0 ? 'left' : 'right'}`;
    el.style.setProperty('--shell', f.color);
    el.querySelector('.lobster')!.innerHTML = `<span class="badge">${f.icon}</span>${lobsterSvg(f)}`;
    setHp(side, lobsters[side].stamina, lobsters[side].stamina);
    el.querySelector<HTMLElement>('.say')!.hidden = true;
  }
  els.betRow.hidden = false;
  els.stakeRow.hidden = false;
  els.after.hidden = true;
  setBetButtons(false);
  // Lost some? Don't leave a stake you can't cover.
  if (stake() > save.bankroll) els.stake.value = String(save.bankroll);
  updateBankroll();
  renderPool();
  log(`🔔 Bout ${save.bouts + 1}: ${lobsters[0].name} (${factionById(lobsters[0].faction).name}) vs ${lobsters[1].name} (${factionById(lobsters[1].faction).name}). The pool is open.`, 'bell');
  // The crowd puts its money down first, one by one.
  for (const b of crowdBets(lobsters[0], lobsters[1], bout.publicP, Math.random)) {
    if (token !== boutToken) return;
    bout.pool.push(b);
    if (b.who !== 'public') {
      crowdShout(b);
      play('coin');
    }
    renderPool();
    await wait(b.who === 'public' ? 150 : 380);
  }
  if (token !== boutToken) return;
  phase = 'betting';
  setBetButtons(true);
  renderPool();
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** A meme bettor yells as they put their money down. */
function crowdShout(b: PoolBet) {
  if (b.who === 'you' || b.who === 'public') return;
  const bettor = bettorById(b.who);
  const i = BETTORS.indexOf(bettor);
  const spot = els.spectators[i];
  const line = bettor.lines[Math.floor(Math.random() * bettor.lines.length)];
  const el = spot.querySelector<HTMLElement>('.shout')!;
  el.textContent = `${money(b.amount)} on ${bout.lobsters[b.side].name.split(' ')[0]}! ${line}`;
  spot.classList.remove('shouting');
  void spot.offsetWidth;
  spot.classList.add('shouting');
}

function setBetButtons(open: boolean) {
  for (const b of [...els.bets, els.watch]) b.disabled = !open;
}

/** The pool panel: each side's money, the odds, who bet what, and your projected payout. */
function renderPool() {
  const t = totals(bout.pool);
  const odds = poolOdds(t);
  const total = t[0] + t[1];
  for (const side of [0, 1] as Side[]) {
    els.poolBar[side].style.flexGrow = String(Math.max(1, t[side]));
    els.poolBar[side].textContent = total ? `${money(t[side])}` : '';
    const name = bout.lobsters[side].name;
    els.bets[side].innerHTML = `Bet on <b>${escapeHtml(name)}</b> <span>${total ? `${odds[side].toFixed(2)}×` : '…'}</span>`;
  }
  els.poolTotal.textContent = total ? `POOL ${money(total)} · house cut ${Math.round(TAKEOUT * 100)}%` : 'The crowd is placing its bets…';
  const rows = bout.pool.filter((b) => b.who !== 'public');
  els.poolBets.replaceChildren(
    ...rows.map((b) => {
      const li = document.createElement('li');
      const face = b.who === 'you' ? '🫵' : bettorById(b.who).face;
      const who = b.who === 'you' ? 'You' : bettorById(b.who).name;
      li.className = b.who === 'you' ? 'you' : '';
      li.textContent = `${face} ${who}: ${money(b.amount)} on ${bout.lobsters[b.side].name}${b.late ? ' (late!)' : ''}`;
      li.title = b.who === 'you' ? '' : bettorById(b.who).style;
      return li;
    }),
  );
  updatePreview();
}

/** What your stake would pay on each side right now (your own money moves the odds). */
function updatePreview() {
  els.preview.hidden = phase !== 'betting' && phase !== 'opening';
  if (els.preview.hidden) return;
  const t = totals(bout.pool);
  const amount = stake();
  if (!t[0] || !t[1] || amount < 10) {
    els.preview.textContent = amount < 10 ? 'Minimum stake: $10' : '';
    return;
  }
  const pay = [projectedPayout(t, 0, amount), projectedPayout(t, 1, amount)];
  els.preview.textContent = `${money(amount)} pays ${money(pay[0])} on ${bout.lobsters[0].name.split(' ')[0]} or ${money(pay[1])} on ${bout.lobsters[1].name.split(' ')[0]} (if nobody else bets after you).`;
}

els.stake.addEventListener('input', updatePreview);

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
    save.bankroll -= amount;
    bout.pool.push({ who: 'you', side, amount });
    updateBankroll();
    play('coin');
  } else {
    log('👀 You keep your money in your pocket and watch.', '');
  }
  // Betting closes; somebody might still sneak a late bet in.
  phase = 'fighting';
  els.preview.hidden = true;
  const late = lateBet(Math.random);
  if (late) {
    bout.pool.push(late);
    crowdShout(late);
  }
  const odds = poolOdds(totals(bout.pool));
  if (side !== null) {
    const amount = bout.pool.find((b) => b.who === 'you')!.amount;
    yourBets.push({ kind: 'pool', side, stake: amount, payout: Math.floor(amount * odds[side]), cashedOut: null });
    log(`💵 You put ${money(amount)} on ${bout.lobsters[side].name}. ${late ? `${bettorById(late.who as 'susan').name} throws in ${money(late.amount)} late. ` : ''}Final odds: ${odds[0].toFixed(2)}× / ${odds[1].toFixed(2)}×.`, 'bet');
  } else {
    log(`Betting is closed. Final odds: ${odds[0].toFixed(2)}× / ${odds[1].toFixed(2)}×.`, 'bell');
  }
  renderPool();
  persist();
  void fight();
}

els.bets[0].addEventListener('click', () => placeBet(0));
els.bets[1].addEventListener('click', () => placeBet(1));
els.watch.addEventListener('click', () => placeBet(null));

// ---------------------------------------------------------------------------
// The live market, between rounds
// ---------------------------------------------------------------------------

/** The live market's chance for A, and its odds on each side. */
let liveP = 0.5;
let continueLive: (() => void) | null = null;
const LIVE_SECONDS = 8;

function liveOddsPair(): [number, number] {
  return [liveOdds(liveP), liveOdds(1 - liveP)];
}

/** Your open bets, each with what cashing out would pay now. */
function renderYourBets() {
  const open = yourBets.filter((b) => b.cashedOut === null);
  els.yourBets.replaceChildren(
    ...(open.length
      ? open.map((b) => {
          const li = document.createElement('li');
          const p = b.side === 0 ? liveP : 1 - liveP;
          const value = cashOutValue(b.payout, p);
          li.innerHTML = '<span></span><button type="button" class="cashout"></button>';
          li.querySelector('span')!.textContent = `${b.kind === 'live' ? '⚡' : '💵'} ${money(b.stake)} on ${bout.lobsters[b.side].name} → pays ${money(b.payout)}`;
          const btn = li.querySelector('button')!;
          btn.textContent = `Cash out ${money(value)}`;
          btn.addEventListener('click', () => cashOut(b, value));
          return li;
        })
      : [Object.assign(document.createElement('li'), { className: 'none', textContent: 'No open bets. Bet live, or just watch.' })]),
  );
}

function cashOut(b: YourBet, value: number) {
  if (phase !== 'live' || b.cashedOut !== null) return;
  b.cashedOut = value;
  save.bankroll += value;
  updateBankroll();
  persist();
  play('cashout');
  log(`💸 Cashed out your ${money(b.stake)} on ${bout.lobsters[b.side].name} for ${money(value)}. ${value >= b.stake ? 'Profit locked in.' : 'Salvaged what you could.'}`, value >= b.stake ? 'win' : 'warn');
  renderYourBets();
}

function liveBet(side: Side) {
  if (phase !== 'live') return;
  const amount = stake();
  if (amount < 10 || amount > save.bankroll) {
    log(amount < 10 ? 'The minimum stake is $10.' : 'You don’t have the capital for that.', 'warn');
    return;
  }
  const odds = liveOddsPair()[side];
  save.bankroll -= amount;
  yourBets.push({ kind: 'live', side, stake: amount, payout: Math.floor(amount * odds), cashedOut: null });
  updateBankroll();
  persist();
  play('coin');
  log(`⚡ Live bet: ${money(amount)} on ${bout.lobsters[side].name} at ${odds.toFixed(2)}×.`, 'bet');
  renderYourBets();
}

els.liveBets[0].addEventListener('click', () => liveBet(0));
els.liveBets[1].addEventListener('click', () => liveBet(1));
els.liveContinue.addEventListener('click', () => continueLive?.());

/** Pauses after a round for the live market, until you continue (or the timer runs out). */
async function liveBreak(result: FightResult, roundDone: number) {
  const [a, b] = bout.lobsters;
  liveP = publicChance(a, b, stateAfterRound(a, b, result, roundDone), 200);
  phase = 'live';
  const odds = liveOddsPair();
  els.liveTitle.textContent = `⏸ After round ${roundDone}: the live market`;
  for (const side of [0, 1] as Side[]) els.liveBets[side].innerHTML = `Bet live on <b>${escapeHtml(bout.lobsters[side].name)}</b> <span>${odds[side].toFixed(2)}×</span>`;
  renderYourBets();
  els.live.hidden = false;
  els.stakeRow.hidden = false;
  els.live.scrollIntoView({ block: 'end', behavior: 'smooth' });
  if (stake() > save.bankroll) els.stake.value = String(save.bankroll);
  els.skip.hidden = true;
  log(`⏸ Live market after round ${roundDone}: ${odds[0].toFixed(2)}× / ${odds[1].toFixed(2)}×.`, 'bell');
  await new Promise<void>((resolve) => {
    const started = performance.now();
    const tick = () => {
      if (!continueLive) return;
      const left = Math.max(0, LIVE_SECONDS - (performance.now() - started) / 1000);
      els.liveTimer.style.width = `${(left / LIVE_SECONDS) * 100}%`;
      if (left <= 0) continueLive();
      else requestAnimationFrame(tick);
    };
    continueLive = () => {
      continueLive = null;
      resolve();
    };
    requestAnimationFrame(tick);
  });
  els.live.hidden = true;
  els.stakeRow.hidden = true;
  els.skip.hidden = false;
  phase = 'fighting';
}

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
  for (const e of result.events) {
    // Between rounds: the live market (unless you're skipping to the end).
    if (e.type === 'round' && e.round > 1 && !skipping) await liveBreak(result, e.round - 1);
    await showEvent(e);
  }
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
  // Settle every bet you didn't cash out; the net counts cash-outs too.
  let net = 0;
  let collected = 0;
  for (const b of yourBets) {
    net -= b.stake;
    if (b.cashedOut !== null) net += b.cashedOut;
    else if (b.side === result.winner) {
      save.bankroll += b.payout;
      collected += b.payout;
      net += b.payout;
    }
  }
  const betted = yourBets.length > 0;
  let line = '';
  if (betted) {
    line = net > 0 ? `You're up ${money(net)} on the bout.` : net < 0 ? `You're down ${money(-net)} on the bout.` : 'You broke even.';
    if (collected) line = `You collect ${money(collected)}. ${line}`;
    if (net > 0) {
      play('win');
      rain();
      log(`💰 ${line} The market rewards those who read the matchup chart.`, 'win');
    } else if (net < 0) {
      play('lose');
      log(`📉 ${line} No bailouts here.`, 'lose');
    } else log(line, '');
  }
  save.best = Math.max(save.best, save.bankroll);
  // Broke: your uncle spots you a fresh bankroll (the loan shark comes later).
  if (save.bankroll < 10) {
    save.bankroll = START_BANKROLL;
    log('💸 You’re broke. Your uncle the Bitcoin maximalist spots you $500. “Have fun staying poor.”', 'warn');
  }
  persist();
  updateBankroll();
  els.result.innerHTML = `<b>${escapeHtml(winner.name)}</b> wins ${how}<small>${escapeHtml(line) || 'You watched from the sidelines.'}</small>`;
  els.result.hidden = false;
  els.result.classList.toggle('won', betted && net > 0);
  els.result.classList.toggle('lost', betted && net < 0);
  els.skip.hidden = true;
  els.next.hidden = false;
  els.next.focus();
  for (const side of [0, 1] as Side[]) renderCard(side);
  els.fighters[result.winner].classList.add('winner');
}

els.next.addEventListener('click', () => void newBout());

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
  } else if (phase === 'live' && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    continueLive?.();
  } else if (phase === 'live' && (e.key === '1' || e.key === '2')) {
    liveBet(e.key === '1' ? 0 : 1);
  } else if (phase === 'done' && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    void newBout();
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
log('Welcome to the free market of violence. Read the tale of the tape and the pool, then place your bet.');
void newBout();
