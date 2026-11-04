// The draggable background collage.

import { STICKERS, STICKER_COUNTS, type StickerCategory } from './data.ts';

const shuffle = <T>(items: T[]) => items.sort(() => 0.5 - Math.random());

/** Drops a fresh random set of stickers into the container (replacing any there). */
export function spawnStickers(container: HTMLElement): void {
  container.innerHTML = '';

  const picked = shuffle(
    (Object.keys(STICKER_COUNTS) as StickerCategory[]).flatMap((category) =>
      shuffle(STICKERS.filter((s) => s.category === category)).slice(0, STICKER_COUNTS[category]),
    ),
  );

  picked.forEach((data, index) => {
    const el = document.createElement('div');
    el.className = 'sticker';

    const finalLeft = `${Math.random() * (window.innerWidth - 100)}px`;
    const finalTop = `${Math.random() * (window.innerHeight - 100)}px`;
    // Start off-screen, then fall into place.
    el.style.left = finalLeft;
    el.style.top = '-200px';

    if (data.type === 'text') {
      el.classList.add('text');
      el.innerText = data.content;
    } else if (data.type === 'emoji') {
      el.classList.add('img-rep');
      el.innerText = data.content;
      el.style.fontSize = `${Math.random() * 40 + 30}px`;
    } else if (data.type === 'image') {
      el.classList.add('image');
      const img = document.createElement('img');
      img.src = data.content;
      img.alt = '';
      img.draggable = false;
      el.appendChild(img);
    } else {
      el.innerHTML = data.content;
    }
    el.style.transform = `rotate(${Math.random() * 40 - 20}deg)`;

    container.appendChild(el);
    setTimeout(() => {
      el.style.top = finalTop;
    }, 50 + index * 20); // Stagger the fall
  });
}

/**
 * Lets stickers inside `container` be dragged with mouse or touch.
 * Uses one set of listeners for all stickers, so reshuffling doesn't pile up handlers.
 */
export function enableStickerDragging(container: HTMLElement, onDragged: () => void): void {
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
    dragging.style.zIndex = '21';
    dragging = null;
    if (moved) onDragged();
  };
  container.addEventListener('pointerup', stop);
  container.addEventListener('pointercancel', stop);
}
