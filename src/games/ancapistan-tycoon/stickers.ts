// The draggable background collage: every sticker you own, scattered on screen.

import { STICKERS, STICKER_LABELS, type StickerData } from './data.ts';

const byId = new Map(STICKERS.map((s) => [s.id, s]));

/** Fills an element with a sticker's look (text, emoji, image or HTML snippet). */
function fill(el: HTMLElement, data: StickerData, randomSize: boolean) {
  if (data.type === 'text') {
    el.classList.add('text');
    el.innerText = data.content;
  } else if (data.type === 'emoji') {
    el.classList.add('img-rep');
    el.innerText = data.content;
    if (randomSize) el.style.fontSize = `${Math.random() * 40 + 30}px`;
  } else if (data.type === 'image') {
    el.classList.add('image');
    if (data.width) el.style.setProperty('--sticker-width', `${data.width}px`);
    const img = document.createElement('img');
    img.src = data.content;
    img.alt = '';
    img.draggable = false;
    el.appendChild(img);
  } else {
    el.innerHTML = data.content;
  }
}

/** Drops one sticker onto the screen at a random spot. `index` staggers the fall. */
export function dropSticker(container: HTMLElement, id: string, index = 0): void {
  const data = byId.get(id);
  if (!data) return;
  const el = document.createElement('div');
  el.className = 'sticker';
  el.dataset.id = id;
  const label = STICKER_LABELS[id];
  if (label) el.title = label.note ? `${label.name}: ${label.note}` : label.name;

  const finalTop = `${Math.random() * (window.innerHeight - 100)}px`;
  // Start off-screen, then fall into place.
  el.style.left = `${Math.random() * (window.innerWidth - 100)}px`;
  el.style.top = '-200px';
  fill(el, data, true);
  el.style.transform = `rotate(${Math.random() * 40 - 20}deg)`;

  container.appendChild(el);
  setTimeout(() => {
    el.style.top = finalTop;
  }, 50 + index * 20); // Stagger the fall
}

/** Clears the screen and scatters the given stickers in random order. */
export function spawnStickers(container: HTMLElement, ids: readonly string[]): void {
  container.innerHTML = '';
  [...ids].sort(() => 0.5 - Math.random()).forEach((id, i) => dropSticker(container, id, i));
}

/** A small, non-interactive copy of a sticker for the shop. */
export function stickerPreview(id: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'sticker sticker-preview';
  const data = byId.get(id);
  if (data) fill(el, data, false);
  return el;
}

/**
 * Lets stickers inside `container` be dragged with mouse or touch.
 * Uses one set of listeners for all stickers, so reshuffling doesn't pile up handlers.
 */
export function enableStickerDragging(container: HTMLElement, onDragged: (sticker: HTMLElement) => void): void {
  let dragging: HTMLElement | null = null;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;
  let moved = false;

  container.addEventListener('pointerdown', (e) => {
    const sticker = (e.target as HTMLElement).closest<HTMLElement>('.sticker');
    if (!sticker) return;
    dragging = sticker;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    initialLeft = sticker.offsetLeft;
    initialTop = sticker.offsetTop;
    sticker.style.zIndex = '1000'; // Bring to front
    sticker.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  container.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    dragging.style.left = `${initialLeft + dx}px`;
    dragging.style.top = `${initialTop + dy}px`;
  });

  const stop = () => {
    if (!dragging) return;
    const dropped = dragging;
    dropped.style.zIndex = '21';
    dragging = null;
    if (moved) onDragged(dropped);
  };
  container.addEventListener('pointerup', stop);
  container.addEventListener('pointercancel', stop);
}
