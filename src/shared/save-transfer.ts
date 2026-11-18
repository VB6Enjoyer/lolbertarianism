// Moving progress between browsers and devices: a game's save as a text code (or a small file
// holding it), and a dialog to copy, download or load one. Saves only live in localStorage, so this
// is how players keep their progress when they switch devices or clear their browsing data.
//
// A code is "LOLB1:<game slug>:<base64 of the save as stored>". Loading one writes it under the
// game's key and reloads the page, so the game reads it through its own checks, as with any save.
// (Ancapistan Tycoon has its own save codes, from before this.)

import { games } from '../games.ts';
import { freezeSaves, readSave, writeSave } from './storage.ts';

const CODE_PREFIX = 'LOLB1:';

/** Base64 of UTF-8 text (saves can hold emoji, which plain btoa can't). */
function toBase64(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(code: string): string {
  const binary = atob(code);
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

const titleOf = (slug: string) => games.find((g) => g.slug === slug)?.title ?? slug;

/** A save (as stored) turned into a code for that game. */
export function encodeSave(game: string, stored: string): string {
  return `${CODE_PREFIX}${game}:${toBase64(stored)}`;
}

export type Decoded = { ok: true; stored: string } | { ok: false; error: string };

/**
 * Reads a code for a game: the save to store, or why it can't be loaded. Spaces and line breaks
 * from copying are ignored.
 */
export function decodeSave(game: string, code: string): Decoded {
  const text = code.replace(/\s+/g, '');
  if (!text) return { ok: false, error: 'Paste a save code first, or pick a save file.' };
  const match = /^LOLB1:([a-z0-9-]+):([A-Za-z0-9+/=]+)$/.exec(text);
  if (!match) return { ok: false, error: 'That doesn’t look like a save code. Check that you copied all of it.' };
  const [, slug, body] = match;
  if (slug !== game) return { ok: false, error: `That’s a save for ${titleOf(slug)}, not ${titleOf(game)}. Load it in that game instead.` };
  try {
    const stored = fromBase64(body);
    const parsed: unknown = JSON.parse(stored);
    const { v, data } = (parsed ?? {}) as { v?: unknown; data?: unknown };
    if (typeof v !== 'number' || !data || typeof data !== 'object') throw new Error('not a save');
    return { ok: true, stored };
  } catch {
    return { ok: false, error: 'That save code is damaged. Check that you copied all of it.' };
  }
}

/** The file name for a downloaded save: the game and today's date. */
export const saveFileName = (game: string, date: Date) =>
  `${game}-save-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.txt`;

// ---------------------------------------------------------------------------
// The dialog
// ---------------------------------------------------------------------------

const STYLE = `
.lolb-save-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483647; /* over the arcade's corner buttons (it comes later in the page) */
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(0 0 0 / 0.6);
  font: 15px/1.4 system-ui, sans-serif;
}
.lolb-save {
  box-sizing: border-box;
  width: min(520px, 100%);
  max-height: calc(100dvh - 32px);
  overflow: auto;
  padding: 20px;
  border: 3px solid #f7d02c;
  border-radius: 14px;
  background: #151515;
  color: #f4f4f4;
  box-shadow: 0 10px 40px rgb(0 0 0 / 0.5);
  text-align: left;
}
.lolb-save h2 { margin: 0 0 4px; font-size: 22px; color: #f7d02c; }
.lolb-save h3 { margin: 18px 0 4px; font-size: 16px; color: #f7d02c; }
.lolb-save p { margin: 0 0 8px; color: #cfcfcf; }
.lolb-save textarea {
  box-sizing: border-box;
  width: 100%;
  height: 76px;
  padding: 8px;
  border: 2px solid #555;
  border-radius: 8px;
  background: #0b0b0b;
  color: #f4f4f4;
  font: 12px/1.3 ui-monospace, monospace;
  word-break: break-all;
  resize: vertical;
}
.lolb-save textarea:focus { outline: none; border-color: #f7d02c; }
.lolb-save .row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.lolb-save button {
  padding: 8px 14px;
  border: 2px solid #f7d02c;
  border-radius: 8px;
  background: #111;
  color: #f7d02c;
  font: 700 14px/1.2 system-ui, sans-serif;
  cursor: pointer;
}
.lolb-save button:hover:not(:disabled), .lolb-save button:focus-visible { background: #f7d02c; color: #111; outline: none; }
.lolb-save button:disabled { opacity: 0.4; cursor: not-allowed; }
.lolb-save button.primary { background: #f7d02c; color: #111; }
.lolb-save button.danger { border-color: #ff7a6b; background: #ff7a6b; color: #111; }
.lolb-save .status { min-height: 1.4em; margin: 6px 0 0; font-weight: 600; }
.lolb-save .status.bad { color: #ff9b8f; }
.lolb-save .status.good { color: #8fe39b; }
.lolb-save .close { display: block; margin: 18px 0 0 auto; }
.lolb-save input[type='file'] { display: none; }
`;

let styled = false;

/** An element with some properties set (className, textContent, type…) and children. */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

/**
 * Opens the save dialog for a game: its save as a code to copy or a file to download, and a place
 * to paste a code or pick a file. `onClose` runs when it closes without loading a save.
 */
export function openSaveTransfer(game: string, onClose?: () => void) {
  if (!styled) {
    document.head.append(el('style', { textContent: STYLE }));
    styled = true;
  }
  const previous = document.activeElement as HTMLElement | null;
  const stored = readSave(game);
  const code = stored === null ? '' : encodeSave(game, stored);

  // Export
  const out = el('textarea', { readOnly: true, value: code || 'Nothing saved yet. Play a bit first!' });
  out.setAttribute('aria-label', 'Your save code');
  const outStatus = el('p', { className: 'status' });
  const copy = el('button', { type: 'button', className: 'primary', textContent: '📋 Copy code', disabled: !code });
  const download = el('button', { type: 'button', textContent: '💾 Download file', disabled: !code });
  copy.addEventListener('click', async () => {
    out.select();
    let ok = false;
    try {
      await navigator.clipboard.writeText(code);
      ok = true;
    } catch {
      ok = document.execCommand?.('copy') ?? false;
    }
    outStatus.className = `status ${ok ? 'good' : 'bad'}`;
    outStatus.textContent = ok ? 'Copied! Paste it into this game on your other device.' : 'Couldn’t copy. Select the code and copy it yourself.';
  });
  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
    const a = el('a', { href: url, download: saveFileName(game, new Date()) });
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    outStatus.className = 'status good';
    outStatus.textContent = 'Downloaded. Keep the file somewhere safe.';
  });

  // Import
  const input = el('textarea', { placeholder: 'Paste a save code here (it starts with LOLB1:)' });
  input.setAttribute('aria-label', 'Save code to load');
  const file = el('input', { type: 'file', accept: '.txt,text/plain' });
  const pick = el('button', { type: 'button', textContent: '📂 Open a save file' });
  const load = el('button', { type: 'button', className: 'primary', textContent: '📥 Load this save' });
  const inStatus = el('p', { className: 'status' });
  inStatus.setAttribute('role', 'status');
  let confirming = false;
  const bad = (text: string) => {
    inStatus.className = 'status bad';
    inStatus.textContent = text;
  };
  const resetConfirm = () => {
    confirming = false;
    load.className = 'primary';
    load.textContent = '📥 Load this save';
  };
  pick.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    if (f.size > 2_000_000) return bad('That file is too big to be a save.');
    input.value = (await f.text()).trim();
    resetConfirm();
    inStatus.className = 'status';
    inStatus.textContent = `Read ${f.name}. Press “Load this save”.`;
  });
  input.addEventListener('input', () => {
    resetConfirm();
    inStatus.textContent = '';
  });
  load.addEventListener('click', () => {
    const result = decodeSave(game, input.value);
    if (!result.ok) return bad(result.error);
    // Replacing a save takes a second click.
    if (stored !== null && !confirming) {
      confirming = true;
      load.className = 'danger';
      load.textContent = '⚠️ Yes, replace my progress';
      inStatus.className = 'status bad';
      inStatus.textContent = 'This replaces the progress saved in this browser. Copy your own code first if you want to keep it.';
      return;
    }
    if (!writeSave(game, result.stored)) return bad('This browser won’t let the game save (private mode or blocked storage?).');
    // Nothing may overwrite it on the way out (some games save when the page hides).
    freezeSaves();
    inStatus.className = 'status good';
    inStatus.textContent = 'Loaded! Restarting the game…';
    load.disabled = true;
    window.setTimeout(() => location.reload(), 600);
  });

  const close = el('button', { type: 'button', className: 'close', textContent: 'Close' });
  const dialog = el(
    'div',
    { className: 'lolb-save' },
    el('h2', { textContent: '💾 Save & load' }),
    el('p', { textContent: `${titleOf(game)} saves in this browser only. To play on another device, or to keep your progress safe when you clear your browsing data, copy your save code or download it as a file, then load it there.` }),
    el('h3', { textContent: '📤 Your save' }),
    out,
    el('div', { className: 'row' }, copy, download),
    outStatus,
    el('h3', { textContent: '📥 Load a save' }),
    input,
    el('div', { className: 'row' }, pick, load, file),
    inStatus,
    close,
  );
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Save and load');
  const backdrop = el('div', { className: 'lolb-save-backdrop' }, dialog);

  function shut() {
    backdrop.remove();
    previous?.focus?.();
    onClose?.();
  }
  close.addEventListener('click', shut);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) shut();
  });
  // Typing here mustn't reach the game's own keys (pause, shout, read aloud…).
  for (const type of ['keydown', 'keyup', 'keypress'] as const)
    backdrop.addEventListener(type, (e) => {
      e.stopPropagation();
      if (type === 'keydown' && (e as KeyboardEvent).key === 'Escape') shut();
    });
  // Nor clicks (a clicker's big button underneath).
  for (const type of ['pointerdown', 'mousedown', 'click'] as const) backdrop.addEventListener(type, (e) => e.stopPropagation());

  document.body.append(backdrop);
  (code ? copy : input).focus();
}
