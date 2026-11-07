// Small corner buttons added to every game page: "back to the arcade" (←) and
// feedback (🐞), which opens links to report a bug or suggest an idea on GitHub.
// They're tiny and translucent in the bottom-left corner so they don't get in
// the way of each game's own layout.

import { gameForPath, issueUrl } from './feedback.ts';

const STYLE = `
.lolb-arcade-btn,
.lolb-feedback-btn {
  position: fixed;
  left: max(12px, env(safe-area-inset-left));
  bottom: max(12px, env(safe-area-inset-bottom));
  z-index: 2147483647;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: 50%;
  background: #111;
  color: #f7d02c;
  border: 2px solid #f7d02c;
  font: 700 18px/1 system-ui, sans-serif;
  text-decoration: none;
  cursor: pointer;
  opacity: 0.55;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.35);
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.lolb-feedback-btn {
  bottom: calc(max(12px, env(safe-area-inset-bottom)) + 46px);
  font-size: 16px;
}
.lolb-arcade-btn:hover,
.lolb-arcade-btn:focus-visible,
.lolb-feedback-btn:hover,
.lolb-feedback-btn:focus-visible,
.lolb-feedback-btn[aria-expanded='true'] {
  opacity: 1;
  transform: scale(1.08);
}
.lolb-feedback-menu {
  position: fixed;
  left: calc(max(12px, env(safe-area-inset-left)) + 46px);
  bottom: calc(max(12px, env(safe-area-inset-bottom)) + 46px);
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border-radius: 10px;
  background: #111;
  border: 2px solid #f7d02c;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.4);
  font: 600 14px/1.2 system-ui, sans-serif;
}
.lolb-feedback-menu[hidden] {
  display: none;
}
.lolb-feedback-menu a {
  padding: 8px 12px;
  border-radius: 6px;
  color: #f7d02c;
  text-decoration: none;
  white-space: nowrap;
}
.lolb-feedback-menu a:hover,
.lolb-feedback-menu a:focus-visible {
  background: #f7d02c;
  color: #111;
}
.lolb-feedback-menu small {
  padding: 2px 12px 4px;
  color: #aaa;
  font-weight: 400;
}
`;

const style = document.createElement('style');
style.textContent = STYLE;
document.head.append(style);

const link = document.createElement('a');
link.className = 'lolb-arcade-btn';
link.href = import.meta.env.BASE_URL;
link.title = 'Back to the arcade';
link.setAttribute('aria-label', 'Back to the arcade');
link.textContent = '←';

const feedback = document.createElement('button');
feedback.type = 'button';
feedback.className = 'lolb-feedback-btn';
feedback.title = 'Report a bug or suggest an idea';
feedback.setAttribute('aria-label', 'Report a bug or suggest an idea');
feedback.setAttribute('aria-haspopup', 'true');
feedback.setAttribute('aria-expanded', 'false');
feedback.textContent = '🐞';

const menu = document.createElement('div');
menu.className = 'lolb-feedback-menu';
menu.hidden = true;
const game = gameForPath(location.pathname);
for (const [kind, label] of [['bug', '🐞 Report a bug'], ['idea', '💡 Suggest an idea']] as const) {
  const a = document.createElement('a');
  a.href = issueUrl(kind, game, navigator.userAgent);
  a.target = '_blank'; // a new tab, so the game keeps running
  a.rel = 'noopener';
  a.textContent = label;
  a.addEventListener('click', () => setOpen(false));
  menu.append(a);
}
const note = document.createElement('small');
note.textContent = 'Opens GitHub (free account needed)';
menu.append(note);

function setOpen(open: boolean) {
  menu.hidden = !open;
  feedback.setAttribute('aria-expanded', String(open));
}

// Clicks here shouldn't reach the game underneath (e.g. a clicker's big button).
feedback.addEventListener('click', (e) => {
  e.stopPropagation();
  setOpen(feedback.getAttribute('aria-expanded') !== 'true');
  if (!menu.hidden) menu.querySelector('a')?.focus();
});
menu.addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('click', () => setOpen(false));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !menu.hidden) {
    setOpen(false);
    feedback.focus();
  }
});

document.body.append(link, feedback, menu);
