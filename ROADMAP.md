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

## Phase 4: Ancapistan Tycoon ✅

- Ported to TypeScript in `src/games/ancapistan-tycoon/`:
  - `data.ts`: upgrades, perks, stickers, phrases, achievements and every
    balance number (`BALANCE`).
  - `logic.ts`: pure game rules, unit-tested in `logic.test.ts` (`npm test`).
  - `save.ts`: save format v2 with migration from v0/v1 saves.
  - `stickers.ts`, `main.ts`, `style.css`: the page.
- **Secession** (prestige): once all-time earnings reach $1M, secede to found Free
  Private Cities, each giving +10% to all income forever. Total cities =
  floor(√(all-time earnings / $1M)), so city #2 needs $4M, #10 needs $100M.
  Old saves are credited with what they'd already spent.
- **Offline earnings**: 50% of passive income while away, up to 8 hours, with a
  "Welcome back!" popup.
- **Achievements**: 26 of them, +1% income each, with toasts and a 🏆 panel.
- **JUST GETTING STARTED 😈**: kept as its own game rather than merged in.
  The "NAH, WE'RE JUST GETTING STARTED" achievement (secede 3 times) unlocks a link to it.
- Fixes: the score shows right away on load; stickers can be dragged on touch
  screens; reshuffling no longer piles up event listeners; owned perks are
  marked "✔ Owned"; amounts over a billion read "1.235 billion".

### Sticker shop ✅

- 🎨 Stickers button opens a shop with tabs per category (quotes, emojis,
  flags, people, orgs, items). You start with 5 free stickers; the other 72
  are bought one at a time.
- Each owned sticker adds +0.5% to passive income. The price depends only on how
  many you've bought: $100k for the first, ~30% more per purchase, ~$10 trillion
  for the last (`BALANCE.stickers`).
- The screen shows every sticker you own; a toggle hides them (bonus stays).
- Bought stickers reset when you secede (the starter pack stays).
- Achievements: Brand Ambassador, Hall of Fame, Laptop Lid Complete.

### Golden stickers and bulk buying ✅

- Every 1.5–4 minutes a glowing golden sticker drops in (looks like one of your
  stickers) and fades after 13 seconds. Catching it gives one of
  (`GOLDEN_EFFECTS`, weighted 3/3/3/1):
  - 🪚 Milei's Chainsaw: clicks ×7 for 30s
  - 🐂 Bull Run: income ×3 for 60s
  - 🔑 Unclaimed Bitcoin Wallet: instant cash, min(25% of cash, 15 min of
    income), at least 50 clicks' worth
  - 🏖️ Tax Holiday: everything ×2 and no raids for 45s
- Active boosts show as chips with a countdown under the income. Boosts aren't
  saved and don't count toward offline earnings. Golden stickers wait while a
  raid is on screen or the tab is hidden.
- Achievements: Gold Bug (1 caught), Hard Money Maniac (25).
- Shop toggle: Buy ×1 / ×10 / MAX. Prices show the total for the batch
  ("×10 · $308"); MAX buys as many as you can afford and updates live. ×10
  buys nothing unless you can afford all ten. The setting is saved.

### Charters (prestige shop) ✅

- 📜 Charters button (shown once you've founded a city). Each Free Private City
  can sign one charter: a permanent perk that survives every secession.
  Signing never lowers the +10%-per-city income bonus (it counts every city
  founded); it just uses up that city's charter.
- 11 charters (`CHARTERS`, numbers in `CHARTER_VALUES`), 55 cities for all:
  - 1 💼 Seed Capital: start each run with $25,000
  - 2 📜 Grandfather Clause: start with 10 theory books + 10 lemonade stands
  - 2 ⚖️ Private Courts: raids half as often
  - 3 🧠 Memorized Seed Phrases: golden stickers 25% sooner
  - 3 🏝️ Remote Management: offline earnings 100%, up to 24 hours
  - 4 🐂 Secular Bull Market: golden boosts last 50% longer
  - 5 🏷️ Collector's Exemption: keep bought stickers when seceding
  - 6 🏪 Competitive Suppliers: upgrades 10% cheaper
  - 8 🎓 Austrian Tenure: keep special upgrades when seceding
  - 10 🏆 Lindy Effect: +2% per achievement instead of +1%
  - 15 🌐 Network Effects: +15% per city instead of +10%
- Achievements: We the Sovereign Individual (first charter), Constitution? I
  Hardly Know Her (all of them).

### Late-game upgrades ✅

- 8 upgrades past "Privatize solar system", alternating click/passive, $5B → $200T:
  🛰️ NAP-enforcement orbital railgun, ☄️ Asteroid mining guild, 🚪 Physical
  removal service, ☀️ Dyson sphere toll booth, ⏳ Lower your time preference,
  🚀 Interstellar free trade zone, 🔀 Multiverse arbitrage, 🌀 Homestead the
  Andromeda galaxy.
- Passives earn back their price at a rate close to Solar system's (tested), so
  each tier stays worth buying.
- Shop rows show bonuses formatted ("+4,000,000/s", "+1 billion/s").
- Achievements: I Would Privatize the Sun, Intergalactic Landlord.
- Phone layout fix: the page scrolls on narrow screens (the shop had been pushed
  off-screen), perks wrap into a 3×2 grid, and nothing overflows 320px phones.

### News ticker and sound effects ✅

- 📰 News strip at the top of the clicker panel: one headline scrolls across,
  then the next. ~50 absurd headlines in `news.ts`, many unlocked by progress
  (upgrades owned, raids evaded, golden stickers, secession, charters), some
  with live numbers. No repeats until 8 others have shown. Reduced-motion users
  get static headlines that change every 9 seconds.
- 🔊 Synthesized sound effects (`sfx.ts`, built on the shared `playTone`): click,
  crit, purchase, perk/charter, sticker, achievement, golden sticker appear and
  catch, raid siren, evade, and a little anthem on secession. The 🔊/🔇 button
  on the ticker toggles them; the setting is saved.
- The shared audio helper now skips sounds while the browser still has audio
  locked (before the first click), instead of queuing them up.

Ideas for later:
- Stats panel (clicks, crits, raids evaded, golden stickers, best run).

## Phase 5: The rest, one at a time

- Port each remaining game to TypeScript when it's actually being worked on.
- Move an action game (Econ Defender, Kindergarten Defender, Road to Liberty)
  to Phaser or Kaplay only if it outgrows plain canvas/DOM.
