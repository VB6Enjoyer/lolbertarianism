/**
 * Tooltips for touch screens. Phones never show `title` tooltips, so a tap on anything with a title
 * (that isn't a button or a field) pops its text up in a bubble. A mouse keeps the browser's own tooltips.
 */
export function installTapTips(root: HTMLElement) {
  const tip = document.createElement('div');
  tip.className = 'tap-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.append(tip);
  let owner: HTMLElement | null = null;
  let touch = false;

  const hide = () => {
    tip.hidden = true;
    owner = null;
  };

  document.addEventListener('pointerdown', (e) => (touch = e.pointerType !== 'mouse'), { capture: true });
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[title]');
    if (!touch || !el || !root.contains(el) || el.closest('button, input, select, a, label, summary') || el === owner) {
      hide();
      return;
    }
    owner = el;
    tip.textContent = el.title;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    tip.style.top = `${r.bottom + h + 12 > innerHeight ? r.top - h - 8 : r.bottom + 8}px`;
  });
  addEventListener('scroll', hide, { passive: true });
  addEventListener('resize', hide);
}
