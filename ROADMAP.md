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

## Phase 2: Shared toolkit ✅

- Each game's script moved out of its HTML into `src/games/<slug>/main.js`
  (an ES module). Functions used by inline `onclick=""` attributes are exposed
  on `window` at the bottom of each file.
- `src/shared/effects.ts`: `spawnText` (floaters, particles, explosions, hit
  numbers) and `pick`.
- `src/shared/format.ts`: `formatNumber` (locale separators) and `formatCompact` (1.2k / 3.40M).
- `src/shared/audio.ts`: shared AudioContext and `playTone` for synthesized sound effects.
- `src/shared/storage.ts`: `createSaveSlot` with a schema version and keys
  namespaced as `lolbertarianism:<game>`. The Tycoon now saves there and imports
  old `ancapTycoonSave` saves automatically (the old key is left in place).
- Not shared on purpose: game-over/restart screens. Each one is its own
  markup and jokes, and the only common logic is showing/hiding an element.

Noticed along the way, left alone for now:
- Tycoon shows `$0` for about a second after loading a save, until the first tick
  (`updateUI()` isn't called on load). Fix in phase 4.
- Unused variables: `raidTimer` (Tycoon), `isTyping` (Basic Economics Trainer),
  `heldBook` (Eminem's Human Action), `enemySpeed` and `targetX` (Kindergarten).
  Clean up when porting each game to TS.

## Phase 3: Assets ✅

- All 33 PNGs converted to WebP at their original dimensions (quality 90,
  full-quality alpha; lossless where that came out smaller): 3.3 MB → ~440 KB.
- `liberland.svg` (~1 MB; SVGO only got it to ~550 KB) rasterized to a
  480 px-wide WebP (4 KB). It's shown as a 60 px sticker, so it looks the same.
  The SVG is in git history if a bigger version is ever needed.
- `npm run images -- <files>` converts new art the same way (see `scripts/optimize-images.mjs`).
- Tailwind CDN script replaced with a build-time stylesheet
  (`src/styles/tailwind.css`, `tailwind.config.js`). It uses Tailwind v3, the
  same engine the CDN ran: v4 changes the default palette and preflight, which
  would have shifted colors. Screenshots matched the CDN version pixel for pixel.
  Move to v4 when porting those two games, if wanted.

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
