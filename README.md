# Lolbertarianism

A free-market arcade of libertarian in-jokes, playable at
<https://vb6enjoyer.github.io/lolbertarianism/>.

## Development

```bash
npm install
npm run dev       # http://localhost:5173/lolbertarianism/
npm test          # unit tests (Vitest)
npm run build     # type-check + tests + production build into dist/
npm run preview   # serve dist/ locally
npm run images -- public/vidya/img/new.png   # convert art to WebP next to the original
npm run simulate  # Ancapistan Tycoon balance check (simulated playthrough)
npm run simulate -- --challenges   # same, for each challenge run
```

## Layout

- `index.html`, `src/home/`: the arcade homepage.
- `src/games.ts`: the list of games. It drives the homepage cards, the build
  inputs and the redirects from old URLs.
- `vidya/<slug>.html`: one page per game (markup and CSS).
- `src/games/<slug>/main.js` (or `main.ts`): each game's code, loaded as an ES module.
  Ancapistan Tycoon is fully TypeScript: content and balance in `data.ts`,
  rules in `logic.ts` (tested), saves in `save.ts`.
- `src/shared/`: code shared by all games:
  - `arcade-button.ts`: the back-to-arcade button.
  - `effects.ts`: `spawnText` for floaters, particles and hit numbers; `pick`.
  - `format.ts`: `formatNumber`, `formatMoney` ("1.235 billion") and `formatCompact`.
  - `audio.ts`: `playTone` for synthesized sound effects.
  - `storage.ts`: `createSaveSlot` for versioned, namespaced saves.
- `src/styles/tailwind.css`: Tailwind (v3) for the pages that use utility
  classes; which files it scans is set in `tailwind.config.js`.
- `public/`: static files copied as-is (game images, thumbnails, favicon).
  Images are WebP; convert new ones with `npm run images`, then delete the original.
- `art/`: full-size source art (not deployed), e.g. `art/christmas/`.

Seasonal events can be previewed on any day with `?date=YYYY-MM-DD`, e.g.
`/lolbertarianism/vidya/ancapistan-tycoon.html?date=2026-12-24`.

## Adding a game

1. Add `vidya/<slug>.html` with these in its `<head>`:
   `<script type="module" src="/src/shared/arcade-button.ts"></script>` and
   `<script type="module" src="/src/games/<slug>/main.js"></script>` (or `main.ts`).
2. Add an entry to `src/games.ts`.
3. Add a 640×400 thumbnail at `public/thumbs/<slug>.webp`.

Game scripts are modules, so their functions aren't global. If the HTML uses
inline handlers like `onclick="startGame()"`, expose them with
`Object.assign(window, { startGame })`, or attach listeners with `addEventListener` instead.

## Deployment

Pushes to `main` build and deploy through `.github/workflows/deploy.yml`.
In the repository settings, Pages must be set to **Source: GitHub Actions**.

See [ROADMAP.md](ROADMAP.md) for what's planned.
