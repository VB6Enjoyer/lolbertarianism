import './style.css';
import { games, type GameStatus } from '../games.ts';

const STATUS_LABEL: Record<GameStatus, string> = {
  wip: 'In progress',
  prototype: 'Prototype',
};

const base = import.meta.env.BASE_URL;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const list = document.getElementById('games')!;

for (const game of games) {
  const item = el('li', 'card');
  const link = el('a', 'card__link');
  link.href = `${base}vidya/${game.slug}.html`;

  const media = el('div', 'card__media');
  const img = el('img', 'card__thumb');
  img.src = `${base}thumbs/${game.slug}.webp`;
  img.alt = '';
  img.loading = 'lazy';
  img.width = 640;
  img.height = 400;
  media.append(img, el('span', `badge badge--${game.status}`, STATUS_LABEL[game.status]));

  const body = el('div', 'card__body');
  body.append(el('h2', 'card__title', game.title), el('p', 'card__blurb', game.blurb));

  link.append(media, body);
  item.append(link);
  list.append(item);
}

document.getElementById('game-count')!.textContent = `${games.length} games · 0% taxes`;
