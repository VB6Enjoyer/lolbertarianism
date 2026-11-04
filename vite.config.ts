import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { games } from './src/games.ts';

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
<meta http-equiv="refresh" content="0; url=${target}">
<link rel="canonical" href="${target}">
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

export default defineConfig({
  base,
  plugins: [legacyRedirects()],
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
