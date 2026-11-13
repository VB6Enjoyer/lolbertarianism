import './style.css';
import { getAudioContext, note, playTone } from '../../shared/audio.ts';
import { spawnText } from '../../shared/effects.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import { installTapTips } from './taptips.ts';
import { ARG_TYPES, FACTIONS, factionById, makeRoster, movesOf, normalizeRoster, TEACHABLE, traitById, type ArgType, type Faction, type Lobster } from './lobsters.ts';
import { argTypesOf, pickBout, publicChance, revealedSides, ROUNDS, seededRng, simulate, stateAfterRound, weighIn, type FightEvent, type FightResult, type Side } from './fight.ts';
import { BETTORS, bettorById, cashOutValue, crowdBets, lateBet, liveOdds, poolOdds, projectedPayout, TAKEOUT, totals, type PoolBet } from './pool.ts';
import { buyTip, normalizeRecords, SCOUT_PRICE, TELLS, TIPSTERS, tipsterById, type Tip, type TipsterId, type TrackRecords } from './intel.ts';
import { afterLoss, bailout, BAD_TRAITS, endNight, MARKET_VENUE, marketOffers, MINE_ID, NIGHT_BOUTS, normalizeCareer, normalizeStable, pickOpponent, purseFor, startNight, suggestName, teachCost, THERAPY_PRICE, TIERS, train, trainingCost, VENUES, type Career, type NightOutcome, type Offer, type Stable, type Tier, type TrainStat } from './career.ts';
import { ACHIEVEMENTS, achievementById, normalizeUnlocked } from './achievements.ts';
import { borrow, collect, creditLimit, dueForCollection, loanChunk, nightPasses, normalizeShark, repay, SHARK_PATIENCE, SHARK_RATE, type Shark } from './shark.ts';
import { BET_TYPES, ledgerTotal, normalizeLedger, recordBet, roi, type BetType, type Ledger } from './ledger.ts';
import { eventById, FORFEIT, normalizeEvent, rollEvent, whaleBet, type EventId } from './events.ts';
import { bribeFor, catchChance, diveFighter, FINE_MULTIPLE, SUSPENSION } from './dive.ts';
import { callWinner, introduce } from './announcer.ts';
import { alive, champion, CUP_BOUTS, cupChances, futuresOdds, isCupNight, matchOf, newCup, nextMatch, normalizeCup, ROUND_NAMES, started, type Cup } from './cup.ts';
import { addResults, emptyStandings, GLOATS, GRUMBLES, leading, normalizeRivals, ranking, RIVALS, rivalResults, type Player, type RivalId, type Rivals } from './rivals.ts';
import { MAX_LEG_ODDS, normalizeParlay, parlayOdds, PROPS, propById, propChances, propOdds, propOutcomes, settleLeg, type Parlay, type PropId } from './props.ts';

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const els = {
  bankroll: byId('bankroll'),
  nightLabel: byId('night-label'),
  boutDots: byId('bout-dots'),
  goalFill: byId('goal-fill'),
  goalText: byId('goal-text'),
  guide: byId('guide'),
  guideText: byId('guide-text'),
  stakeCap: byId('stake-cap'),
  liveSeconds: byId('live-seconds'),
  logToggle: byId<HTMLButtonElement>('log-toggle'),
  sharkLabel: byId('shark-label'),
  speed: byId<HTMLButtonElement>('speed'),
  liveOff: byId<HTMLButtonElement>('live-off'),
  settings: byId('settings'),
  stats: byId('stats'),
  propsRepeat: byId<HTMLButtonElement>('props-repeat'),
  eventChip: byId('event-chip'),
  cupTab: document.querySelector<HTMLButtonElement>('.tabs [data-tab="cup"]')!,
  parlayTab: document.querySelector<HTMLButtonElement>('.tabs [data-tab="parlay"]')!,
  cupBracket: byId('cup-bracket'),
  cupFutures: byId('cup-futures'),
  rivals: byId('rivals'),
  announcer: byId('announcer'),
  announcerText: byId('announcer-text'),
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
  tabs: [...document.querySelectorAll<HTMLButtonElement>('.tabs button')],
  panes: [...document.querySelectorAll<HTMLElement>('.tab-pane')],
  props: byId('props'),
  parlayLegs: byId('parlay-legs'),
  parlaySummary: byId('parlay-summary'),
  parlayPlace: byId<HTMLButtonElement>('parlay-place'),
  parlayActive: byId('parlay-active'),
  tipsters: byId('tipsters'),
  scouts: byId('scouts'),
  notebook: byId('notebook'),
  slip: byId('slip'),
  tabbar: document.querySelector<HTMLElement>('.tabs')!,
  venueName: byId('venue-name'),
  stable: byId('stable'),
  night: byId('night'),
  nightTitle: byId('night-title'),
  nightBody: byId('night-body'),
  nightNext: byId<HTMLButtonElement>('night-next'),
  achievements: byId('achievements'),
  achievementsGrid: byId('achievements-grid'),
  achievementsCount: byId('achievements-count'),
  sharkButton: byId<HTMLButtonElement>('show-shark'),
  sharkPanel: byId('shark'),
  sharkBody: byId('shark-body'),
  sharkBorrow: byId<HTMLButtonElement>('shark-borrow'),
  sharkRepay: byId<HTMLButtonElement>('shark-repay'),
  broke: byId('broke'),
  brokeShark: byId<HTMLButtonElement>('broke-shark'),
  brokeUncle: byId<HTMLButtonElement>('broke-uncle'),
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
  /** Each tipster's track record with you. */
  tipsters: TrackRecords;
  /** The next bouts on tonight's card (pairs of roster ids), and your parlay on them. */
  card: [number, number][];
  parlay: Parlay | null;
  /** The career: venue, night, and how tonight is going. */
  career: Career;
  /** Your own lobster, today's fish market, and the fight you've signed it up for. */
  stable: Stable | null;
  market: Offer[];
  entry: Tier | null;
  /** Achievements, the counters a few of them need, and what you owe Vinny. */
  achievements: string[];
  stats: { scouted: number; tipsters: string[]; fades: number; loans: number; peakVenue: number };
  shark: Shark;
  /** Tonight's twist (if any), and how tonight's bouts have gone. */
  event: EventId | null;
  tonight: { won: number };
  /** The Invisible Claw Cup, on cup nights. */
  cup: Cup | null;
  /** Tonight's table and the season's: you against Susan, Sheila and Larry. */
  rivals: Rivals;
  /** The bout in progress when you left: settled when you come back, so a reload can't lose (or dodge) a bet. */
  pending: Pending | null;
  /** Your last stake, and the props you placed last time (for “same props again”). */
  stake: number;
  lastProps: { prop: PropId; stake: number }[];
  settings: Settings;
  /** Your betting record. */
  ledger: Ledger;
}

interface Settings {
  speed: 1 | 2 | 3;
  /** Pause between rounds for the live market. */
  live: boolean;
  /** The ring announcer reads the intros out loud. */
  voice: boolean;
}

/** A thrown fight: the chance the commission catches it, and the bribe (for the fine). */
interface Dive {
  chance: number;
  bribe: number;
}

interface Pending {
  ids: [number, number];
  entry: Tier | null;
  /** The fight's seed, once betting has closed (null while it's still open). */
  seed: number | null;
  bets: YourBet[];
  pool: PoolBet[];
  tips: Tip[];
  dive: Dive | null;
}

function normalizePending(raw: unknown): Pending | null {
  const r = raw as Partial<Pending> | null;
  if (!r || !Array.isArray(r.ids) || r.ids.length !== 2 || !Array.isArray(r.bets)) return null;
  const okId = (x: unknown) => Number.isInteger(x) && (((x as number) >= 0 && (x as number) < 16) || x === MINE_ID);
  if (!r.ids.every(okId) || r.ids[0] === r.ids[1]) return null;
  const bets: YourBet[] = r.bets
    .filter((b) => !!b && (b.kind === 'pool' || b.kind === 'live' || b.kind === 'prop') && (b.side === 0 || b.side === 1) && Number(b.stake) > 0 && Number(b.payout) >= 0 && (b.kind !== 'prop' || PROPS.some((x) => x.id === b.prop)))
    .map((b) => ({ kind: b.kind, prop: b.kind === 'prop' ? b.prop : undefined, side: b.side, stake: Math.floor(b.stake), payout: Math.floor(b.payout), cashedOut: b.cashedOut == null ? null : Math.max(0, Math.floor(Number(b.cashedOut) || 0)), underwater: b.underwater === true }));
  const d = r.dive as Partial<Dive> | null | undefined;
  return {
    ids: [r.ids[0], r.ids[1]],
    entry: r.entry === 'easy' || r.entry === 'even' || r.entry === 'hard' ? r.entry : null,
    seed: Number.isInteger(r.seed) ? (r.seed as number) >>> 0 : null,
    bets,
    pool: (Array.isArray(r.pool) ? r.pool : []).filter((b) => !!b && (b.side === 0 || b.side === 1) && Number(b.amount) > 0 && typeof b.who === 'string'),
    tips: (Array.isArray(r.tips) ? r.tips : []).filter((t) => !!t && TIPSTERS.some((x) => x.id === t.by) && (t.side === 0 || t.side === 1) && typeof t.text === 'string'),
    dive: d && Number(d.chance) >= 0 && Number(d.chance) <= 1 && Number(d.bribe) > 0 ? { chance: Number(d.chance), bribe: Math.floor(Number(d.bribe)) } : null,
  };
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
  tipsters: normalizeRecords(saved?.tipsters),
  card: (Array.isArray(saved?.card) ? saved!.card : []).filter((c): c is [number, number] => Array.isArray(c) && c.length === 2 && c.every((x) => Number.isInteger(x) && x >= 0 && x < 16) && c[0] !== c[1]).slice(0, 2),
  parlay: normalizeParlay(saved?.parlay),
  career: normalizeCareer(saved?.career, Math.max(0, Math.floor(Number(saved?.bankroll ?? START_BANKROLL) || 0))),
  stable: normalizeStable(saved?.stable),
  market: [],
  entry: saved?.entry === 'easy' || saved?.entry === 'even' || saved?.entry === 'hard' ? saved.entry : null,
  achievements: [...normalizeUnlocked(saved?.achievements)],
  stats: {
    scouted: Math.max(0, Math.floor(Number(saved?.stats?.scouted) || 0)),
    tipsters: (Array.isArray(saved?.stats?.tipsters) ? saved!.stats.tipsters : []).filter((t): t is string => typeof t === 'string').slice(0, 3),
    fades: Math.max(0, Math.floor(Number(saved?.stats?.fades) || 0)),
    loans: Math.max(0, Math.floor(Number(saved?.stats?.loans) || 0)),
    peakVenue: Math.max(0, Math.min(4, Math.floor(Number(saved?.stats?.peakVenue) || 0))),
  },
  event: normalizeEvent(saved?.event),
  tonight: { won: Math.max(0, Math.floor(Number(saved?.tonight?.won) || 0)) },
  cup: normalizeCup(saved?.cup, 16),
  rivals: normalizeRivals(saved?.rivals),
  shark: normalizeShark(saved?.shark),
  pending: normalizePending(saved?.pending),
  stake: Math.max(10, Math.floor(Number(saved?.stake) || 50)),
  lastProps: (Array.isArray(saved?.lastProps) ? saved!.lastProps : []).filter((x) => !!x && PROPS.some((p) => p.id === x.prop) && Number(x.stake) >= 10).map((x) => ({ prop: x.prop, stake: Math.floor(x.stake) })).slice(0, PROPS.length),
  settings: {
    speed: saved?.settings?.speed === 2 || saved?.settings?.speed === 3 ? saved.settings.speed : 1,
    live: saved?.settings?.live !== false,
    voice: saved?.settings?.voice !== false,
  },
  ledger: normalizeLedger(saved?.ledger),
};
const unlocked = new Set(save.achievements);
// The market's lots are regenerated on load (they're cheap to make, and it keeps saves honest).
save.market = marketOffers(Math.random, save.career.night);
const venue = () => VENUES[save.career.venue];
/** Tonight's twist, and what it does to the house cut, the maximum stake and prices. */
const tonightEvent = () => eventById(save.event);
const cut = () => tonightEvent()?.cut ?? TAKEOUT;
const maxStake = () => Math.round((venue().maxStake * (tonightEvent()?.stakeScale ?? 1)) / 10) * 10;
/** A cup night runs seven bouts; a normal one, five. */
const boutsTonight = () => (save.cup ? CUP_BOUTS : NIGHT_BOUTS);
const price = (n: number) => Math.ceil((n * (tonightEvent()?.priceScale ?? 1)) / 5) * 5;
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
  achievement: () => [784, 988, 1175, 1568].forEach((hz, i) => playTone(note(hz, 0.1, 0.05, 'triangle'), i * 0.07)),
  shark: () => playTone({ wave: 'sawtooth', duration: 0.5, frequency: [[0, 110], [0.5, 55, 'exp']], gain: [[0, 0.08], [0.5, 0.001, 'exp']] }),
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

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** What a lobster gets called for short (usually its first name). */
const SHORT_NAMES: Record<string, string> = { 'Big Claw Dave': 'Dave' };
const firstName = (l: Lobster) => SHORT_NAMES[l.name] ?? l.name.split(' ')[0];

/** A stat as a bar with its number, so you can compare the two cards at a glance. */
const STATS = [
  { key: 'claw', icon: '🦀', name: 'Claw', max: 10, help: 'How hard its arguments hit' },
  { key: 'shell', icon: '🛡️', name: 'Shell', max: 10, help: 'How much damage it blocks' },
  { key: 'wits', icon: '🧠', name: 'Wits', max: 10, help: 'Critical hits, and who strikes first' },
  { key: 'stamina', icon: '❤️', name: 'Stamina', max: 160, help: 'How much it can take' },
] as const;

function statBars(l: Lobster, other?: Lobster) {
  return `<div class="stats">${STATS.map((st) => {
    const v = l[st.key];
    const better = other && v > other[st.key] ? ' better' : '';
    return `<div class="stat${better}" title="${st.name}: ${st.help}"><span class="stat-name">${st.icon} ${st.name}</span><span class="bar"><i style="width:${Math.min(100, (v / st.max) * 100)}%"></i></span><b>${v}</b></div>`;
  }).join('')}</div>`;
}

/** How this lobster's arguments fare against the other one: the matchup chart, worked out for you. */
function edgeChips(side: Side) {
  const me = bout.lobsters[side];
  const them = bout.lobsters[side === 0 ? 1 : 0];
  const tf = factionById(them.faction);
  const moves = movesOf(me);
  const hits = moves.filter((m) => m.type === tf.weak).length;
  const blocked = moves.filter((m) => m.type === tf.resists).length;
  const who = escapeHtml(firstName(them));
  const chips: string[] = [];
  if (hits) chips.push(`<span class="edge good" title="${hits} of its ${moves.length} arguments are ${ARG_TYPES[tf.weak].name}: ×1.5 damage against a ${tf.name}">🎯 ${hits} of ${moves.length} args hit ${who}’s weak spot</span>`);
  if (blocked) chips.push(`<span class="edge bad" title="${blocked} of its ${moves.length} arguments are ${ARG_TYPES[tf.resists].name}: ×0.65 damage against a ${tf.name}">🧱 ${blocked} of ${moves.length} bounce off ${who}</span>`);
  if (!chips.length) chips.push('<span class="edge even" title="None of its arguments hit the other’s weak spot, and none bounce off">➖ No matchup edge</span>');
  return `<div class="matchup">${chips.join('')}</div>`;
}

function renderCard(side: Side) {
  const l = bout.lobsters[side];
  const other = bout.lobsters[side === 0 ? 1 : 0];
  const f = factionById(l.faction);
  const trait = traitById(l.trait);
  const types = argTypesOf(l);
  const form = l.form.length ? l.form.map((r) => `<i class="${r}">${r}</i>`).join('') : '<em>debut</em>';
  const corner = bout.entry && side === 0 ? '🦞 YOUR LOBSTER' : side === 0 ? 'RED CORNER' : 'BLUE CORNER';
  els.cards[side].style.setProperty('--shell', f.color);
  els.cards[side].style.setProperty('--accent', f.accent);
  els.cards[side].innerHTML = `
    <div class="corner"><kbd>${side + 1}</kbd> ${corner}</div>
    <div class="card-head"><span class="badge">${f.icon}</span><div class="who"><b>${escapeHtml(l.name)}</b><small>${f.name} · ${l.weight} lb</small></div><div class="record" title="Wins–losses, and the last five fights">${l.wins}–${l.losses}<span class="form">${form}</span></div></div>
    ${statBars(l, other)}
    ${edgeChips(side)}
    <div class="tags">
      <span class="tag" title="Argues with: ${types.map((t) => ARG_TYPES[t].name).join(', ')}">🗣️ ${types.map((t) => ARG_TYPES[t].icon).join(' ')}</span>
      <span class="tag weak" title="Weak to ${ARG_TYPES[f.weak].name} arguments (×1.5 damage)">💔 ${ARG_TYPES[f.weak].icon} ${ARG_TYPES[f.weak].name}</span>
      <span class="tag resist" title="Shrugs off ${ARG_TYPES[f.resists].name} arguments (×0.65 damage)">🛡️ ${ARG_TYPES[f.resists].icon} ${ARG_TYPES[f.resists].name}</span>
      ${l.traitKnown ? `<span class="tag trait" title="${escapeHtml(trait.description)}">🧬 ${trait.name}</span>` : '<span class="tag trait unknown" title="Hidden. Watch it fight, buy a tip, or scout it (Intel) to find out">❓ Hidden trait</span>'}
    </div>
    ${!l.traitKnown && l.rumor ? `<div class="rumor" title="A tip, not a fact">🗣️ ${tipsterById(l.rumor.by as TipsterId)?.name ?? 'Someone'} says: <b>${traitById(l.rumor.trait).name}</b>?</div>` : ''}
    ${!l.traitKnown && l.scouted ? `<div class="tell">👀 In the tank, it ${escapeHtml(TELLS[l.trait][l.id % 2])}</div>` : ''}`;
  markPicks();
}

/** Ribbons on the cards of the lobsters you've got money on. */
function markPicks() {
  for (const side of [0, 1] as Side[]) {
    const riding = yourBets.filter((b) => b.kind !== 'prop' && b.side === side && b.cashedOut === null).reduce((sum, b) => sum + b.stake, 0);
    if (riding) els.cards[side].dataset.pick = `💵 ${money(riding)} ON IT`;
    else delete els.cards[side].dataset.pick;
  }
}

// ---------------------------------------------------------------------------
// The guide: what's going on, and what to do now
// ---------------------------------------------------------------------------

let resultNote = '';
let flashTimer = 0;

function renderGuide() {
  if (flashTimer) return;
  const riding = yourBets.filter((b) => b.cashedOut === null).reduce((sum, b) => sum + b.stake, 0);
  let step: 'bet' | 'fight' | 'collect' = 'bet';
  let tone = '';
  let text = '';
  switch (phase) {
    case 'opening':
      text = '💬 The crowd is placing its bets. Watch the odds move…';
      break;
    case 'betting':
      text = bout.dive
        ? `🤫 The fix is in. Bet on <b>${escapeHtml(bout.lobsters[1].name)}</b>, and act natural.`
        : bout.entry
        ? `🦞 Your lobster fights for a <b>${money(purseFor(bout.entry, save.career.venue))}</b> purse. Back it, just watch, or fix it in the <b>🦞 Your lobster</b> tab.`
        : save.bouts < 3
          ? '👇 <b>Set your stake</b>, then back a lobster. <b>🎯</b> on a card means its arguments hit the other’s weak spot.'
          : save.cup
            ? '👇 <b>Set your stake</b> and back a lobster, or bet on who wins the whole thing in the <b>🏆 Cup</b> tab.'
            : '👇 <b>Set your stake</b> and back a lobster, or try <b>Props</b>, <b>Parlay</b> or <b>Intel</b> first.';
      break;
    case 'fighting':
      step = 'fight';
      text = `🥊 Fight on! ${riding ? `You’ve got <b>${money(riding)}</b> riding on it. ` : ''}<kbd>Space</kbd> skips to the result.`;
      break;
    case 'live':
      step = 'fight';
      tone = 'live';
      text = '⏸ <b>Live market:</b> cash out a bet, bet on the fight as it stands, or continue.';
      break;
    case 'done':
      step = 'collect';
      tone = resultNote.startsWith('💰') ? 'good' : resultNote.startsWith('📉') ? 'bad' : '';
      text = `${resultNote} <b>${save.career.bout >= boutsTonight() ? 'End of the night ▶' : 'Next bout ▶'}</b> when you’re ready.`;
      break;
  }
  els.guide.dataset.step = step;
  els.guide.dataset.tone = tone;
  els.guideText.innerHTML = text;
  const nudge = phase === 'betting' && save.bouts < 3 && yourBets.length === 0;
  for (const b of els.bets) b.classList.toggle('nudge', nudge);
}

/** Something you tried didn't work: say so where you're looking. */
function warn(text: string) {
  log(text, 'warn');
  clearTimeout(flashTimer);
  els.guide.dataset.tone = 'warn';
  els.guideText.textContent = `⚠️ ${text}`;
  pulse(els.guide, 'shake');
  flashTimer = window.setTimeout(() => {
    flashTimer = 0;
    renderGuide();
  }, 2600);
}

function setPhase(p: Phase) {
  phase = p;
  els.preview.hidden = p === 'fighting' || p === 'done';
  renderGuide();
  renderSlip();
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
  /** The house's odds on each prop. */
  propOdds: Record<PropId, number>;
  /** Tips you bought for this bout. */
  tips: Tip[];
  /** Your lobster's fight: the tier you signed up for (null for a league bout). */
  entry: Tier | null;
  /** The pool's odds once the public's money was in (the stats line), and when betting closed. */
  opening: [number, number] | null;
  closing: [number, number] | null;
  /** Your lobster's paid to lose this one (null for an honest fight). */
  dive: Dive | null;
  /** The cops show up after round 1 (decided when betting closes). */
  raid: boolean;
  /** Lobsters the announcer called undefeated. */
  hyped: Side[];
  /** Which cup match this is (null outside the cup). */
  cupMatch: number | null;
}

/** Your bets on this bout: the pool bet, and any live bets. `payout` is what it pays if it wins. */
interface YourBet {
  kind: 'pool' | 'live' | 'prop';
  /** For props: which one. */
  prop?: PropId;
  side: Side;
  stake: number;
  payout: number;
  /** Cashed out for this much (and settled), or null. */
  cashedOut: number | null;
  /** At some live market it was only worth less than its stake. */
  underwater?: boolean;
}

let phase: Phase = 'opening';
let bout: Bout;
let lastPair: [number, number] | null = null;
let yourBets: YourBet[] = [];
/** Bumped with each new bout, so the old bout's timers know to stop. */
let boutToken = 0;
/** The fight's seed, picked when betting closes (it decides the fight, and lets a reload replay it). */
let fightSeed: number | null = null;
/** The crowd waits for you to walk in before it bets. */
let openDoors!: () => void;
const startGate = new Promise<void>((resolve) => (openDoors = resolve));

async function newBout() {
  const token = ++boutToken;
  // Cup night: the bracket decides the bouts (and your lobster's fight waits for tomorrow).
  if (isCupNight(save.career.night) && !save.cup && save.career.bout === 0) save.cup = newCup(save.roster.length, Math.random);
  const cupMatch = save.cup ? nextMatch(save.cup) : null;
  // Your lobster's fight goes in before the card's next bout; otherwise the next bout comes off the card.
  const entry = cupMatch === null && save.entry && save.stable && save.stable.rest === 0 ? save.entry : null;
  if (cupMatch === null) save.entry = null;
  let ids: [number, number];
  let lobsters: [Lobster, Lobster];
  if (cupMatch !== null) {
    ids = matchOf(save.cup!, cupMatch)!;
    lobsters = [save.roster[ids[0]], save.roster[ids[1]]];
  } else if (entry && save.stable) {
    const opponent = pickOpponent(save.roster, entry, Math.random);
    ids = [MINE_ID, opponent.id];
    lobsters = [save.stable.lobster, opponent];
  } else {
    ids = save.card.shift() ?? pickBout(save.roster.length, Math.random, lastPair);
    lastPair = ids;
    lobsters = [save.roster[ids[0]], save.roster[ids[1]]];
  }
  while (save.card.length < 2) save.card.push(pickBout(save.roster.length, Math.random, save.card[save.card.length - 1] ?? lastPair ?? [0, 1]));
  stageBout(lobsters, ids, entry);
  els.arena.classList.remove('raid');
  voidStaleParlay();
  // Saved straight away: leave now and you get this same bout back.
  savePending();
  log(entry ? `🦞 Your lobster ${lobsters[0].name} steps into the ring against ${lobsters[1].name} (${factionById(lobsters[1].faction).name}), ${TIERS.find((t) => t.id === entry)!.name.toLowerCase()} fight, purse ${money(purseFor(entry, save.career.venue))}.` : `🔔 Bout ${save.bouts + 1}: ${lobsters[0].name} (${factionById(lobsters[0].faction).name}) vs ${lobsters[1].name} (${factionById(lobsters[1].faction).name}). The pool is open.`, 'bell');
  await startGate;
  if (token !== boutToken) return;
  const intro = introduce(lobsters, venue().id, save.career.bout === 0, !!entry, Math.random).lines;
  if (cupMatch !== null) intro.splice(save.career.bout === 0 ? 1 : 0, 0, `The Invisible Claw Cup: it’s the ${ROUND_NAMES[cupMatch]}!`);
  announce(intro);
  // The crowd puts its money down first, one by one (and on a whale night, the whale).
  const ev = tonightEvent();
  const crowd = crowdBets(lobsters[0], lobsters[1], bout.publicP, Math.random, venue().scale * (ev?.crowdScale ?? 1), ev?.memeScale ?? 1);
  if (ev?.whale) {
    const publicMoney = crowd.filter((x) => x.who === 'public').reduce((sum, x) => sum + x.amount, 0);
    crowd.push({ who: 'whale', side: Math.random() < 0.5 ? 0 : 1, amount: whaleBet(publicMoney, Math.random) });
  }
  for (const b of crowd) {
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
  setPhase('betting');
  setBetButtons(true);
  renderPool();
  renderProps();
  renderParlay();
  renderIntel();
  renderStable();
  renderCup();
}

/** Puts a bout in the ring: its lobsters, the pool, the cards and every panel. */
function stageBout(lobsters: [Lobster, Lobster], ids: [number, number], entry: Tier | null, pool: PoolBet[] = [], tips: Tip[] = [], bets: YourBet[] = []) {
  bout = { lobsters, ids, publicP: publicChance(lobsters[0], lobsters[1]), pool, propOdds: propOdds(propChances(lobsters[0], lobsters[1])), tips, entry, opening: null, closing: null, dive: null, raid: false, cupMatch: cupIndexFor(ids), hyped: lobsters.flatMap((l, i) => (l.losses === 0 && l.wins >= 3 ? [i as Side] : [])) };
  parlayPicks = [null, null, null];
  yourBets = bets;
  fightSeed = null;
  resultNote = '';
  setPhase('opening');
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
    el.querySelector('.nameplate')!.textContent = lobsters[side].name;
    setHp(side, lobsters[side].stamina, lobsters[side].stamina);
    el.querySelector<HTMLElement>('.say')!.hidden = true;
  }
  els.betRow.hidden = false;
  els.stakeRow.hidden = false;
  els.after.hidden = true;
  setBetButtons(false);
  // Lost some? Don't leave a stake you can't cover (or the venue won't take).
  clampStake();
  updateBankroll();
  renderVenue();
  renderStable();
  renderPool();
  renderProps();
  renderParlay();
  renderIntel();
  renderSlip();
  els.tabbar.hidden = false;
  renderCup();
  renderRivals();
}

/** Saves the bout in progress, with your bets on it. */
function savePending() {
  save.pending = { ids: bout.ids, entry: bout.entry, seed: fightSeed, bets: yourBets, pool: bout.pool, tips: bout.tips, dive: bout.dive };
  persist();
}

/**
 * Back from leaving mid-bout. A fight that had started was already decided (by its seed), so it's settled
 * as it would have ended. If betting was still open, your bets come back and so does the bout.
 */
function resumePending(): boolean {
  const p = save.pending;
  save.pending = null;
  if (!p) return false;
  const mine = save.stable?.lobster;
  const a = p.ids[0] === MINE_ID ? mine : save.roster[p.ids[0]];
  const b = p.ids[1] === MINE_ID ? undefined : save.roster[p.ids[1]];
  if (p.seed === null || !a || !b) {
    const refund = p.bets.filter((x) => x.cashedOut === null).reduce((sum, x) => sum + x.stake, 0);
    save.bankroll += refund;
    if (p.entry && save.stable) save.entry = p.entry;
    else if (a && b && !save.cup) save.card.unshift(p.ids);
    if (refund) log(`↩️ You left before the fight started. Your ${money(refund)} in bets came back.`, 'warn');
    persist();
    return false;
  }
  stageBout([a, b], p.ids, p.entry, p.pool, p.tips, p.bets);
  fightSeed = p.seed;
  bout.dive = p.dive;
  bout.raid = raidFor(p.seed);
  els.betRow.hidden = true;
  els.stakeRow.hidden = true;
  els.tabbar.hidden = true;
  showTab('winner');
  els.after.hidden = false;
  if (bout.raid) {
    log('📼 You left in the middle of a fight. Here’s how it ended.', 'bell');
    raid();
    return true;
  }
  const result = simulate(bout.dive ? diveFighter(a) : a, b, seededRng(p.seed));
  // Show where the fight ended up.
  const hp: [number, number] = [weighIn(a).stamina, weighIn(b).stamina];
  for (const e of result.events) if (e.type === 'argue') [hp[0], hp[1]] = e.hp;
  for (const side of [0, 1] as Side[]) setHp(side, hp[side], weighIn(bout.lobsters[side]).stamina);
  if (result.ending === 'ko') els.fighters[result.winner === 0 ? 1 : 0].classList.add('ko');
  log('📼 You left in the middle of a fight. Here’s how it ended.', 'bell');
  finish(result);
  return true;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** A meme bettor yells as they put their money down. */
function crowdShout(b: PoolBet) {
  if (b.who === 'you' || b.who === 'public') return;
  const bettor = bettorById(b.who);
  const i = BETTORS.indexOf(bettor);
  const spot = els.spectators[i] ?? els.spectators[1];
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

// ---------------------------------------------------------------------------
// Tabs: the winner (pool), props, parlays and intel
// ---------------------------------------------------------------------------

function showTab(name: string) {
  for (const t of els.tabs) t.classList.toggle('on', t.dataset.tab === name);
  for (const p of els.panes) p.hidden = p.dataset.tab !== name;
}

for (const t of els.tabs) t.addEventListener('click', () => showTab(t.dataset.tab!));

/** Why this stake can't be placed (or null if it can). */
function stakeProblem(amount: number): string | null {
  if (amount < 10) return 'The minimum stake is $10. Even the free market has standards.';
  if (amount > maxStake()) return `${venue().name} takes bets up to ${money(maxStake())}${tonightEvent()?.stakeScale ? ' tonight' : ''}.`;
  if (amount > save.bankroll) return `You don’t have the capital for that (you’ve got ${money(save.bankroll)}).`;
  return null;
}

/** Takes a stake from your bankroll (or explains why not). */
function takeStake(amount = stake()): number | null {
  const problem = stakeProblem(amount);
  if (problem) {
    warn(problem);
    return null;
  }
  save.bankroll -= amount;
  updateBankroll();
  return amount;
}

/** Your side bets on this bout, and the main button's label. */
function renderSlip() {
  const open = yourBets.filter((b) => b.cashedOut === null);
  const chips = open.map((b) => {
    const what = b.kind === 'prop' ? `${propById(b.prop!).icon} ${propById(b.prop!).name}` : `${b.kind === 'live' ? '⚡' : '💵'} ${escapeHtml(firstName(bout.lobsters[b.side]))}`;
    return `<span class="ticket-chip side-${b.kind === 'prop' ? 'x' : b.side}">${what} <b>${money(b.stake)}</b> → ${money(b.payout)}</span>`;
  });
  if (save.parlay) chips.push(`<span class="ticket-chip side-x">🧾 Parlay <b>${money(save.parlay.stake)}</b> → ${money(save.parlay.stake * parlayOdds(save.parlay.legs))}</span>`);
  els.slip.hidden = !chips.length || phase === 'live' || phase === 'done';
  els.slip.innerHTML = chips.length ? `<span class="ticket-label">Your ticket</span>${chips.join('')}` : '';
  const sideBets = open.some((b) => b.kind === 'prop') || !!save.parlay;
  els.watch.textContent = sideBets ? '▶ Start (no winner bet)' : '👀 Just watch';
  renderBadges();
}

/** Little counters on the tabs, so you can see what's going on in each without opening it. */
function renderBadges() {
  const set = (tab: string, text: string) => {
    const b = els.tabs.find((t) => t.dataset.tab === tab)?.querySelector<HTMLElement>('.badge-count');
    if (!b) return;
    b.hidden = !text;
    b.textContent = text;
    b.classList.toggle('emoji', !!text && !/^[\d✓!]+$/.test(text));
  };
  set('props', String(yourBets.filter((b) => b.kind === 'prop').length || ''));
  set('parlay', save.parlay ? '✓' : '');
  set('cup', save.cup?.futures.length ? String(save.cup.futures.length) : '');
  set('intel', bout?.tips.length ? String(bout.tips.length) : '');
  const st = save.stable;
  set('stable', st ? (st.rest ? '🩹' : save.entry ? '🥊' : '!') : save.career.venue >= MARKET_VENUE ? '🐟' : '');
}

// --- Props ---

function renderProps() {
  const last = save.lastProps;
  els.propsRepeat.hidden = !last.length || phase !== 'betting' || yourBets.some((b) => b.kind === 'prop');
  els.propsRepeat.textContent = `↺ Same props as last time: ${last.map((x) => propById(x.prop).icon).join(' ')} · ${money(last.reduce((sum, x) => sum + x.stake, 0))}`;
  els.propsRepeat.title = last.map((x) => `${money(x.stake)} on “${propById(x.prop).name}”`).join(', ');
  els.props.replaceChildren(
    ...PROPS.map((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'prop';
      b.disabled = phase !== 'betting';
      b.innerHTML = `<span>${p.icon} ${p.name}</span><b>${bout.propOdds[p.id].toFixed(2)}×</b>`;
      b.addEventListener('click', () => placeProp(p.id));
      return b;
    }),
  );
}

function placeProp(id: PropId, amount_ = stake()) {
  if (phase !== 'betting') return false;
  const amount = takeStake(amount_);
  if (amount === null) return false;
  const odds = bout.propOdds[id];
  yourBets.push({ kind: 'prop', prop: id, side: 0, stake: amount, payout: Math.floor(amount * odds), cashedOut: null });
  play('coin');
  award('first-bet');
  log(`🎲 Prop: ${money(amount)} on “${propById(id).name}” at ${odds.toFixed(2)}×.`, 'bet');
  savePending();
  renderSlip();
  renderProps();
  return true;
}

els.propsRepeat.addEventListener('click', () => {
  for (const x of save.lastProps) if (!placeProp(x.prop, x.stake)) break;
});

// --- Parlays ---

let parlayPicks: (Side | null)[] = [null, null, null];

/** This bout and the next two on the card, with the house's parlay odds for each side. */
function parlayCard(): { ids: [number, number]; odds: [number, number] }[] {
  return [bout.ids, ...save.card.slice(0, 2)].map((ids) => {
    const p = publicChance(save.roster[ids[0]], save.roster[ids[1]]);
    return { ids, odds: [Math.min(MAX_LEG_ODDS, liveOdds(p)), Math.min(MAX_LEG_ODDS, liveOdds(1 - p))] };
  });
}

function renderParlay() {
  const active = save.parlay;
  if (!active && (bout.entry || save.cup)) {
    els.parlayLegs.replaceChildren();
    els.parlayPlace.hidden = true;
    els.parlaySummary.hidden = false;
    els.parlayActive.hidden = true;
    els.parlaySummary.textContent = save.cup ? 'No parlays during the cup: nobody knows who fights next. Try futures in the 🏆 Cup tab.' : 'No parlays on a bout with your own lobster in it. Conflict of interest. Come back next bout.';
    return;
  }
  els.parlayPlace.hidden = !!active;
  els.parlayLegs.hidden = !!active;
  els.parlaySummary.hidden = !!active;
  els.parlayActive.hidden = !active;
  if (active) {
    els.parlayActive.innerHTML = `<b>Your parlay: ${money(active.stake)} at ${parlayOdds(active.legs).toFixed(2)}× → ${money(active.stake * parlayOdds(active.legs))}</b>`;
    const ul = document.createElement('ul');
    for (const leg of active.legs) {
      const li = document.createElement('li');
      const mark = leg.won === null ? '⏳' : leg.won ? '✅' : '❌';
      li.textContent = `${mark} ${save.roster[leg.ids[leg.side]].name} (over ${save.roster[leg.ids[leg.side === 0 ? 1 : 0]].name}) at ${leg.odds.toFixed(2)}×`;
      ul.append(li);
    }
    els.parlayActive.append(ul);
    return;
  }
  const card = parlayCard();
  els.parlayLegs.replaceChildren(
    ...card.map((leg, i) => {
      const row = document.createElement('div');
      row.className = 'leg';
      row.innerHTML = `<span class="leg-title">${i === 0 ? 'This bout' : `Bout ${save.bouts + 1 + i}`}</span>`;
      for (const side of [0, 1] as Side[]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `leg-pick${parlayPicks[i] === side ? ' on' : ''}`;
        b.innerHTML = `${escapeHtml(save.roster[leg.ids[side]].name)} <b>${leg.odds[side].toFixed(2)}×</b>`;
        b.disabled = phase !== 'betting';
        b.addEventListener('click', () => {
          parlayPicks[i] = parlayPicks[i] === side ? null : side;
          renderParlay();
        });
        row.append(b);
      }
      return row;
    }),
  );
  const picked = parlayPicks.every((p) => p !== null);
  const odds = picked ? parlayOdds(card.map((leg, i) => ({ odds: leg.odds[parlayPicks[i]!] }))) : 0;
  els.parlaySummary.textContent = picked ? `Parlay odds ${odds.toFixed(2)}× · ${money(stake())} pays ${money(stake() * odds)} if all three win.` : 'Pick a winner in all three bouts.';
  els.parlayPlace.disabled = !picked || phase !== 'betting';
}

els.parlayPlace.addEventListener('click', () => {
  if (phase !== 'betting' || save.parlay || parlayPicks.some((p) => p === null)) return;
  const card = parlayCard();
  const amount = takeStake();
  if (amount === null) return;
  save.parlay = { stake: amount, legs: card.map((leg, i) => ({ ids: leg.ids, side: parlayPicks[i]!, odds: leg.odds[parlayPicks[i]!], won: null })) };
  play('coin');
  award('first-bet');
  log(`🧾 Parlay: ${money(amount)} on three winners at ${parlayOdds(save.parlay.legs).toFixed(2)}×.`, 'bet');
  persist();
  renderParlay();
  renderSlip();
});

/** A parlay whose bouts fell off the card (a reload mid-bout) is void: you get your stake back. */
function voidStaleParlay() {
  const p = save.parlay;
  if (!p) return;
  const upcoming = [bout.ids, ...save.card];
  const pending = p.legs.filter((l) => l.won === null);
  if (pending.every((l) => upcoming.some((u) => u[0] === l.ids[0] && u[1] === l.ids[1]))) return;
  save.bankroll += p.stake;
  save.parlay = null;
  log(`🧾 Your parlay was voided (its bouts are off the card). ${money(p.stake)} refunded.`, 'warn');
}

// --- The cup: the bracket and futures ---

/** The cup match these two are fighting right now, if any. */
function cupIndexFor(ids: [number, number]): number | null {
  const cup = save.cup;
  const m = cup ? nextMatch(cup) : null;
  const pair = m === null ? null : matchOf(cup!, m);
  return pair && pair[0] === ids[0] && pair[1] === ids[1] ? m : null;
}

/** The house's futures odds, worked out from the public's line on every possible match-up. */
let cupOdds: { key: string; odds: Map<number, number> } | null = null;
function futures(): Map<number, number> {
  const cup = save.cup!;
  const key = `${cup.seeds.join()}|${cup.winners.join()}|${save.bouts}`;
  if (cupOdds?.key === key) return cupOdds.odds;
  const memo = new Map<string, number>();
  const chances = cupChances(cup, (a, b) => {
    const k = `${a}-${b}`;
    if (!memo.has(k)) memo.set(k, publicChance(save.roster[a], save.roster[b], undefined, 200));
    return memo.get(k)!;
  });
  const odds = new Map([...chances].filter(([, p]) => p > 0).map(([id, p]) => [id, futuresOdds(p)]));
  cupOdds = { key, odds };
  return odds;
}

function renderCup() {
  const cup = save.cup;
  els.cupTab.hidden = !cup;
  els.parlayTab.hidden = !!cup && !save.parlay;
  if ((els.cupTab.hidden && els.cupTab.classList.contains('on')) || (els.parlayTab.hidden && els.parlayTab.classList.contains('on'))) showTab('winner');
  renderBadges();
  if (!cup) return;
  const now = phase === 'done' ? null : nextMatch(cup);
  const name = (id: number | null) => (id === null ? '<em>TBD</em>' : escapeHtml(save.roster[id].name));
  const box = (i: number) => {
    const slots = i < 4 ? [cup.seeds[i * 2], cup.seeds[i * 2 + 1]] : [cup.winners[(i - 4) * 2], cup.winners[(i - 4) * 2 + 1]];
    const w = cup.winners[i];
    return `<div class="match${i === now ? ' now' : ''}">${slots.map((id) => `<span class="${w !== null && id === w ? 'won' : w !== null ? 'out' : ''}">${id !== null ? factionById(save.roster[id].faction).icon : '·'} ${name(id)}</span>`).join('')}</div>`;
  };
  const champ = champion(cup);
  els.cupBracket.innerHTML = `
    <div class="round-col"><h4>Quarter-finals</h4><div class="round-matches">${[0, 1, 2, 3].map(box).join('')}</div></div>
    <div class="round-col"><h4>Semi-finals</h4><div class="round-matches">${[4, 5].map(box).join('')}</div></div>
    <div class="round-col"><h4>Final</h4><div class="round-matches">${box(6)}<div class="champ${champ !== null ? ' crowned' : ''}">🏆 ${champ !== null ? name(champ) : 'Champion'}</div></div></div>`;
  const mine = cup.futures.map((f) => `<li>🏆 ${money(f.stake)} on <b>${escapeHtml(save.roster[f.id].name)}</b> at ${f.odds.toFixed(2)}× → ${money(f.stake * f.odds)}${alive(cup).includes(f.id) ? '' : ' <em>(out)</em>'}</li>`).join('');
  if (champ !== null) {
    els.cupFutures.innerHTML = mine ? `<ul class="your-futures">${mine}</ul>` : '';
    return;
  }
  const odds = futures();
  const rows = alive(cup)
    .sort((a, b) => (odds.get(a) ?? 99) - (odds.get(b) ?? 99))
    .map((id) => {
      const l = save.roster[id];
      return `<button type="button" class="future" data-id="${id}" ${phase !== 'betting' ? 'disabled' : ''}><span>${factionById(l.faction).icon} ${escapeHtml(l.name)}</span><b>${(odds.get(id) ?? 50).toFixed(2)}×</b></button>`;
    })
    .join('');
  els.cupFutures.innerHTML = `<p class="pane-note">🔮 <b>Futures:</b> bet on who wins the whole cup, at the house’s odds right now (your stake below). Settled after the final.${started(cup) ? '' : ' Bet before the first bout for the longest odds.'}</p><div class="futures">${rows}</div>${mine ? `<ul class="your-futures">${mine}</ul>` : ''}`;
  for (const b of els.cupFutures.querySelectorAll<HTMLButtonElement>('.future')) b.addEventListener('click', () => placeFuture(Number(b.dataset.id)));
}

function placeFuture(id: number) {
  const cup = save.cup;
  if (!cup || phase !== 'betting' || !alive(cup).includes(id)) return;
  const odds = futures().get(id);
  if (!odds) return;
  const amount = takeStake();
  if (amount === null) return;
  cup.futures.push({ id, stake: amount, odds, early: !started(cup) });
  play('coin');
  award('first-bet');
  log(`🔮 Futures: ${money(amount)} on ${save.roster[id].name} to win the cup at ${odds.toFixed(2)}×.`, 'bet');
  persist();
  renderCup();
}

/** The final's done: futures pay out. Returns your profit on them. */
function settleCup(): number {
  const cup = save.cup!;
  const champ = champion(cup)!;
  const winner = save.roster[champ];
  let net = 0;
  for (const f of cup.futures) {
    const pay = f.id === champ ? Math.floor(f.stake * f.odds) : 0;
    save.bankroll += pay;
    net += pay - f.stake;
    recordBet(save.ledger, 'futures', f.stake, pay, `${money(f.stake)} on ${save.roster[f.id].name} to win the cup at ${f.odds.toFixed(2)}×`);
    if (pay) {
      if (f.early) award('cup-called');
      if (f.odds >= 8) award('cup-long');
    }
  }
  toast('🏆', 'CUP CHAMPION', winner.name);
  if (cup.futures.length) log(net > 0 ? `🔮💰 Your futures came in: up ${money(net)} on the cup.` : `🔮 Your futures on the cup: ${net < 0 ? `down ${money(-net)}` : 'even'}.`, net > 0 ? 'win' : 'lose');
  return net;
}

// --- The regulars ---

const playerName = (id: Player) => (id === 'you' ? '🫵 You' : `${bettorById(id).face} ${bettorById(id).name.split(' ')[1]}`);
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${money(Math.abs(n))}`;

function renderRivals() {
  els.rivals.innerHTML = `<span class="rivals-label" title="You against the regulars: everyone’s profit on tonight’s bouts. The season table is in 🏅 Record.">🏁 Tonight</span>${ranking(save.rivals.tonight)
    .map((r, i) => `<span class="rival${r.id === 'you' ? ' you' : ''}"><i>${i + 1}</i>${playerName(r.id)} <b class="${r.amount > 0 ? 'up' : r.amount < 0 ? 'down' : ''}">${signed(r.amount)}</b></span>`)
    .join('')}`;
}

/** Puts a bout on the tables, and lets the regular who did best (or worst) say something about it. */
function scoreRivals(you: number, theirs: Record<RivalId, number>) {
  addResults(save.rivals, you, theirs);
  const loudest = RIVALS.reduce((a, b) => (Math.abs(theirs[b]) > Math.abs(theirs[a]) ? b : a));
  const amount = theirs[loudest];
  if (amount) {
    const lines = amount > 0 ? GLOATS[loudest] : GRUMBLES[loudest];
    const spot = els.spectators[RIVALS.indexOf(loudest)];
    spot.querySelector<HTMLElement>('.shout')!.textContent = lines[Math.floor(Math.random() * lines.length)];
    spot.classList.remove('shouting');
    void spot.offsetWidth;
    spot.classList.add('shouting');
  }
  if (save.rivals.bouts >= 30 && save.rivals.season.you > 0 && leading(save.rivals.season)) award('season-leader');
  renderRivals();
}

// --- Intel: tipsters and scouting ---

function renderIntel() {
  renderBadges();
  els.tipsters.replaceChildren(
    ...TIPSTERS.map((t) => {
      const rec = save.tipsters[t.id];
      const total = rec.right + rec.wrong;
      const row = document.createElement('div');
      row.className = 'tipster';
      row.innerHTML = `<span class="face"></span><div><b></b><small></small><small class="record"></small></div><button type="button"></button>`;
      row.querySelector('.face')!.textContent = t.face;
      row.querySelector('b')!.textContent = t.name;
      row.querySelector('small')!.textContent = t.blurb;
      row.querySelector('.record')!.textContent = total ? `Track record with you: ${rec.right}–${rec.wrong} (${Math.round((rec.right / total) * 100)}%)` : 'No track record with you yet.';
      const b = row.querySelector('button')!;
      const bought = bout.tips.some((x) => x.by === t.id);
      b.textContent = bought ? 'Bought' : t.price ? `Buy a tip · ${money(price(t.price))}` : 'Read his post · free';
      b.disabled = bought || phase !== 'betting' || save.bankroll < price(t.price);
      b.addEventListener('click', () => buyFrom(t.id));
      return row;
    }),
  );
  els.scouts.replaceChildren(
    ...([0, 1] as Side[]).map((side) => {
      const l = bout.lobsters[side];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'scout';
      b.textContent = l.traitKnown ? `${l.name}: trait known` : l.scouted ? `${l.name}: already scouted` : `👀 Watch ${l.name} in the tank · ${money(price(SCOUT_PRICE))}`;
      b.disabled = l.traitKnown || l.scouted || phase !== 'betting' || save.bankroll < price(SCOUT_PRICE);
      b.addEventListener('click', () => scout(side));
      return b;
    }),
  );
  els.notebook.replaceChildren(
    ...bout.tips.map((tip) => {
      const li = document.createElement('li');
      li.textContent = `${tipsterById(tip.by).face} ${tip.text}`;
      return li;
    }),
  );
}

function buyFrom(id: TipsterId) {
  if (phase !== 'betting' || bout.tips.some((t) => t.by === id)) return;
  const t = tipsterById(id);
  if (save.bankroll < price(t.price)) return;
  const tip = buyTip(id, bout.lobsters, Math.random);
  if (!tip) {
    log(`${t.face} ${t.name} shrugs: “You know as much as I do about these two.”`, '');
    return;
  }
  save.bankroll -= price(t.price);
  updateBankroll();
  bout.tips.push(tip);
  if (!save.stats.tipsters.includes(id)) save.stats.tipsters.push(id);
  if (save.stats.tipsters.length >= 3) award('tipsters');
  if (tip.kind === 'trait') bout.lobsters[tip.side].rumor = { trait: tip.trait, by: id };
  play('reveal');
  log(`${t.face} ${t.name}: “${tip.text}”`, 'trait');
  persist();
  renderIntel();
  renderCard(tip.side);
}

function scout(side: Side) {
  const l = bout.lobsters[side];
  if (phase !== 'betting' || l.scouted || l.traitKnown || save.bankroll < price(SCOUT_PRICE)) return;
  save.bankroll -= price(SCOUT_PRICE);
  l.scouted = true;
  save.stats.scouted++;
  if (save.stats.scouted >= 10) award('scout-10');
  updateBankroll();
  play('reveal');
  log(`👀 You slip the kitchen staff ${money(price(SCOUT_PRICE))}. In the tank, ${l.name} ${TELLS[l.trait][l.id % 2]}`, 'trait');
  persist();
  renderIntel();
  renderCard(side);
}

/** When a trait comes out, any rumor about it is settled, for the tipster's track record. */
function settleRumor(l: Lobster) {
  if (!l.rumor) return;
  const by = l.rumor.by as TipsterId;
  if (save.tipsters[by]) {
    if (l.rumor.trait === l.trait) save.tipsters[by].right++;
    else save.tipsters[by].wrong++;
  }
  l.rumor = null;
}

/** The pool panel: each side's money, the odds, who bet what, and your projected payout. */
function renderPool() {
  const t = totals(bout.pool);
  const odds = poolOdds(t, cut());
  const total = t[0] + t[1];
  // The public bets first, on the stats: that's the opening line. The meme money moves it from there.
  if (!bout.opening && t[0] && t[1]) bout.opening = odds;
  for (const side of [0, 1] as Side[]) {
    els.poolBar[side].style.flexGrow = String(Math.max(1, t[side]));
    els.poolBar[side].textContent = total ? `${money(t[side])}` : '';
    els.bets[side].dataset.odds = total ? `${odds[side].toFixed(2)}×` : '…';
  }
  const c = cut();
  els.poolTotal.textContent = total ? `POOL ${money(total)} · ${c < 0 ? `+${Math.round(-c * 100)}% printed money` : c === 0 ? 'no house cut tonight' : `house cut ${Math.round(c * 100)}%`}` : 'The crowd is placing its bets…';
  const rows = bout.pool.filter((b) => b.who !== 'public');
  els.poolBets.replaceChildren(
    ...rows.map((b) => {
      const li = document.createElement('li');
      const face = b.who === 'you' ? '🫵' : bettorById(b.who).face;
      const who = b.who === 'you' ? 'You' : bettorById(b.who).name;
      li.className = `side-${b.side}${b.who === 'you' ? ' you' : ''}`;
      li.textContent = `${face} ${who} ${money(b.amount)} on ${firstName(bout.lobsters[b.side])}${b.late ? ' (late!)' : ''}`;
      li.title = b.who === 'you' ? '' : bettorById(b.who).style;
      return li;
    }),
  );
  updatePreview();
}

/** What your stake would pay on each side right now (your own money moves the odds). */
function updatePreview() {
  const amount = stake();
  const problem = stakeProblem(amount);
  els.preview.textContent = problem ? `⚠️ ${problem}` : '';
  els.preview.classList.toggle('problem', !!problem);
  els.stakeCap.textContent = `max ${money(Math.min(maxStake(), Math.max(0, save.bankroll)))}`;
  const t = totals(bout.pool);
  const ready = t[0] > 0 && t[1] > 0 && !problem;
  for (const side of [0, 1] as Side[]) {
    const pays = ready ? projectedPayout(t, side, amount, cut()) : 0;
    const now = Number.parseFloat(els.bets[side].dataset.odds ?? '');
    els.bets[side].innerHTML = betLabel(side, 'Bet on', els.bets[side].dataset.odds ?? '…', pays ? `${money(amount)} pays ${money(pays)}` : '', bout.opening ? oddsMove(bout.opening[side], now) : '');
  }
  if (phase === 'live') {
    const odds = liveOddsPair();
    for (const side of [0, 1] as Side[]) els.liveBets[side].innerHTML = betLabel(side, 'Bet live on', `${odds[side].toFixed(2)}×`, problem ? '' : `${money(amount)} pays ${money(Math.floor(amount * odds[side]))}`, bout.closing ? oddsMove(bout.closing[side], odds[side], 'at the bell') : '');
  }
}

function betLabel(side: Side, verb: string, odds: string, pays: string, move = '') {
  return `<kbd>${side + 1}</kbd><span class="who">${verb} <b>${escapeHtml(bout.lobsters[side].name)}</b></span><span class="odds">${odds}${move}</span><small class="pays">${pays || '&nbsp;'}</small>`;
}

/** An arrow for odds that moved: ▲ they got longer (pays more), ▼ shorter. */
function oddsMove(from: number, to: number, since = 'on the stats') {
  if (!Number.isFinite(to) || Math.abs(to - from) < 0.05) return '';
  const up = to > from;
  return `<i class="move ${up ? 'up' : 'down'}" title="Opened ${since} at ${from.toFixed(2)}×">${up ? '▲' : '▼'} <small>from ${from.toFixed(2)}</small></i>`;
}

els.stake.addEventListener('input', () => {
  rememberStake();
  updatePreview();
  if (!save.parlay && phase === 'betting') renderParlay();
});

function setHp(side: Side, hp: number, max: number) {
  const el = els.fighters[side].querySelector('.hp')!;
  const pct = Math.max(0, (hp / max) * 100);
  (el.querySelector('i') as HTMLElement).style.width = `${pct}%`;
  el.classList.toggle('low', pct < 30);
  el.querySelector('span')!.textContent = `${hp}`;
}

function updateBankroll() {
  const before = Number(els.bankroll.dataset.value ?? save.bankroll);
  els.bankroll.textContent = money(save.bankroll);
  els.bankroll.dataset.value = String(save.bankroll);
  els.bankroll.classList.toggle('broke', save.bankroll < 10);
  if (save.bankroll !== before) pulse(els.bankroll, save.bankroll > before ? 'up' : 'down');
  if (bout) {
    renderVenue();
    updatePreview();
  }
}

const money = (n: number) => `$${Math.floor(n).toLocaleString('en-US')}`;

function log(text: string, kind = '') {
  const div = document.createElement('div');
  div.className = kind ? `log-entry log-${kind}` : 'log-entry';
  div.textContent = text;
  els.log.prepend(div);
  while (els.log.children.length > 60) els.log.lastChild!.remove();
}

els.logToggle.addEventListener('click', () => {
  const open = els.log.classList.toggle('collapsed') === false;
  els.logToggle.setAttribute('aria-expanded', String(open));
  els.logToggle.querySelector('span')!.textContent = open ? 'show less ▴' : 'show all ▾';
});

/** Unlocks an achievement (once), with a pop-up. */
function award(id: string) {
  if (unlocked.has(id)) return;
  const a = achievementById(id);
  if (!a) return;
  unlocked.add(id);
  save.achievements = [...unlocked];
  toast(a.icon, 'ACHIEVEMENT UNLOCKED', a.name);
  play('achievement');
  persist();
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

function rememberStake() {
  if (stake() < 10 || stake() === save.stake) return;
  save.stake = stake();
  persist();
}

for (const b of document.querySelectorAll<HTMLButtonElement>('.chips button')) {
  b.addEventListener('click', () => {
    const add = b.dataset.add!;
    if (add === 'max') els.stake.value = String(Math.min(save.bankroll, maxStake()));
    else if (add === 'clear') els.stake.value = '0';
    else els.stake.value = String(Math.min(save.bankroll, maxStake(), stake() + Number(add)));
    rememberStake();
    updatePreview();
    if (!save.parlay && phase === 'betting') renderParlay();
  });
}

function placeBet(side: Side | null) {
  if (phase !== 'betting') return;
  getAudioContext();
  if (side !== null) {
    const amount = stake();
    const problem = stakeProblem(amount);
    if (problem) {
      warn(problem);
      return;
    }
    save.bankroll -= amount;
    bout.pool.push({ who: 'you', side, amount });
    updateBankroll();
    play('coin');
    award('first-bet');
  } else {
    log('👀 You keep your money in your pocket and watch.', '');
  }
  // Betting closes; somebody might still sneak a late bet in.
  phase = 'fighting';
  fightSeed = Math.floor(Math.random() * 4294967296);
  showTab('winner');
  els.tabbar.hidden = true;
  const late = lateBet(Math.random, venue().scale);
  if (late) {
    bout.pool.push(late);
    crowdShout(late);
  }
  const odds = poolOdds(totals(bout.pool), cut());
  bout.closing = odds;
  if (side !== null) {
    const amount = bout.pool.find((b) => b.who === 'you')!.amount;
    yourBets.push({ kind: 'pool', side, stake: amount, payout: Math.floor(amount * odds[side]), cashedOut: null });
    log(`💵 You put ${money(amount)} on ${bout.lobsters[side].name}. ${late ? `${bettorById(late.who as 'susan').name} throws in ${money(late.amount)} late. ` : ''}Final odds: ${odds[0].toFixed(2)}× / ${odds[1].toFixed(2)}×.`, 'bet');
  } else {
    log(`Betting is closed. Final odds: ${odds[0].toFixed(2)}× / ${odds[1].toFixed(2)}×.`, 'bell');
  }
  renderPool();
  markPicks();
  setPhase('fighting');
  savePending();
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
          if (b.kind === 'prop') {
            li.innerHTML = '<span></span><small>settles at the end</small>';
            li.querySelector('span')!.textContent = `🎲 ${money(b.stake)} on “${propById(b.prop!).name}” → pays ${money(b.payout)}`;
            return li;
          }
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
  if (value > b.stake) award('cashout-profit');
  save.ledger.cashouts++;
  updateBankroll();
  savePending();
  play('cashout');
  log(`💸 Cashed out your ${money(b.stake)} on ${bout.lobsters[b.side].name} for ${money(value)}. ${value >= b.stake ? 'Profit locked in.' : 'Salvaged what you could.'}`, value >= b.stake ? 'win' : 'warn');
  renderYourBets();
  markPicks();
}

function liveBet(side: Side) {
  if (phase !== 'live') return;
  const amount = stake();
  const problem = stakeProblem(amount);
  if (problem) {
    warn(problem);
    return;
  }
  const odds = liveOddsPair()[side];
  save.bankroll -= amount;
  yourBets.push({ kind: 'live', side, stake: amount, payout: Math.floor(amount * odds), cashedOut: null });
  updateBankroll();
  savePending();
  play('coin');
  award('first-bet');
  log(`⚡ Live bet: ${money(amount)} on ${bout.lobsters[side].name} at ${odds.toFixed(2)}×.`, 'bet');
  renderYourBets();
  markPicks();
}

els.liveBets[0].addEventListener('click', () => liveBet(0));
els.liveBets[1].addEventListener('click', () => liveBet(1));
els.liveContinue.addEventListener('click', () => continueLive?.());

/** Pauses after a round for the live market, until you continue (or the timer runs out). */
async function liveBreak(result: FightResult, roundDone: number) {
  const [a, b] = bout.lobsters;
  liveP = publicChance(a, b, stateAfterRound(a, b, result, roundDone), 200);
  for (const x of yourBets) if (x.kind !== 'prop' && x.cashedOut === null && cashOutValue(x.payout, x.side === 0 ? liveP : 1 - liveP) < x.stake) x.underwater = true;
  setPhase('live');
  const odds = liveOddsPair();
  els.liveTitle.textContent = `⏸ After round ${roundDone}: the live market`;
  updatePreview();
  renderYourBets();
  els.live.hidden = false;
  els.stakeRow.hidden = false;
  els.live.scrollIntoView({ block: 'end', behavior: 'smooth' });
  clampStake();
  els.skip.hidden = true;
  els.speed.hidden = true;
  log(`⏸ Live market after round ${roundDone}: ${odds[0].toFixed(2)}× / ${odds[1].toFixed(2)}×.`, 'bell');
  await new Promise<void>((resolve) => {
    const started = performance.now();
    const tick = () => {
      if (!continueLive) return;
      const left = Math.max(0, LIVE_SECONDS - (performance.now() - started) / 1000);
      els.liveTimer.style.width = `${(left / LIVE_SECONDS) * 100}%`;
      els.liveSeconds.textContent = `${Math.ceil(left)}s`;
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
  els.speed.hidden = false;
  setPhase('fighting');
}

// ---------------------------------------------------------------------------
// The fight, played back
// ---------------------------------------------------------------------------

const EFFECT_TEXT = (e: number) => (e > 1 ? 'IT’S SUPER EFFECTIVE!' : e < 1 ? 'Not very effective…' : '');
const SHOUTS = ['OTHER LIBERTARIANS LMAO', 'TAXATION IS THEFT!', 'GET HIM!', 'THAT’S NOT REAL LIBERTARIANISM!', 'READ MISES!', 'WHO WILL BUILD THE ROADS?', 'FINISH HIM!', 'NAP VIOLATION!', 'MY MONEY!'];

let skipping = false;
const sleep = (ms: number) => (skipping ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms / save.settings.speed)));

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
  settleRumor(l);
  renderCard(side);
  pulse(els.cards[side], 'revealed');
  toast('🔍', 'TRAIT REVEALED', `${l.name}: ${traitById(l.trait).name}`);
}

async function fight() {
  setPhase('fighting');
  skipping = false;
  els.betRow.hidden = true;
  els.stakeRow.hidden = true;
  els.after.hidden = false;
  els.skip.hidden = false;
  els.speed.hidden = false;
  els.next.hidden = true;
  const result = simulate(bout.dive ? diveFighter(bout.lobsters[0]) : bout.lobsters[0], bout.lobsters[1], seededRng(fightSeed ?? 1));
  bout.raid = raidFor(fightSeed ?? 1);
  hideAnnouncer();
  for (const e of result.events) {
    if (bout.raid && e.type === 'round' && e.round === 2) {
      raid();
      return;
    }
    // Between rounds: the live market (unless you're skipping to the end).
    if (e.type === 'round' && e.round > 1 && !skipping && save.settings.live) await liveBreak(result, e.round - 1);
    await showEvent(e);
  }
  finish(result);
}

els.skip.addEventListener('click', () => {
  skipping = true;
});

/** Whether the cops raid this bout: only on a raid night, never your own lobster's bout or one in your parlay. */
function raidFor(seed: number): boolean {
  const chance = tonightEvent()?.raidChance ?? 0;
  if (!chance || bout.entry || save.parlay?.legs.some((l) => l.won === null && l.ids[0] === bout.ids[0] && l.ids[1] === bout.ids[1])) return false;
  return seededRng(seed ^ 0x5bd1e995)() < chance;
}

/** The cops call the bout off. They keep a cut of every bet on it; the rest comes back. */
function raid() {
  phase = 'done';
  skipping = false;
  els.arena.classList.add('raid');
  for (const f of els.fighters) f.querySelector<HTMLElement>('.say')!.hidden = true;
  play('ko');
  shout('COPS!');
  let back = 0;
  let staked = 0;
  for (const b of yourBets) {
    if (b.cashedOut !== null) {
      recordBet(save.ledger, b.kind === 'pool' ? 'winner' : b.kind === 'live' ? 'live' : 'props', b.stake, b.cashedOut, describeBet(b));
      continue;
    }
    const refund = Math.floor(b.stake * (1 - FORFEIT));
    back += refund;
    staked += b.stake;
    recordBet(save.ledger, b.kind === 'pool' ? 'winner' : b.kind === 'live' ? 'live' : 'props', b.stake, refund, describeBet(b));
  }
  save.bankroll += back;
  scoreRivals(back - staked, rivalResults(bout.pool, [1, 1], null, 1 - FORFEIT));
  save.bouts++;
  save.career.bout++;
  if (save.stable && save.stable.rest > 0) save.stable.rest--;
  save.pending = null;
  if (staked) award('forfeiture');
  const line = staked ? `They keep ${Math.round(FORFEIT * 100)}% of your bets: ${money(back)} of ${money(staked)} comes back.` : 'You had nothing on it. Lucky.';
  log(`🚔 RAID! The cops storm in after round 1 and call the bout off. ${line}`, 'warn');
  announce(['Ladies and gentlemen, this bout is over. Please put your hands where the officers can see them.']);
  resultNote = staked ? `🚔 ${line}` : '🚔 The bout was raided.';
  els.result.innerHTML = `<b>🚔 RAIDED</b> The bout is off<small>${escapeHtml(line)}</small>`;
  els.result.hidden = false;
  els.result.classList.remove('won');
  els.result.classList.toggle('lost', staked > 0);
  if (save.bankroll < 10) setTimeout(showBroke, 900);
  persist();
  updateBankroll();
  renderGuide();
  renderSlip();
  markPicks();
  els.skip.hidden = true;
  els.speed.hidden = true;
  els.live.hidden = true;
  els.next.hidden = false;
  els.next.textContent = save.career.bout >= boutsTonight() ? 'End of the night ▶' : 'Next bout ▶';
  els.next.focus();
  renderVenue();
  renderStable();
}

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
  for (const side of revealedSides(result)) {
    bout.lobsters[side].traitKnown = true;
    settleRumor(bout.lobsters[side]);
  }
  // Tipsters' picks go on their records.
  for (const tip of bout.tips) {
    if (tip.kind !== 'pick') continue;
    if (tip.side === result.winner) save.tipsters[tip.by].right++;
    else save.tipsters[tip.by].wrong++;
  }
  save.bouts++;
  save.career.bout++;
  if (bout.cupMatch !== null && save.cup) save.cup.winners[bout.cupMatch] = bout.ids[result.winner];
  // A thrown fight: did the commission notice?
  const dive = bout.dive;
  const caught = !!dive && seededRng((fightSeed ?? 1) ^ 0x2545f491)() < dive.chance;
  // Your lobster: a purse for a win; rest (and maybe an injury) after a loss. Otherwise it rests up.
  const stable = save.stable;
  if (stable && bout.entry && caught) {
    const fine = Math.min(save.bankroll, dive.bribe * FINE_MULTIPLE);
    save.bankroll -= fine;
    stable.rest = Math.max(stable.rest, SUSPENSION);
    stable.suspicion = 0;
    play('lose');
    log(`🚨 The commission caught ${stable.lobster.name} taking a dive. Every bet on the bout is void (no refunds), you’re fined ${money(fine)}, and it’s suspended for ${SUSPENSION} bouts.`, 'lose');
    toast('🚨', 'CAUGHT', `${stable.lobster.name} is suspended`);
    award('dive-caught');
  } else if (stable && bout.entry) {
    if (result.winner === 0 && dive) award('dive-won');
    if (result.winner === 0) {
      const purse = purseFor(bout.entry, save.career.venue);
      save.bankroll += purse;
      stable.purses += purse;
      log(`🏆 ${stable.lobster.name} wins! The purse: ${money(purse)}.`, 'win');
      award('mine-win');
      if (bout.entry === 'hard') award('mine-hard');
      if (stable.lobster.form.length >= 5 && stable.lobster.form.every((f) => f === 'W')) award('mine-streak');
      toast('🏆', 'YOUR LOBSTER WON', `${stable.lobster.name} · +${money(purse)}`);
    } else {
      const hurt = afterLoss(stable, result.ending === 'ko', Math.random);
      log(`🩹 ${stable.lobster.name} lost${hurt ? ` and hurt its ${hurt} (−${hurt === 'stamina' ? 10 : 1})` : ''}. It needs ${stable.rest} bout${stable.rest > 1 ? 's' : ''} of rest.`, 'lose');
    }
  } else if (stable && stable.rest > 0) stable.rest--;
  const how = result.ending === 'ko' ? 'by KO' : result.ending === 'flee' ? 'when the other one ran away' : 'on the judges’ cards';
  // Settle every bet you didn't cash out; the net counts cash-outs too.
  let net = 0;
  let collected = 0;
  const props = propOutcomes(result);
  for (const b of yourBets) {
    net -= b.stake;
    const won = !caught && (b.kind === 'prop' ? props[b.prop!] : b.side === result.winner);
    if (b.cashedOut !== null) net += b.cashedOut;
    else if (won) {
      save.bankroll += b.payout;
      collected += b.payout;
      net += b.payout;
    }
    const type: BetType = b.kind === 'pool' ? 'winner' : b.kind === 'live' ? 'live' : 'props';
    recordBet(save.ledger, type, b.stake, b.cashedOut ?? (won ? b.payout : 0), describeBet(b));
  }
  const placedProps = yourBets.filter((b) => b.kind === 'prop').map((b) => ({ prop: b.prop!, stake: b.stake }));
  if (placedProps.length) save.lastProps = placedProps;
  // The parlay leg for this bout (it's settled on its own, outside the bout's net).
  let sideNet = 0;
  if (save.parlay) {
    const parlay = save.parlay;
    const outcome = settleLeg(parlay, bout.ids, bout.ids[result.winner]);
    if (outcome === 'won') {
      const pay = Math.floor(parlay.stake * parlayOdds(parlay.legs));
      save.bankroll += pay;
      recordBet(save.ledger, 'parlay', parlay.stake, pay, `${money(parlay.stake)} on a parlay at ${parlayOdds(parlay.legs).toFixed(2)}×`);
      sideNet += pay - parlay.stake;
      save.parlay = null;
      play('win');
      rain();
      log(`🧾💰 Your parlay came in! ${money(pay)}. Three for three.`, 'win');
      award('parlay');
      toast('🧾', 'PARLAY CAME IN', money(pay));
    } else if (outcome === 'lost') {
      save.parlay = null;
      recordBet(save.ledger, 'parlay', parlay.stake, 0, `${money(parlay.stake)} on a parlay at ${parlayOdds(parlay.legs).toFixed(2)}×`);
      sideNet -= parlay.stake;
      log(`🧾 Your parlay is dead: ${winner.name} won this one. ${money(parlay.stake)} gone.`, 'lose');
    } else if (outcome === 'pending') {
      log(`🧾 Parlay leg ✅. ${parlay.legs.filter((l) => l.won === null).length} to go.`, 'win');
    }
  }
  for (const b of yourBets.filter((x) => x.kind === 'prop')) {
    log(`🎲 “${propById(b.prop!).name}”: ${props[b.prop!] ? `hit! Pays ${money(b.payout)}.` : 'missed.'}`, props[b.prop!] ? 'win' : 'lose');
  }
  const betted = yourBets.length > 0;
  // Achievements from how the bets went
  let propHits = 0;
  for (const b of yourBets) {
    if (b.cashedOut !== null) {
      if (b.kind !== 'prop' && b.side !== result.winner) award('cashout-save');
      continue;
    }
    const won = b.kind === 'prop' ? props[b.prop!] : b.side === result.winner;
    if (!won) continue;
    const odds = b.payout / b.stake;
    if (odds >= 3) award('underdog');
    if (odds >= 8) award('longshot');
    if (b.kind === 'live') award('live-win');
    if (b.kind === 'prop') {
      propHits++;
      if (b.prop === 'flee') award('prop-flee');
      if (b.prop === 'ko-r1') award('prop-ko1');
    }
  }
  if (propHits >= 3) award('props-3');
  // Achievements from who you backed
  const loserSide: Side = result.winner === 0 ? 1 : 0;
  for (const b of yourBets) {
    if (b.kind === 'prop') continue;
    if (b.cashedOut === null && bout.hyped.includes(b.side) && b.side === loserSide) award('hype');
    if (b.cashedOut !== null || caught || b.side !== result.winner) continue;
    const l = bout.lobsters[b.side];
    const other = bout.lobsters[b.side === 0 ? 1 : 0];
    if (b.underwater) award('diamond-claws');
    if (bout.tips.some((t) => t.by === 'insider' && t.kind === 'pick' && t.side === b.side)) award('insider-trading');
    if (bout.pool.some((x) => x.who === 'whale' && x.side !== b.side)) award('whale-watching');
    if (l.faction === 'hoppean' && result.ending === 'ko') award('removed');
    if (l.faction === 'ancap' && other.faction === 'minarchist') award('roads');
    if (b.kind === 'pool' && bout.closing && bout.closing[b.side] > bout.closing[b.side === 0 ? 1 : 0]) {
      save.stats.fades++;
      if (save.stats.fades >= 5) award('fade-public');
    }
  }
  if (dive && !caught && result.winner === 1 && net > 0) award('dive');
  const taught = save.stable?.lobster.learned;
  if (bout.entry && !caught && result.winner === 0 && taught && result.events.some((e) => e.type === 'argue' && e.side === 0 && e.move.name === taught.name && e.effect > 1)) award('teach-win');
  // The cup's final: futures pay out.
  const cupDone = bout.cupMatch === CUP_BOUTS - 1 && !!save.cup;
  if (cupDone) sideNet += settleCup();
  scoreRivals(net + sideNet, rivalResults(bout.pool, poolOdds(totals(bout.pool), cut()), result.winner));
  if (betted && net > 0) award('first-win');
  if (betted && net > 0) save.tonight.won++;
  if (net >= 1000) award('big-win');
  if (bout.tips.some((t) => t.by === 'insider' && t.kind === 'pick' && t.side !== result.winner)) award('insider-wrong');
  if (save.roster.every((l) => l.traitKnown)) award('traits-all');
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
  save.pending = null;
  // Broke: Vinny or your uncle (that's your call, on the next screen).
  if (save.bankroll < 10) setTimeout(showBroke, 900);
  persist();
  updateBankroll();
  if (caught) line = `🚨 Caught taking a dive. ${line}`;
  resultNote = betted ? (net > 0 ? `💰 ${line}` : net < 0 ? `📉 ${line}` : `🤝 ${line}`) : `👀 ${winner.name} wins ${how}.`;
  let lastRound = 1;
  for (const e of result.events) if (e.type === 'round') lastRound = e.round;
  announce(cupDone ? [callWinner(winner, result.ending, lastRound), `${winner.name} wins the Invisible Claw Cup!`] : [callWinner(winner, result.ending, lastRound)]);
  renderCup();
  renderGuide();
  renderSlip();
  markPicks();
  els.result.innerHTML = `<b>${escapeHtml(winner.name)}</b> wins ${how}<small>${escapeHtml(line) || 'You watched from the sidelines.'}</small>`;
  els.result.hidden = false;
  els.result.classList.toggle('won', betted && net > 0);
  els.result.classList.toggle('lost', betted && net < 0);
  els.skip.hidden = true;
  els.speed.hidden = true;
  els.next.hidden = false;
  els.next.textContent = save.career.bout >= boutsTonight() ? 'End of the night ▶' : 'Next bout ▶';
  els.next.focus();
  renderVenue();
  renderStable();
  for (const side of [0, 1] as Side[]) renderCard(side);
  els.fighters[result.winner].classList.add('winner');
}

/** One bet, in a line, for the record's highlights. */
function describeBet(b: YourBet) {
  const what = b.kind === 'prop' ? `“${propById(b.prop!).name}”` : bout.lobsters[b.side].name;
  return `${money(b.stake)} on ${what} at ${(b.payout / b.stake).toFixed(2)}×${b.kind === 'live' ? ' (live)' : ''}${b.cashedOut !== null ? ', cashed out' : ''}`;
}

els.next.addEventListener('click', () => (save.career.bout >= boutsTonight() ? showNightEnd() : void newBout()));

function rain() {
  for (let i = 0; i < 18; i++) {
    spawnText({ text: '💵', className: 'fc-rain', x: `${Math.random() * 100}%`, y: '-10%', parent: els.arena, ttl: 2000, vars: { '--d': `${0.6 + Math.random() * 0.8}s` } });
  }
}

// ---------------------------------------------------------------------------
// The career: venues and nights
// ---------------------------------------------------------------------------

function clampStake() {
  const cap = Math.min(save.bankroll, maxStake());
  if (stake() > cap) els.stake.value = String(cap);
  els.stake.max = String(maxStake());
}

function renderVenue() {
  const v = venue();
  const c = save.career;
  els.venueName.textContent = `${v.icon} ${v.name}`;
  els.venueName.title = `${v.name}: bets up to ${money(maxStake())}`;
  save.stats.peakVenue = Math.max(save.stats.peakVenue, c.venue);
  const ev = tonightEvent();
  els.eventChip.hidden = !ev && !save.cup;
  if (save.cup) {
    els.eventChip.textContent = '🏆 The Invisible Claw Cup';
    els.eventChip.title = 'Eight lobsters, a knockout bracket, seven bouts. Bet futures on the winner in the 🏆 Cup tab.';
  } else if (ev) {
    els.eventChip.textContent = `${ev.icon} ${ev.name}`;
    els.eventChip.title = ev.blurb;
  }
  els.nightLabel.textContent = `Night ${c.night} · bout ${Math.min(boutsTonight(), c.bout + (phase === 'done' ? 0 : 1))}/${boutsTonight()}`;
  els.boutDots.replaceChildren(
    ...Array.from({ length: boutsTonight() }, (_, i) => {
      const dot = document.createElement('i');
      dot.className = i < c.bout ? 'done' : i === c.bout && phase !== 'done' ? 'now' : '';
      dot.title = `Bout ${i + 1} of ${boutsTonight()}`;
      return dot;
    }),
  );
  const next = VENUES[c.venue + 1];
  els.goalFill.style.width = `${Math.min(100, (save.bankroll / v.target) * 100)}%`;
  els.goalFill.parentElement!.classList.toggle('reached', save.bankroll >= v.target);
  els.goalText.textContent = save.bankroll >= v.target
    ? `✅ ${next ? `${next.icon} ${next.name} after tonight` : 'Champion after tonight'}`
    : `${money(v.target)} → ${next ? `${next.icon} ${next.name}` : '🏆 the title'}`;
  els.arena.dataset.venue = v.id;
}

let nightOutcome: NightOutcome | null = null;
let nextEvent: EventId | null = null;

function showNightEnd() {
  const c = save.career;
  const v = venue();
  nightOutcome = endNight(c, save.bankroll);
  const profit = save.bankroll - c.startBankroll;
  const next = VENUES[c.venue + 1];
  els.nightTitle.textContent = nightOutcome === 'champion' ? '🏆 CHAMPION OF THE INVISIBLE CLAW' : `${v.icon} End of night ${c.night}`;
  const lines = [
    `You started the night with ${money(c.startBankroll)} and leave with ${money(save.bankroll)}: ${profit >= 0 ? `up ${money(profit)}` : `down ${money(-profit)}`}.`,
    nightOutcome === 'promoted'
      ? `🎟️ Word gets around. You're invited to ${next.icon} ${next.name}: ${next.blurb} Entry ${money(next.fee)} a night.`
      : nightOutcome === 'champion'
        ? `You turned a kitchen-floor bet into ${money(save.bankroll)} at the Liberland Championship. Rothbard would be proud. Hoppe would physically remove your competitors. You can keep playing.`
        : save.career.venue < VENUES.length - 1
          ? `You need ${money(v.target)} at the end of a night to move up to ${next.icon} ${next.name}.`
          : `${money(v.target)} at the end of a night wins the championship.`,
  ];
  if (save.stable) lines.push(`🦞 ${save.stable.lobster.name}: ${save.stable.lobster.wins}–${save.stable.lobster.losses}, ${money(save.stable.purses)} in purses.`);
  if (save.tonight.won >= boutsTonight()) {
    lines.push(`🌙 ${boutsTonight()} bouts, ${boutsTonight()} wins. A perfect night.`);
    award('perfect-night');
  }
  if (save.event === 'printer' && profit > 0) award('cantillon');
  // Tonight's table
  const table = ranking(save.rivals.tonight);
  lines.push(`🏁 Tonight’s table: ${table.map((r, i) => `${i + 1}. ${playerName(r.id)} ${signed(r.amount)}`).join(', ')}.${leading(save.rivals.tonight) && save.rivals.tonight.you > 0 ? ' You topped it.' : ''}`);
  if (leading(save.rivals.tonight) && save.rivals.tonight.you > 0) award('top-table');
  if (table[0].id === 'sheila' && table[table.length - 1].id === 'you') award('sheila-right');
  const cupNext = isCupNight(c.night + 1);
  nextEvent = cupNext ? null : rollEvent(Math.random, c.night + 1, save.event);
  const coming = eventById(nextEvent);
  lines.push(cupNext ? 'Tomorrow night: 🏆 the Invisible Claw Cup. Eight lobsters, a knockout bracket, seven bouts, and futures on the winner.' : coming ? `Word for tomorrow night: ${coming.icon} ${coming.name}. ${coming.blurb}` : 'Tomorrow looks like a normal night. As normal as lobster debates get.');
  els.nightBody.replaceChildren(...lines.map((t) => Object.assign(document.createElement('p'), { textContent: t })));
  els.nightNext.textContent = `Start night ${c.night + 1} ▶`;
  els.night.hidden = false;
  els.nightNext.focus();
  if (nightOutcome !== 'stayed') play('win');
}

els.nightNext.addEventListener('click', () => {
  const r = startNight(save.career, save.bankroll, nightOutcome);
  save.career = r.career;
  save.bankroll = r.bankroll;
  save.event = nextEvent;
  save.tonight = { won: 0 };
  save.cup = null;
  save.rivals.tonight = emptyStandings();
  if (isCupNight(save.career.night)) {
    log('🏆 Tonight: the Invisible Claw Cup. Futures on the winner are in the 🏆 Cup tab.', 'trait');
    toast('🏆', 'TONIGHT', 'The Invisible Claw Cup');
  }
  if (save.stable) save.stable.suspicion = Math.max(0, save.stable.suspicion - 1);
  const ev = tonightEvent();
  if (ev) {
    log(`${ev.icon} Tonight: ${ev.name}. ${ev.blurb}`, 'trait');
    toast(ev.icon, 'TONIGHT', ev.name);
  }
  save.market = marketOffers(Math.random, save.career.night);
  if (nightOutcome === 'champion') toast('🏆', 'CHAMPION', 'The Invisible Claw');
  if (r.demoted) log(`🚪 You can't afford ${VENUES[save.career.venue + 1].name}'s door fee. Back to ${venue().name}.`, 'warn');
  if (r.fee) log(`🎟️ ${venue().name}: ${money(r.fee)} at the door.`, 'bell');
  const reached = ['kitchen', 'garage', 'porcfest', 'convention', 'liberland'];
  for (let i = 1; i <= save.career.venue; i++) award(reached[i]);
  if (save.career.champion) award('champion');
  sharkNight();
  // Cleaned out at the door (or by Vinny)? Deal with it before the first bout.
  if (save.bankroll < 10) setTimeout(showBroke, 300);
  log(`🌙 Night ${save.career.night} at ${venue().icon} ${venue().name}.`, 'bell');
  nightOutcome = null;
  els.night.hidden = true;
  persist();
  void newBout();
});

// ---------------------------------------------------------------------------
// Your lobster: the fish market, training, and the ring
// ---------------------------------------------------------------------------

let nameDraft = suggestName(Math.random);

function renderStable() {
  renderBadges();
  const st = save.stable;
  if (!st) {
    if (save.career.venue < MARKET_VENUE) {
      els.stable.innerHTML = `<p class="pane-note">🔒 The fish market only deals with people who've made it out of the kitchen. Reach ${VENUES[MARKET_VENUE].icon} ${VENUES[MARKET_VENUE].name} (end a night with ${money(VENUES[0].target)}) to buy a lobster of your own.</p>`;
      return;
    }
    els.stable.innerHTML = `<p class="pane-note">🐟 The fish market. Three lots tonight, cheaper (and weaker) than league fighters. You won't know its trait until it's yours.</p>
      <label class="name-field">Name it: <input id="lobster-name" maxlength="30" value="${escapeHtml(nameDraft)}"></label>
      <div class="offers"></div>`;
    els.stable.querySelector<HTMLInputElement>('#lobster-name')!.addEventListener('input', (e) => (nameDraft = (e.target as HTMLInputElement).value));
    els.stable.querySelector('.offers')!.replaceChildren(
      ...save.market.map((o, i) => {
        const f = factionById(o.lobster.faction);
        const card = document.createElement('div');
        card.className = 'offer';
        card.style.setProperty('--shell', f.color);
        card.innerHTML = `<div class="card-head"><span class="badge">${f.icon}</span><div><b>“${escapeHtml(o.lobster.name)}”</b><small>Lot #${o.lot} · ${f.name} · ${o.lobster.weight} lb</small></div></div>${statBars(o.lobster)}<div class="args"><span class="label">Trait</span> <b class="unknown">???</b></div><button type="button" class="next-button">Buy · ${money(o.price)}</button>`;
        const b = card.querySelector('button')!;
        b.disabled = save.bankroll < o.price || phase === 'fighting' || phase === 'live';
        b.addEventListener('click', () => buyLobster(i));
        return card;
      }),
    );
    return;
  }
  const l = st.lobster;
  const f = factionById(l.faction);
  const t = traitById(l.trait);
  // No training while it's in tonight's bout (the odds are already set).
  const busy = !!bout?.entry && phase !== 'done';
  const training = (['claw', 'shell', 'wits', 'stamina'] as TrainStat[])
    .map((stat) => {
      const raw = trainingCost(l, stat);
      const cost = raw === null ? null : price(raw);
      return `<button type="button" class="train" data-stat="${stat}" ${busy || cost === null || save.bankroll < cost ? 'disabled' : ''}>${stat === 'stamina' ? 'Stamina +10' : `${stat[0].toUpperCase()}${stat.slice(1)} +1`} · ${cost === null ? 'MAX' : money(cost)}</button>`;
    })
    .join('');
  const therapy = BAD_TRAITS.has(l.trait) ? `<button type="button" class="train therapy" ${busy || save.bankroll < price(THERAPY_PRICE) ? 'disabled' : ''}>🛋️ Therapy for its ${t.name.toLowerCase()} streak · ${money(price(THERAPY_PRICE))}</button>` : '';
  const own = factionById(l.faction).moves;
  const teachPrice = price(teachCost(save.career.venue));
  const teaching = (Object.keys(TEACHABLE) as ArgType[])
    .filter((t) => !own.some((m) => m.type === t))
    .map((t) => {
      const known = l.learned?.type === t;
      return `<button type="button" class="train teach${known ? ' on' : ''}" data-teach="${t}" ${busy || known || save.bankroll < teachPrice ? 'disabled' : ''}>${ARG_TYPES[t].icon} “${TEACHABLE[t].name}” · ${known ? 'knows it' : money(teachPrice)}</button>`;
    })
    .join('');
  const entries = TIERS.map((tier) => `<button type="button" class="enter${save.entry === tier.id ? ' on' : ''}" data-tier="${tier.id}" ${st.rest > 0 ? 'disabled' : ''}>${tier.name} opponent · purse ${money(purseFor(tier.id, save.career.venue))}</button>`).join('');
  // Tonight's fight is your lobster's: you could make sure it loses.
  let fix = '';
  if (bout?.entry && phase === 'betting') {
    const purse = purseFor(bout.entry, save.career.venue);
    const bribe = bribeFor(purse);
    const opponent = bout.lobsters[1].name;
    fix = bout.dive
      ? `<div class="fix done">🤫 ${escapeHtml(l.name)} has agreed to take a dive. Now bet on <b>${escapeHtml(opponent)}</b>. The crowd doesn’t know.</div>`
      : `<div class="fix"><p>🤫 <b>The fix.</b> Pay ${escapeHtml(l.name)} to lose, then bet on ${escapeHtml(opponent)}: the crowd’s odds don’t know. It gives up the ${money(purse)} purse, and the commission catches about <b>${Math.round(catchChance(st.suspicion) * 100)}%</b> of thrown fights (more if you keep doing it). Get caught and every bet on the bout is void, you pay a fine, and it’s suspended.</p><button type="button" class="train dive" ${save.bankroll < bribe ? 'disabled' : ''}>🤫 Pay it to take a dive · ${money(bribe)}</button></div>`;
  }
  els.stable.innerHTML = `${fix}<div class="mine" style="--shell:${f.color}">
      <div class="card-head"><span class="badge">${f.icon}</span><div><b>${escapeHtml(l.name)}</b><small>${f.name} · ${l.weight} lb · ${l.wins}–${l.losses} · ${money(st.purses)} in purses</small></div></div>
      ${statBars(l)}
      <div class="args"><span class="label">Trait</span> <b title="${escapeHtml(t.description)}">${t.name}</b></div>
      <div class="args"><span class="label">Argues with</span> ${movesOf(l).map((m) => `<span class="tag" title="“${escapeHtml(m.name)}”">${ARG_TYPES[m.type].icon} ${escapeHtml(m.name)}</span>`).join(' ')}</div>
      <div class="args"><span class="label">Weak to</span> <b class="weak">${ARG_TYPES[f.weak].icon} ${ARG_TYPES[f.weak].name}</b> · <span class="label">Shrugs off</span> <b class="resist">${ARG_TYPES[f.resists].icon} ${ARG_TYPES[f.resists].name}</b></div>
      ${st.rest > 0 ? `<p class="rest">🩹 Resting: ${st.rest} more bout${st.rest > 1 ? 's' : ''}.</p>` : ''}
    </div>
    <p class="pane-note">🏋️ Training</p><div class="training">${training}${therapy}</div>
    <p class="pane-note">📚 Teach it an argument of a kind its faction doesn’t use${l.learned ? ` (it knows ${ARG_TYPES[l.learned.type].icon} “${escapeHtml(l.learned.name)}”; learning another replaces it)` : ''}. Pick one that hits the weak spots of the lobsters it fights.</p><div class="training">${teaching}</div>
    <p class="pane-note">🥊 ${save.entry ? 'Signed up for the next bout (click again to cancel).' : 'Sign it up for the next bout. Losing means rest, and maybe an injury.'}</p><div class="entries">${entries}</div>`;
  for (const b of els.stable.querySelectorAll<HTMLButtonElement>('.train[data-stat]')) b.addEventListener('click', () => trainMine(b.dataset.stat as TrainStat));
  els.stable.querySelector<HTMLButtonElement>('.therapy')?.addEventListener('click', therapy_);
  els.stable.querySelector<HTMLButtonElement>('.dive')?.addEventListener('click', throwFight);
  for (const b of els.stable.querySelectorAll<HTMLButtonElement>('.teach')) b.addEventListener('click', () => teachMine(b.dataset.teach as ArgType));
  for (const b of els.stable.querySelectorAll<HTMLButtonElement>('.enter')) {
    b.addEventListener('click', () => {
      const tier = b.dataset.tier as Tier;
      save.entry = save.entry === tier ? null : tier;
      persist();
      renderStable();
      renderBadges();
      if (save.entry) log(`🥊 ${l.name} is signed up for the next bout: ${tier === 'easy' ? 'an easy' : tier === 'even' ? 'an even' : 'a hard'} fight for ${money(purseFor(tier, save.career.venue))}.`, 'bell');
    });
  }
}

/** Teaches your lobster an argument (replacing any it was taught before). */
function teachMine(type: ArgType) {
  const st = save.stable;
  const cost = price(teachCost(save.career.venue));
  if (!st || st.lobster.learned?.type === type || save.bankroll < cost || (!!bout?.entry && phase !== 'done')) return;
  save.bankroll -= cost;
  const old = st.lobster.learned;
  st.lobster.learned = TEACHABLE[type];
  updateBankroll();
  play('reveal');
  log(`📚 ${st.lobster.name} learns “${TEACHABLE[type].name}”${old ? ` and forgets “${old.name}”` : ''}. ${ARG_TYPES[type].icon} ${ARG_TYPES[type].name} arguments are in its repertoire now.`, 'win');
  award('teach');
  persist();
  renderStable();
}

/** Pays your lobster to lose tonight's fight. */
function throwFight() {
  const st = save.stable;
  if (!st || !bout.entry || bout.dive || phase !== 'betting') return;
  const bribe = bribeFor(purseFor(bout.entry, save.career.venue));
  if (save.bankroll < bribe) return;
  save.bankroll -= bribe;
  bout.dive = { chance: catchChance(st.suspicion), bribe };
  st.suspicion++;
  st.dives++;
  updateBankroll();
  play('reveal');
  log(`🤫 You slip ${st.lobster.name} ${money(bribe)} in clarified butter. It’ll lose tonight. Probably.`, 'trait');
  savePending();
  renderStable();
  renderGuide();
}

function buyLobster(i: number) {
  const o = save.market[i];
  if (!o || save.stable || save.bankroll < o.price) return;
  save.bankroll -= o.price;
  const name = nameDraft.trim().slice(0, 30) || suggestName(Math.random);
  save.stable = { lobster: { ...o.lobster, name, traitKnown: true }, rest: 0, purses: 0, suspicion: 0, dives: 0 };
  save.market = [];
  updateBankroll();
  play('cashout');
  const t = traitById(save.stable.lobster.trait);
  log(`🦞 You bought ${name} for ${money(o.price)}. Now that it's yours, you can see it: ${t.id === 'none' ? 'nothing special.' : `it's a ${t.name}. ${t.description}`}`, BAD_TRAITS.has(t.id) ? 'warn' : 'win');
  toast('🦞', 'YOUR OWN LOBSTER', name);
  award('buy');
  if (BAD_TRAITS.has(t.id)) award('lemon');
  persist();
  renderStable();
}

function trainMine(stat: TrainStat) {
  const st = save.stable;
  if (!st) return;
  const raw = trainingCost(st.lobster, stat);
  const cost = raw === null ? null : price(raw);
  if (cost === null || save.bankroll < cost) return;
  save.bankroll -= cost;
  train(st.lobster, stat);
  if (stat !== 'stamina' && st.lobster[stat] >= 10) award('maxed');
  updateBankroll();
  play('coin');
  persist();
  renderStable();
}

function therapy_() {
  const st = save.stable;
  if (!st || !BAD_TRAITS.has(st.lobster.trait) || save.bankroll < price(THERAPY_PRICE)) return;
  const was = traitById(st.lobster.trait).name;
  save.bankroll -= price(THERAPY_PRICE);
  st.lobster.trait = 'none';
  updateBankroll();
  play('reveal');
  log(`🛋️ After a few sessions, ${st.lobster.name} is no longer a ${was}.`, 'win');
  award('therapy');
  persist();
  renderStable();
}

// ---------------------------------------------------------------------------
// Vinny the Fin, and going broke
// ---------------------------------------------------------------------------

const SHARK_LINES = [
  'Nice lobster you got there.',
  'I’m a businessman. Voluntary exchange, capisce?',
  'Twenty percent a night. Very competitive. Ask around.',
  'Three nights. Then we talk about claws.',
];

function renderSharkButton() {
  const d = save.shark.debt;
  els.sharkLabel.textContent = d > 0 ? money(d) : 'Vinny';
  els.sharkButton.classList.toggle('owing', d > 0);
  els.sharkButton.classList.toggle('danger', d > 0 && save.shark.nightsUnpaid >= SHARK_PATIENCE - 1);
}

function renderShark() {
  const s = save.shark;
  const limit = creditLimit(save.career.venue);
  const chunk = Math.min(loanChunk(save.career.venue), Math.max(0, limit - s.debt));
  const patience = SHARK_PATIENCE - s.nightsUnpaid;
  const lines = [
    `🦈 “${SHARK_LINES[Math.floor(Math.random() * SHARK_LINES.length)]}”`,
    s.debt > 0
      ? `You owe ${money(s.debt)}. ${Math.round(SHARK_RATE * 100)}% goes on every night. ${s.paidTonight ? 'You paid something tonight, so he’s patient.' : `Pay something before ${patience <= 1 ? 'the next night, or he collects' : `${patience} more nights go by unpaid`}.`}`
      : `You owe nothing. He lends ${money(loanChunk(save.career.venue))} at a time here, up to ${money(limit)}, at ${Math.round(SHARK_RATE * 100)}% a night.`,
    'If he collects, he takes your cash, then something that hurts: your lobster’s claw, or your place at this venue.',
  ];
  els.sharkBody.replaceChildren(...lines.map((t) => Object.assign(document.createElement('p'), { textContent: t })));
  els.sharkBorrow.textContent = chunk >= 10 ? `Borrow ${money(chunk)}` : 'Credit limit reached';
  els.sharkBorrow.disabled = chunk < 10 || phase === 'fighting' || phase === 'live';
  els.sharkRepay.textContent = s.debt > 0 ? `Repay ${money(Math.min(save.bankroll, s.debt))}` : 'Nothing to repay';
  els.sharkRepay.disabled = s.debt <= 0 || save.bankroll < 1;
}

function sharkBorrow(): number {
  const amount = borrow(save.shark, save.career.venue);
  if (!amount) return 0;
  save.bankroll += amount;
  updateBankroll();
  play('shark');
  log(`🦈 Vinny counts out ${money(amount)}. You owe him ${money(save.shark.debt)}.`, 'warn');
  award('shark');
  save.stats.loans++;
  if (save.stats.loans >= 3) award('moral-hazard');
  persist();
  renderSharkButton();
  return amount;
}

els.sharkBorrow.addEventListener('click', () => {
  sharkBorrow();
  renderShark();
});
els.sharkRepay.addEventListener('click', () => {
  const paid = repay(save.shark, save.bankroll);
  if (!paid) return;
  save.bankroll -= paid;
  updateBankroll();
  play('cashout');
  log(`🤝 You pay Vinny ${money(paid)}. ${save.shark.debt ? `Still owe ${money(save.shark.debt)}.` : 'All square. He looks almost disappointed.'}`, 'win');
  if (save.shark.debt === 0) award('shark-repaid');
  persist();
  renderSharkButton();
  renderShark();
});
els.sharkButton.addEventListener('click', () => {
  renderShark();
  els.sharkPanel.hidden = false;
});
byId('hide-shark').addEventListener('click', () => {
  els.sharkPanel.hidden = true;
});

/** A new night: interest, and if he's run out of patience, he collects. */
function sharkNight() {
  const interest = nightPasses(save.shark);
  if (interest) log(`🦈 Vinny’s interest: +${money(interest)}. You owe ${money(save.shark.debt)}.`, 'warn');
  if (dueForCollection(save.shark)) {
    const c = collect(save.shark, save.bankroll, !!save.stable);
    save.bankroll -= c.took;
    play('shark');
    let what = '';
    if (c.claw && save.stable) {
      save.stable.lobster.claw = Math.max(1, save.stable.lobster.claw - 2);
      what = ` Then he breaks ${save.stable.lobster.name}’s claw (Claw −2).`;
    } else if (c.demoted && save.career.venue > 0) {
      save.career = { ...save.career, venue: save.career.venue - 1 };
      what = ` Then his friends walk you out of the venue: back to ${venue().name}.`;
    }
    log(`🦈 Vinny collects. He takes ${money(c.took)}.${what}${save.shark.debt ? ` You still owe ${money(save.shark.debt)}; call the rest a “courtesy”.` : ''}`, 'lose');
    toast('🦈', 'VINNY COLLECTED', c.claw ? 'Your lobster’s claw' : c.demoted ? 'Your venue' : money(c.took));
    award('shark-claw');
    renderVenue();
    renderStable();
  }
  updateBankroll();
  renderSharkButton();
}

function showBroke() {
  if (save.bankroll >= 10) return;
  if (save.stats.peakVenue >= 3) award('boom-bust');
  const chunk = Math.min(loanChunk(save.career.venue), creditLimit(save.career.venue) - save.shark.debt);
  els.brokeShark.disabled = chunk < 10;
  els.brokeShark.textContent = chunk >= 10 ? `🦈 Take ${money(chunk)} from Vinny (${Math.round(SHARK_RATE * 100)}% a night)` : '🦈 Vinny won’t lend you more';
  els.brokeUncle.textContent = save.career.venue > 0 ? `👴 Call your uncle: $500, but you're thrown out to ${VENUES[save.career.venue - 1].name}` : '👴 Call your uncle: $500, no questions asked (well, some)';
  els.broke.hidden = false;
  (chunk >= 10 ? els.brokeShark : els.brokeUncle).focus();
}

els.brokeShark.addEventListener('click', () => {
  if (sharkBorrow()) els.broke.hidden = true;
});
els.brokeUncle.addEventListener('click', () => {
  save.bankroll += START_BANKROLL;
  const was = save.career.venue;
  save.career = bailout(save.career);
  save.career.startBankroll = save.bankroll;
  log(`💸 Your uncle the Bitcoin maximalist spots you $500. “Have fun staying poor.”${save.career.venue < was ? ` The bouncers throw you out of ${VENUES[was].name}: back to ${venue().name}.` : ''}`, 'warn');
  award('bailout');
  els.broke.hidden = true;
  persist();
  updateBankroll();
  renderVenue();
  renderStable();
});

// --- The achievements screen ---

function renderStats() {
  const pct = (x: number | null) => (x === null ? '–' : `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`);
  const row = (icon: string, name: string, l: ReturnType<typeof ledgerTotal>, cls = '') => {
    const profit = l.returned - l.staked;
    return `<tr class="${cls}"><th>${icon} ${name}</th><td>${l.bets}</td><td>${l.bets ? `${Math.round((l.wins / l.bets) * 100)}%` : '–'}</td><td>${money(l.staked)}</td><td class="${profit > 0 ? 'up' : profit < 0 ? 'down' : ''}">${profit < 0 ? '−' : profit > 0 ? '+' : ''}${money(Math.abs(profit))}</td><td>${pct(roi(l))}</td></tr>`;
  };
  const L = save.ledger;
  const total = ledgerTotal(L);
  els.stats.innerHTML = `
    <table class="ledger">
      <thead><tr><th></th><th title="Bets placed">Bets</th><th title="Bets that paid back more than they cost">Hit</th><th>Staked</th><th>Profit</th><th title="Profit over what you staked">Return</th></tr></thead>
      <tbody>${BET_TYPES.map((t) => row(t.icon, t.name, L.lines[t.id])).join('')}${row('Σ', 'All bets', total, 'total')}</tbody>
    </table>
    <table class="ledger season">
      <thead><tr><th title="Everyone’s profit on every bout since the regulars started keeping score">🏁 Season table</th><th></th><th>${save.rivals.bouts} bouts</th></tr></thead>
      <tbody>${ranking(save.rivals.season).map((r, i) => `<tr class="${r.id === 'you' ? 'total' : ''}"><th>${i + 1}. ${playerName(r.id)}</th><td></td><td class="${r.amount > 0 ? 'up' : r.amount < 0 ? 'down' : ''}">${signed(r.amount)}</td></tr>`).join('')}</tbody>
    </table>
    <div class="highlights">
      <div><small>🚀 Biggest hit</small><b>${L.best ? `+${money(L.best.amount)}` : '–'}</b><span>${L.best ? escapeHtml(L.best.text) : 'Win a bet first'}</span></div>
      <div><small>💀 Worst beat</small><b>${L.worst ? `−${money(L.worst.amount)}` : '–'}</b><span>${L.worst ? escapeHtml(L.worst.text) : 'Nothing lost yet'}</span></div>
      <div><small>📈 Best bankroll</small><b>${money(save.best)}</b><span>${save.bouts} bouts · ${save.career.night} night${save.career.night === 1 ? '' : 's'} · ${L.cashouts} cash-out${L.cashouts === 1 ? '' : 's'}</span></div>
    </div>`;
}

function renderAchievements() {
  els.achievementsCount.textContent = `${unlocked.size} / ${ACHIEVEMENTS.length}`;
  els.achievementsGrid.replaceChildren(
    ...ACHIEVEMENTS.map((a) => {
      const card = document.createElement('div');
      const got = unlocked.has(a.id);
      const hidden = a.secret && !got;
      card.className = `achievement${got ? '' : ' locked'}${a.secret ? ' secret' : ''}`;
      card.innerHTML = '<span class="icon"></span><b></b><small></small>';
      card.querySelector('.icon')!.textContent = got ? a.icon : hidden ? '❔' : '🔒';
      card.querySelector('b')!.textContent = hidden ? 'Secret achievement' : a.name;
      card.querySelector('small')!.textContent = hidden ? 'Keep betting. You’ll know it when it happens.' : a.description;
      return card;
    }),
  );
}

byId('show-achievements').addEventListener('click', () => {
  renderStats();
  renderAchievements();
  els.achievements.hidden = false;
  byId('hide-achievements').focus();
});
byId('hide-achievements').addEventListener('click', () => {
  els.achievements.hidden = true;
});

// --- The ring announcer ---

let announceToken = 0;

/** Shows the announcer's lines one at a time (and reads them out, if the voice is on). */
function announce(lines: string[]) {
  const token = ++announceToken;
  for (const line of lines) log(`🎤 ${line}`, 'bell');
  const synth = window.speechSynthesis;
  const voice = save.settings.voice && !save.muted && !!synth && typeof SpeechSynthesisUtterance !== 'undefined';
  synth?.cancel();
  els.announcer.hidden = false;
  const show = (i: number) => {
    if (token !== announceToken) return;
    els.announcerText.textContent = lines[i];
    pulse(els.announcer, 'show');
  };
  if (voice) {
    lines.forEach((line, i) => {
      const u = new SpeechSynthesisUtterance(line);
      u.rate = 1.08;
      u.pitch = 0.75;
      u.onstart = () => show(i);
      synth.speak(u);
    });
  }
  // The text moves on by itself too (the voice may be off, or slow to start).
  let at = 0;
  show(0);
  const step = () => {
    if (token !== announceToken || ++at >= lines.length) return;
    show(at);
    setTimeout(step, Math.max(2200, lines[at].length * 45));
  };
  setTimeout(step, Math.max(2200, lines[0].length * 45));
}

function hideAnnouncer() {
  announceToken++;
  window.speechSynthesis?.cancel();
  els.announcer.hidden = true;
}

// --- Settings ---

function renderSettings() {
  for (const b of els.settings.querySelectorAll<HTMLButtonElement>('[data-speed]')) b.classList.toggle('on', Number(b.dataset.speed) === save.settings.speed);
  for (const b of els.settings.querySelectorAll<HTMLButtonElement>('[data-live]')) b.classList.toggle('on', (b.dataset.live === 'on') === save.settings.live);
  for (const b of els.settings.querySelectorAll<HTMLButtonElement>('[data-voice]')) b.classList.toggle('on', (b.dataset.voice === 'on') === save.settings.voice);
  els.speed.textContent = `🐇 Speed ${save.settings.speed}×`;
}

function setSpeed(speed: Settings['speed']) {
  save.settings.speed = speed;
  persist();
  renderSettings();
}

function setLive(on: boolean) {
  save.settings.live = on;
  persist();
  renderSettings();
}

for (const b of els.settings.querySelectorAll<HTMLButtonElement>('[data-speed]')) b.addEventListener('click', () => setSpeed(Number(b.dataset.speed) as Settings['speed']));
for (const b of els.settings.querySelectorAll<HTMLButtonElement>('[data-live]')) b.addEventListener('click', () => setLive(b.dataset.live === 'on'));
for (const b of els.settings.querySelectorAll<HTMLButtonElement>('[data-voice]')) {
  b.addEventListener('click', () => {
    save.settings.voice = b.dataset.voice === 'on';
    if (!save.settings.voice) window.speechSynthesis?.cancel();
    persist();
    renderSettings();
  });
}
els.speed.addEventListener('click', () => setSpeed(((save.settings.speed % 3) + 1) as Settings['speed']));
els.liveOff.addEventListener('click', () => {
  setLive(false);
  log('⚙️ No more live markets. Turn them back on in ⚙️ Settings.', 'bell');
  continueLive?.();
});
byId('show-settings').addEventListener('click', () => {
  renderSettings();
  els.settings.hidden = false;
  byId('hide-settings').focus();
});
byId('hide-settings').addEventListener('click', () => {
  els.settings.hidden = true;
});

// ---------------------------------------------------------------------------
// Keys, screens, start
// ---------------------------------------------------------------------------

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (!els.title.hidden || !els.chart.hidden || !els.night.hidden || !els.achievements.hidden || !els.sharkPanel.hidden || !els.broke.hidden || !els.settings.hidden) return;
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
    if (save.career.bout >= boutsTonight()) showNightEnd();
    else void newBout();
  }
});

byId('start').addEventListener('click', () => {
  els.title.hidden = true;
  getAudioContext();
  openDoors();
  // Broke from last time? Sort that out first.
  if (save.bankroll < 10) showBroke();
});
byId('show-chart').addEventListener('click', () => {
  renderChart();
  els.chart.hidden = false;
  byId('hide-chart').focus();
});
byId('hide-chart').addEventListener('click', () => {
  els.chart.hidden = true;
});

byId('title-best').textContent = save.bouts ? `${venue().icon} ${venue().name} · night ${save.career.night} · bankroll ${money(save.bankroll)} · best ${money(save.best)}${save.career.champion ? ' · 🏆 champion' : ''}` : '';
log('Welcome to the free market of violence. Read the tale of the tape and the pool, then place your bet.');
renderSharkButton();
renderSettings();
installTapTips(byId('app'));
els.stake.value = String(save.stake);
if (!resumePending()) void newBout();
