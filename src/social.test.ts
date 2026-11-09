import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { games } from './games.ts';
import { gamePreview, homePreview, previewTags, SITE_URL } from './social.ts';

const publicDir = resolve(import.meta.dirname, '../public');

describe('link previews', () => {
  it('every page has its 1200×630 picture in public/og/', () => {
    for (const p of [homePreview(), ...games.map(gamePreview)]) {
      expect(p.image.startsWith(SITE_URL), p.image).toBe(true);
      expect(existsSync(resolve(publicDir, p.image.slice(SITE_URL.length))), p.image).toBe(true);
    }
  });

  it('uses absolute URLs and escapes quotes', () => {
    const game = { slug: 'x', title: 'Say "hi" & <go>', blurb: 'Blurb.', status: 'released' as const };
    const tags = previewTags(gamePreview(game), true);
    expect(tags).toContain('<meta property="og:title" content="Say &quot;hi&quot; &amp; &lt;go&gt; · Lolbertarianism">');
    expect(tags).toContain(`<meta property="og:url" content="${SITE_URL}vidya/x.html">`);
    expect(tags).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(tags).toContain('<meta name="description"');
    expect(previewTags(gamePreview(game), false)).not.toContain('<meta name="description"');
  });
});
