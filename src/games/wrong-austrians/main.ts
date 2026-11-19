// I THOUGHT I HIRED AUSTRIAN ECONOMISTS: the screens. The council runs in council.ts; this file
// draws it, turns clicks into moves, and keeps the save.

import './style.css';
import { getAudioContext, note, playTone } from '../../shared/audio.ts';
import { openSaveTransfer } from '../../shared/save-transfer.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import { ballSvg, type BallLook, type Eyes } from './ball.ts';
import {
  active, type Advisor, advisorName, ask, backgroundCheck, beginCouncil, canFire, COUNCIL, crisisOf, enact, fire, type Game, type Mark, newGame, nextQuarter,
  policyOf, QUARTERS, score, setMark, VIENNESE, won,
} from './council.ts';
import { crisisById, type Effect, policyById } from './crises.ts';
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
}

interface Save {
  muted: boolean;
  game: Game | null;
  /** The seed of the last term already counted in the records. */
  recorded: number | null;
  meta: Meta;
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
    if ([...g.proposals, ...g.tabled].some((p) => !policyById(p.policy)) || g.pending.some((p) => !policyById(p.policy))) return null;
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
  },
};
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

/** How an advisor looks right now: the eagle until you know better. */
function lookOf(a: Advisor, eyes: Eyes = 'normal'): BallLook {
  return { flag: a.revealed && a.viennese ? 'austria' : 'ancap', hat: a.hat, face: a.face, eyes: a.fired ? (a.viennese ? 'shifty' : 'shocked') : eyes };
}

function ball(look: BallLook, className = ''): HTMLElement {
  const el = h('span', `ball-wrap ${className}`);
  el.innerHTML = ballSvg(look);
  return el;
}

const MARK_ICON: Record<Mark, string> = { none: '🤔', trust: '✅', suspect: '🚩' };
const MARK_LABEL: Record<Mark, string> = { none: 'Unsure', trust: 'Trusted', suspect: 'Suspect' };

/** "+3 📈 −5 🗽" */
function effectChips(e: Effect): HTMLElement {
  const box = h('span', 'effects');
  for (const [k, icon] of [['p', '📈'], ['l', '🗽']] as const) {
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
  els.hud.append(
    t('span', 'hud-q', `${quarterLabel(Math.min(g.quarter, QUARTERS))} · ${Math.min(g.quarter, QUARTERS)}/${QUARTERS}`),
    meter('📈', 'Prosperity', g.prosperity),
    meter('🗽', 'Liberty', g.liberty),
  );
  if (!g.checkUsed && g.phase !== 'over') {
    const chk = t('span', 'hud-check', '🔍 1');
    chk.title = 'Background check: one per term (tap an advisor)';
    els.hud.append(chk);
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
  panel.append(
    say('Cut all taxes to 0%', { flag: 'ancap', eyes: 'normal', hat: 'top', face: 'monocle' }),
    say('Privatize Vienna plz', { flag: 'ancap', eyes: 'normal', face: 'glasses' }),
    say('Nationalize oil', { flag: 'ancap', eyes: 'shifty', hat: 'tyrolean' }, 'sus'),
    say('Wait. Why are Austrian economists suddenly statists?', { flag: 'player', eyes: 'happy', flip: true }, 'you'),
  );
  s.append(t('h1', 'title', 'I THOUGHT I HIRED AUSTRIAN ECONOMISTS'), panel);
  s.append(
    t(
      'p',
      'pitch',
      `You’re Ancapball, two years in office, with a council of ${COUNCIL} economists. ${VIENNESE} of them aren’t from the Austrian School at all: they’re just from Austria, and they want the state to grow. Find them before they regulate everything.`,
    ),
  );
  const buttons = h('div', 'menu');
  const g = save.game;
  if (g && g.phase !== 'over') {
    buttons.append(button(`▶ Continue <small>${quarterLabel(g.quarter)} · 📈${g.prosperity} 🗽${g.liberty}</small>`, 'big', () => go('game')));
    buttons.append(button('New term', 'big secondary', confirmNew));
  } else buttons.append(button('▶ Start a term', 'big', startGame));
  buttons.append(button('📖 How to play', 'big secondary', showHowTo));
  buttons.append(button('💾 Save &amp; load', 'big secondary', () => openSaveTransfer('wrong-austrians')));
  s.append(buttons);
  const m = save.meta;
  if (m.terms) s.append(t('p', 'meta', `${m.terms} term${m.terms === 1 ? '' : 's'} · ${m.wins} won · best ${m.best} points · ${m.caught} Viennese caught, ${m.wrong} real Austrians fired by mistake`));
  els.screen.append(s);
}

function go(to: 'title' | 'game') {
  view = to;
  picking = null;
  render();
  window.scrollTo(0, 0);
}

function startGame() {
  save.game = newGame((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
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
      h(
        'ul',
        'how',
        `<li>🏛️ Your council has <b>${COUNCIL} economists</b>. <b>${VIENNESE}</b> are secretly <b>from Vienna</b>: Austrian, but not the Austrian School. They want the state to grow.</li>
        <li>📰 Each quarter a <b>crisis</b> hits. Everyone proposes a fix. Real Austrians propose sound policy; the Viennese usually dress up something statist so it sounds market-friendly.</li>
        <li>⏳ <b>Bad policy looks good now and sends the bill later</b>; sound policy often stings now and pays off later. When a bill lands, the news says who backed it.</li>
        <li>❓ Ask <b>2 questions</b> a quarter. Real Austrians answer like Mises would. The Viennese bluff, and sometimes slip. Anyone might dodge.</li>
        <li>🗣️ The council <b>accuses each other</b>. The real ones go on the evidence. The Viennese frame the real ones, and cover for each other.</li>
        <li>🔥 <b>Fire</b> one advisor a quarter; you’ll find out what they were. Firing a real Austrian costs you. 🔍 One <b>background check</b> a term tells you about someone quietly.</li>
        <li>📋 Every quarter a Viennese stays on the council, they slip a regulation through: <b>−5 🗽 −2 📈</b> each, unsigned.</li>
        <li>🏁 Lose if 📈 Prosperity or 🗽 Liberty hits 0, or if the Viennese outnumber the real Austrians. Fire both Viennese to win early; survive ${QUARTERS} quarters to win anyway.</li>
        <li>🚩 Tap an advisor for their record, and to mark them ✅ trusted or 🚩 suspect.</li>`,
      ),
      button('Got it', 'big', closeOverlay),
    );
  });
}

// --- The council strip ---

function councilRow(g: Game): HTMLElement {
  const row = h('div', 'council');
  for (const a of g.advisors) {
    const card = button('', `advisor${a.fired ? ' fired' : ''}${a.revealed ? (a.viennese ? ' is-viennese' : ' is-real') : ''} mark-${a.mark}`, () => openDossier(a.id));
    card.append(ball(lookOf(a)), t('b', 'name', a.name));
    const tag = a.fired ? (a.viennese ? '🇦🇹 Fired: from Vienna' : '😢 Fired: was real') : a.revealed ? (a.viennese ? '🔍 From Vienna!' : '🔍 Real Austrian') : `${MARK_ICON[a.mark]} ${MARK_LABEL[a.mark]}`;
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
  card.append(t('p', 'later', `Backed by ${names(g, last.backers)}. Its real effect lands ${pol.later.in === 1 ? 'next quarter' : 'in two quarters'}${g.quarter + pol.later.in > QUARTERS ? ', after your term (it still counts)' : ''}.`));
  s.append(card);
  if (g.firedThisQuarter !== null) {
    const a = g.advisors[g.firedThisQuarter];
    s.append(t('p', `fired-note ${a.viennese ? 'good' : 'bad'}`, a.viennese ? `🔥 You fired ${a.name}. From Vienna, as suspected.` : `🔥 You fired ${a.name}. A real Austrian. Oops.`));
  }
  s.append(button(g.quarter >= QUARTERS ? 'End the term ▶' : 'Next quarter ▶', 'big', () => {
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
    const status = a.revealed ? (a.viennese ? '🇦🇹 From Vienna. Not the Austrian School.' : '🦅 A real Austrian School economist.') : 'Austrian. But which kind?';
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
      if (!g.checkUsed && !a.revealed) actions.append(button('🔍 Background check <small>once a term</small>', 'big secondary', () => doCheck(id)));
    } else if (!a.fired && g.phase !== 'council') actions.append(t('p', 'muted', 'Firing and background checks happen in the council session.'));
    box.append(actions);
  });
}

function confirmFire(id: number) {
  const g = save.game!;
  const a = g.advisors[id];
  openOverlay(`Fire ${a.name}?`, (box) => {
    box.append(t('p', '', 'Everyone will find out what they were. A real Austrian costs you −6 📈 −2 🗽 (severance, and a scathing op-ed). A Viennese: +4 🗽.'));
    box.append(
      button('🔥 You’re fired', 'big danger', () => {
        fire(g, id);
        persist();
        play(a.viennese ? 'caught' : 'oops');
        reveal(a);
      }),
      button('Not yet', 'big secondary', closeOverlay),
    );
  });
}

function reveal(a: Advisor) {
  const g = save.game!;
  openOverlay(a.viennese ? 'FROM VIENNA!' : 'A REAL AUSTRIAN', (box) => {
    box.append(ball({ ...lookOf(a), eyes: a.viennese ? 'shifty' : 'shocked' }, 'big-ball'));
    box.append(
      t(
        'p',
        'reveal-text',
        a.viennese
          ? `Under the ancap paint: red, white, red. ${a.name} goes back to the Finance Ministry, muttering about the social partnership.`
          : `${a.name} was the real thing. They leave to write a book about your mistake. It’s footnoted.`,
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
  play(a.viennese ? 'caught' : 'click');
  openOverlay('🔍 Background check', (box) => {
    box.append(ball(lookOf(a), 'big-ball'));
    box.append(
      t(
        'p',
        'reveal-text',
        a.viennese
          ? `The registrar writes back: ${a.name}, twenty years at the Ministry of Finance, member of three chambers, season pass to the State Opera. Austrian, yes. School: no.`
          : `The registrar writes back: ${a.name}, no state employment on record, ever. Owns four copies of Human Action. The real thing.`,
      ),
      t('p', 'muted', 'They don’t know you checked. Nobody else does either.'),
      button('Close', 'big', () => {
        closeOverlay();
        render();
      }),
    );
  }, false);
}

// --- The end ---

const ENDINGS: Record<NonNullable<Game['ending']>, [string, string]> = {
  term: ['TWO YEARS. STILL STATELESS. 😎', 'You made it through the term. Not everyone on the council was who they said they were, but the country survived them.'],
  purged: ['COUNCIL PURGED 🦅', 'Only real Austrians left. The rest of the term runs itself, mostly by abolishing things.'],
  broke: ['THE ECONOMY COLLAPSED 📉', 'Prosperity hit zero. Somewhere in Vienna, someone is drafting a stimulus.'],
  chained: ['REGULATED INTO OBLIVION 📋', 'Liberty hit zero. You now need a permit to read this sentence.'],
  takeover: ['I THOUGHT I HIRED AUSTRIAN ECONOMISTS', 'The Viennese outnumber the real Austrians. The council votes to nationalize oil, then to regulate everything.'],
};

function renderEnd(g: Game) {
  record(g);
  const [title, line] = ENDINGS[g.ending!];
  const s = h('section', `panel end ${won(g) ? 'won' : 'lost'}`);
  s.append(t('h2', 'end-title', title), t('p', 'pitch', line));
  s.append(h('p', 'score-line', `🏆 <b>${score(g)}</b> points <small>· 📈 ${g.prosperity} · 🗽 ${g.liberty}</small>`));
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
    const statist = backed.filter((p) => policyOf(p.policy).kind !== 'sound').length;
    const card = h('div', `reveal-card ${a.viennese ? 'viennese' : 'real'}`);
    card.append(ball({ flag: a.viennese ? 'austria' : 'ancap', hat: a.hat, face: a.face, eyes: a.viennese ? 'shifty' : 'happy' }));
    card.append(
      t('b', '', a.name),
      t('small', 'role', a.viennese ? '🇦🇹 From Vienna' : '🦅 Austrian School'),
      t('small', '', `${a.fired ? (a.viennese ? '🔥 Fired, rightly' : '🔥 Fired, wrongly') : 'Stayed'} · backed ${backed.length - statist} sound, ${statist} statist`),
    );
    grid.append(card);
  }
  s.append(grid);
  const buttons = h('div', 'menu');
  buttons.append(button('▶ New term', 'big', startGame), button('Title screen', 'big secondary', () => go('title')));
  s.append(buttons);
  els.screen.append(s);
}

/** Counts a finished (or abandoned) term in the records, once. */
function record(g: Game, abandoned = false) {
  if (save.recorded === g.seed) return;
  save.recorded = g.seed;
  const m = save.meta;
  m.terms++;
  if (!abandoned && won(g)) m.wins++;
  if (!abandoned) m.best = Math.max(m.best, score(g));
  m.caught += g.advisors.filter((a) => a.fired && a.viennese).length;
  m.wrong += g.advisors.filter((a) => a.fired && !a.viennese).length;
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
