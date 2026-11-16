import './style.css';
import { getAudioContext, note, playTone } from '../../shared/audio.ts';
import { createSaveSlot } from '../../shared/storage.ts';
import { anyaSvg, faceMarkup, SHOTS, type Face } from './anya.ts';
import { QUESTIONS } from './questions.ts';
import { answer, answered, current, finished, newQuiz, next, verdict, type Quiz } from './quiz.ts';

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const els = {
  app: byId('app'),
  pips: byId('pips'),
  score: byId('score'),
  mute: byId<HTMLButtonElement>('mute'),
  bubble: byId('bubble'),
  bubbleText: byId('bubble-text'),
  anya: document.getElementById('anya') as unknown as SVGSVGElement,
  sfx: byId('sfx'),
  take: byId<HTMLButtonElement>('take'),
  quizPanel: byId('quiz-panel'),
  chapter: byId('chapter'),
  counter: byId('counter'),
  question: byId('question'),
  options: byId('options'),
  next: byId<HTMLButtonElement>('next'),
  endPanel: byId('end-panel'),
  stamp: byId('stamp'),
  finalScore: byId('final-score'),
  review: byId('review'),
  best: byId('best'),
  again: byId<HTMLButtonElement>('again'),
};

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

interface Save {
  best: number;
  muted: boolean;
}
const slot = createSaveSlot<Save>({ game: 'basic-economics-trainer', version: 1 });
const saved = slot.load();
const save: Save = { best: Math.max(0, Math.floor(Number(saved?.best) || 0)), muted: saved?.muted === true };
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

// ---------------------------------------------------------------------------
// Anya: her face, her shot, what she says
// ---------------------------------------------------------------------------

els.anya.innerHTML = anyaSvg();
const faceLayer = els.anya.querySelector('#anya-face')!;
let face: Face = 'neutral';
let shown: Face = 'neutral';

function show(f: Face) {
  if (f === shown) return;
  shown = f;
  faceLayer.innerHTML = faceMarkup(f);
}

function setFace(f: Face) {
  face = f;
  show(f);
}

// She blinks now and then (unless she's mid-reaction).
window.setInterval(() => {
  if (face !== 'neutral' || talking) return;
  show('blink');
  window.setTimeout(() => show(face), 130);
}, 3600);

function shoot(shot: keyof typeof SHOTS) {
  els.anya.setAttribute('viewBox', SHOTS[shot]);
}

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
let afterTyping: (() => void) | null = null;

/** Types a line into her bubble. With `talk`, her mouth moves while she says it. */
function say(text: string, opts: { talk?: boolean; then?: () => void } = {}) {
  if (typing !== null) window.clearInterval(typing);
  fullText = text;
  afterTyping = opts.then ?? null;
  els.bubble.classList.remove('empty');
  els.bubbleText.textContent = '';
  talking = !!opts.talk;
  let i = 0;
  typing = window.setInterval(() => {
    i++;
    els.bubbleText.textContent = text.slice(0, i);
    if (talking) show(i % 4 < 2 ? 'talk' : face);
    if (i % 3 === 0 && text[i] !== ' ') play('blip');
    if (i >= text.length) finishTyping();
  }, 22);
}

function finishTyping() {
  if (typing !== null) window.clearInterval(typing);
  typing = null;
  els.bubbleText.textContent = fullText;
  talking = false;
  show(face);
  const then = afterTyping;
  afterTyping = null;
  then?.();
}

els.bubble.addEventListener('click', () => {
  if (typing !== null) finishTyping();
});

const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

// ---------------------------------------------------------------------------
// The quiz
// ---------------------------------------------------------------------------

let quiz: Quiz = newQuiz(QUESTIONS);
let taken = false;

function screen(name: 'intro' | 'quiz' | 'end') {
  els.app.dataset.screen = name;
  els.quizPanel.hidden = name !== 'quiz';
  els.endPanel.hidden = name !== 'end';
  shoot(name === 'intro' ? 'full' : 'close');
}

function renderPips() {
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
      li.setAttribute('aria-label', `Question ${i + 1}${a === null ? '' : a === q.correct ? ': right' : ': wrong'}`);
      return li;
    }),
  );
  els.score.textContent = taken ? `${quiz.score} / ${quiz.questions.length}` : '';
}

const ASK_LINES = ['Try not to embarrass yourself.', 'Think before you click.', 'Read the question. Slowly.', 'This one’s easy. Probably.', 'Take your time. Not too much.'];
const RIGHT_OPENERS = ['Heh.', 'Correct.', 'Good.', 'Hmph. Fine.'];
const WRONG_OPENERS = ['Wrong.', 'No.', '…No.', 'Ugh.'];

function ask() {
  const q = current(quiz)!;
  const n = quiz.index + 1;
  const total = quiz.questions.length;
  els.chapter.textContent = `Chapter: ${q.chapter}`;
  els.counter.textContent = `Question ${n} of ${total}`;
  els.question.textContent = q.q;
  els.next.hidden = true;
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
  setFace('neutral');
  say(n === total ? 'Last one. Don’t choke.' : n === 1 ? 'Finally. Question one: try not to embarrass yourself.' : pick(ASK_LINES.slice(1)), { talk: true });
  // The panel slides in again for each question.
  els.quizPanel.style.animation = 'none';
  void els.quizPanel.offsetWidth;
  els.quizPanel.style.animation = '';
}

function choose(i: number) {
  const q = current(quiz);
  if (!q) return;
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
  renderPips();
  if (right) {
    play('right');
    setFace(q.right);
    boom(quiz.streak >= 3 ? 'WAKU WAKU!' : q.right === 'smug' ? 'HEH.' : 'NICE!', 'good', quiz.streak >= 3);
    const streak = quiz.streak === 3 ? ' Three in a row. Suspicious.' : '';
    say(`${pick(RIGHT_OPENERS)} ${q.comment}${streak}`);
  } else {
    play('wrong');
    setFace(q.wrong);
    boom(q.wrong === 'shock' ? 'GASP!' : q.wrong === 'deadpan' ? 'SIGH.' : 'HMPH!', 'bad', q.wrong === 'shock');
    els.anya.classList.add('shake');
    window.setTimeout(() => els.anya.classList.remove('shake'), 450);
    say(`${pick(WRONG_OPENERS)} ${q.comment} Try to keep up.`);
  }
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
  if (typing !== null) finishTyping();
  next(quiz);
  play('page');
  if (finished(quiz)) end();
  else ask();
}

function end() {
  screen('end');
  renderPips();
  const total = quiz.questions.length;
  const v = verdict(quiz.score, total);
  const newBest = quiz.score > save.best;
  save.best = Math.max(save.best, quiz.score);
  persist();
  els.stamp.textContent = v.stamp;
  els.stamp.className = `stamp ${v.tone}`;
  els.finalScore.textContent = `${quiz.score} out of ${total}`;
  els.review.replaceChildren(
    ...quiz.questions.map((q, i) => {
      const li = document.createElement('li');
      const right = quiz.answers[i] === q.correct;
      li.className = right ? 'right' : 'wrong';
      li.innerHTML = '<span class="tick"></span><span><b></b><small></small></span>';
      li.querySelector('.tick')!.textContent = right ? '✓' : '✗';
      li.querySelector('b')!.textContent = q.q;
      li.querySelector('small')!.textContent = right ? q.options[q.correct] : `You said “${q.options[quiz.answers[i]!]}”. It’s “${q.options[q.correct]}”.`;
      return li;
    }),
  );
  els.best.textContent = newBest && quiz.score > 0 ? '🏆 Your best yet!' : `Your best: ${save.best} out of ${total}`;
  setFace(v.face);
  window.setTimeout(() => {
    play('stamp');
    if (v.tone === 'good') play('fanfare');
    boom(v.tone === 'good' ? 'WAKU WAKU!' : v.tone === 'okay' ? 'HEH.' : 'SIGH.', v.tone === 'bad' ? 'bad' : v.tone === 'good' ? 'good' : '', v.tone === 'good');
  }, 250);
  say(v.line);
  els.again.focus({ preventScroll: true });
}

function start() {
  quiz = newQuiz(QUESTIONS);
  screen('quiz');
  ask();
}

/** Takes the book from her: it flies at you, and the quiz opens. */
function take() {
  if (taken) return;
  taken = true;
  getAudioContext();
  play('page');
  els.anya.classList.add('taking');
  setFace('smug');
  window.setTimeout(() => {
    els.anya.classList.remove('taking');
    start();
  }, 600);
}

els.take.addEventListener('click', take);
els.anya.querySelector('#anya-book')!.addEventListener('click', take);
els.next.addEventListener('click', advance);
els.again.addEventListener('click', () => {
  play('page');
  start();
});

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const screenName = els.app.dataset.screen;
  if (e.key === 'Enter' || e.key === ' ') {
    if (document.activeElement instanceof HTMLButtonElement && document.activeElement !== document.body) {
      if (typing !== null) {
        e.preventDefault();
        finishTyping();
      }
      return; // the focused button handles it
    }
    e.preventDefault();
    if (typing !== null) finishTyping();
    else if (screenName === 'intro') take();
    else if (screenName === 'quiz' && answered(quiz)) advance();
    else if (screenName === 'end') els.again.click();
    return;
  }
  if (screenName !== 'quiz' || els.quizPanel.hidden || answered(quiz)) return;
  const n = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
  if (n >= 0 && n < (current(quiz)?.options.length ?? 0)) choose(n);
});

// ---------------------------------------------------------------------------
// The meme, to start
// ---------------------------------------------------------------------------

screen('intro');
setFace('shock');
renderPips();
window.setTimeout(() => say('Take the book. I don’t have all day.'), 500);

// ?debug: the state, for testing from the console
if (new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, { bet: { quiz: () => quiz, setFace, take, choose } });
}
