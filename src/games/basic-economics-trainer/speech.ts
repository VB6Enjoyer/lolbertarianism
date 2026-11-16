// Reading aloud, for accessibility: questions and answers in a plain reading voice, Anya's lines in a
// higher one. Uses the browser's own speech synthesis; does nothing where there isn't any.

export type Voice = 'reader' | 'anya';

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let english: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (english) return english;
  const voices = window.speechSynthesis.getVoices();
  english = voices.find((v) => /^en(-|_)US/i.test(v.lang) && v.localService) ?? voices.find((v) => /^en/i.test(v.lang)) ?? null;
  return english;
}

if (speechSupported()) window.speechSynthesis.addEventListener?.('voiceschanged', () => (english = null));

/** Says something; `queue` adds it after whatever's being said, otherwise it interrupts. */
export function speak(text: string, voice: Voice, queue = false) {
  if (!speechSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  if (!queue) synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) u.voice = v;
  u.lang = v?.lang ?? 'en-US';
  u.pitch = voice === 'anya' ? 1.6 : 1;
  u.rate = voice === 'anya' ? 1.1 : 1;
  synth.speak(u);
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}

/** How a question is read: the question, then each answer with its letter. */
export const questionScript = (q: string, options: readonly string[], hint?: string) =>
  [q, ...(hint ? [`Sowell says: ${hint}`] : []), ...options.map((o, i) => `${'ABCD'[i]}: ${o}.`)].join(' ');
