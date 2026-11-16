import './style.css';
import { getAudioContext, note, playTone } from '../../shared/audio.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import * as anyaV2 from './anya.ts';
import type { Face } from './anya.ts';
import * as anyaV1 from './anya-v1.ts';
import { ACHIEVEMENTS, achievementById, normalizeUnlocked } from './achievements.ts';
import { ASK_SOWELL_COST, BOOK, dateKey, LEVELS, LIGHTNING_SECONDS, MIND_READ_COST, PASS_MARK, questionsFor, roman, RUN_LENGTH, swapFor, SWAP_COST, unlockedParts, type Mode } from './bank.ts';
import type { Level } from './books/types.ts';
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
};

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

interface Save {
  muted: boolean;
  peanuts: number;
  /** Best score in each part (out of 10), and the parts passed. */
  partBest: Record<string, number>;
  passed: number[];
  drillBest: Record<string, number>;
  dailyBests: Record<string, number>;
  lightningBest: number;
  achievements: string[];
  /** Questions answered right at least once, and running totals for achievements. */
  mastered: string[];
  peanutsEarned: number;
  hardRight: number;
  stillDumbs: number;
  /** Anya's unlockable looks, and whether each is switched on. */
  looks: { pink: boolean; green: boolean };
}
const slot = createSaveSlot<Save>({ game: 'basic-economics-trainer', version: 1 });
const saved = slot.load();
const count = (x: unknown) => Math.max(0, Math.floor(Number(x) || 0));
const counts = (raw: unknown): Record<string, number> =>
  Object.fromEntries(Object.entries(raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}).map(([k, v]) => [k, count(v)]));
const save: Save = {
  muted: saved?.muted === true,
  peanuts: count(saved?.peanuts ?? 5),
  partBest: counts(saved?.partBest),
  passed: Array.isArray(saved?.passed) ? saved.passed.filter((n): n is number => Number.isInteger(n)) : [],
  drillBest: counts(saved?.drillBest),
  // Keep the last two months of daily scores.
  dailyBests: Object.fromEntries(Object.entries(counts(saved?.dailyBests)).filter(([k]) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 60)),
  lightningBest: count(saved?.lightningBest),
  achievements: [...normalizeUnlocked(saved?.achievements)],
  mastered: Array.isArray(saved?.mastered) ? saved.mastered.filter((id): id is string => typeof id === 'string') : [],
  peanutsEarned: count(saved?.peanutsEarned),
  hardRight: count(saved?.hardRight),
  stillDumbs: count(saved?.stillDumbs),
  looks: { pink: saved?.looks?.pink === true, green: saved?.looks?.green === true },
};
const persist = () => slot.save(save);

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
let shown: Face = 'neutral';
/** A passing reaction (a boop, a pat) shows over her current face for a moment. */
let quipFace: Face | null = null;

function show(f: Face) {
  if (f === shown) return;
  shown = f;
  faceLayer.innerHTML = art.faceMarkup(f);
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
function say(text: string, opts: { talk?: boolean; quip?: boolean } = {}) {
  if (typing !== null) window.clearInterval(typing);
  if (!opts.quip) endQuip(false);
  fullText = text;
  els.bubbleText.textContent = '';
  talking = !!opts.talk;
  let i = 0;
  typing = window.setInterval(() => {
    i++;
    els.bubbleText.textContent = text.slice(0, i);
    if (talking) show(i % 4 < 2 ? 'talk' : (quipFace ?? face));
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
const MENU_LINES = ['Pick a part. Start at the beginning, like a normal person.', 'Well? The book won’t read itself.', 'More questions. Anya is very patient. Mostly.', 'Peanuts buy lifelines. Anya likes peanuts. Just saying.'];

function renderMenu() {
  const open = unlockedParts(save.passed);
  els.parts.replaceChildren(
    ...BOOK.parts.map((part) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      const passed = save.passed.includes(part.n);
      const locked = !open.includes(part.n);
      const best = save.partBest[part.n];
      b.className = `part-card${passed ? ' passed' : ''}`;
      b.disabled = locked;
      b.innerHTML = `<span class="numeral">${roman(part.n)}</span><span class="what"><b></b><small></small></span><span class="status"></span>`;
      b.querySelector('b')!.textContent = part.title;
      b.querySelector('small')!.textContent = locked ? `Pass Part ${roman(part.n - 1)} to open` : `Chapters ${part.chapters[0].n}–${part.chapters[part.chapters.length - 1].n}${best !== undefined ? ` · best ${best}/${RUN_LENGTH}` : ''}`;
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
      const best = save.drillBest[level];
      b.innerHTML = `<b>${LEVEL_NAMES[level]}</b><small>${best !== undefined ? `Best ${best}/${RUN_LENGTH}` : `${BOOK.questions.filter((q) => q.level === level).length} questions`}</small>`;
      b.addEventListener('click', () => start({ kind: 'drill', level }));
      return b;
    }),
  );
  const today = save.dailyBests[dateKey(new Date())];
  els.dailyNote.textContent = today !== undefined ? `Today’s best: ${today}/${RUN_LENGTH}` : 'Same 10 questions for everyone today';
  els.lightningNote.textContent = save.lightningBest ? `Best: ${save.lightningBest} in a minute` : `${LIGHTNING_SECONDS} seconds. As many as you can.`;
}

function toMenu() {
  screen('menu');
  renderMenu();
  els.pips.replaceChildren();
  els.score.textContent = '';
  setFace('neutral');
  say(save.passed.length === 0 && Object.keys(save.partBest).length === 0 ? MENU_LINES[0] : pick(MENU_LINES.slice(1)), { talk: true });
}

// ---------------------------------------------------------------------------
// A run
// ---------------------------------------------------------------------------

let mode: Mode = { kind: 'part', part: 1 };
let quiz: Quiz = newQuiz([]);
/** Mind-read has been used on this question. */
let readMind = false;
/** Asked Sowell on this question; any lifeline used this run; when this question appeared. */
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
  if (m.kind === 'part') return `Part ${roman(m.part)}: ${BOOK.parts.find((p) => p.n === m.part)!.title}`;
  if (m.kind === 'drill') return `${LEVEL_NAMES[m.level]} drill`;
  if (m.kind === 'daily') return 'Daily quiz';
  return 'Lightning round';
}

function start(m: Mode) {
  mode = m.kind === 'daily' ? { kind: 'daily', key: dateKey(new Date()) } : m;
  quiz = newQuiz(questionsFor(mode));
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
  if (isLightning()) return;
  say(n === 1 ? `${modeLabel(mode)}. Question one: try not to embarrass yourself.` : n === quiz.questions.length ? 'Last one. Don’t choke.' : pick(ASK_LINES), { talk: true });
}

function renderLifelines() {
  const open = !answered(quiz);
  els.mindRead.disabled = !open || readMind || save.peanuts < MIND_READ_COST;
  els.swap.disabled = !open || save.peanuts < SWAP_COST;
  els.askSowell.disabled = !open || askedSowell || save.peanuts < ASK_SOWELL_COST;
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
    if (BOOK.questions.every((x) => save.mastered.includes(x.id))) award('whole-book');
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
  say(right ? `${pick(RIGHT_OPENERS)} ${q.comment}${streak}` : `${pick(WRONG_OPENERS)} ${q.comment}`);
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
  const replacement = swapFor(q, quiz.questions.map((x) => x.id));
  if (!replacement || !replaceCurrent(quiz, replacement)) return;
  save.peanuts -= SWAP_COST;
  usedLifeline = true;
  award('swap');
  persist();
  renderPeanuts(true);
  play('page');
  ask();
  say(pick(['Fine. Try this one instead.', 'Scared of that one? Here.', 'Different question. Same Anya.']), { talk: true });
});

/** Ask Sowell: a hint from the book, not the answer. */
els.askSowell.addEventListener('click', () => {
  const q = current(quiz);
  if (!q || answered(quiz) || askedSowell || save.peanuts < ASK_SOWELL_COST) return;
  save.peanuts -= ASK_SOWELL_COST;
  persist();
  renderPeanuts(true);
  askedSowell = true;
  usedLifeline = true;
  award('ask-sowell');
  els.sowellNote.innerHTML = '<b>Sowell says</b><br>';
  els.sowellNote.append(document.createTextNode(q.hint));
  els.sowellNote.hidden = false;
  play('page');
  setFace('neutral');
  say(pick(['Fine. Here’s what the book says.', 'Anya asked the author. He says this.', 'Read the hint. Then think. In that order.']), { talk: true });
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
    const was = save.partBest[part];
    save.partBest[part] = Math.max(was ?? 0, quiz.score);
    if (quiz.score >= PASS_MARK && !save.passed.includes(part)) {
      save.passed.push(part);
      const nextPart = BOOK.parts.find((p) => p.n === part + 1);
      bestLine = nextPart ? `📖 Part ${roman(part)} passed! Part ${roman(nextPart.n)}, “${nextPart.title},” is open.` : '🎓 You’ve passed every part of the book!';
    } else bestLine = was === undefined || quiz.score > was ? '🏆 Your best on this part yet!' : `Your best on this part: ${was}/${RUN_LENGTH}`;
  } else if (mode.kind === 'drill') {
    const was = save.drillBest[mode.level];
    save.drillBest[mode.level] = Math.max(was ?? 0, quiz.score);
    bestLine = was === undefined || quiz.score > was ? `🏆 Your best ${LEVEL_NAMES[mode.level].toLowerCase()} drill yet!` : `Your best: ${was}/${RUN_LENGTH}`;
  } else if (mode.kind === 'daily') {
    const was = save.dailyBests[mode.key];
    save.dailyBests[mode.key] = Math.max(was ?? 0, quiz.score);
    bestLine = `📅 Daily quiz, ${mode.key}: ${was === undefined ? 'your first score today.' : quiz.score > was ? `new best today (was ${was}).` : `today’s best is ${was}.`} New questions tomorrow.`;
  } else {
    const was = save.lightningBest;
    save.lightningBest = Math.max(was, quiz.score);
    bestLine = quiz.score > was ? '🏆 Your best lightning round yet!' : `Your best: ${was} in a minute`;
  }
  // Achievements for the run
  if (!isLightning()) {
    if (quiz.score === total && total === RUN_LENGTH) award('perfect');
    if (quiz.score === 0 && total === RUN_LENGTH) award('still-dumb');
    if (v.stamp === 'STILL DUMB' && ++save.stillDumbs >= 3) award('no-refunds');
  }
  if (mode.kind === 'part' && quiz.score >= PASS_MARK) {
    award(`part-${mode.part}`);
    if (!usedLifeline) award('no-lifelines');
    if (BOOK.parts.every((p) => save.passed.includes(p.n))) award('all-parts');
  }
  if (mode.kind === 'drill' && mode.level === 'hard' && quiz.score >= 8) award('drill-hard');
  if (mode.kind === 'daily') {
    award('daily');
    if (Object.keys(save.dailyBests).length >= 5) award('daily-5');
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

function openAchievements() {
  renderAchievements();
  els.achievements.hidden = false;
  // The lightning round's clock waits while you look.
  if (timerHandle !== null) {
    pausedTimerAt = timeLeft();
    stopTimer();
  }
  els.hideAchievements.focus();
}

function closeAchievements() {
  els.achievements.hidden = true;
  if (pausedTimerAt !== null) {
    timerEnds = performance.now() + pausedTimerAt * 1000;
    pausedTimerAt = null;
    timerHandle = window.setInterval(renderTimer, 100);
  }
}

els.showAchievements.addEventListener('click', () => (els.achievements.hidden ? openAchievements() : closeAchievements()));
els.hideAchievements.addEventListener('click', closeAchievements);

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
  const waiting = els.app.dataset.screen === 'quiz' && !answered(quiz) && !isLightning() && els.achievements.hidden && !document.hidden && typing === null;
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
  if (taken) return;
  taken = true;
  award('took-book');
  getAudioContext();
  play('page');
  els.anya.classList.add('taking');
  setFace('smug');
  window.setTimeout(() => {
    els.anya.classList.remove('taking');
    toMenu();
  }, 600);
}

els.take.addEventListener('click', take);
els.anya.querySelector('#anya-book')!.addEventListener('click', take);
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
  if (!els.achievements.hidden) {
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      closeAchievements();
    }
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

screen('intro');
setFace('shock');
renderPeanuts();
window.setTimeout(() => say('Take the book. I don’t have all day.'), 500);

// ?debug: the state, for testing from the console
if (new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, { bet: { wait: (n: number) => (waited += n), award, quiz: () => quiz, save, start, setFace, take, choose, timeLeft } });
}
