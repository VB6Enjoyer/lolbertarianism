// A small "back to the arcade" button added to every game page.
// It is kept tiny and translucent in the bottom-left corner so it does not
// get in the way of each game's own layout.

const STYLE = `
.lolb-arcade-btn {
  position: fixed;
  left: max(12px, env(safe-area-inset-left));
  bottom: max(12px, env(safe-area-inset-bottom));
  z-index: 2147483647;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #111;
  color: #f7d02c;
  border: 2px solid #f7d02c;
  font: 700 18px/1 system-ui, sans-serif;
  text-decoration: none;
  opacity: 0.55;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.35);
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.lolb-arcade-btn:hover,
.lolb-arcade-btn:focus-visible {
  opacity: 1;
  transform: scale(1.08);
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
document.body.append(link);
