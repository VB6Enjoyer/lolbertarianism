export interface SpawnTextOptions {
  /** Text to show (floating money, emoji particles, damage numbers…). */
  text: string;
  /** CSS class that gives the element its look and animation. Each game defines its own. */
  className: string;
  /** Position. Numbers are pixels; strings are used as-is (e.g. "50%"). */
  x: number | string;
  y: number | string;
  /** Where to attach the element. Defaults to document.body. */
  parent?: HTMLElement;
  /** Milliseconds before the element is removed. Defaults to 1000. */
  ttl?: number;
  /** Extra inline styles, e.g. { color: 'orange', fontSize: '3rem' }. */
  style?: Partial<Record<'color' | 'fontSize' | 'opacity' | 'transform', string>>;
  /** CSS custom properties for the animation, e.g. { '--tx': '20px' }. */
  vars?: Record<`--${string}`, string>;
}

const toCss = (v: number | string) => (typeof v === 'number' ? `${v}px` : v);

/**
 * Pops a short-lived text element on screen and removes it when its animation
 * is done. Covers floaters, particles, explosions and hit numbers.
 */
export function spawnText({
  text,
  className,
  x,
  y,
  parent = document.body,
  ttl = 1000,
  style,
  vars,
}: SpawnTextOptions): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  el.innerText = text;
  el.style.left = toCss(x);
  el.style.top = toCss(y);
  if (style) Object.assign(el.style, style);
  if (vars) for (const [name, value] of Object.entries(vars)) el.style.setProperty(name, value);
  parent.appendChild(el);
  setTimeout(() => el.remove(), ttl);
  return el;
}

/** Picks a random element of a list. */
export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
