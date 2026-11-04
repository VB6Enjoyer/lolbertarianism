# Lolbertarianism

A free-market arcade of libertarian in-jokes, playable at
<https://vb6enjoyer.github.io/lolbertarianism/>.

## Development

```bash
npm install
npm run dev       # http://localhost:5173/lolbertarianism/
npm run build     # type-check + production build into dist/
npm run preview   # serve dist/ locally
```

## Layout

- `index.html`, `src/home/`: the arcade homepage.
- `src/games.ts`: the list of games. It drives the homepage cards, the build
  inputs and the redirects from old URLs.
- `vidya/<slug>.html`: one page per game (markup and CSS).
- `src/games/<slug>/main.js`: each game's code, loaded as an ES module.
- `src/shared/`: code shared by all games:
  - `arcade-button.ts`: the back-to-arcade button.
  - `effects.ts`: `spawnText` for floaters, particles and hit numbers; `pick`.
  - `format.ts`: `formatNumber` and `formatCompact`.
  - `audio.ts`: `playTone` for synthesized sound effects.
  - `storage.ts`: `createSaveSlot` for versioned, namespaced saves.
- `public/`: static files copied as-is (game images, thumbnails, favicon).

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
