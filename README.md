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
- `vidya/<slug>.html`: one page per game.
- `src/shared/`: code shared by all games (currently the back-to-arcade button).
- `public/`: static files copied as-is (game images, thumbnails, favicon).

## Adding a game

1. Add `vidya/<slug>.html` and include
   `<script type="module" src="/src/shared/arcade-button.ts"></script>` in its `<head>`.
2. Add an entry to `src/games.ts`.
3. Add a 640×400 thumbnail at `public/thumbs/<slug>.webp`.

## Deployment

Pushes to `main` build and deploy through `.github/workflows/deploy.yml`.
In the repository settings, Pages must be set to **Source: GitHub Actions**.

See [ROADMAP.md](ROADMAP.md) for what's planned.
