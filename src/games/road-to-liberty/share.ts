// The share card: your run as text (to paste anywhere) and as an image.

export interface RunSummary {
  score: number;
  commies: number;
  meters: number;
  /** The landscape you reached ("the Beach") and where you were ("Zug"). */
  landscape: string;
  territory: string;
  car: string;
  carIcon: string;
  /** The daily challenge's twist and date, or null for a normal run. */
  daily: { name: string; icon: string; key: string } | null;
  url: string;
}

const money = (n: number) => `$${Math.floor(n).toLocaleString('en-US')}`;
const km = (meters: number) => `${(meters / 1000).toFixed(1)} km`;

/** A few lines for social media. */
export function shareText(s: RunSummary): string {
  const title = s.daily ? `🚗 The Road to Liberty · ${s.daily.icon} Daily ${s.daily.key} (${s.daily.name})` : '🚗 The Road to Liberty';
  return [
    title,
    `💰 ${money(s.score)} before the State caught me`,
    `☭ ${s.commies} ${s.commies === 1 ? 'commie' : 'commies'} flattened · 🛣️ ${km(s.meters)}`,
    `🏞️ Reached ${s.landscape} (${s.territory}) in the ${s.carIcon} ${s.car}`,
    s.url,
  ].join('\n');
}

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/** Draws the card (1200×630, the usual social preview size), with the photo finish if there is one. */
export function drawShareCard(ctx: CanvasRenderingContext2D, s: RunSummary, photo: CanvasImageSource | null): void {
  const W = CARD_WIDTH;
  const H = CARD_HEIGHT;
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1a1200');
  bg.addColorStop(0.55, '#0c0c0c');
  bg.addColorStop(1, '#2a0606');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Gold frame
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 10;
  ctx.strokeRect(15, 15, W - 30, H - 30);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe082';
  ctx.font = "bold 54px 'Courier New', monospace";
  ctx.fillText('THE ROAD TO LIBERTY', 60, 100);
  ctx.fillStyle = '#bbb';
  ctx.font = "22px 'Courier New', monospace";
  ctx.fillText(s.daily ? `${s.daily.icon} DAILY CHALLENGE ${s.daily.key} · ${s.daily.name.toUpperCase()}` : 'The Fed is in your mirror. Marx is in the road.', 60, 138, W - 120);

  // The photo finish, as a polaroid tilted a little
  const px = 60;
  const py = 175;
  const pw = 560;
  const ph = 315;
  ctx.save();
  ctx.translate(px + pw / 2, py + ph / 2 + 20);
  ctx.rotate(-0.025);
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(-pw / 2 - 14, -ph / 2 - 14, pw + 28, ph + 64);
  if (photo) {
    ctx.drawImage(photo, -pw / 2, -ph / 2, pw, ph);
  } else {
    ctx.fillStyle = '#222';
    ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
  }
  ctx.fillStyle = '#333';
  ctx.font = "bold 22px 'Courier New', monospace";
  ctx.textAlign = 'center';
  ctx.fillText('📸 PHOTO FINISH', 0, ph / 2 + 36);
  ctx.restore();

  // The numbers
  const x = 680;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#aaa';
  ctx.font = "24px 'Courier New', monospace";
  ctx.fillText('NET WORTH', x, 215);
  ctx.fillStyle = '#ffd54f';
  ctx.font = "bold 64px 'Courier New', monospace";
  ctx.fillText(money(s.score), x, 280, W - x - 50);
  const rows: [string, string][] = [
    ['☭ Commies', String(s.commies)],
    ['🛣️ Distance', km(s.meters)],
    ['🏞️ Reached', s.landscape],
    ['📍 Last seen', s.territory],
    [`${s.carIcon} Car`, s.car],
  ];
  ctx.font = "24px 'Courier New', monospace";
  rows.forEach(([label, value], i) => {
    const y = 340 + i * 42;
    ctx.fillStyle = '#999';
    ctx.fillText(label, x, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(value, x + 205, y, W - x - 255);
  });

  ctx.fillStyle = '#80d8ff';
  ctx.font = "20px 'Courier New', monospace";
  ctx.textAlign = 'center';
  ctx.fillText(s.url.replace(/^https?:\/\//, ''), W / 2, H - 40, W - 100);
}
