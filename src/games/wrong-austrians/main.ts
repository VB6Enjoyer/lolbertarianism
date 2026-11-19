// I THOUGHT I HIRED AUSTRIAN ECONOMISTS: the screens. The council runs in council.ts; this file
// draws it, turns clicks into moves, and keeps the save.

import './style.css';
import { getAudioContext, note, playTone } from '../../shared/audio.ts';
import { openSaveTransfer } from '../../shared/save-transfer.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import { ballSvg, type BallLook, type Eyes } from './ball.ts';
import {
  active, type Advisor, advisorName, ask, backgroundCheck, beginCouncil, canFire, COUNCIL, crisisOf, enact, findPolicy, fire, type Game, IMPOSTORS, type Mark,
  type Mode, newGame, nextQuarter, policyOf, QUARTERS, score, setMark, won, canCheck, checksAllowed, termLength,
} from './council.ts';
import { crisisById, type Effect } from './crises.ts';
import { type Side, sideOf } from './sides.ts';
import { ACHIEVEMENTS, achievementById, earnedNow, normalizeUnlocked } from './achievements.ts';
import { dailyFor, normalizeDailyBests, twistById } from './daily.ts';
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
  /** The best daily score, per date. */
  dailyBests: Record<string, number>;
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
    // Saves from before the daily term had one background check, as a yes/no.
    const old = g as Game & { checkUsed?: boolean };
    if (typeof g.checksUsed !== 'number') g.checksUsed = old.checkUsed ? 1 : 0;
    delete old.checkUsed;
    g.checked ??= [];
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
  },
  achievements: normalizeUnlocked(saved?.achievements),
  dailyBests: normalizeDailyBests(saved?.dailyBests),
  mirrorUnlocked: saved?.mirrorUnlocked === true || count(saved?.meta?.wins) > 0,
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
});
renderMute();

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

/** The side being played: the current term's, or the one picked for new terms. */
const side = (): Side => sideOf(view === 'game' && save.game ? save.game.mode : save.mode);

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

let view: 'title' | 'game' = 'title';
/** The question picked, waiting for someone to ask it. */
let picking: string | null = null;

function render() {
  els.screen.replaceChildren();
  const g = save.game;
  checkAchievements();
  renderHud();
  if (view === 'title' || !g) return renderTitle();
  if (g.phase === 'over') return renderEnd(g);
  els.screen.append(councilRow(g));
  if (g.phase === 'briefing') renderBriefing(g);
  else if (g.phase === 'council') renderCouncil(g);
  else renderResult(g);
}

function renderHud() {
  els.hud.replaceChildren();
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
  const checks = checksAllowed(g) - g.checksUsed;
  if (checks > 0 && g.phase !== 'over') {
    const chk = t('span', 'hud-check', `🔍 ${checks}`);
    chk.title = `Background check${checks === 1 ? '' : 's'} left this term (tap an advisor)`;
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
  buttons.append(button('📖 How to play', 'big secondary', showHowTo));
  buttons.append(button('💾 Save &amp; load', 'big secondary', () => openSaveTransfer('wrong-austrians')));
  s.append(buttons);
  const m = save.meta;
  if (m.terms) s.append(t('p', 'meta', `${m.terms} term${m.terms === 1 ? '' : 's'} · ${m.wins} won${m.mirrorWins ? ` (${m.mirrorWins} as Austria)` : ''} · best ${m.best} points · ${m.caught} impostors caught, ${m.wrong} loyal advisors fired by mistake`));
  if (!save.mirrorUnlocked) s.append(t('p', 'meta', '🔒 Win a term to unlock mirror mode: play as Austria.'));
  els.screen.append(s);
}

function go(to: 'title' | 'game') {
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
  s.append(t('p', 'hint', canFire(g) ? 'Tap an advisor up top for their record, to fire them, or for the background check. Then enact one proposal.' : 'You’ve fired someone this quarter. Enact one proposal to carry on.'));
  els.screen.append(s);
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
      actions.append(button(canFire(g) ? '🔥 Fire' : '🔥 Fire <small>(one a quarter)</small>', 'big danger', () => confirmFire(id), !canFire(g)));
      const left = checksAllowed(g) - g.checksUsed;
      if (canCheck(g) && !a.revealed) actions.append(button(`🔍 Background check <small>${left === 1 ? 'one left this term' : `${left} left this term`}</small>`, 'big secondary', () => doCheck(id)));
    } else if (!a.fired && g.phase !== 'council') actions.append(t('p', 'muted', 'Firing and background checks happen in the council session.'));
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

function doCheck(id: number) {
  const g = save.game!;
  const a = g.advisors[id];
  if (!backgroundCheck(g, id)) return;
  persist();
  play(a.impostor ? 'caught' : 'click');
  openOverlay('🔍 Background check', (box) => {
    box.append(ball(lookOf(a), 'big-ball'));
    box.append(
      t(
        'p',
        'reveal-text',
        a.impostor ? side().check.impostor(a.name) : side().check.loyal(a.name),
      ),
      t('p', 'muted', 'They don’t know you checked. Nobody else does either.'),
      button('Close', 'big', () => {
        closeOverlay();
        render();
      }),
    );
  }, false);
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
  const buttons = h('div', 'menu');
  buttons.append(button('▶ New term', 'big', startGame), button('Title screen', 'big secondary', () => go('title')));
  s.append(buttons);
  els.screen.append(s);
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
  Object.assign(window, { wa: { save, render, go } });
}
