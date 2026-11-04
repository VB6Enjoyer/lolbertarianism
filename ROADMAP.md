# Roadmap

Ground rule: these are free parodies and passion projects. Keep each game's
content, jokes and references exactly as they are. Refactors change the code,
not the bits.

## Phase 1: Scaffold and homepage ✅

- Vite + TypeScript multi-page setup; games still run their original inline JS.
- Homepage with game cards (thumbnail, blurb, status badge), driven by `src/games.ts`.
- URL-friendly file names (`vidya/<slug>.html`), with redirects from the old URLs.
- Shared "back to the arcade" button on every game.
- GitHub Actions workflow deploying `dist/` to GitHub Pages.

## Phase 2: Shared toolkit

- Extract repeated helpers into `src/shared/`: number formatting, floating text
  (`createFloater` / `spawnFloater`), particles, sound, game-over/restart screens.
- Save helper with a schema version and per-game key prefix. localStorage is
  shared across everything on `vb6enjoyer.github.io`, so keys must be namespaced.
  Keep reading `ancapTycoonSave` so existing saves migrate.

## Phase 3: Assets

- Optimize `public/vidya/img/liberland.svg` (~1 MB) with SVGO.
- Convert portrait PNGs to WebP (`bohmbawerk.png` alone is ~640 KB).
- Replace the Tailwind CDN script (Basic Economics Trainer, Eminem's Human
  Action) with the Tailwind Vite plugin.

## Phase 4: Ancapistan Tycoon

- Port to TypeScript with balance numbers in a data file.
- Prestige as "Secession" / "Exit": reset to found a new free private city for a
  permanent multiplier.
- Offline earnings and achievements.
- Consider folding JUST GETTING STARTED 😈 in as an unlockable mini-game.

## Phase 5: The rest, one at a time

- Port each remaining game to TypeScript when it's actually being worked on.
- Move an action game (Econ Defender, Kindergarten Defender, Road to Liberty)
  to Phaser or Kaplay only if it outgrows plain canvas/DOM.
