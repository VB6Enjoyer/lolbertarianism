// The certificate for passing a book's final exam: drawn on a canvas so it can be saved as an image.
// The name and lettering are the player's; the date is always today's.

/** The letterings you can pick for your name: a CSS font for a given size, and how big it reads. */
export const CERTIFICATE_FONTS: readonly { id: string; label: string; font: (px: number) => string; scale: number }[] = [
  { id: 'classic', label: 'Classic', font: (px) => `italic 600 ${px}px "Playfair Display", Georgia, serif`, scale: 1 },
  { id: 'script', label: 'Script', font: (px) => `400 ${px}px "Great Vibes", "Brush Script MT", cursive`, scale: 1.3 },
  { id: 'engraved', label: 'Engraved', font: (px) => `800 ${px}px Cinzel, "Times New Roman", serif`, scale: 0.85 },
  { id: 'comic', label: 'Comic', font: (px) => `400 ${px}px Bangers, Impact, sans-serif`, scale: 1 },
  { id: 'typewriter', label: 'Typewriter', font: (px) => `700 ${px}px "Courier New", Courier, monospace`, scale: 0.85 },
];
export const certificateFont = (id: string) => CERTIFICATE_FONTS.find((f) => f.id === id) ?? CERTIFICATE_FONTS[0];

/** “November 18, 2026”. */
export const longDate = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

export interface CertificateInfo {
  name: string;
  font: string;
  bookTitle: string;
  author: string;
  score: number;
  total: number;
  date: Date;
  /** The book's colour, for the border and headings. */
  accent: string;
  /** The book's cover, already loaded (or null if it couldn't be). */
  cover: HTMLImageElement | null;
}

const PAPER = '#fbf6ea';
const INK = '#2a2420';
const MUTED = '#6b5a4a';
const GOLD = '#b8913a';

/** Loads the fonts the certificate uses, so the canvas doesn't draw in a fallback. */
export async function loadCertificateFonts(): Promise<void> {
  if (!document.fonts) return;
  const sample = CERTIFICATE_FONTS.map((f) => f.font(40));
  await Promise.all([...sample, '800 40px Cinzel', '600 40px Cinzel', 'italic 600 40px "Playfair Display"', 'italic 700 40px "Playfair Display"', '400 40px "Great Vibes"'].map((f) => document.fonts.load(f).catch(() => [])));
}

/** A book's cover (the markup Anya holds on her plate) as an image to draw. */
export function coverImage(markup: string): Promise<HTMLImageElement | null> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="56 288 128 148" width="384" height="444">${markup}</svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return img.decode().then(
    () => img,
    () => null,
  );
}

/** Writes text centred at x, shrinking the font until it fits the width. */
function fitted(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, font: (px: number) => string, size: number) {
  let px = size;
  ctx.font = font(px);
  while (px > 12 && ctx.measureText(text).width > maxWidth) {
    px -= 2;
    ctx.font = font(px);
  }
  ctx.fillText(text, x, y);
}

/** Draws the whole certificate (1400 × 1000). */
export function drawCertificate(canvas: HTMLCanvasElement, info: CertificateInfo) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // Borders: a thick one in the book's colour, then a double gold rule with little diamonds at the corners.
  ctx.strokeStyle = info.accent;
  ctx.lineWidth = 18;
  ctx.strokeRect(24, 24, W - 48, H - 48);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  ctx.strokeRect(54, 54, W - 108, H - 108);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(66, 66, W - 132, H - 132);
  ctx.fillStyle = GOLD;
  for (const [x, y] of [
    [66, 66],
    [W - 66, 66],
    [66, H - 66],
    [W - 66, H - 66],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y - 14);
    ctx.lineTo(x + 14, y);
    ctx.lineTo(x, y + 14);
    ctx.lineTo(x - 14, y);
    ctx.closePath();
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (info.cover) ctx.drawImage(info.cover, cx - 74, 88, 148, 171);

  ctx.fillStyle = info.accent;
  fitted(ctx, 'CERTIFICATE OF NOT BEING DUMB', cx, 322, 1120, (px) => `800 ${px}px Cinzel, "Times New Roman", serif`, 50);
  ctx.fillStyle = MUTED;
  ctx.font = 'italic 600 30px "Playfair Display", Georgia, serif';
  ctx.fillText('Anya hereby certifies that', cx, 378);

  // The name, in the lettering you picked (or a faint placeholder until you type one).
  const lettering = certificateFont(info.font);
  const name = info.name.trim();
  ctx.fillStyle = INK;
  ctx.globalAlpha = name ? 1 : 0.28;
  fitted(ctx, name || 'Your name here', cx, 492, 1000, lettering.font, Math.round(96 * lettering.scale));
  ctx.globalAlpha = 1;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(290, 518);
  ctx.lineTo(W - 290, 518);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = 'italic 600 28px "Playfair Display", Georgia, serif';
  ctx.fillText('has read, survived and passed the final exam of', cx, 574);
  ctx.fillStyle = INK;
  fitted(ctx, info.bookTitle, cx, 642, 1120, (px) => `italic 700 ${px}px "Playfair Display", Georgia, serif`, 54);
  ctx.fillStyle = MUTED;
  ctx.font = 'italic 600 28px "Playfair Display", Georgia, serif';
  ctx.fillText(`by ${info.author}`, cx, 688);
  ctx.fillStyle = info.accent;
  ctx.font = '600 26px Cinzel, "Times New Roman", serif';
  ctx.fillText(`SCORE: ${info.score} OUT OF ${info.total}`, cx, 744);

  // The date (always today’s) on the left, Anya’s signature on the right.
  const lines: [number, string, string, string][] = [
    [330, longDate(info.date), 'italic 600 34px "Playfair Display", Georgia, serif', 'DATE'],
    [W - 330, 'Anya', '400 76px "Great Vibes", "Brush Script MT", cursive', 'EXAMINER (VERY STRICT)'],
  ];
  for (const [x, text, font, label] of lines) {
    ctx.fillStyle = INK;
    ctx.font = font;
    ctx.fillText(text, x, 870);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 140, 886);
    ctx.lineTo(x + 140, 886);
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.font = '600 18px Cinzel, "Times New Roman", serif';
    ctx.fillText(label, x, 916);
  }

  // The seal: ribbon tails in the book’s colour behind a serrated gold disc.
  const sx = cx;
  const sy = 852;
  ctx.fillStyle = info.accent;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx + dir * 18, sy + 30);
    ctx.lineTo(sx + dir * 50, sy + 84);
    ctx.lineTo(sx + dir * 34, sy + 76);
    ctx.lineTo(sx + dir * 24, sy + 90);
    ctx.lineTo(sx + dir * 2, sy + 40);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r = i % 2 ? 72 : 84;
    const x = sx + Math.cos(a) * r;
    const y = sy + Math.sin(a) * r;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#d9b45a';
  ctx.fill();
  ctx.strokeStyle = '#9b7a2a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sx, sy, 60, 0, Math.PI * 2);
  ctx.strokeStyle = '#9b7a2a';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#5a4312';
  ctx.font = '800 26px Cinzel, "Times New Roman", serif';
  ctx.fillText('NOT', sx, sy - 4);
  ctx.fillText('DUMB', sx, sy + 26);
  ctx.restore();
}
