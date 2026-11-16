import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { listedGames as games } from './src/games.ts';
import { gamePreview, homePreview, previewTags } from './src/social.ts';

const root = import.meta.dirname;
const base = '/lolbertarianism/';

/** Emits tiny redirect pages so old links (e.g. vidya/ancapistan_tycoon.html) keep working. */
function legacyRedirects(): Plugin {
  return {
    name: 'legacy-redirects',
    apply: 'build',
    generateBundle() {
      for (const game of games) {
        const target = `${base}vidya/${game.slug}.html`;
        for (const legacy of game.legacyPaths ?? []) {
          this.emitFile({
            type: 'asset',
            fileName: `vidya/${legacy}`,
            source: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${game.title}</title>
${previewTags(gamePreview(game), true)}
<meta http-equiv="refresh" content="0; url=${target}">
<script>location.replace(${JSON.stringify(target)} + location.search + location.hash)</script>
</head>
<body><a href="${target}">${game.title} has moved here.</a></body>
</html>
`,
          });
        }
      }
    },
  };
}

/** Adds link-preview tags (picture, title, description) to the homepage and every game page. */
function socialPreviews(): Plugin {
  return {
    name: 'social-previews',
    transformIndexHtml(html, ctx) {
      const page = ctx.path.replace(/^\//, '');
      const game = games.find((g) => page === `vidya/${g.slug}.html`);
      const preview = game ? gamePreview(game) : page === 'index.html' || page === '' ? homePreview() : null;
      if (!preview) return html;
      const tags = previewTags(preview, !/<meta\s+name="description"/i.test(html));
      return html.replace('</title>', `</title>\n    ${tags}`);
    },
  };
}

/**
 * Keeps the source books (public/books/, the PDFs the quiz questions are written from) out of the
 * deployed site: they're copyrighted, and the games don't need them.
 */
function dropSourceBooks(): Plugin {
  return {
    name: 'drop-source-books',
    apply: 'build',
    closeBundle() {
      rmSync(resolve(root, 'dist', 'books'), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  base,
  plugins: [legacyRedirects(), socialPreviews(), dropSourceBooks()],
  build: {
    rolldownOptions: {
      input: {
        main: resolve(root, 'index.html'),
        ...Object.fromEntries(
          games.map((g) => [`vidya/${g.slug}`, resolve(root, 'vidya', `${g.slug}.html`)]),
        ),
      },
    },
  },
});
