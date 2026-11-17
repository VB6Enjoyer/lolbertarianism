import './style.css';
import { getAudioContext, note, playTone } from '../../shared/audio.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import * as anyaV2 from './anya.ts';
import { coverMarkup } from './anya.ts';
import type { Face, Mouth } from './anya.ts';
import * as anyaV1 from './anya-v1.ts';
import { ACHIEVEMENTS, achievementById, allPartsAchievement, normalizeUnlocked, partAchievement, wholeBookAchievement } from './achievements.ts';
import { BOOKS, bookById, dateKey, HINT_COST, LEVELS, LIGHTNING_SECONDS, MIND_READ_COST, PASS_MARK, questionsFor, roman, RUN_LENGTH, swapFor, SWAP_COST, unlockedParts, type Mode } from './bank.ts';
import type { Book, Level } from './books/types.ts';
import { combineStats, normalizeBookStats, recordAnswer, summarize, summarizeAnswers, type Stats } from './stats.ts';
import { questionScript, speak, speechSupported, stopSpeaking } from './speech.ts';
import { answer, answered, asked, current, finished, lightningVerdict, newQuiz, next, replaceCurrent, verdict, type Quiz } from './quiz.ts';

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const els = {
  app: byId('app'),
  pips: byId('pips'),
  score: byId('score'),
  peanuts: byId('peanuts'),
  mute: byId<HTMLButtonElement>('mute'),
  bubble: byId('bubble'),
  bubbleText: byId('bubble-text'),
  anya: document.getElementById('anya') as unknown as SVGSVGElement,
  sfx: byId('sfx'),
  take: byId<HTMLButtonElement>('take'),
  menuPanel: byId('menu-panel'),
  parts: byId('parts'),
  drills: byId('drills'),
  daily: byId<HTMLButtonElement>('daily'),
  dailyNote: byId('daily-note'),
  lightning: byId<HTMLButtonElement>('lightning'),
  lightningNote: byId('lightning-note'),
  quizPanel: byId('quiz-panel'),
  chapter: byId('chapter'),
  counter: byId('counter'),
  timer: byId('timer'),
  timerBar: byId('timer-bar'),
  timerText: byId('timer-text'),
  question: byId('question'),
  options: byId('options'),
  mindRead: byId<HTMLButtonElement>('mind-read'),
  swap: byId<HTMLButtonElement>('swap'),
  hint: byId('hint'),
  next: byId<HTMLButtonElement>('next'),
  endPanel: byId('end-panel'),
  stamp: byId('stamp'),
  finalScore: byId('final-score'),
  review: byId('review'),
  best: byId('best'),
  again: byId<HTMLButtonElement>('again'),
  toMenu: byId<HTMLButtonElement>('to-menu'),
  askSowell: byId<HTMLButtonElement>('ask-sowell'),
  sowellNote: byId('sowell-note'),
  showAchievements: byId<HTMLButtonElement>('show-achievements'),
  achievements: byId('achievements'),
  achievementsGrid: byId('achievements-grid'),
  achievementsCount: byId('achievements-count'),
  hideAchievements: byId<HTMLButtonElement>('hide-achievements'),
  toasts: byId('toasts'),
  settings: byId('settings'),
  brandTitle: byId('brand-title'),
  menuKicker: byId('menu-kicker'),
  switchBook: byId<HTMLButtonElement>('switch-book'),
  prevBook: byId<HTMLButtonElement>('prev-book'),
  nextBook: byId<HTMLButtonElement>('next-book'),
  bookDots: byId('book-dots'),
};

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

/** Scores in one book. */
interface Progress {
  /** Best score in each part (out of 10), and the parts passed. */
  partBest: Record<string, number>;
  passed: number[];
  drillBest: Record<string, number>;
  dailyBests: Record<string, number>;
  lightningBest: number;
}

interface Save {
  muted: boolean;
  peanuts: number;
  /** The book Anya is holding out, and the books you've taken from her. */
  book: string;
  opened: string[];
  /** Each book's scores, by book id. */
  progress: Record<string, Progress>;
  achievements: string[];
  /** Questions answered right at least once, and running totals for achievements. */
  mastered: string[];
  peanutsEarned: number;
  hardRight: number;
  stillDumbs: number;
  /** Anya's unlockable looks, and whether each is switched on. */
  looks: { pink: boolean; green: boolean };
  /** Each book's stats, by book id. */
  stats: Record<string, Stats>;
  /** Read aloud: questions and answers, and Anya's lines. */
  tts: { questions: boolean; anya: boolean };
}
const slot = createSaveSlot<Save>({ game: 'basic-economics-trainer', version: 1 });
const saved = slot.load();
const count = (x: unknown) => Math.max(0, Math.floor(Number(x) || 0));
const counts = (raw: unknown): Record<string, number> =>
  Object.fromEntries(Object.entries(raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}).map(([k, v]) => [k, count(v)]));
function progressFrom(raw: unknown): Progress {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    partBest: counts(r.partBest),
    passed: Array.isArray(r.passed) ? r.passed.filter((n): n is number => Number.isInteger(n)) : [],
    drillBest: counts(r.drillBest),
    // Keep the last two months of daily scores.
    dailyBests: Object.fromEntries(Object.entries(counts(r.dailyBests)).filter(([k]) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 60)),
    lightningBest: count(r.lightningBest),
  };
}
// Saves from before there was a second book kept Basic Economics' scores at the top level.
const savedProgress = (saved?.progress && typeof saved.progress === 'object' ? saved.progress : { be: saved }) as Record<string, unknown>;
const save: Save = {
  muted: saved?.muted === true,
  peanuts: count(saved?.peanuts ?? 5),
  book: bookById(saved?.book).id,
  opened: Array.isArray(saved?.opened) ? saved.opened.filter((id): id is string => BOOKS.some((b) => b.id === id)) : saved?.achievements?.includes('took-book') ? ['be'] : [],
  progress: Object.fromEntries(BOOKS.map((b) => [b.id, progressFrom(savedProgress[b.id])])),
  achievements: [...normalizeUnlocked(saved?.achievements)],
  mastered: Array.isArray(saved?.mastered) ? saved.mastered.filter((id): id is string => typeof id === 'string') : [],
  peanutsEarned: count(saved?.peanutsEarned),
  hardRight: count(saved?.hardRight),
  stillDumbs: count(saved?.stillDumbs),
  looks: { pink: saved?.looks?.pink === true, green: saved?.looks?.green === true },
  stats: normalizeBookStats(saved?.stats, BOOKS.map((b) => b.id)),
  tts: { questions: saved?.tts?.questions === true, anya: saved?.tts?.anya === true },
};
const persist = () => slot.save(save);

/** The book in hand, and its scores. */
let book: Book = bookById(save.book);
const prog = () => save.progress[book.id];
const bookStats = () => save.stats[book.id];

// ---------------------------------------------------------------------------
// Sound
// ---------------------------------------------------------------------------

const sfx = {
  blip: () => playTone({ wave: 'triangle', duration: 0.03, frequency: [[0, 900 + Math.random() * 200]], gain: [[0, 0.025], [0.03, 0.001, 'exp']] }),
  page: () => {
    playTone({ wave: 'sawtooth', duration: 0.18, frequency: [[0, 300], [0.18, 1400, 'exp']], gain: [[0, 0.03], [0.18, 0.001, 'exp']] });
    playTone({ wave: 'triangle', duration: 0.12, frequency: [[0, 1800], [0.12, 600, 'exp']], gain: [[0, 0.04], [0.12, 0.001, 'exp']] }, 0.08);
  },
  right: () => [784, 1175].forEach((hz, i) => playTone(note(hz, 0.12, 0.07, 'triangle'), i * 0.08)),
  wrong: () => {
    playTone({ wave: 'square', duration: 0.28, frequency: [[0, 180], [0.28, 110, 'exp']], gain: [[0, 0.06], [0.28, 0.001, 'exp']] });
    playTone({ wave: 'square', duration: 0.2, frequency: [[0, 150]], gain: [[0, 0.04], [0.2, 0.001, 'exp']] }, 0.12);
  },
  stamp: () => {
    playTone({ wave: 'sine', duration: 0.25, frequency: [[0, 160], [0.25, 50, 'exp']], gain: [[0, 0.2], [0.25, 0.001, 'exp']] });
    playTone({ wave: 'square', duration: 0.05, frequency: [[0, 900], [0.05, 200, 'exp']], gain: [[0, 0.05], [0.05, 0.001, 'exp']] });
  },
  fanfare: () => [523, 659, 784, 1047].forEach((hz, i) => playTone(note(hz, 0.16, 0.06, 'triangle'), 0.2 + i * 0.1)),
  magic: () => [1568, 1319, 1760, 2093].forEach((hz, i) => playTone(note(hz, 0.09, 0.04, 'sine'), i * 0.05)),
  tick: () => playTone(note(1400, 0.04, 0.03, 'square')),
  boop: () => playTone({ wave: 'sine', duration: 0.16, frequency: [[0, 600], [0.08, 1300, 'exp'], [0.16, 900, 'exp']], gain: [[0, 0.09], [0.16, 0.001, 'exp']] }),
  poke: () => playTone({ wave: 'triangle', duration: 0.1, frequency: [[0, 1200], [0.1, 500, 'exp']], gain: [[0, 0.06], [0.1, 0.001, 'exp']] }),
};

function play<K extends keyof typeof sfx>(name: K) {
  if (save.muted) return;
  getAudioContext();
  sfx[name]();
}

const renderMute = () => (els.mute.textContent = save.muted ? '🔇' : '🔊');
els.mute.addEventListener('click', () => {
  save.muted = !save.muted;
  persist();
  renderMute();
});
renderMute();

function renderPeanuts(bump = false) {
  els.peanuts.textContent = `🥜 ${save.peanuts}`;
  if (bump) {
    els.peanuts.classList.remove('bump');
    void els.peanuts.offsetWidth;
    els.peanuts.classList.add('bump');
  }
}

// ---------------------------------------------------------------------------
// Anya: her face, her shot, what she says
// ---------------------------------------------------------------------------

// The current drawing, or the first one with ?anya=v1 (kept as a backup).
const art = new URLSearchParams(location.search).get('anya') === 'v1' ? anyaV1 : anyaV2;
els.anya.innerHTML = art.anyaSvg();
const faceLayer = els.anya.querySelector('#anya-face')!;
const overLayer = els.anya.querySelector('#anya-over');
let face: Face = 'neutral';
/** What's drawn right now, including the mouth when she's talking, so nothing is redrawn needlessly. */
let shownKey = 'neutral';
/** A passing reaction (a boop, a pat) shows over her current face for a moment. */
let quipFace: Face | null = null;

function show(f: Face, mouth?: Mouth) {
  const key = mouth ? `${f}:${mouth}` : f;
  if (key === shownKey) return;
  shownKey = key;
  faceLayer.innerHTML = art.faceMarkup(f, mouth);
  if (overLayer) overLayer.innerHTML = art.overMarkup(f);
}

function setFace(f: Face) {
  face = f;
  show(f);
}

// She blinks now and then (unless she's mid-reaction).
window.setInterval(() => {
  if (face !== 'neutral' || talking || quipFace) return;
  show('blink');
  window.setTimeout(() => show(face), 130);
}, 3600);

/** A manga sound effect, and focus lines for the big ones. */
function boom(text: string, tone: 'good' | 'bad' | '', focus = false) {
  els.sfx.textContent = text;
  els.sfx.className = `sfx ${tone}`;
  void els.sfx.offsetWidth; // restart the animation
  els.sfx.classList.add('pop');
  els.anya.classList.toggle('focus', focus);
  if (focus) window.setTimeout(() => els.anya.classList.remove('focus'), 900);
}

let typing: number | null = null;
let talking = false;
let fullText = '';

/** Types a line into her bubble. With `talk`, her mouth moves while she says it. */
function say(text: string, opts: { talk?: boolean; quip?: boolean; queueSpeech?: boolean } = {}) {
  if (typing !== null) window.clearInterval(typing);
  if (!opts.quip) endQuip(false);
  if (save.tts.anya) speak(text, 'anya', opts.queueSpeech);
  fullText = text;
  els.bubbleText.textContent = '';
  talking = !!opts.talk;
  let i = 0;
  typing = window.setInterval(() => {
    i++;
    els.bubbleText.textContent = text.slice(0, i);
    // Only the mouth moves, opening and closing every few letters; her eyes keep the expression.
    if (talking) show(quipFace ?? face, Math.floor(i / 5) % 2 === 0 ? 'open' : 'closed');
    if (i % 3 === 0 && text[i] !== ' ') play('blip');
    if (i >= text.length) finishTyping();
  }, 22);
}

function finishTyping() {
  if (typing !== null) window.clearInterval(typing);
  typing = null;
  els.bubbleText.textContent = fullText;
  talking = false;
  show(quipFace ?? face);
}

let quipTimer: number | null = null;
/** What the bubble said before the quip, to go back to. */
let quipReturn: string | null = null;

/** A quick aside (a boop, a pat, impatience): a line and a face for a moment, then back to what she was saying. */
function quip(text: string, f: Face, ms = 2400) {
  const back = quipReturn ?? (typing !== null ? fullText : els.bubbleText.textContent ?? '');
  say(text, { quip: true });
  quipReturn = back;
  quipFace = f;
  show(f);
  if (quipTimer !== null) window.clearTimeout(quipTimer);
  quipTimer = window.setTimeout(() => endQuip(true), ms);
}

function endQuip(restore: boolean) {
  if (quipTimer !== null) window.clearTimeout(quipTimer);
  quipTimer = null;
  const back = quipReturn;
  quipReturn = null;
  if (quipFace === null) return;
  quipFace = null;
  if (restore && back !== null) {
    if (typing !== null) window.clearInterval(typing);
    typing = null;
    talking = false;
    fullText = back;
    els.bubbleText.textContent = back;
  }
  show(face);
}

els.bubble.addEventListener('click', () => {
  if (typing !== null) finishTyping();
});

const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

type Screen = 'intro' | 'menu' | 'quiz' | 'end';

function screen(name: Screen) {
  els.app.dataset.screen = name;
  els.menuPanel.hidden = name !== 'menu';
  els.quizPanel.hidden = name !== 'quiz';
  els.endPanel.hidden = name !== 'end';
  els.anya.setAttribute('viewBox', art.SHOTS[name === 'intro' ? 'full' : 'close']);
  if (name !== 'quiz') stopTimer();
  // Panels slide in each time they're shown.
  for (const panel of [els.menuPanel, els.quizPanel, els.endPanel]) {
    panel.style.animation = 'none';
    void panel.offsetWidth;
    panel.style.animation = '';
  }
}

const LEVEL_NAMES: Record<Level, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
/** A few lines of Anya's that depend on the book in hand. */
const BOOK_LINES: Record<string, { menu: string[]; hint: string[] }> = {
  be: {
    menu: ['Sowell would want you to read the footnotes.', 'Common sense, one part at a time.'],
    hint: ['Sowell has a footnote for this.', 'Anya asked Sowell. He sighed, then said this.'],
  },
  ha: {
    menu: ['Praxeology time. Anya brought snacks.', 'Nine hundred pages. One part at a time.', 'Mises wrote this in exile. You can read it in pajamas.'],
    hint: ['Anya asked Mises. He says it’s a priori.', 'Mises says this. He was very sure.', 'Herr Professor has a hint for you.'],
  },
  eol: {
    menu: ['One lesson. Many chapters. No shortcuts.', 'Remember the tailor. Nobody else does.', 'Hazlitt wrote this for beginners. So, for you.'],
    hint: ['Hazlitt says: look at all the consequences.', 'Think of the Forgotten Man. Then read this.', 'Anya asked Hazlitt. He pointed at the broken window.'],
  },
  tmb: {
    menu: ['Follow the money. All the way to the Fed.', 'Banks make money out of thin air. Anya makes peanuts out of nothing.', 'Rothbard says the mystery is simple. Anya will be the judge.'],
    hint: ['Anya asked Rothbard. He laughed his big laugh, then said this.', 'Rothbard says: check the T-account.', 'Mr. Libertarian has a hint. He’s very excited about it.'],
  },
  mes: {
    menu: ['Fourteen hundred pages. Anya counted. Twice.', 'Start from the action axiom. Everything else follows. Supposedly.', 'Crusoe first. Then the whole economy. Then the State. Easy.'],
    hint: ['Anya asked Rothbard. He deduced it from the action axiom.', 'Rothbard says: if A, then B. Here’s your B.', 'Professor Rothbard left a footnote for you. A long one.'],
  },
};
const bookLines = () => BOOK_LINES[book.id] ?? BOOK_LINES.be;
/** Each book's icon, in its cover's colour. */
const bookIcon = (id: string) => ({ be: '📕', ha: '📘', eol: '📓', tmb: '📗', mes: '♟️' })[id] ?? '📗';

const MENU_LINES = ['Pick a part. Start at the beginning, like a normal person.', 'Well? The book won’t read itself.', 'More questions. Anya is very patient. Mostly.', 'Peanuts buy lifelines. Anya likes peanuts. Just saying.'];

function renderMenu() {
  const open = unlockedParts(prog().passed, book);
  els.parts.replaceChildren(
    ...book.parts.map((part) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      const passed = prog().passed.includes(part.n);
      const locked = !open.includes(part.n);
      const best = prog().partBest[part.n];
      b.className = `part-card${passed ? ' passed' : ''}`;
      b.disabled = locked;
      b.innerHTML = `<span class="numeral">${roman(part.n)}</span><span class="what"><b></b><small></small></span><span class="status"></span>`;
      b.querySelector('b')!.textContent = part.title;
      const chapters = part.chapters.filter((c) => c.n > 0);
      // An introduction before chapter 1 (Human Action), or an appendix after the last chapter (The Mystery of Banking)
      const appendix = chapters[chapters.length - 1].title.startsWith('Appendix');
      const body = appendix ? chapters.slice(0, -1) : chapters;
      const span = part.label ?? `${part.chapters[0].n === 0 ? 'Introduction, chapters' : 'Chapters'} ${body[0].n}–${body[body.length - 1].n}${appendix ? ' and appendix' : ''}`;
      b.querySelector('small')!.textContent = locked ? `Pass Part ${roman(part.n - 1)} to open` : `${span}${best !== undefined ? ` · best ${best}/${RUN_LENGTH}` : ''}`;
      b.querySelector('.status')!.textContent = locked ? '🔒' : passed ? 'PASSED' : '▶';
      b.addEventListener('click', () => start({ kind: 'part', part: part.n }));
      li.append(b);
      return li;
    }),
  );
  els.drills.replaceChildren(
    ...LEVELS.map((level) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `drill ${level}`;
      const best = prog().drillBest[level];
      b.innerHTML = `<b>${LEVEL_NAMES[level]}</b><small>${best !== undefined ? `Best ${best}/${RUN_LENGTH}` : `${book.questions.filter((q) => q.level === level).length} questions`}</small>`;
      b.addEventListener('click', () => start({ kind: 'drill', level }));
      return b;
    }),
  );
  const today = prog().dailyBests[dateKey(new Date())];
  els.dailyNote.textContent = today !== undefined ? `Today’s best: ${today}/${RUN_LENGTH}` : 'Same 10 questions for everyone today';
  els.lightningNote.textContent = prog().lightningBest ? `Best: ${prog().lightningBest} in a minute` : `${LIGHTNING_SECONDS} seconds. As many as you can.`;
}

function toMenu() {
  stopSpeaking();
  screen('menu');
  renderMenu();
  els.pips.replaceChildren();
  els.score.textContent = '';
  setFace('neutral');
  say(prog().passed.length === 0 && Object.keys(prog().partBest).length === 0 ? MENU_LINES[0] : pick([...MENU_LINES.slice(1), ...bookLines().menu]), { talk: true });
}

// ---------------------------------------------------------------------------
// A run
// ---------------------------------------------------------------------------

let mode: Mode = { kind: 'part', part: 1 };
let quiz: Quiz = newQuiz([]);
/** Mind-read has been used on this question. */
let readMind = false;
/** Asked the author on this question; any lifeline used this run; when this question appeared. */
let askedSowell = false;
let usedLifeline = false;
let askedAt = 0;

const isLightning = () => mode.kind === 'lightning';

function renderPips() {
  if (isLightning()) {
    els.pips.replaceChildren();
    els.score.textContent = `${quiz.score} right`;
    return;
  }
  els.pips.replaceChildren(
    ...quiz.questions.map((q, i) => {
      const li = document.createElement('li');
      const a = quiz.answers[i];
      if (a !== null && a !== undefined) {
        const right = a === q.correct;
        li.className = right ? 'right' : 'wrong';
        li.textContent = right ? '✓' : '✗';
      }
      if (i === quiz.index && !finished(quiz)) li.classList.add('now');
      return li;
    }),
  );
  els.score.textContent = `${quiz.score} / ${quiz.questions.length}`;
}

function modeLabel(m: Mode): string {
  if (m.kind === 'part') return `Part ${roman(m.part)}: ${book.parts.find((p) => p.n === m.part)!.title}`;
  if (m.kind === 'drill') return `${LEVEL_NAMES[m.level]} drill`;
  if (m.kind === 'daily') return 'Daily quiz';
  return 'Lightning round';
}

function start(m: Mode) {
  mode = m.kind === 'daily' ? { kind: 'daily', key: dateKey(new Date()) } : m;
  quiz = newQuiz(questionsFor(mode, Math.random, book));
  play('page');
  screen('quiz');
  els.timer.hidden = !isLightning();
  els.mindRead.hidden = els.swap.hidden = els.askSowell.hidden = isLightning();
  usedLifeline = false;
  els.hint.hidden = isLightning();
  if (isLightning()) startTimer();
  ask();
}

const ASK_LINES = ['Think before you click.', 'Read the question. Slowly.', 'This one’s easy. Probably.', 'Take your time. Not too much.', 'Anya is watching.'];

function ask() {
  const q = current(quiz)!;
  const n = quiz.index + 1;
  readMind = false;
  askedSowell = false;
  askedAt = performance.now();
  waited = 0;
  impatience = 0;
  els.sowellNote.hidden = true;
  els.chapter.innerHTML = '';
  els.chapter.append(document.createTextNode(q.chapter));
  const tag = document.createElement('span');
  tag.className = `level ${q.level}`;
  tag.textContent = LEVEL_NAMES[q.level];
  els.chapter.append(tag);
  els.counter.textContent = isLightning() ? `Question ${n}` : `Question ${n} of ${quiz.questions.length}`;
  els.question.textContent = q.q;
  els.next.hidden = true;
  els.quizPanel.classList.remove('answered');
  els.options.replaceChildren(
    ...q.options.map((text, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'option';
      b.innerHTML = `<span class="letter">${'ABCD'[i]}</span><span class="text"></span>`;
      b.querySelector('.text')!.textContent = text;
      b.addEventListener('click', () => choose(i));
      return b;
    }),
  );
  renderPips();
  renderLifelines();
  setFace('neutral');
  if (isLightning()) {
    readQuestion(false);
    return;
  }
  say(n === 1 ? `${modeLabel(mode)}. Question one: try not to embarrass yourself.` : n === quiz.questions.length ? 'Last one. Don’t choke.' : pick(ASK_LINES), { talk: true });
  readQuestion(save.tts.anya);
}

function renderLifelines() {
  const open = !answered(quiz);
  els.mindRead.disabled = !open || readMind || save.peanuts < MIND_READ_COST;
  els.swap.disabled = !open || save.peanuts < SWAP_COST;
  els.askSowell.disabled = !open || askedSowell || save.peanuts < HINT_COST;
}

/** Faces and sound effects for each level, right and wrong. */
const REACTIONS: Record<Level, { right: [Face, string]; wrong: [Face, string] }> = {
  easy: { right: ['smug', 'HEH.'], wrong: ['shock', 'GASP!'] },
  medium: { right: ['smug', 'GOOD.'], wrong: ['deadpan', 'SIGH.'] },
  hard: { right: ['happy', 'NICE!'], wrong: ['pout', 'HMPH!'] },
};
const RIGHT_OPENERS = ['Heh.', 'Correct.', 'Good.', 'Hmph. Fine.'];
const WRONG_OPENERS = ['Wrong.', 'No.', '…No.', 'Ugh.'];

function choose(i: number) {
  const q = current(quiz);
  if (!q || (isLightning() && timeLeft() <= 0)) return;
  const right = answer(quiz, i);
  if (right === null) return;
  recordAnswer(bookStats(), q.level, right, performance.now() - askedAt, quiz.streak);
  persist();
  if (save.tts.questions) speak(right ? 'Right.' : `Wrong. The answer was ${'ABCD'[q.correct]}: ${q.options[q.correct]}.`, 'reader');
  const buttons = [...els.options.querySelectorAll<HTMLButtonElement>('.option')];
  buttons.forEach((b, j) => {
    b.disabled = true;
    if (j === q.correct) b.classList.add('right');
    else if (j === i) b.classList.add('wrong');
    else b.classList.add('dim');
  });
  const mark = document.createElement('span');
  mark.className = 'mark';
  mark.textContent = right ? 'RIGHT!' : 'NOPE';
  buttons[i].append(mark);
  els.quizPanel.classList.add('answered');
  renderPips();
  renderLifelines();
  const [f, word] = REACTIONS[q.level][right ? 'right' : 'wrong'];
  if (right) {
    play('right');
    save.peanuts++;
    save.peanutsEarned++;
    if (!save.mastered.includes(q.id)) save.mastered.push(q.id);
    if (q.level === 'hard') save.hardRight++;
    award('first-right');
    if (quiz.streak >= 5) award('streak-5');
    if (quiz.streak >= 10) award('streak-10');
    if (save.mastered.length >= 100) award('well-read');
    if (book.questions.every((x) => save.mastered.includes(x.id))) award(wholeBookAchievement(book.id));
    if (save.hardRight >= 50) award('empiricist');
    if (save.peanutsEarned >= 100) award('peanuts-100');
    if (q.level === 'hard' && performance.now() - askedAt < 2000) award('lucky');
    persist();
    renderPeanuts(true);
    setFace(quiz.streak >= 3 ? 'happy' : f);
    boom(quiz.streak >= 3 ? 'WAKU WAKU!' : word, 'good', quiz.streak >= 3);
  } else {
    play('wrong');
    setFace(f);
    boom(word, 'bad', f === 'shock');
    if (readMind) award('cant-help');
    if (askedSowell) award('sowell-said');
    els.anya.classList.add('shake');
    window.setTimeout(() => els.anya.classList.remove('shake'), 450);
  }
  if (isLightning()) {
    // No time for explanations: straight on to the next one.
    say(right ? pick(['Next!', 'Faster!', 'Heh.', 'Go go go!']) : pick(['Wrong!', 'Nope!', 'Keep going!']));
    window.setTimeout(() => {
      if (timeLeft() > 0 && answered(quiz) && els.app.dataset.screen === 'quiz') advance();
    }, right ? 450 : 900);
    return;
  }
  const streak = right && quiz.streak === 3 ? ' Three in a row. Suspicious.' : '';
  say(right ? `${pick(RIGHT_OPENERS)} ${q.comment}${streak}` : `${pick(WRONG_OPENERS)} ${q.comment}`, { queueSpeech: save.tts.questions });
  showNext();
}

function showNext() {
  els.next.hidden = false;
  els.next.textContent = quiz.index + 1 >= quiz.questions.length ? 'See the verdict ▶' : 'Next ▶';
  els.next.focus({ preventScroll: true });
  // On a phone the button can be below the fold.
  els.next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function advance() {
  if (!answered(quiz)) return;
  if (typing !== null && !isLightning()) finishTyping();
  next(quiz);
  if (!isLightning()) play('page');
  if (finished(quiz)) end();
  else ask();
}

// --- Lifelines ---

/** Anya reads the examiner's mind: two wrong answers vanish. */
els.mindRead.addEventListener('click', () => {
  const q = current(quiz);
  if (!q || answered(quiz) || readMind || save.peanuts < MIND_READ_COST) return;
  save.peanuts -= MIND_READ_COST;
  persist();
  renderPeanuts(true);
  readMind = true;
  usedLifeline = true;
  award('mind-read');
  bookStats().mindReads++;
  const wrong = q.options.map((_, i) => i).filter((i) => i !== q.correct);
  const keep = pick(wrong);
  const buttons = els.options.querySelectorAll<HTMLButtonElement>('.option');
  for (const i of wrong) if (i !== keep) {
    buttons[i].classList.add('gone');
    buttons[i].disabled = true;
  }
  play('magic');
  setFace('smug');
  boom('MIND READ!', 'good', true);
  say(pick(['Anya can read minds. The examiner is thinking about lunch. And this.', 'Heh. Anya peeked. Two of those are wrong.', 'Waku waku. Telepathy is cheating, but peanuts are peanuts.']));
  renderLifelines();
});

/** A different question of the same difficulty. */
els.swap.addEventListener('click', () => {
  const q = current(quiz);
  if (!q || answered(quiz) || save.peanuts < SWAP_COST) return;
  const replacement = swapFor(q, quiz.questions.map((x) => x.id), Math.random, book);
  if (!replacement || !replaceCurrent(quiz, replacement)) return;
  save.peanuts -= SWAP_COST;
  usedLifeline = true;
  award('swap');
  bookStats().swaps++;
  persist();
  renderPeanuts(true);
  play('page');
  ask();
  say(pick(['Fine. Try this one instead.', 'Scared of that one? Here.', 'Different question. Same Anya.']), { talk: true });
});

/** Ask the author (Sowell, Mises): a hint from the book, not the answer. */
els.askSowell.addEventListener('click', () => {
  const q = current(quiz);
  if (!q || answered(quiz) || askedSowell || save.peanuts < HINT_COST) return;
  save.peanuts -= HINT_COST;
  persist();
  renderPeanuts(true);
  askedSowell = true;
  usedLifeline = true;
  award('ask-sowell');
  bookStats().hints++;
  if (save.tts.questions) speak(`${book.short} says: ${q.hint}`, 'reader', save.tts.anya);
  els.sowellNote.innerHTML = `<b>${book.short} says</b><br>`;
  els.sowellNote.append(document.createTextNode(q.hint));
  els.sowellNote.hidden = false;
  play('page');
  setFace('neutral');
  say(pick(['Fine. Here’s what the book says.', 'Read the hint. Then think. In that order.', ...bookLines().hint]), { talk: true });
  renderLifelines();
});

// --- The lightning round's clock ---

let timerEnds = 0;
let timerHandle: number | null = null;
let lastTick = 0;
const timeLeft = () => Math.max(0, (timerEnds - performance.now()) / 1000);

function startTimer() {
  timerEnds = performance.now() + LIGHTNING_SECONDS * 1000;
  lastTick = LIGHTNING_SECONDS;
  stopTimer();
  timerHandle = window.setInterval(renderTimer, 100);
  renderTimer();
}

function stopTimer() {
  if (timerHandle !== null) window.clearInterval(timerHandle);
  timerHandle = null;
}

function renderTimer() {
  const left = timeLeft();
  els.timerBar.style.width = `${(left / LIGHTNING_SECONDS) * 100}%`;
  els.timerText.textContent = `${Math.ceil(left)}s`;
  els.timer.classList.toggle('low', left <= 10);
  const whole = Math.ceil(left);
  if (whole <= 5 && whole < lastTick && whole > 0) play('tick');
  lastTick = whole;
  if (left <= 0) {
    stopTimer();
    if (els.app.dataset.screen === 'quiz') end();
  }
}

// --- The verdict ---

function end() {
  stopTimer();
  screen('end');
  renderPips();
  const done = asked(quiz);
  const total = isLightning() ? done.length : quiz.questions.length;
  const v = isLightning() ? lightningVerdict(quiz.score) : verdict(quiz.score, total);
  let bestLine = '';
  if (mode.kind === 'part') {
    const part = mode.part;
    const was = prog().partBest[part];
    prog().partBest[part] = Math.max(was ?? 0, quiz.score);
    if (quiz.score >= PASS_MARK && !prog().passed.includes(part)) {
      prog().passed.push(part);
      const nextPart = book.parts.find((p) => p.n === part + 1);
      bestLine = nextPart ? `📖 Part ${roman(part)} passed! Part ${roman(nextPart.n)}, “${nextPart.title},” is open.` : '🎓 You’ve passed every part of the book!';
    } else bestLine = was === undefined || quiz.score > was ? '🏆 Your best on this part yet!' : `Your best on this part: ${was}/${RUN_LENGTH}`;
  } else if (mode.kind === 'drill') {
    const was = prog().drillBest[mode.level];
    prog().drillBest[mode.level] = Math.max(was ?? 0, quiz.score);
    bestLine = was === undefined || quiz.score > was ? `🏆 Your best ${LEVEL_NAMES[mode.level].toLowerCase()} drill yet!` : `Your best: ${was}/${RUN_LENGTH}`;
  } else if (mode.kind === 'daily') {
    const was = prog().dailyBests[mode.key];
    prog().dailyBests[mode.key] = Math.max(was ?? 0, quiz.score);
    bestLine = `📅 Daily quiz, ${mode.key}: ${was === undefined ? 'your first score today.' : quiz.score > was ? `new best today (was ${was}).` : `today’s best is ${was}.`} New questions tomorrow.`;
  } else {
    const was = prog().lightningBest;
    prog().lightningBest = Math.max(was, quiz.score);
    bestLine = quiz.score > was ? '🏆 Your best lightning round yet!' : `Your best: ${was} in a minute`;
  }
  // Achievements for the run
  if (!isLightning()) {
    if (quiz.score === total && total === RUN_LENGTH) award('perfect');
    if (quiz.score === 0 && total === RUN_LENGTH) award('still-dumb');
    if (v.stamp === 'STILL DUMB' && ++save.stillDumbs >= 3) award('no-refunds');
  }
  if (mode.kind === 'part' && quiz.score >= PASS_MARK) {
    award(partAchievement(book.id, mode.part));
    if (!usedLifeline) award('no-lifelines');
    if (book.parts.every((p) => prog().passed.includes(p.n))) award(allPartsAchievement(book.id));
  }
  if (mode.kind === 'drill' && mode.level === 'hard' && quiz.score >= 8) award('drill-hard');
  if (mode.kind === 'daily') {
    award('daily');
    if (new Set(Object.values(save.progress).flatMap((p) => Object.keys(p.dailyBests))).size >= 5) award('daily-5');
  }
  if (isLightning()) {
    if (quiz.score >= 10) award('lightning-10');
    if (quiz.score >= 20) award('lightning-20');
  }
  persist();
  els.stamp.textContent = v.stamp;
  els.stamp.className = `stamp ${v.tone}`;
  els.finalScore.textContent = isLightning() ? `${quiz.score} right out of ${total} in ${LIGHTNING_SECONDS} seconds` : `${quiz.score} out of ${total}`;
  els.review.replaceChildren(
    ...done.map((q, i) => {
      const li = document.createElement('li');
      const a = quiz.answers[i];
      const right = a === q.correct;
      li.className = right ? 'right' : 'wrong';
      li.innerHTML = '<span class="tick"></span><span><b></b><small></small></span>';
      li.querySelector('.tick')!.textContent = right ? '✓' : '✗';
      li.querySelector('b')!.textContent = q.q;
      li.querySelector('small')!.textContent = right ? q.options[q.correct] : a === null || a === undefined ? `Out of time. It’s “${q.options[q.correct]}”.` : `You said “${q.options[a]}”. It’s “${q.options[q.correct]}”.`;
      return li;
    }),
  );
  els.best.textContent = bestLine;
  setFace(v.face);
  window.setTimeout(() => {
    play('stamp');
    if (v.tone === 'good') play('fanfare');
    boom(v.tone === 'good' ? 'WAKU WAKU!' : v.tone === 'okay' ? 'HEH.' : 'SIGH.', v.tone === 'bad' ? 'bad' : v.tone === 'good' ? 'good' : '', v.tone === 'good');
  }, 250);
  say(v.line);
  els.again.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

const unlocked = new Set(save.achievements);

function award(id: string) {
  if (unlocked.has(id)) return;
  const a = achievementById(id);
  if (!a) return;
  unlocked.add(id);
  save.achievements = [...unlocked];
  persist();
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = '<span class="icon"></span><small>ACHIEVEMENT UNLOCKED</small><b></b>';
  el.querySelector('.icon')!.textContent = a.icon;
  el.querySelector('b')!.textContent = a.name;
  els.toasts.append(el);
  window.setTimeout(() => el.remove(), 4300);
  if (!save.muted) [784, 988, 1175, 1568].forEach((hz, i) => playTone(note(hz, 0.1, 0.05, 'triangle'), i * 0.07));
}

function renderAchievements() {
  renderWardrobe();
  els.achievementsCount.textContent = `${unlocked.size} / ${ACHIEVEMENTS.length}`;
  els.achievementsGrid.replaceChildren(
    ...ACHIEVEMENTS.map((a) => {
      const got = unlocked.has(a.id);
      const hidden = a.secret && !got;
      const card = document.createElement('div');
      card.className = `achievement${got ? '' : ' locked'}`;
      card.innerHTML = '<span class="icon"></span><b></b><small></small>';
      card.querySelector('.icon')!.textContent = hidden ? '❓' : a.icon;
      card.querySelector('b')!.textContent = hidden ? 'Secret' : a.name;
      card.querySelector('small')!.textContent = hidden ? 'Keep reading. You’ll know it when it happens.' : a.description;
      return card;
    }),
  );
}

let pausedTimerAt: number | null = null;

/** The lightning round's clock waits while a panel is open. */
function pauseClock() {
  if (timerHandle === null) return;
  pausedTimerAt = timeLeft();
  stopTimer();
}

function resumeClock() {
  if (pausedTimerAt === null || !els.achievements.hidden || !els.settings.hidden) return;
  timerEnds = performance.now() + pausedTimerAt * 1000;
  pausedTimerAt = null;
  timerHandle = window.setInterval(renderTimer, 100);
}

function openAchievements() {
  renderAchievements();
  els.achievements.hidden = false;
  pauseClock();
  els.hideAchievements.focus();
}

function closeAchievements() {
  els.achievements.hidden = true;
  resumeClock();
}

els.showAchievements.addEventListener('click', () => (els.achievements.hidden ? openAchievements() : closeAchievements()));
els.hideAchievements.addEventListener('click', closeAchievements);

// ---------------------------------------------------------------------------
// Reading aloud, stats, and starting over
// ---------------------------------------------------------------------------

/** Reads the current question and its answers (and the author's hint, if asked). `force` reads it even if the setting's off (the R key). */
function readQuestion(queue: boolean, force = false) {
  const q = current(quiz);
  if (!q || (!save.tts.questions && !force)) return;
  speak(questionScript(q.q, q.options, askedSowell ? q.hint : undefined, book.short), 'reader', queue);
}

const settingsEls = {
  panel: byId('settings'),
  cards: byId('stats-cards'),
  levels: byId('stats-levels'),
  parts: byId('stats-parts'),
  partsNote: byId('stats-parts-note'),
  partsTitle: byId('stats-parts-title'),
  heading: byId('stats-heading'),
  scopeBook: byId<HTMLButtonElement>('scope-book'),
  scopeAll: byId<HTMLButtonElement>('scope-all'),
  ttsQuestions: byId<HTMLButtonElement>('tts-questions'),
  ttsAnya: byId<HTMLButtonElement>('tts-anya'),
  speechNote: byId('speech-note'),
  erase: byId<HTMLButtonElement>('erase'),
  eraseConfirm: byId('erase-confirm'),
  eraseYes: byId<HTMLButtonElement>('erase-yes'),
  eraseNo: byId<HTMLButtonElement>('erase-no'),
  hide: byId<HTMLButtonElement>('hide-settings'),
  show: byId<HTMLButtonElement>('show-settings'),
};

function bar(label: string, value: number, total: number, text: string, cls = '') {
  const row = document.createElement('div');
  row.className = 'stat-bar';
  row.innerHTML = `<span class="label"></span><span class="track"><i class="${cls}" style="width:${total ? Math.round((value / total) * 100) : 0}%"></i></span><span class="value"></span>`;
  row.querySelector('.label')!.textContent = label;
  row.querySelector('.value')!.textContent = text;
  return row;
}

/** Which stats the panel shows: the book in hand, or every book together. */
let statsScope: 'book' | 'all' = 'book';

function renderSettings() {
  const all = statsScope === 'all';
  const stats = all ? combineStats(BOOKS.map((b) => save.stats[b.id])) : bookStats();
  const sum = summarizeAnswers(stats);
  settingsEls.scopeBook.textContent = `${bookIcon(book.id)} ${book.title}`;
  settingsEls.scopeBook.setAttribute('aria-pressed', String(!all));
  settingsEls.scopeAll.setAttribute('aria-pressed', String(all));
  settingsEls.heading.textContent = all ? 'Your stats · all books' : `Your stats · ${book.title}`;
  const card = (value: string, label: string, cls = '') => {
    const c = document.createElement('div');
    c.className = `stat-card ${cls}`;
    c.innerHTML = '<b></b><small></small>';
    c.querySelector('b')!.textContent = value;
    c.querySelector('small')!.textContent = label;
    return c;
  };
  settingsEls.cards.replaceChildren(
    card(sum.answered.toLocaleString('en-US'), 'Questions answered'),
    card(sum.right.toLocaleString('en-US'), 'Right answers', 'good'),
    card(sum.wrong.toLocaleString('en-US'), 'Wrong answers', 'bad'),
    card(`${sum.accuracy}%`, 'Right'),
    card(sum.answered ? `${sum.averageSeconds}s` : '—', 'Average time to answer'),
    card(String(stats.bestStreak), 'Longest streak'),
    card(String(stats.hints), all ? 'Hints used (Ask the author)' : `Hints used (Ask ${book.short})`),
    card(String(stats.mindReads), 'Mind-reads'),
    card(String(stats.swaps), 'Swaps'),
    // Every right answer earns a peanut; the all-books count also covers older saves.
    card(String(all ? Math.max(save.peanutsEarned, stats.right) : stats.right), 'Peanuts earned'),
  );
  settingsEls.levels.replaceChildren(...sum.levels.map((l) => bar(LEVEL_NAMES[l.level], l.right, l.answered, l.answered ? `${l.right}/${l.answered} · ${l.accuracy}%` : 'none yet', l.level)));
  const percent = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  if (all) {
    // Every book, and all of them together
    const books = BOOKS.map((b) => summarize(save.stats[b.id], save.mastered, b));
    const mastered = books.reduce((t, x) => t + x.mastered, 0);
    const total = books.reduce((t, x) => t + x.total, 0);
    settingsEls.partsTitle.textContent = 'Every book';
    settingsEls.parts.replaceChildren(
      bar('All books', mastered, total, `${mastered}/${total} · ${percent(mastered, total)}%`),
      ...BOOKS.map((b, i) => bar(`${bookIcon(b.id)} ${b.title}`, books[i].mastered, books[i].total, `${books[i].mastered}/${books[i].total} · ${percent(books[i].mastered, books[i].total)}%`, `book-${b.id}`)),
    );
  } else {
    const whole = summarize(stats, save.mastered, book);
    settingsEls.partsTitle.textContent = `The whole book`;
    settingsEls.parts.replaceChildren(
      bar(`All ${book.parts.length} parts`, whole.mastered, whole.total, `${whole.mastered}/${whole.total} · ${percent(whole.mastered, whole.total)}%`, `book-${book.id}`),
      ...whole.parts.map((p) => bar(`${roman(p.n)}. ${p.title}`, p.mastered, p.total, `${p.mastered}/${p.total}`)),
    );
  }
  settingsEls.partsNote.textContent = 'Questions you’ve answered right at least once';
  const supported = speechSupported();
  const toggle = (b: HTMLButtonElement, on: boolean, label: string) => {
    b.disabled = !supported;
    b.setAttribute('aria-pressed', String(on && supported));
    b.textContent = `${label}: ${on && supported ? 'on' : 'off'}`;
  };
  toggle(settingsEls.ttsQuestions, save.tts.questions, '📖 Questions & answers');
  toggle(settingsEls.ttsAnya, save.tts.anya, '💬 Anya’s lines');
  if (!supported) settingsEls.speechNote.textContent = 'Your browser can’t read aloud, sorry.';
  settingsEls.eraseConfirm.hidden = true;
  settingsEls.erase.hidden = false;
}

function openSettings() {
  statsScope = 'book';
  renderSettings();
  settingsEls.panel.hidden = false;
  pauseClock();
  // Start at the top, on the book / all-books switch.
  settingsEls.panel.querySelector('.overlay-panel')!.scrollTop = 0;
  settingsEls.scopeBook.focus({ preventScroll: true });
}

function closeSettings() {
  settingsEls.panel.hidden = true;
  resumeClock();
}

settingsEls.show.addEventListener('click', () => (settingsEls.panel.hidden ? openSettings() : closeSettings()));
settingsEls.hide.addEventListener('click', closeSettings);
settingsEls.scopeBook.addEventListener('click', () => {
  statsScope = 'book';
  renderSettings();
});
settingsEls.scopeAll.addEventListener('click', () => {
  statsScope = 'all';
  renderSettings();
});
settingsEls.ttsQuestions.addEventListener('click', () => {
  save.tts.questions = !save.tts.questions;
  persist();
  renderSettings();
  if (save.tts.questions) speak('Questions and answers will be read aloud.', 'reader');
  else stopSpeaking();
});
settingsEls.ttsAnya.addEventListener('click', () => {
  save.tts.anya = !save.tts.anya;
  persist();
  renderSettings();
  if (save.tts.anya) speak('Anya will read her lines. Out loud. Heh.', 'anya');
  else stopSpeaking();
});
settingsEls.erase.addEventListener('click', () => {
  settingsEls.erase.hidden = true;
  settingsEls.eraseConfirm.hidden = false;
  settingsEls.eraseNo.focus();
});
settingsEls.eraseNo.addEventListener('click', () => {
  settingsEls.eraseConfirm.hidden = true;
  settingsEls.erase.hidden = false;
});
settingsEls.eraseYes.addEventListener('click', () => {
  // Everything goes, except the sound and read-aloud settings (and the book in hand).
  stopSpeaking();
  slot.clear();
  slot.save({ muted: save.muted, tts: save.tts, book: save.book } as Save);
  location.reload();
});

// ---------------------------------------------------------------------------
// Easter eggs: boop her nose, pat her head, poke her eyes, keep her waiting
// ---------------------------------------------------------------------------

function applyLooks() {
  els.anya.classList.toggle('pink-hair', save.looks.pink && unlocked.has('pink-hair'));
  els.anya.classList.toggle('green-eyes', save.looks.green && unlocked.has('green-eyes'));
}
applyLooks();

/** A little effect where she was touched: a heart for pats, a star for pokes, a "boop". */
function touchFx(e: PointerEvent, text: string) {
  const stage = byId('anya-stage');
  const r = stage.getBoundingClientRect();
  const fx = document.createElement('span');
  fx.className = 'touch-fx';
  fx.textContent = text;
  fx.style.left = `${e.clientX - r.left}px`;
  fx.style.top = `${e.clientY - r.top}px`;
  stage.append(fx);
  window.setTimeout(() => fx.remove(), 900);
}

let boops = 0;
let pats = 0;
let pokes = 0;

const BOOP_LINES = ['Hey! No booping!', 'Anya’s nose is private property.', 'That’s aggression. The NAP says no.', 'Boop yourself.', 'Anya will remember this.', 'Hmph!'];
const BOOP_LINES_ANGRY = ['ANYA SAID NO BOOPING.', 'Anya is filing a complaint with the Department of Education.', 'One more boop and the quiz gets harder. (It won’t. But still.)', 'Anya is getting a lawyer.'];
const PAT_LINES = ['Hehe.', '…Anya allows it.', 'Head pats are a voluntary exchange.', 'Waku waku.', 'One more. Fine.'];
const POKE_LINES = ['Ow! Anya’s eyes!', 'Anya needs those to read!', 'Stop poking!', 'Anya can’t see the book!', 'Hey!'];

function boop(e: PointerEvent) {
  boops++;
  play('boop');
  touchFx(e, 'BOOP');
  boom('BOOP!', 'bad');
  award('boop');
  quip(boops >= 5 ? pick(BOOP_LINES_ANGRY) : pick(BOOP_LINES), 'pout', 2200);
}

function pat(e: PointerEvent) {
  pats++;
  play('blip');
  touchFx(e, '♥');
  if (pats % 10 === 0) {
    const first = !unlocked.has('pink-hair');
    award('pink-hair');
    save.looks.pink = true;
    persist();
    applyLooks();
    makeoverCheck();
    play('magic');
    boom('WAKU WAKU!', 'good', true);
    quip(first ? 'Anya’s hair… is pink?! Anya likes it.' : 'Pink again! Waku waku!', 'happy', 3000);
    return;
  }
  quip(pats % 10 >= 6 ? 'Anya’s head feels… tingly.' : pick(PAT_LINES), pats % 10 >= 6 ? 'smug' : 'happy', 1300);
}

function poke(e: PointerEvent) {
  pokes++;
  touchFx(e, '✦');
  if (pokes % 10 === 0) {
    const first = !unlocked.has('green-eyes');
    award('green-eyes');
    save.looks.green = true;
    persist();
    applyLooks();
    makeoverCheck();
    play('magic');
    boom('SPARKLE!', 'good', true);
    quip(first ? 'Woah. Anya’s eyes are green now. Like money. Heh.' : 'Green again! Anya can see profits.', 'happy', 3000);
    return;
  }
  play('poke');
  show('blink');
  window.setTimeout(() => quip(pokes % 10 >= 6 ? 'Anya’s eyes feel… greener?' : pick(POKE_LINES), 'pout', 1500), 120);
}

function makeoverCheck() {
  if (unlocked.has('pink-hair') && unlocked.has('green-eyes')) award('makeover');
}

els.anya.querySelector('#anya-hits')?.addEventListener('pointerdown', (e) => {
  const part = (e.target as Element).getAttribute('data-part');
  if (!part) return;
  e.preventDefault();
  getAudioContext();
  if (part === 'nose') boop(e as PointerEvent);
  else if (part === 'head') pat(e as PointerEvent);
  else if (part === 'eye') poke(e as PointerEvent);
});

// She gets impatient if a question sits unanswered too long.
let waited = 0;
let impatience = 0;
const IMPATIENT = [
  { after: 25, face: 'deadpan' as Face, lines: ['Anya is waiting.', 'Take your time. Not this much time.', 'Hello? The answer won’t pick itself.'] },
  { after: 45, face: 'pout' as Face, lines: ['Anya could read the whole chapter by now.', 'Tick tock. Tick tock.', 'Anya is getting old here.'] },
  { after: 70, face: 'pout' as Face, lines: ['Anya is going to count to ten. One… two…', 'Is this a sit-in? Anya respects protest, but no.', 'Just pick one! Even Keynes picked one!'] },
];
window.setInterval(() => {
  const waiting = els.app.dataset.screen === 'quiz' && !answered(quiz) && !isLightning() && els.achievements.hidden && els.settings.hidden && !document.hidden && typing === null;
  if (!waiting) return;
  waited++;
  const next = IMPATIENT[impatience];
  if (!next && waited % 30 === 0) {
    quip(pick(IMPATIENT[IMPATIENT.length - 1].lines), 'pout', 3000);
    boom('TAP TAP', 'bad');
    return;
  }
  if (!next || waited < next.after) return;
  impatience++;
  award('impatient');
  quip(pick(next.lines), next.face, 3200);
  if (impatience >= 2) boom(impatience >= 3 ? 'TAP TAP TAP' : 'TAP TAP', 'bad');
}, 1000);

/** The wardrobe, in the achievements panel: switch the looks you've found on and off. */
function renderWardrobe() {
  const box = byId('wardrobe');
  const looks: { key: 'pink' | 'green'; id: string; label: string }[] = [
    { key: 'pink', id: 'pink-hair', label: '🌸 Pink hair' },
    { key: 'green', id: 'green-eyes', label: '💚 Green eyes' },
  ];
  box.replaceChildren(
    ...looks.map((look) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'small-toggle look-toggle';
      const got = unlocked.has(look.id);
      b.disabled = !got;
      b.setAttribute('aria-pressed', String(got && save.looks[look.key]));
      b.textContent = got ? `${look.label}: ${save.looks[look.key] ? 'on' : 'off'}` : '🔒 A secret look';
      b.addEventListener('click', () => {
        save.looks[look.key] = !save.looks[look.key];
        persist();
        applyLooks();
        renderWardrobe();
      });
      return b;
    }),
  );
}

// ---------------------------------------------------------------------------
// The meme, to start
// ---------------------------------------------------------------------------

let taken = false;

/** Takes the book from her: it flies at you, and the menu opens. */
function take() {
  if (taken || switching) return;
  taken = true;
  award('took-book');
  if (!save.opened.includes(book.id)) save.opened.push(book.id);
  if (BOOKS.every((b) => save.opened.includes(b.id))) award('second-book');
  persist();
  getAudioContext();
  play('page');
  els.anya.classList.add('taking');
  setFace('smug');
  window.setTimeout(() => {
    els.anya.classList.remove('taking');
    toMenu();
  }, 600);
}

// ---------------------------------------------------------------------------
// Anya's books: arrows switch which one she's holding out
// ---------------------------------------------------------------------------

const bookEl = els.anya.querySelector('#anya-book')!;

/** What she says about each book when she switches to it. */
const OFFER_LINES: Record<string, { face: Face; lines: string[] }> = {
  be: { face: 'smug', lines: ['Basic Economics. Common sense, with footnotes.', 'Sowell. Start here. Trust Anya.', 'The easy one. Well, easier.', 'Back to Sowell. Anya likes the cover.'] },
  eol: { face: 'smug', lines: ['Economics in One Lesson. Just one! Even Anya can manage one.', 'Hazlitt. Short book, long consequences.', 'Look beyond the broken window. Anya always does.', 'One lesson. Two hundred pages to say it properly.'] },
  tmb: { face: 'shock', lines: ['The Mystery of Banking. Anya will solve it. Detective Anya!', 'Rothbard! Banks make money out of thin air?! Waku waku!', 'A crystal ball full of dollars. Anya wants one.', 'Where does money come from? Not storks. Read on.'] },
  mes: { face: 'smug', lines: ['Man, Economy, and State. Two books in one! Anya brought a forklift.', 'Rothbard’s big one. Chess pieces on the cover, so you know it’s smart.', 'Praxeology, then the State. Anya plays the long game.', 'Checkmate, statists. Anya read the blurb.'] },
  ha: { face: 'happy', lines: ['Human Action. Nine hundred pages. Anya believes in you. A little.', 'Mises! Praxeology! Waku waku!', 'This one’s heavy. Lift with your legs.', 'A treatise. Like a book, but it judges you.'] },
};

/** Dresses the page for the book in hand: the cover on the plate, the colours, the names. */
function applyBook() {
  document.documentElement.dataset.book = book.id;
  bookEl.innerHTML = coverMarkup(book.id);
  els.brandTitle.textContent = book.title;
  document.title = `${book.title} Trainer`;
  els.anya.setAttribute('aria-label', `Anya, holding out a copy of ${book.title} on a plate`);
  els.menuKicker.textContent = `${book.title} · ${book.author}`;
  els.askSowell.innerHTML = `👓 Ask ${book.short} <span>${HINT_COST}🥜</span>`;
  const title = document.createElement('span');
  title.textContent = book.title;
  const author = document.createElement('span');
  author.className = 'by';
  author.textContent = `· ${book.author}`;
  els.bookDots.replaceChildren(
    title,
    author,
    ...BOOKS.map((b) => {
      const dot = document.createElement('i');
      if (b === book) dot.className = 'on';
      return dot;
    }),
  );
}

let switching = false;

/** Swaps the book on her plate: the old one slides off, the new one slides on, the page changes colour. */
function switchBook(dir: 1 | -1) {
  if (switching || taken || els.app.dataset.screen !== 'intro') return;
  switching = true;
  getAudioContext();
  play('page');
  const nextBook = BOOKS[(BOOKS.indexOf(book) + dir + BOOKS.length) % BOOKS.length];
  bookEl.classList.add(dir > 0 ? 'out-left' : 'out-right');
  window.setTimeout(() => {
    book = nextBook;
    save.book = book.id;
    persist();
    applyBook();
    bookEl.classList.remove('out-left', 'out-right');
    bookEl.classList.add(dir > 0 ? 'in-right' : 'in-left');
    const offer = OFFER_LINES[book.id] ?? OFFER_LINES.be;
    setFace(offer.face);
    boom(({ ha: 'THUD!', eol: 'PLOP!', tmb: 'KA-CHING!', mes: 'CHECK!' } as Record<string, string>)[book.id] ?? 'SWISH!', '');
    say(pick(offer.lines), { talk: true });
    window.setTimeout(() => {
      bookEl.classList.remove('in-right', 'in-left');
      switching = false;
    }, 340);
  }, 260);
}

/** Back from the menu to Anya, to pick another book. */
function toIntro() {
  stopSpeaking();
  taken = false;
  screen('intro');
  els.pips.replaceChildren();
  els.score.textContent = '';
  setFace('smug');
  say(BOOKS.length > 1 ? 'Another book? Use the arrows. Anya will wait. Briefly.' : 'Take the book. I don’t have all day.', { talk: true });
}

els.prevBook.addEventListener('click', () => switchBook(-1));
els.nextBook.addEventListener('click', () => switchBook(1));
els.switchBook.addEventListener('click', () => {
  play('page');
  toIntro();
});
els.take.addEventListener('click', take);
bookEl.addEventListener('click', take);
els.next.addEventListener('click', advance);
els.again.addEventListener('click', () => start(mode));
els.toMenu.addEventListener('click', () => {
  play('page');
  toMenu();
});
els.daily.addEventListener('click', () => start({ kind: 'daily', key: dateKey(new Date()) }));
els.lightning.addEventListener('click', () => start({ kind: 'lightning' }));

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const at = els.app.dataset.screen;
  if (!els.settings.hidden) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSettings();
    }
    return;
  }
  if ((e.key === 'r' || e.key === 'R') && at === 'quiz' && speechSupported()) {
    readQuestion(false, true);
    return;
  }
  if (!els.achievements.hidden) {
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      closeAchievements();
    }
    return;
  }
  if (at === 'intro' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault();
    switchBook(e.key === 'ArrowLeft' ? -1 : 1);
    return;
  }
  if (e.key === 'Escape' && (at === 'quiz' || at === 'end')) {
    toMenu();
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    if (document.activeElement instanceof HTMLButtonElement) {
      if (typing !== null) {
        e.preventDefault();
        finishTyping();
      }
      return; // the focused button handles it
    }
    e.preventDefault();
    if (typing !== null) finishTyping();
    else if (at === 'intro') take();
    else if (at === 'quiz' && answered(quiz)) advance();
    else if (at === 'end') els.again.click();
    return;
  }
  if (at !== 'quiz' || answered(quiz)) return;
  const n = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
  const button = els.options.querySelectorAll<HTMLButtonElement>('.option')[n];
  if (n >= 0 && button && !button.disabled) choose(n);
});

applyBook();
screen('intro');
setFace('shock');
renderPeanuts();
window.setTimeout(() => say('Take the book. I don’t have all day.'), 500);

// ?debug: the state, for testing from the console
if (new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, { bet: { wait: (n: number) => (waited += n), award, quiz: () => quiz, save, start, setFace, take, choose, timeLeft, switchBook, book: () => book } });
}
