// I THOUGHT I HIRED AUSTRIAN ECONOMISTS: the screens. The council runs in council.ts; this file
// draws it, turns clicks into moves, and keeps the save.

import './style.css';
import { getAudioContext, note, playTone } from '../../shared/audio.ts';
import { openSaveTransfer } from '../../shared/save-transfer.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import { ballSvg, type BallLook, type Eyes } from './ball.ts';
import {
  active, type Advisor, advisorName, ask, beginCouncil, canFire, canInvestigate, COUNCIL, crisisOf, enact, findPolicy, fire, FIRING_FROM, type Game, IMPOSTORS,
  investigate, type Mark, type Mode, newGame, nextQuarter, policyOf, QUARTERS, score, setMark, termLength, toolsLeft, upgradeGame, won,
} from './council.ts';
import { crisisById, type Effect } from './crises.ts';
import { type Side, sideOf } from './sides.ts';
import { ACHIEVEMENTS, achievementById, earnedNow, normalizeUnlocked } from './achievements.ts';
import { dailyFor, normalizeDailyBests, twistById } from './daily.ts';
import { type MoodId, Waltz } from './music.ts';
import { CARD_H, CARD_W, drawShareCard, shareText, type TermSummary } from './share.ts';
import {
  activePlayers, beginProposals, callVote, castVote, chairEnacts, fellowImpostors, loyalWins, MAX_PLAYERS, MIN_PLAYERS, newParty, nextPartyQuarter,
  partyCrisis, type PartyGame, propose, roleSeen, TABLES,
} from './party.ts';
import { LEAN_LABEL, TOOL_ORDER, type ToolId, TOOLS } from './clues.ts';
import { QUESTIONS } from './talk.ts';

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

interface Meta {
  terms: number;
  wins: number;
  best: number;
  caught: number;
  wrong: number;
  /** Terms won in mirror mode, and daily terms finished. */
  mirrorWins: number;
  dailies: number;
  shared: number;
  /** Party games played to the end. */
  parties: number;
}

interface Save {
  muted: boolean;
  game: Game | null;
  /** The seed of the last term already counted in the records. */
  recorded: number | null;
  meta: Meta;
  /** Mirror mode opens after the first win; the side new terms are played on. */
  mirrorUnlocked: boolean;
  mode: Mode;
  achievements: string[];
  /** Music on or off (the speaker button mutes everything). */
  music: boolean;
  /** Party mode: the game in progress, and the names last used. */
  party: PartyGame | null;
  partyNames: string[];
  partyRecorded: number | null;
  /** The best daily score, per date. */
  dailyBests: Record<string, number>;
  /** The first-term walkthrough has been shown. */
  walkthroughSeen: boolean;
}

const slot = createSaveSlot<Save>({ game: 'wrong-austrians', version: 1 });
const saved = slot.load();
const count = (x: unknown) => Math.max(0, Math.floor(Number(x) || 0));

/** A saved term, if it still makes sense with this version's crises. */
function gameFrom(raw: unknown): Game | null {
  try {
    const g = raw as Game;
    if (!g || typeof g.seed !== 'number' || !g.rng || !Array.isArray(g.advisors) || g.advisors.length !== COUNCIL) return null;
    if (!Array.isArray(g.crises) || g.crises.some((id) => !crisisById(id))) return null;
    g.mode = g.mode === 'mirror' ? 'mirror' : 'ancap';
    // Saves from before the investigations had a background check instead, and no hidden pasts.
    upgradeGame(g);
    g.twist = twistById(g.twist)?.id ?? null;
    if ([...g.proposals, ...g.tabled].some((p) => !findPolicy(p.policy)) || g.pending.some((p) => !findPolicy(p.policy))) return null;
    // Saves from before mirror mode called the impostors "viennese".
    for (const a of g.advisors as (Advisor & { viennese?: boolean })[]) {
      if (typeof a.impostor !== 'boolean') a.impostor = a.viennese === true;
      delete a.viennese;
    }
    if (!(g.quarter >= 1 && g.quarter <= QUARTERS)) return null;
    return g;
  } catch {
    return null;
  }
}

/** A saved party, if it still makes sense with this version's content. */
function partyFrom(raw: unknown): PartyGame | null {
  try {
    const g = raw as PartyGame;
    if (!g || typeof g.seed !== 'number' || !g.rng || !Array.isArray(g.players) || g.players.length < MIN_PLAYERS || g.players.length > MAX_PLAYERS) return null;
    if (g.crises.some((id) => !crisisById(id))) return null;
    const ids = [...Object.values(g.hands ?? {}).flat(), ...g.proposals.map((p) => p.policy), ...g.pending.map((p) => p.policy)];
    if (ids.some((id) => !findPolicy(id))) return null;
    g.mode = g.mode === 'mirror' ? 'mirror' : 'ancap';
    return g;
  } catch {
    return null;
  }
}

const save: Save = {
  muted: saved?.muted === true,
  game: gameFrom(saved?.game),
  recorded: typeof saved?.recorded === 'number' ? saved.recorded : null,
  meta: {
    terms: count(saved?.meta?.terms),
    wins: count(saved?.meta?.wins),
    best: count(saved?.meta?.best),
    caught: count(saved?.meta?.caught),
    wrong: count(saved?.meta?.wrong),
    mirrorWins: count(saved?.meta?.mirrorWins),
    dailies: count(saved?.meta?.dailies),
    shared: count(saved?.meta?.shared),
    parties: count(saved?.meta?.parties),
  },
  music: saved?.music !== false,
  party: partyFrom(saved?.party),
  partyNames: Array.isArray(saved?.partyNames) ? saved.partyNames.filter((n): n is string => typeof n === 'string').slice(0, MAX_PLAYERS) : [],
  partyRecorded: typeof saved?.partyRecorded === 'number' ? saved.partyRecorded : null,
  achievements: normalizeUnlocked(saved?.achievements),
  dailyBests: normalizeDailyBests(saved?.dailyBests),
  mirrorUnlocked: saved?.mirrorUnlocked === true || count(saved?.meta?.wins) > 0,
  walkthroughSeen: saved?.walkthroughSeen === true,
  mode: 'ancap',
};
save.mode = saved?.mode === 'mirror' && save.mirrorUnlocked ? 'mirror' : 'ancap';
const persist = () => slot.save(save);

// ---------------------------------------------------------------------------
// Elements, sound
// ---------------------------------------------------------------------------

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const els = {
  screen: byId('screen'),
  hud: byId('hud'),
  overlay: byId('overlay'),
  mute: byId<HTMLButtonElement>('mute'),
  music: byId<HTMLButtonElement>('music'),
  toasts: byId('toasts'),
  home: byId<HTMLButtonElement>('home'),
};

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', html = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html) el.innerHTML = html;
  return el;
}
/** An element with plain text (never HTML). */
function t<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: string): HTMLElementTagNameMap[K] {
  const el = h(tag, className);
  el.textContent = text;
  return el;
}
function button(label: string, className: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const b = h('button', className, label);
  b.type = 'button';
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  return b;
}

document.addEventListener('pointerdown', () => void getAudioContext().resume().catch(() => {}), { once: true });
const SOUNDS = {
  click: () => playTone(note(520, 0.05, 0.035, 'triangle')),
  enact: () => [392, 523].forEach((hz, i) => playTone(note(hz, 0.09, 0.045, 'square'), i * 0.07)),
  caught: () => [523, 659, 784, 1047].forEach((hz, i) => playTone(note(hz, 0.12, 0.05, 'square'), i * 0.08)),
  oops: () => [330, 294, 247].forEach((hz, i) => playTone(note(hz, 0.18, 0.05, 'sawtooth'), i * 0.12)),
  bill: () => playTone(note(180, 0.25, 0.05, 'sawtooth')),
  win: () => [392, 523, 659, 784, 1047].forEach((hz, i) => playTone(note(hz, 0.14, 0.05), i * 0.09)),
  lose: () => [392, 330, 262, 196].forEach((hz, i) => playTone(note(hz, 0.22, 0.05, 'sawtooth'), i * 0.16)),
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
  if (save.muted) waltz.stop();
  else startMusic();
});

// The waltz: starts on the first click or key (browsers won't play audio before one).
const waltz = new Waltz();
function startMusic() {
  if (waltz.playing || save.muted || !save.music) return;
  const ctx = getAudioContext();
  void ctx.resume().catch(() => {});
  waltz.start(ctx);
  updateMusic();
}
/** Calm between sessions, livelier in the council, minor-key when a meter is running out. */
function updateMusic() {
  const g = view === 'game' ? save.game : view === 'party' ? save.party : null;
  let mood: MoodId = 'calm';
  if (g && g.phase !== 'over') {
    if (g.prosperity <= 25 || g.liberty <= 25) mood = 'tense';
    else if (g.phase === 'council' || g.phase === 'table' || g.phase === 'vote') mood = 'council';
  }
  waltz.set(mood, g?.mode ?? save.mode);
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
  else waltz.stop();
});
for (const type of ['pointerdown', 'keydown'] as const) document.addEventListener(type, startMusic, { once: true });
renderMute();
renderMusic();

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

/** The side being played: the current term's, or the one picked for new terms. */
const side = (): Side => sideOf(view === 'game' && save.game ? save.game.mode : view === 'party' && save.party ? save.party.mode : save.mode);

/** How an advisor looks right now: the council's colours until you know better. */
function lookOf(a: Advisor, eyes: Eyes = 'normal'): BallLook {
  const sd = side();
  return { flag: a.revealed && a.impostor ? sd.impostorFlag : sd.council, hat: a.hat, face: a.face, eyes: a.fired ? (a.impostor ? 'shifty' : 'shocked') : eyes };
}

function ball(look: BallLook, className = ''): HTMLElement {
  const el = h('span', `ball-wrap ${className}`);
  el.innerHTML = ballSvg(look);
  return el;
}

const MARK_ICON: Record<Mark, string> = { none: '🤔', trust: '✅', suspect: '🚩' };
const MARK_LABEL: Record<Mark, string> = { none: 'Unsure', trust: 'Trusted', suspect: 'Suspect' };

/** "+3 📈 −5 🗽" (or 🏛️ and 🗳️ in mirror mode) */
function effectChips(e: Effect): HTMLElement {
  const box = h('span', 'effects');
  const { meters } = side();
  for (const [k, icon] of [['p', meters.p[0]], ['l', meters.l[0]]] as const) {
    const v = e[k] ?? 0;
    if (!v) continue;
    box.append(t('span', `chip ${v > 0 ? 'up' : 'down'}`, `${v > 0 ? '+' : '−'}${Math.abs(v)} ${icon}`));
  }
  return box;
}

const quarterLabel = (q: number) => `Year ${Math.ceil(q / 4)}, Q${((q - 1) % 4) + 1}`;
const names = (g: Game, ids: number[]) => (ids.length ? ids.map((id) => advisorName(g, id).split(' ')[1]).join(', ') : 'nobody left');

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

let view: 'title' | 'game' | 'party' = 'title';
/** The question picked, waiting for someone to ask it; the investigation picked, waiting for a target. */
let picking: string | null = null;
let pickingTool: ToolId | null = null;

function render() {
  els.screen.replaceChildren();
  const g = save.game;
  checkAchievements();
  updateMusic();
  renderHud();
  if (view === 'party') return renderParty();
  if (view === 'title' || !g) return renderTitle();
  if (g.phase === 'over') return renderEnd(g);
  els.screen.append(councilRow(g));
  // How to fire someone was the thing nobody could find: say it every time.
  els.screen.append(h('p', 'council-hint', g.phase === 'council' && canFire(g) ? '👆 Tap a portrait to open their file: everything on the record, your notes, and <b>🔥 Fire</b>.' : g.quarter < FIRING_FROM ? `👆 Tap a portrait for their file. Firing opens in quarter ${FIRING_FROM} (labour law): use the time to dig.` : '👆 Tap a portrait for their file and your notes.'));
  if (g.phase === 'briefing') renderBriefing(g);
  else if (g.phase === 'council') renderCouncil(g);
  else renderResult(g);
}

function renderHud() {
  els.hud.replaceChildren();
  if (view === 'party') return partyHud();
  const g = save.game;
  if (view !== 'game' || !g) return;
  const meter = (icon: string, label: string, v: number) => {
    const m = h('span', `meter${v <= 20 ? ' low' : ''}`, `<span>${icon}</span><b>${v}</b>`);
    m.title = label;
    m.setAttribute('aria-label', `${label}: ${v}`);
    return m;
  };
  const { meters } = side();
  els.hud.append(
    t('span', 'hud-q', `${g.mode === 'mirror' ? '🪞 ' : ''}${quarterLabel(Math.min(g.quarter, termLength(g)))} · ${Math.min(g.quarter, termLength(g))}/${termLength(g)}`),
    meter(meters.p[0], meters.p[1], g.prosperity),
    meter(meters.l[0], meters.l[1], g.liberty),
  );
  const tools = TOOL_ORDER.reduce((n, id) => n + Math.max(0, toolsLeft(g, id)), 0);
  if (tools > 0 && g.phase !== 'over') {
    const chk = t('span', 'hud-check', `🔎 ${tools}`);
    chk.title = `${tools} investigation${tools === 1 ? '' : 's'} left this term (one a quarter)`;
    chk.setAttribute('aria-label', chk.title);
    els.hud.append(chk);
  }
  const twist = twistById(g.twist);
  if (twist) {
    const badge = t('span', 'hud-daily', `📅 ${twist.icon}`);
    badge.title = `Daily term ${g.daily}: ${twist.name}. ${twist.description}`;
    badge.setAttribute('aria-label', badge.title);
    els.hud.append(badge);
  }
}

function renderTitle() {
  const s = h('section', 'title-screen');
  const panel = h('div', 'comic');
  const say = (text: string, look: BallLook, cls = '') => {
    const c = h('div', `comic-ball ${cls}`);
    c.append(t('div', 'bubble', text), ball(look));
    return c;
  };
  const sd = side();
  const [l1, l2, l3, you] = sd.comic;
  panel.append(
    say(l1, { flag: sd.council, eyes: 'normal', hat: 'top', face: 'monocle' }),
    say(l2, { flag: sd.council, eyes: 'normal', face: 'glasses' }),
    say(l3, { flag: sd.council, eyes: 'shifty', hat: 'tyrolean' }, 'sus'),
    say(you, { flag: sd.player, eyes: 'happy', flip: true }, 'you'),
  );
  s.append(t('h1', 'title', 'I THOUGHT I HIRED AUSTRIAN ECONOMISTS'));
  if (save.mirrorUnlocked) {
    const tabs = h('div', 'mode-tabs');
    for (const [mode, label] of [['ancap', '🦅 Ancapball'], ['mirror', '🪞 Mirror: Austria']] as [Mode, string][]) {
      const b = button(label, `mode-tab${save.mode === mode ? ' picked' : ''}`, () => {
        save.mode = mode;
        persist();
        play('click');
        render();
      });
      b.setAttribute('aria-pressed', String(save.mode === mode));
      tabs.append(b);
    }
    s.append(tabs);
  }
  s.append(panel, t('p', 'pitch', sd.pitch(COUNCIL, IMPOSTORS)));
  const buttons = h('div', 'menu');
  const g = save.game;
  if (g && g.phase !== 'over') {
    const gs = sideOf(g.mode);
    buttons.append(button(`▶ Continue <small>${g.mode === 'mirror' ? '🪞 Mirror · ' : ''}${quarterLabel(g.quarter)} · ${gs.meters.p[0]}${g.prosperity} ${gs.meters.l[0]}${g.liberty}</small>`, 'big', () => go('game')));
    buttons.append(button(`New term <small>${save.mode === 'mirror' ? 'as Austria' : 'as Ancapball'}</small>`, 'big secondary', confirmNew));
  } else buttons.append(button(save.mode === 'mirror' ? '▶ Start a term as Austria' : '▶ Start a term', 'big', startGame));
  const d = dailyFor(new Date());
  buttons.append(button(`📅 Daily term <small>${d.twist.icon} ${d.twist.name}</small>`, 'big secondary', showDaily));
  buttons.append(button(`🏅 Achievements <small>${save.achievements.length}/${ACHIEVEMENTS.length}</small>`, 'big secondary', showAchievements));
  buttons.append(button(`🎉 Party mode <small>${save.party && save.party.phase !== 'over' ? 'continue the party' : `${MIN_PLAYERS}–${MAX_PLAYERS} players, one phone`}</small>`, 'big secondary', () => go('party')));
  buttons.append(button('📖 How to play', 'big secondary', showHowTo));
  buttons.append(button('💾 Save &amp; load', 'big secondary', () => openSaveTransfer('wrong-austrians')));
  s.append(buttons);
  const m = save.meta;
  if (m.terms) s.append(t('p', 'meta', `${m.terms} term${m.terms === 1 ? '' : 's'} · ${m.wins} won${m.mirrorWins ? ` (${m.mirrorWins} as Austria)` : ''} · best ${m.best} points · ${m.caught} impostors caught, ${m.wrong} loyal advisors fired by mistake`));
  if (!save.mirrorUnlocked) s.append(t('p', 'meta', '🔒 Win a term to unlock mirror mode: play as Austria.'));
  els.screen.append(s);
}

function go(to: 'title' | 'game' | 'party') {
  view = to;
  picking = null;
  render();
  window.scrollTo(0, 0);
}

function startGame() {
  save.game = newGame((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, null, save.mode);
  persist();
  go('game');
}

function confirmNew() {
  openOverlay('Start over?', (box) => {
    box.append(t('p', '', 'Your current term ends here (it counts as a loss).'));
    box.append(
      button('Yes, new term', 'big', () => {
        if (save.game) record(save.game, true);
        closeOverlay();
        startGame();
      }),
      button('Keep governing', 'big secondary', closeOverlay),
    );
  });
}

function showHowTo() {
  openOverlay('How to play', (box) => {
    box.append(
      h('ul', 'how', side().how(COUNCIL, IMPOSTORS, QUARTERS)),
      button('▶ The walkthrough', 'big secondary', () => showWalkthrough(0)),
      button('Got it', 'big', closeOverlay),
    );
  });
}

// --- The council strip ---

function councilRow(g: Game): HTMLElement {
  const row = h('div', 'council');
  for (const a of g.advisors) {
    const card = button('', `advisor${a.fired ? ' fired' : ''}${a.revealed ? (a.impostor ? ' is-impostor' : ' is-real') : ''} mark-${a.mark}`, () => openDossier(a.id));
    card.append(ball(lookOf(a)), t('b', 'name', a.name));
    const { tag: tags } = side();
    const tag = a.fired ? (a.impostor ? tags.firedImpostor : tags.firedLoyal) : a.revealed ? (a.impostor ? tags.impostor : tags.loyal) : `${MARK_ICON[a.mark]} ${MARK_LABEL[a.mark]}`;
    card.append(t('small', 'tag', tag));
    card.setAttribute('aria-label', `${a.name}: ${tag}. Open record.`);
    row.append(card);
  }
  return row;
}

// --- Briefing ---

function renderBriefing(g: Game) {
  const s = h('section', 'panel');
  s.append(t('h2', 'screen-title', `📰 ${quarterLabel(g.quarter)}`));
  const list = h('ul', 'news');
  for (const n of g.news) {
    const li = h('li', `news-item${n.good === false ? ' bad' : n.good ? ' good' : ''}`);
    li.append(t('span', 'news-text', n.text), effectChips(n.effect));
    if (n.policy && n.backers) {
      const pol = policyOf(n.policy);
      li.append(t('small', 'news-who', `“${pol.title}”, backed by ${names(g, n.backers)}`));
    }
    list.append(li);
  }
  s.append(list);
  const c = crisisOf(g);
  const card = h('div', 'crisis');
  card.append(t('span', 'crisis-emoji', c.emoji), t('h3', '', c.title), t('p', '', c.text));
  s.append(card, button('Convene the council ▶', 'big', () => {
    beginCouncil(g);
    persist();
    play('click');
    render();
  }));
  els.screen.append(s);
}

// --- The council session ---

function renderCouncil(g: Game) {
  const c = crisisOf(g);
  const s = h('section', 'panel');
  s.append(h('h2', 'screen-title', `${c.emoji} <span></span>`));
  s.querySelector('.screen-title span')!.textContent = c.title;

  s.append(t('h3', 'section', '📋 On the table'));
  const props = h('div', 'proposals');
  for (const p of g.proposals) {
    const pol = policyOf(p.policy);
    const card = h('div', 'proposal');
    card.append(t('b', 'proposal-title', pol.title), t('q', 'pitch', pol.pitch));
    const who = h('div', 'backers');
    for (const id of p.backers) {
      const a = g.advisors[id];
      const chip = h('span', 'backer');
      chip.append(ball(lookOf(a), 'mini'), t('span', '', a.name.split(' ')[1]));
      who.append(chip);
    }
    card.append(who, button('Enact', 'enact', () => doEnact(p.policy)));
    props.append(card);
  }
  s.append(props);

  if (g.talk.length) {
    s.append(t('h3', 'section', '🗣️ The debate'));
    const talk = h('div', 'talk');
    for (const line of g.talk) {
      const a = g.advisors[line.from];
      const row = h('div', `line ${line.kind}`);
      row.append(ball(lookOf(a, line.kind === 'accuse' ? 'shifty' : 'normal'), 'mini'));
      const said = h('div', 'said');
      said.append(t('b', '', a.name), t('span', '', line.text));
      row.append(said);
      talk.append(row);
    }
    s.append(talk);
  }

  s.append(t('h3', 'section', `❓ Questions · ${g.questionsLeft} left`));
  const qs = h('div', 'questions');
  if (g.questionsLeft > 0) {
    for (const id of g.offered) {
      const q = QUESTIONS.find((x) => x.id === id)!;
      const b = button('', `question${picking === id ? ' picked' : ''}`, () => {
        picking = picking === id ? null : id;
        play('click');
        render();
      });
      b.textContent = q.q;
      qs.append(b);
    }
    if (picking) {
      const who = h('div', 'ask-who');
      who.append(t('span', '', 'Ask whom?'));
      for (const a of active(g)) {
        const already = g.answers.some((x) => x.advisor === a.id && x.question === picking);
        who.append(button('', 'ask', () => doAsk(a.id), already));
        who.lastElementChild!.textContent = a.name.split(' ')[1];
      }
      qs.append(who);
    }
  }
  s.append(qs);
  const now = g.answers.filter((x) => x.quarter === g.quarter);
  if (now.length) {
    const log = h('div', 'answers');
    for (const ans of now) {
      const q = QUESTIONS.find((x) => x.id === ans.question)!;
      const row = h('div', 'answer');
      row.append(ball(lookOf(g.advisors[ans.advisor]), 'mini'));
      const said = h('div', 'said');
      said.append(t('small', 'asked', `You: ${q.q}`), t('b', '', advisorName(g, ans.advisor)), t('span', '', ans.text));
      row.append(said);
      log.append(row);
    }
    s.append(log);
  }
  // This quarter's investigation.
  s.append(t('h3', 'section', `🔎 Investigate · ${g.investigated ? 'done this quarter' : 'one a quarter'}`));
  const inv = h('div', 'questions tools');
  if (canInvestigate(g)) {
    for (const id of TOOL_ORDER) {
      const tool = TOOLS[id];
      const left = toolsLeft(g, id);
      const b = button(`${tool.icon} ${tool.name}${left > 1 ? ` <small>×${left}</small>` : ''}`, `question tool${pickingTool === id ? ' picked' : ''}`, () => {
        pickingTool = pickingTool === id ? null : id;
        play('click');
        render();
      }, left <= 0);
      if (left <= 0) b.title = 'Used this term';
      inv.append(b);
    }
    if (pickingTool) {
      const who = h('div', 'ask-who');
      who.append(t('span', '', 'Investigate whom?'));
      for (const a of active(g)) {
        who.append(button('', 'ask', () => doInvestigate(pickingTool!, a.id)));
        who.lastElementChild!.textContent = a.name.split(' ')[1];
      }
      inv.append(who);
    }
  }
  s.append(inv);
  const found = g.clues.filter((c) => c.quarter === g.quarter);
  if (found.length) {
    const log = h('div', 'answers');
    for (const c of found) log.append(clueRow(g, c));
    s.append(log);
  }
  s.append(t('p', 'hint', g.firedThisQuarter !== null ? 'You’ve fired someone this quarter. Enact one proposal to carry on.' : 'Clues lean; they don’t prove. Then enact one proposal to end the quarter.'));
  els.screen.append(s);
  if (!save.walkthroughSeen && !walkthroughOpen) showWalkthrough(0);
}

let walkthroughOpen = false;

/** An investigation's result, as a row: who, which tool, what turned up. */
function clueRow(g: Game, c: Game['clues'][number]): HTMLElement {
  const tool = TOOLS[c.tool];
  const row = h('div', 'answer clue');
  row.append(ball(lookOf(g.advisors[c.advisor]), 'mini'));
  const said = h('div', 'said');
  said.append(t('small', 'asked', `${tool.icon} ${tool.heading}`), t('b', '', advisorName(g, c.advisor)), t('span', '', c.text));
  row.append(said);
  return row;
}

function doInvestigate(tool: ToolId, advisor: number) {
  const g = save.game!;
  pickingTool = null;
  if (investigate(g, tool, advisor)) play('click');
  persist();
  render();
}

/** The first-term walkthrough: a few short cards, then it gets out of the way. */
function showWalkthrough(step: number) {
  const steps = side().walkthrough(COUNCIL, IMPOSTORS);
  const [title, body] = steps[step];
  walkthroughOpen = true;
  const done = () => {
    save.walkthroughSeen = true;
    walkthroughOpen = false;
    persist();
    closeOverlay();
  };
  openOverlay(`${step + 1}/${steps.length} · ${title}`, (box) => {
    box.append(h('p', 'walkthrough', body));
    const nav = h('div', 'menu');
    if (step < steps.length - 1) nav.append(button('Next ▶', 'big', () => showWalkthrough(step + 1)), button('Skip', 'big secondary', done));
    else nav.append(button('Got it: let’s govern', 'big', done));
    box.append(nav);
  }, false);
}

function doAsk(advisor: number) {
  const g = save.game!;
  if (!picking) return;
  if (ask(g, advisor, picking)) play('click');
  picking = null;
  persist();
  render();
}

function doEnact(policy: string) {
  const g = save.game!;
  if (!enact(g, policy)) return;
  play('enact');
  persist();
  render();
  window.scrollTo(0, 0);
}

// --- Result ---

function renderResult(g: Game) {
  const s = h('section', 'panel');
  const last = g.enacted[g.enacted.length - 1];
  const pol = policyOf(last.policy);
  s.append(t('h2', 'screen-title', '✍️ Enacted'));
  const card = h('div', 'enacted');
  card.append(t('b', '', pol.title), t('q', 'pitch', pol.pitch), effectChips(pol.now));
  card.append(t('p', 'later', `Backed by ${names(g, last.backers)}. Its real effect lands ${pol.later.in === 1 ? 'next quarter' : 'in two quarters'}${g.quarter + pol.later.in > termLength(g) ? ', after your term (it still counts)' : ''}.`));
  s.append(card);
  if (g.firedThisQuarter !== null) {
    const a = g.advisors[g.firedThisQuarter];
    s.append(t('p', `fired-note ${a.impostor ? 'good' : 'bad'}`, `🔥 You fired ${a.name}. ${a.impostor ? side().firedNote.impostor : side().firedNote.loyal}`));
  }
  s.append(button(g.quarter >= termLength(g) ? 'End the term ▶' : 'Next quarter ▶', 'big', () => {
    nextQuarter(g);
    if (g.news.some((n) => n.good === false)) play('bill');
    persist();
    if (g.phase === 'over') endSounds(g);
    render();
    window.scrollTo(0, 0);
  }));
  els.screen.append(s);
}

// --- The dossier: an advisor's record, the mark, firing, the background check ---

function openDossier(id: number) {
  const g = save.game!;
  const a = g.advisors[id];
  play('click');
  openOverlay(a.name, (box) => {
    const head = h('div', 'dossier-head');
    head.append(ball(lookOf(a), 'big-ball'));
    const status = a.revealed ? (a.impostor ? side().status.impostor : side().status.loyal) : 'Austrian. But which kind?';
    head.append(t('p', 'status', status));
    box.append(head);
    if (!a.fired) {
      const marks = h('div', 'marks');
      for (const m of ['none', 'trust', 'suspect'] as Mark[]) {
        const b = button(`${MARK_ICON[m]} ${MARK_LABEL[m]}`, `mark${a.mark === m ? ' picked' : ''}`, () => {
          setMark(g, id, m);
          persist();
          closeOverlay();
          render();
        });
        b.setAttribute('aria-pressed', String(a.mark === m));
        marks.append(b);
      }
      box.append(marks);
    }
    const rec = h('div', 'record');
    const items: HTMLElement[] = [];
    for (const p of g.tabled.filter((x) => x.backers.includes(id))) {
      const pol = policyOf(p.policy);
      const enacted = g.enacted.some((e) => e.quarter === p.quarter && e.policy === p.policy);
      const landed = g.landed.find((l) => l.policy === p.policy && l.backers?.includes(id));
      const li = h('li', landed ? (landed.good ? 'good' : 'bad') : '');
      li.textContent = `Q${p.quarter}: proposed “${pol.title}”${enacted ? ' (enacted' + (landed ? (landed.good ? ', it paid off)' : ', and the bill came)') : ')') : ''}`;
      items.push(li);
    }
    for (const ans of g.answers.filter((x) => x.advisor === id)) {
      const q = QUESTIONS.find((x) => x.id === ans.question)!;
      const li = h('li', 'answer-li');
      li.textContent = `Q${ans.quarter}: asked “${q.q}” → “${ans.text}”`;
      items.push(li);
    }
    for (const c of g.clues.filter((x) => x.advisor === id)) {
      const li = h('li', 'clue-li');
      li.textContent = `Q${c.quarter}: ${TOOLS[c.tool].icon} ${TOOLS[c.tool].heading}: ${c.text}`;
      items.push(li);
    }
    for (const line of g.said.filter((x) => x.from === id)) {
      const li = h('li', 'said-li');
      li.textContent = `Q${line.quarter}: said “${line.text}”`;
      items.push(li);
    }
    if (items.length) {
      const ul = h('ul');
      ul.append(...items);
      rec.append(t('h3', '', 'On the record'), ul);
    } else rec.append(t('p', 'muted', 'Nothing on the record yet.'));
    box.append(rec);
    const actions = h('div', 'actions');
    if (!a.fired && g.phase === 'council') {
      const why = g.quarter < FIRING_FROM ? `(from quarter ${FIRING_FROM}: labour law)` : '(one a quarter)';
      actions.append(button(canFire(g) ? '🔥 Fire' : `🔥 Fire <small>${why}</small>`, 'big danger', () => confirmFire(id), !canFire(g)));
    } else if (!a.fired && g.phase !== 'council') actions.append(t('p', 'muted', 'Firing happens in the council session.'));
    box.append(actions);
  });
}

function confirmFire(id: number) {
  const g = save.game!;
  const a = g.advisors[id];
  openOverlay(`Fire ${a.name}?`, (box) => {
    box.append(t('p', '', side().fireWarning));
    box.append(
      button('🔥 You’re fired', 'big danger', () => {
        fire(g, id);
        persist();
        play(a.impostor ? 'caught' : 'oops');
        reveal(a);
      }),
      button('Not yet', 'big secondary', closeOverlay),
    );
  });
}

function reveal(a: Advisor) {
  const g = save.game!;
  const { reveal: rv } = side();
  openOverlay(a.impostor ? rv.impostorTitle : rv.loyalTitle, (box) => {
    box.append(ball({ ...lookOf(a), eyes: a.impostor ? 'shifty' : 'shocked' }, 'big-ball'));
    box.append(
      t(
        'p',
        'reveal-text',
        a.impostor ? rv.impostor(a.name) : rv.loyal(a.name),
      ),
    );
    box.append(
      button('Carry on', 'big', () => {
        closeOverlay();
        if (g.phase === 'over') endSounds(g);
        render();
      }),
    );
  }, false);
}

// ---------------------------------------------------------------------------
// Party mode: pass the phone round the table
// ---------------------------------------------------------------------------

/** Whether the player holding the phone has tapped to see their private screen. */
let peek = false;
/** The player count and side picked on the setup screen. */
let setupCount = 5;
let setupMode: Mode = 'ancap';

function partyHud() {
  const g = save.party;
  if (!g || g.phase === 'roles') {
    els.hud.append(t('span', 'hud-q', '🎉 Party mode'));
    return;
  }
  const sd = sideOf(g.mode);
  const meter = (icon: string, label: string, v: number) => {
    const m = h('span', `meter${v <= 20 ? ' low' : ''}`, `<span>${icon}</span><b>${v}</b>`);
    m.title = label;
    return m;
  };
  els.hud.append(
    t('span', 'hud-q', `🎉 ${quarterLabel(g.quarter)} · ${g.quarter}/${QUARTERS}`),
    meter(sd.meters.p[0], sd.meters.p[1], g.prosperity),
    meter(sd.meters.l[0], sd.meters.l[1], g.liberty),
  );
}

function renderParty() {
  const g = save.party;
  if (!g) return partySetup();
  const s = h('section', 'panel party');
  switch (g.phase) {
    case 'roles':
      partyPass(s, g, g.turn, 'see your role', () => partyRole(s, g));
      break;
    case 'briefing':
      partyBriefing(s, g);
      break;
    case 'propose':
      partyPass(s, g, g.turn, 'see your policies', () => partyHand(s, g));
      break;
    case 'table':
      partyTable(s, g);
      break;
    case 'result':
      partyResult(s, g);
      break;
    case 'vote':
      partyPass(s, g, g.turn, 'vote in secret', () => partyBallot(s, g));
      break;
    case 'voted':
      partyVoted(s, g);
      break;
    case 'over':
      partyEnd(s, g);
      break;
  }
  els.screen.append(s);
  if (g.phase !== 'over' && !peek) {
    els.screen.append(
      button('🚪 End this party', 'close leave', () =>
        openOverlay('End this party?', (box) => {
          box.append(t('p', '', 'The game ends here, with no winner, and you go back to setting up a table.'));
          box.append(
            button('Yes, end it', 'big danger', () => {
              save.party = null;
              persist();
              closeOverlay();
              render();
            }),
            button('Keep playing', 'big secondary', closeOverlay),
          );
        }),
      ),
    );
  }
}

function partySetup() {
  const s = h('section', 'panel party');
  s.append(t('h2', 'screen-title', '🎉 Party mode'));
  s.append(t('p', 'pitch', `${MIN_PLAYERS} to ${MAX_PLAYERS} people round one phone. Everyone gets a secret role, the app deals the policies and counts the votes, and you argue it out loud.`));
  const count = h('div', 'party-count');
  count.append(t('span', '', 'Players:'));
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
    const b = button(String(n), `mode-tab${setupCount === n ? ' picked' : ''}`, () => {
      setupCount = n;
      render();
    });
    b.setAttribute('aria-pressed', String(setupCount === n));
    count.append(b);
  }
  s.append(count, t('p', 'muted', `${TABLES[setupCount].impostors} impostor${TABLES[setupCount].impostors === 1 ? '' : 's'} at this table.`));
  const sides = h('div', 'party-count');
  sides.append(t('span', '', 'Side:'));
  for (const [mode, label] of [['ancap', '🦅 Ancapball'], ['mirror', '🪞 Austria']] as [Mode, string][]) {
    const b = button(label, `mode-tab${setupMode === mode ? ' picked' : ''}`, () => {
      setupMode = mode;
      render();
    });
    b.setAttribute('aria-pressed', String(setupMode === mode));
    sides.append(b);
  }
  s.append(sides);
  const names = h('div', 'party-names');
  const inputs: HTMLInputElement[] = [];
  for (let i = 0; i < setupCount; i++) {
    const input = h('input');
    input.type = 'text';
    input.maxLength = 16;
    input.placeholder = `Player ${i + 1}`;
    input.value = save.partyNames[i] ?? '';
    input.setAttribute('aria-label', `Player ${i + 1}’s name`);
    input.addEventListener('input', () => {
      save.partyNames[i] = input.value;
    });
    inputs.push(input);
    names.append(input);
  }
  s.append(names);
  s.append(
    button('▶ Deal the roles', 'big', () => {
      const list = inputs.map((inp, i) => inp.value.trim() || `Player ${i + 1}`);
      save.partyNames = list;
      save.party = newParty((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, list, setupMode);
      peek = false;
      persist();
      play('click');
      render();
    }),
    button('📖 Party rules', 'big secondary', showPartyRules),
  );
  els.screen.append(s);
}

function showPartyRules() {
  openOverlay('🎉 Party rules', (box) => {
    box.append(
      h(
        'ul',
        'how',
        `<li>🤫 <b>Secret roles.</b> Pass the phone round: everyone sees their role in private. Impostors also see who the other impostors are.</li>
        <li>📰 <b>Each quarter</b> a crisis hits. The phone goes round again: everyone is dealt <b>two policies</b> and proposes one. Only you see what your cards really are (sound, or not). Loyal players get bad hands too: that’s your cover, or theirs.</li>
        <li>🗣️ The proposals go on the table with names on them. <b>Argue.</b> Then the <b>Chair</b> (it rotates) enacts one.</li>
        <li>⏳ Bad policy looks fine now and sends the bill later, with the proposer’s name on it.</li>
        <li>🔥 After each quarter you can hold a <b>firing vote</b>: secret ballots, and a majority of the table fires someone. Their role is revealed.</li>
        <li>📋 Every quarter, each impostor still at the table quietly costs you a little.</li>
        <li>🏁 The loyal side wins by firing every impostor, or by surviving all ${QUARTERS} quarters. The impostors win if a meter hits 0, or if they ever match the loyal players in number.</li>`,
      ),
      button('Got it', 'big', closeOverlay),
    );
  });
}

/** "Pass the phone to Anna": the private screen only shows once she taps. */
function partyPass(s: HTMLElement, g: PartyGame, player: number, what: string, reveal: () => void) {
  if (peek) return reveal();
  const name = g.players[player].name;
  s.classList.add('pass');
  s.append(t('p', 'pass-hand', '📱'), h('h2', 'screen-title', 'Pass the phone to <span></span>'));
  s.querySelector('.screen-title span')!.textContent = name;
  s.append(t('p', 'muted', 'Everyone else, look away.'));
  const b = button('', 'big', () => {
    peek = true;
    play('click');
    render();
  });
  b.textContent = `I’m ${name}: ${what}`;
  s.append(b);
}

function partyRole(s: HTMLElement, g: PartyGame) {
  const sd = sideOf(g.mode);
  const me = g.players[g.turn];
  s.classList.add('secret');
  s.append(t('h2', 'screen-title', `${me.name}, you are…`));
  s.append(ball({ flag: me.impostor ? sd.impostorFlag : sd.council, eyes: me.impostor ? 'shifty' : 'happy', hat: me.impostor ? 'tyrolean' : 'top' }, 'big-ball'));
  s.append(t('p', `role-name ${me.impostor ? 'bad' : 'good'}`, me.impostor ? `${sd.role.impostor} · an impostor` : sd.role.loyal));
  s.append(t('p', 'pitch', me.impostor ? sd.party.impostorGoal : sd.party.loyalGoal));
  const friends = fellowImpostors(g, g.turn);
  if (friends.length) s.append(t('p', 'friends', `Your fellow impostor${friends.length === 1 ? '' : 's'}: ${friends.map((k) => g.players[k].name).join(', ')}.`));
  s.append(
    button('Got it: hide it and pass the phone', 'big', () => {
      peek = false;
      roleSeen(g);
      persist();
      render();
    }),
  );
}

function partyBriefing(s: HTMLElement, g: PartyGame) {
  s.append(t('h2', 'screen-title', `📰 ${quarterLabel(g.quarter)}`));
  const list = h('ul', 'news');
  for (const n of g.news) {
    const li = h('li', `news-item${n.good === false ? ' bad' : n.good ? ' good' : ''}`);
    li.append(t('span', 'news-text', n.text), effectChips(n.effect));
    if (n.policy && n.proposer !== undefined) li.append(t('small', 'news-who', `“${policyOf(n.policy).title}”, proposed by ${g.players[n.proposer].name}`));
    list.append(li);
  }
  const c = partyCrisis(g);
  const card = h('div', 'crisis');
  card.append(t('span', 'crisis-emoji', c.emoji), t('h3', '', c.title), t('p', '', c.text));
  s.append(list, card, t('p', 'chair', `🪑 Chair this quarter: ${g.players[g.chair].name}`));
  s.append(
    button('Deal the policies ▶', 'big', () => {
      beginProposals(g);
      peek = false;
      persist();
      play('click');
      render();
    }),
  );
}

function partyHand(s: HTMLElement, g: PartyGame) {
  const sd = sideOf(g.mode);
  const me = g.players[g.turn];
  s.classList.add('secret');
  s.append(t('h2', 'screen-title', `${me.name}: propose one`));
  s.append(t('p', 'muted', `${partyCrisis(g).emoji} ${partyCrisis(g).title}. Only you can see what these really are.`));
  const hand = h('div', 'proposals');
  for (const id of g.hands[g.turn]) {
    const pol = policyOf(id);
    const card = h('div', `proposal kind-${pol.kind}`);
    card.append(t('small', 'kind', sd.party.kinds[pol.kind]), t('b', 'proposal-title', pol.title), t('q', 'pitch', pol.pitch));
    card.append(
      button('Propose this', 'enact', () => {
        propose(g, id);
        peek = false;
        persist();
        play('click');
        render();
      }),
    );
    hand.append(card);
  }
  s.append(hand);
  if (me.impostor) {
    const friends = fellowImpostors(g, g.turn);
    if (friends.length) s.append(t('p', 'friends', `Your fellow impostor${friends.length === 1 ? '' : 's'}: ${friends.map((k) => g.players[k].name).join(', ')}.`));
  }
}

function partyTable(s: HTMLElement, g: PartyGame) {
  const c = partyCrisis(g);
  s.append(h('h2', 'screen-title', `${c.emoji} <span></span>`));
  s.querySelector('.screen-title span')!.textContent = c.title;
  s.append(t('p', 'pitch', `Argue it out. Then ${g.players[g.chair].name}, the Chair, enacts one.`));
  const props = h('div', 'proposals');
  g.proposals.forEach((p, i) => {
    const pol = policyOf(p.policy);
    const card = h('div', 'proposal');
    card.append(t('small', 'proposer', `🙋 ${g.players[p.player].name}`), t('b', 'proposal-title', pol.title), t('q', 'pitch', pol.pitch));
    card.append(
      button('Enact', 'enact', () => {
        chairEnacts(g, i);
        persist();
        play('enact');
        render();
        window.scrollTo(0, 0);
      }),
    );
    props.append(card);
  });
  s.append(props);
  s.append(partyRoster(g));
}

/** Who's still at the table, and what's on their record. */
function partyRoster(g: PartyGame): HTMLElement {
  const box = h('div', 'roster');
  const sd = sideOf(g.mode);
  g.players.forEach((p, i) => {
    const bills = g.enacted.filter((e) => e.proposer === i);
    const bad = bills.filter((e) => policyOf(e.policy).kind !== 'sound' && e.quarter + policyOf(e.policy).later.in <= g.quarter).length;
    const good = bills.filter((e) => policyOf(e.policy).kind === 'sound' && e.quarter + policyOf(e.policy).later.in <= g.quarter).length;
    const chip = h('span', `roster-chip${p.fired ? ' fired' : ''}`);
    chip.textContent = `${p.fired ? (p.impostor ? '🔥 ' : '😬 ') : i === g.chair ? '🪑 ' : ''}${p.name}${p.fired ? ` (${p.impostor ? sd.role.impostor : sd.role.loyal})` : bad || good ? ` · ${'✅'.repeat(good)}${'❌'.repeat(bad)}` : ''}`;
    box.append(chip);
  });
  return box;
}

function partyResult(s: HTMLElement, g: PartyGame) {
  const last = g.enacted[g.enacted.length - 1];
  const pol = policyOf(last.policy);
  s.append(t('h2', 'screen-title', '✍️ Enacted'));
  const card = h('div', 'enacted');
  card.append(t('b', '', pol.title), t('small', 'proposer', `Proposed by ${g.players[last.proposer].name}`), effectChips(pol.now));
  card.append(t('p', 'later', `Its real effect lands ${pol.later.in === 1 ? 'next quarter' : 'in two quarters'}${g.quarter + pol.later.in > QUARTERS ? ', after the term (it won’t count)' : ''}.`));
  s.append(card, partyRoster(g));
  const buttons = h('div', 'menu');
  buttons.append(
    button('🔥 Hold a firing vote', 'big danger', () => {
      callVote(g);
      peek = false;
      persist();
      render();
    }),
    button(g.quarter >= QUARTERS ? 'End the term ▶' : 'Next quarter ▶', 'big', () => {
      nextPartyQuarter(g);
      persist();
      render();
      window.scrollTo(0, 0);
    }),
  );
  s.append(buttons);
}

function partyBallot(s: HTMLElement, g: PartyGame) {
  const me = g.players[g.turn];
  s.classList.add('secret');
  s.append(t('h2', 'screen-title', `${me.name}: fire someone?`));
  s.append(t('p', 'muted', 'A majority of the table fires them. Your vote is secret.'));
  const box = h('div', 'ballot');
  for (const { p, i } of activePlayers(g)) {
    if (i === g.turn) continue;
    const b = button('', 'ask', () => {
      castVote(g, i);
      peek = false;
      persist();
      play('click');
      render();
    });
    b.textContent = `🔥 ${p.name}`;
    box.append(b);
  }
  box.append(
    button('Nobody', 'ask nobody', () => {
      castVote(g, -1);
      peek = false;
      persist();
      play('click');
      render();
    }),
  );
  s.append(box);
}

function partyVoted(s: HTMLElement, g: PartyGame) {
  const sd = sideOf(g.mode);
  const v = g.lastVote!;
  s.append(t('h2', 'screen-title', '🗳️ The votes are in'));
  const tally = h('ul', 'tally');
  for (const [target, n] of Object.entries(v.tally).sort((a, b) => b[1] - a[1])) {
    const li = h('li');
    li.textContent = `${Number(target) === -1 ? 'Nobody' : g.players[Number(target)].name}: ${n} vote${n === 1 ? '' : 's'}`;
    tally.append(li);
  }
  s.append(tally);
  if (v.fired === null) s.append(t('p', 'pitch', 'No majority. Nobody is fired.'));
  else {
    const p = g.players[v.fired];
    play(p.impostor ? 'caught' : 'oops');
    s.append(ball({ flag: p.impostor ? sd.impostorFlag : sd.council, eyes: p.impostor ? 'shifty' : 'shocked' }, 'big-ball'));
    s.append(t('p', `role-name ${p.impostor ? 'good' : 'bad'}`, `${p.name} is fired. ${p.impostor ? `${sd.role.impostor}: an impostor!` : `${sd.role.loyal}: loyal. Oops.`}`));
  }
  s.append(
    button(g.quarter >= QUARTERS ? 'End the term ▶' : 'Next quarter ▶', 'big', () => {
      nextPartyQuarter(g);
      persist();
      render();
      window.scrollTo(0, 0);
    }),
  );
}

function partyEnd(s: HTMLElement, g: PartyGame) {
  const sd = sideOf(g.mode);
  if (save.partyRecorded !== g.seed) {
    save.partyRecorded = g.seed;
    save.meta.parties++;
    persist();
    checkAchievements();
    play(loyalWins(g) ? 'win' : 'lose');
  }
  const [title, line] = sd.endings[g.ending!];
  s.classList.add('end', loyalWins(g) ? 'won' : 'lost');
  s.append(t('h2', 'end-title', loyalWins(g) ? sd.party.loyalWin : sd.party.impostorsWin), t('p', 'end-sub', title), t('p', 'pitch', line));
  // If a vote ended it, show the count (there was no screen for it).
  const v = g.lastVote;
  if (v && v.fired !== null) {
    const fired = g.players[v.fired];
    s.append(t('p', 'meta', `🗳️ The last vote fired ${fired.name}, ${v.tally[v.fired]} of ${Object.values(v.tally).reduce((a, b) => a + b, 0)} votes.`));
  }
  const grid = h('div', 'reveal-grid');
  for (const p of g.players) {
    const card = h('div', `reveal-card ${p.impostor ? 'impostor' : 'real'}`);
    card.append(ball({ flag: p.impostor ? sd.impostorFlag : sd.council, eyes: p.impostor ? 'shifty' : 'happy' }));
    card.append(t('b', '', p.name), t('small', 'role', p.impostor ? sd.role.impostor : sd.role.loyal), t('small', '', p.fired ? '🔥 Fired' : 'Stayed'));
    grid.append(card);
  }
  s.append(grid);
  const buttons = h('div', 'menu');
  buttons.append(
    button('▶ Same players, new game', 'big', () => {
      save.party = newParty((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, g.players.map((p) => p.name), g.mode);
      peek = false;
      persist();
      render();
      window.scrollTo(0, 0);
    }),
    button('New table', 'big secondary', () => {
      save.party = null;
      setupCount = g.players.length;
      setupMode = g.mode;
      persist();
      render();
    }),
    button('Title screen', 'big secondary', () => go('title')),
  );
  s.append(buttons);
}

// --- The daily term, achievements ---

function showDaily() {
  const d = dailyFor(new Date());
  const best = save.dailyBests[d.key];
  const playing = save.game?.daily === d.key && save.game.phase !== 'over';
  openOverlay('📅 Daily term', (box) => {
    const tw = h('p', 'daily-twist', '<span></span><b></b><small></small>');
    tw.querySelector('span')!.textContent = d.twist.icon;
    tw.querySelector('b')!.textContent = d.twist.name;
    tw.querySelector('small')!.textContent = d.twist.description;
    box.append(tw, h('p', '', `The same term for everyone today (${d.key}): the same council, the same impostors, the same crises. Always as Ancapball.${best !== undefined ? ` Your best today: <b>${best}</b> points.` : ''}`));
    box.append(
      button(playing ? '▶ Continue today’s term' : '▶ Play today’s term', 'big', () => {
        if (playing) {
          closeOverlay();
          return go('game');
        }
        const start = () => {
          save.game = newGame(d.seed, d.key, 'ancap', d.twist.id);
          persist();
          closeOverlay();
          go('game');
        };
        if (!save.game || save.game.phase === 'over') return start();
        openOverlay('Start the daily term?', (b2) => {
          b2.append(t('p', '', 'Your current term ends here (it counts as a loss).'));
          b2.append(
            button('Yes, play the daily', 'big', () => {
              if (save.game) record(save.game, true);
              start();
            }),
            button('Keep governing', 'big secondary', closeOverlay),
          );
        });
      }),
    );
  });
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
      card.querySelector('small')!.textContent = hidden ? 'Keep governing. You’ll know it when it happens.' : a.description;
      grid.append(card);
    }
    box.append(grid);
  });
}

/** Unlocks whatever the term (and the records) have earned since the last look. */
function checkAchievements() {
  const fresh = earnedNow(save.game, save.meta).filter((id) => !save.achievements.includes(id));
  if (!fresh.length) return;
  save.achievements.push(...fresh);
  persist();
  // A few at a time; a big haul (the end of a term) gets a summary instead of a wall of toasts.
  const shown = fresh.length > 3 ? fresh.slice(0, 2) : fresh;
  shown.forEach((id, i) => window.setTimeout(() => achievementToast(id), i * 700));
  if (shown.length < fresh.length) window.setTimeout(() => achievementToast(null, fresh.length - shown.length), shown.length * 700);
}

/** One achievement's toast, or (with `more`) a summary of the rest. */
function achievementToast(id: string | null, more = 0) {
  const a = id ? achievementById(id) : null;
  if (id && !a) return;
  const toast = h('div', 'toast', '<span class="icon"></span><small>ACHIEVEMENT UNLOCKED</small><b></b>');
  toast.querySelector('.icon')!.textContent = a ? a.icon : '🏅';
  toast.querySelector('b')!.textContent = a ? a.name : `+${more} more (see 🏅 Achievements)`;
  if (!a) toast.querySelector('small')!.textContent = 'AND';
  els.toasts.append(toast);
  window.setTimeout(() => toast.remove(), 4200);
  if (!save.muted) [784, 988, 1175, 1568].forEach((hz, i) => playTone(note(hz, 0.1, 0.045, 'triangle'), i * 0.07));
}

// --- The end ---

function renderEnd(g: Game) {
  record(g);
  const sd = sideOf(g.mode);
  const [title, line] = sd.endings[g.ending!];
  const s = h('section', `panel end ${won(g) ? 'won' : 'lost'}`);
  s.append(t('h2', 'end-title', title), t('p', 'pitch', line));
  s.append(h('p', 'score-line', `🏆 <b>${score(g)}</b> points <small>· ${sd.meters.p[0]} ${g.prosperity} · ${sd.meters.l[0]} ${g.liberty}</small>`));
  const twist = twistById(g.twist);
  if (g.daily && twist) s.append(t('p', 'meta', `📅 Daily term ${g.daily} · ${twist.icon} ${twist.name} · your best today: ${Math.max(save.dailyBests[g.daily] ?? 0, score(g))}`));
  if (unlockedMirror) s.append(h('p', 'unlocked', '🪞 <b>Mirror mode unlocked.</b> Play as Austria, who hired Austrian economists and got the Austrian School. Pick it on the title screen.'));
  if (g.afterTerm.length) {
    s.append(t('h3', 'section', '⏳ After your term'));
    const list = h('ul', 'news');
    for (const n of g.afterTerm) {
      const li = h('li', `news-item ${n.good ? 'good' : 'bad'}`);
      li.append(t('span', 'news-text', n.text), effectChips(n.effect));
      list.append(li);
    }
    s.append(list);
  }
  s.append(t('h3', 'section', '🎭 Who was who'));
  const grid = h('div', 'reveal-grid');
  for (const a of g.advisors) {
    const backed = g.tabled.filter((p) => p.backers.includes(a.id));
    const bad = backed.filter((p) => policyOf(p.policy).kind !== 'sound').length;
    const card = h('div', `reveal-card ${a.impostor ? 'impostor' : 'real'}`);
    card.append(ball({ flag: a.impostor ? sd.impostorFlag : sd.council, hat: a.hat, face: a.face, eyes: a.impostor ? 'shifty' : 'happy' }));
    card.append(
      t('b', '', a.name),
      t('small', 'role', a.impostor ? sd.role.impostor : sd.role.loyal),
      t('small', '', `${a.fired ? (a.impostor ? '🔥 Fired, rightly' : '🔥 Fired, wrongly') : 'Stayed'} · backed ${backed.length - bad} sound, ${bad} ${g.mode === 'mirror' ? 'ancap' : 'statist'}`),
    );
    grid.append(card);
  }
  s.append(grid);
  s.append(caseFile(g));
  const buttons = h('div', 'menu');
  const status = h('p', 'share-status');
  const share = h('div', 'menu');
  share.append(
    button('📋 Share result', 'big secondary', () => void shareResult(g, status)),
    button('🖼️ Save image', 'big secondary', () => void shareImage(g, status)),
  );
  s.append(share, status);
  buttons.append(button('▶ New term', 'big', startGame), button('Title screen', 'big secondary', () => go('title')));
  s.append(buttons);
  els.screen.append(s);
}

/**
 * The case file: everyone unmasked, and every answer and clue weighed. The near-misses come with
 * what was wrong with them, so the next term goes better.
 */
function caseFile(g: Game): HTMLElement {
  const sd = sideOf(g.mode);
  const wrap = h('details', 'case-file');
  wrap.open = true;
  wrap.append(h('summary', '', '🗂️ <b>The case file</b> <small>every answer and clue, weighed</small>'));
  const mark = { sound: '✅', near: '⚠️', slip: '🚩', dodge: '🤷' } as const;
  const toneLabel = { sound: 'right', near: 'near-miss', slip: g.mode === 'mirror' ? 'pure Mises' : 'statist', dodge: 'dodged' } as const;
  for (const a of g.advisors) {
    const answers = g.answers.filter((x) => x.advisor === a.id);
    const clues = g.clues.filter((x) => x.advisor === a.id);
    const sec = h('section', `case ${a.impostor ? 'impostor' : 'real'}`);
    sec.append(h('h4', '', `${a.impostor ? sd.role.impostor : sd.role.loyal} · <span></span>`));
    sec.querySelector('h4 span')!.textContent = a.name;
    const ul = h('ul');
    for (const ans of answers) {
      const q = QUESTIONS.find((x) => x.id === ans.question)!;
      const li = h('li', `tone-${ans.tone}`);
      li.append(t('span', 'tone', `${mark[ans.tone]} ${toneLabel[ans.tone]}`), t('span', '', ` “${q.q}” → “${ans.text}”`));
      if (ans.tone === 'near' && ans.why) li.append(t('small', 'why', g.mode === 'mirror' ? 'Too market-friendly for a Viennese.' : ans.why));
      ul.append(li);
    }
    for (const c of clues) {
      const li = h('li', `lean-${c.lean}`);
      li.append(t('span', 'tone', LEAN_LABEL[c.lean]), t('span', '', ` ${TOOLS[c.tool].icon} ${c.text}`));
      ul.append(li);
    }
    // What you never dug up.
    const hidden = TOOL_ORDER.filter((tool) => !clues.some((c) => c.tool === tool)).map((tool) => `${TOOLS[tool].icon} ${a.profile[tool].text} (${LEAN_LABEL[a.profile[tool].lean]})`);
    if (!answers.length && !clues.length) ul.append(t('li', 'muted', 'You never asked them anything or looked into them.'));
    sec.append(ul);
    if (hidden.length) {
      const more = h('details', 'unseen');
      more.append(t('summary', '', 'What you didn’t dig up'));
      const list = h('ul');
      for (const line of hidden) list.append(t('li', '', line));
      more.append(list);
      sec.append(more);
    }
    wrap.append(sec);
  }
  return wrap;
}

// --- Sharing ---

function summaryOf(g: Game): TermSummary {
  const sd = sideOf(g.mode);
  const twist = twistById(g.twist);
  return {
    mode: g.mode,
    won: won(g),
    ending: g.ending!,
    headline: sd.endings[g.ending!][0],
    score: score(g),
    quarter: g.quarter,
    meters: [
      [sd.meters.p[0], g.prosperity],
      [sd.meters.l[0], g.liberty],
    ],
    advisors: g.advisors.map((a) => ({ name: a.name, impostor: a.impostor, fired: a.fired })),
    daily: g.daily && twist ? { key: g.daily, name: twist.name, icon: twist.icon } : null,
    url: `${location.origin}${location.pathname}`,
  };
}

function shared() {
  save.meta.shared++;
  persist();
  checkAchievements();
}

async function shareResult(g: Game, status: HTMLElement) {
  const text = shareText(summaryOf(g));
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ text });
      return shared();
    }
    await navigator.clipboard.writeText(text);
    status.textContent = '📋 Copied! Paste it anywhere.';
  } catch {
    status.textContent = 'Couldn’t copy it. Here it is:\n' + text;
  }
  shared();
}

/** An advisor, unmasked, as an image (for the card). */
function ballImage(look: BallLook): Promise<HTMLImageElement | null> {
  const url = URL.createObjectURL(new Blob([ballSvg(look)], { type: 'image/svg+xml' }));
  const img = new Image();
  img.src = url;
  return img
    .decode()
    .then(() => img)
    .catch(() => null)
    .finally(() => URL.revokeObjectURL(url));
}

async function shareImage(g: Game, status: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const sd = sideOf(g.mode);
  const balls = await Promise.all(
    g.advisors.map((a) => ballImage({ flag: a.impostor ? sd.impostorFlag : sd.council, hat: a.hat, face: a.face, eyes: a.impostor ? 'shifty' : 'happy' })),
  );
  await Promise.all([document.fonts?.load("900 40px 'Roboto Condensed'").catch(() => {}), document.fonts?.load('700 28px Roboto').catch(() => {})]);
  drawShareCard(ctx, summaryOf(g), balls);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const file = new File([blob], 'wrong-austrians.png', { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ files: [file] });
      return shared();
    }
  } catch {
    // fall through to a download
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wrong-austrians.png';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = '🖼️ Saved the card.';
  shared();
}

/** Set when the term just won opened mirror mode (for the end screen). */
let unlockedMirror = false;

/** Counts a finished (or abandoned) term in the records, once. */
function record(g: Game, abandoned = false) {
  if (save.recorded === g.seed) return;
  save.recorded = g.seed;
  const m = save.meta;
  m.terms++;
  unlockedMirror = false;
  if (!abandoned && won(g)) {
    m.wins++;
    if (g.mode === 'mirror') m.mirrorWins++;
    if (!save.mirrorUnlocked) {
      save.mirrorUnlocked = true;
      unlockedMirror = true;
    }
  }
  if (!abandoned) m.best = Math.max(m.best, score(g));
  if (!abandoned && g.daily) {
    m.dailies++;
    save.dailyBests[g.daily] = Math.max(save.dailyBests[g.daily] ?? 0, score(g));
  }
  m.caught += g.advisors.filter((a) => a.fired && a.impostor).length;
  m.wrong += g.advisors.filter((a) => a.fired && !a.impostor).length;
  persist();
}

function endSounds(g: Game) {
  play(won(g) ? 'win' : 'lose');
}

// ---------------------------------------------------------------------------
// Overlay, keys, start
// ---------------------------------------------------------------------------

let overlayClosable = true;

function openOverlay(title: string, fill: (box: HTMLElement) => void, closable = true) {
  overlayClosable = closable;
  els.overlay.replaceChildren();
  const box = h('div', 'overlay-box');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', title);
  box.append(t('h2', 'screen-title', title));
  fill(box);
  if (closable) box.append(button('Close', 'close', closeOverlay));
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
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !els.overlay.hidden && overlayClosable) closeOverlay();
});
els.home.addEventListener('click', () => go('title'));

render();

if (new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, { wa: { save, render, go, waltz } });
}
