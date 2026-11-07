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
- **Secession** (prestige): secede to found Free Private Cities, each giving +10%
  to all income forever. (Formula retuned in the balance pass below.)
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
  flags, people, orgs, items). Every sticker starts locked; all are bought
  one at a time. Reshuffle Stickers appears once you own one.
- Each owned sticker adds +0.25% to passive income (was +0.5% before the books). The price depends only on how
  many you've bought: $10k for the first, ~31% more per purchase, ~$10 trillion
  for the last (`BALANCE.stickers`).
- The screen shows every sticker you own; a toggle hides them (bonus stays).
- Bought stickers reset when you secede (limited editions stay). Saves from
  before this change keep the five stickers that used to be free.
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

### Stats panel ✅

- 📊 Stats button opens a panel that updates live: Economy (cash, income,
  click value, crit chance, run/all-time earnings, best run, biggest click),
  Income bonuses (cities, achievements, stickers, special upgrades, active
  golden boosts), Activity (clicks, crit rate, golden stickers, raids, stickers),
  Empire (cities, secessions, charters, collection progress, upgrades owned) and
  Time (time played, this run, tracking since).
- New tracked stats: playtime, run time, best run, biggest click, first played.
  Saves from before this start tracking from now.
- Achievement: Wage Slave to Yourself (10 hours played).

### Secret achievements and save codes ✅

- 12 secret achievements, shown as "🤫 ???" with a cryptic hint until unlocked;
  they count toward the +1% income each. Triggers: leave a raid up for a
  minute, drag Rothbard onto Mises, catch Milei's Chainsaw with the Milei
  sticker on screen, buy the EU flag as your first sticker, play at 3 a.m., on
  April 15, or on October 31 (Bitcoin white paper day), click the news ticker, toggle sound 10 times
  in a row, type "taxation is theft", secede with under $1, or don't click for
  10 minutes while making $1M/sec.
- 💾 Save data screen (Stats → Save / Load): copy a save code (`ANCAP1:…`),
  load one on another browser or device (with a confirmation showing what's in
  it), or start over (with a confirmation). Codes survive copy-paste line
  breaks, and bad values inside a code are cleaned up like a normal save.

### Sticker sets ✅

- Completing every sticker in a category grants a set bonus (`STICKER_SETS`):
  💬 Pamphleteer's Library (quotes, clicks ×1.25), 🐍 Emoji Mosaic (golden
  stickers 15% sooner), 🏴 Flag Collection (income ×1.05), 🧔 Austrian Pantheon
  (people, income ×1.25), 🏛️ Think Tank Network (raids 25% less often),
  🔫 Private Armory (+5% crit chance).
- The shop shows each tab's set bonus and progress, completed tabs get a ✔,
  and completing a set gets its own toast. Stats shows sets and their bonuses.
- Achievement: Completionist Tendencies (3 sets in one run).

### Balance pass ✅

- `npm run simulate` runs a simulated player through the real game rules and
  prints when milestones happen, for an active (5 clicks/s) and a casual
  (1 click/s) player. Try numbers without editing files:
  `BALANCE='{"secession":{"divisor":3000000}}' npm run simulate`.
- Finding: the prestige loop ran away. With cities = √(all-time / $1M), the
  active player had all charters in 3h, Andromeda in 6h, and ~17,000 cities.
- Fix: cities = ∛(all-time / $5M) (`BALANCE.secession`): city #1 at $5M,
  #10 at $5B, #55 at ~$832B. Everything else unchanged.
- Result (open-game time, active / casual): first secession 19m / 1h,
  10 cities 8.5h / 27h, all charters 26.5h / 76h, Andromeda 40.5h / 97h.
- Existing saves keep the cities they already have; new cities follow the new
  curve once lifetime earnings catch up.

### Challenge runs ✅

- 🏁 Challenges button (after your first secession). Starting one sets your
  empire aside inside the save and begins a fresh run with no cities, charters
  or achievement bonus. Win by reaching the goal, or abandon at any time; either
  way you return to your empire exactly as you left it (it's paused, with no
  offline earnings for the challenge's duration). Achievements and lifetime
  counters from the run carry back.
- Four challenges (`CHALLENGES`; rules in `ChallengeRules`, applied in logic.ts):
  - ⚖️ Minarchist ($250M): raids ×2, 5% flat tax, start with a State-provided PMC.
    Reward: raids 10% less often.
  - 🏛️ Status Quo ($75M): progressive tax brackets, AK-47s and raw milk banned,
    passive businesses fail 20% of the time, prices +1%/minute. Reward: upgrades 5% cheaper.
  - ☭ Communism ($1M): click upgrades only, half of clicks requisitioned, ×10
    prices, audits about once a minute from the start. Reward: clicks +25%.
  - 💸 Hyperinflation ($15M): cash melts 0.1%/sec, prices double every 10 minutes.
    Reward: the Unclaimed Bitcoin Wallet pays 50% more.
- Themed raid popups per challenge, a progress banner, and a tint per system.
- Achievements: a win and a sub-1-hour speedrun for each, plus Survived the
  Permit Office, Hero of Socialist Labor and Tried Every System.
- Goals tuned with `npm run simulate -- --challenges`: an active player wins
  each in about 1h17m–1h23m. Casual players (1 click/s) can win Minarchist and
  Communism in 5–7 hours, but not Status Quo or Hyperinflation within 8 hours.
- The simulator's raid check was fixed (it raided every ~8 hours instead of
  every ~100 seconds); the normal-game pacing barely moved.

### Christmas event ✅

- `EVENTS` in data.ts, date logic in events.ts. 🎄 Christmas in Ancapistan runs
  December 20 – January 1. The first time the game is opened in the season, a
  popup shows the Murray & Hoppe meme (the dialog sizes itself to the image),
  "We wish all lolbertarians a Murray Christmas and a Hoppe New Year!", the dates
  and the features. It shows once per season (tracked in the save) and the
  event chip under the income reopens it.
- 🎁 Presents replace golden stickers (40% sooner; `PRESENT_EFFECTS`): Unlicensed
  Elf Workshop (income ×3), Unregistered Sleigh Ride (clicks ×7), Stocking Stuffed
  with Krugerrands (cash ×1.5) and Fiat Coal (almost nothing).
- 🎄 Christmas tab in the sticker shop: the six Christmas stickers plus three text
  ones, on sale only during the event at 10 minutes of income each, kept forever
  (even through secession), with a Christmas Spirit set bonus (income ×1.1). They
  don't affect the regular sticker price ladder.
- 🎂 December 23, the Fed's birthday: raids ×2, and every dodged raid pays a
  minute of income ("a slice of the cake"). Its popup shows the Fed in a party
  hat with Woodrow Wilson in the sky.
- Snow, a Santa hat on the snake button, Christmas headlines, and five
  achievements: A Murray Christmas, Krampus Was a Tax Collector, Ho Ho Homestead,
  Party Pooper, A Hoppe New Year.
- Preview any day with `?date=YYYY-MM-DD`, e.g.
  `vidya/ancapistan-tycoon.html?date=2026-12-24`.
- Full-size source art lives in `art/christmas/` (not deployed); the game uses
  480 px WebP copies in `public/vidya/img/`.

### Birthdays and anniversaries ✅

- 🎂 Birthdays (one day each): Menger Feb 23, Rothbard Mar 2, Hayek May 8,
  Bastiat Jun 30, Ron Paul Aug 20, Hoppe Sep 2, Mises Sep 29. A popup with the
  party-hat portrait, their sticker free to claim (and glowing gold if owned),
  +10% income all day, a headline and a "Happy Birthday" achievement. Party
  Animal for celebrating 4 different birthdays.
- ₿ Bitcoin Genesis Block (Jan 3): crypto farms ×2. Achievement: Chancellor on
  Brink of Second Bailout.
- 🇱🇮 Liberland Day (Apr 13): animated flag popup, the Liberland sticker free,
  and seceding founds one bonus city. Achievement: Terra Nullius.
- 🍕 Bitcoin Pizza Day (May 22): golden stickers become pizzas that may hold
  Two Pizzas for 10,000 BTC (double cash). Achievement: Most Expensive Lunch in History.
- 💵 Nixon Shock (Aug 15): Golden Standard suspended; golden stickers become fiat
  stickers (half cash, half duration). Achievement: Closing the Gold Window.
- New People stickers: Frédéric Bastiat and Thomas Sowell, then Gary Becker, Milton
  Friedman, Peter Boettke, Richard Cantillon, Martín de Azpilicueta, Juan de
  Mariana, Gustave de Molinari and Friedrich von Wieser, then Samuel Edward
  Konkin III (40 people in all).
- 📚 Books: 82 book-cover stickers in their own tab (titles and authors in
  `books.ts`, covers in `public/vidya/img/books/`, originals in `art/books/`).
  Completing them all grants Library of Liberty (clicks ×1.5). With 170 regular
  stickers the price ladder is gentler (+13% per purchase instead of +28%), and
  pacing got ~17% faster: all charters ~21h, Andromeda ~32h for an active player.
- Events can now carry effects (`EventEffects`: income, per-upgrade income,
  gift sticker, bonus cities, suspended perk, golden theme and payouts).
  `?date=` previews now reach every rule, including income.
- Event popups are at least 480 px wide (so text stays readable next to tall
  portraits) and dialog buttons stick to the bottom on small screens.

### Unlockable stickers ✅

- Per-sticker bonus down to +0.25% to undo the books' pacing boost: Andromeda
  back to ~40h active / ~90h casual (from ~32h / ~77h).
- Some stickers have a condition (`STICKER_UNLOCKS`). Once met, they stay
  unlocked for good (saved in `unlockedStickers`, carried through challenges).
  - Earned for free: Economics in One Lesson (100 theory books), Our Enemy, the
    State (250), The Ethics of Liberty (500), Democracy: The God That Failed
    (750), Human Action (1,000), Liberland flag (first secession). Earned
    stickers survive secession, don't raise the price ladder, and are earned
    again in a challenge run once the condition is met there.
  - For sale once unlocked: AK-47 (50 AK-47s), M249 (200 AK-47s), McNuke
    (first silo), Antiroad Aktion (10 roads), Gold standard coin (first crypto
    farm), Bitcoin (50 farms), Solana (100 farms), "I would privatize the sun"
    (solar system), "Free Market Enjoyer" (invisible hand), "Agorism Now!"
    (100 lemonade stands).
- Locked cards show a greyed preview and the requirement with progress, e.g.
  "🔒 Own 200 AK-47s (60/200)" or "🎁 Earn it: Own 750 theory books".
  Unlocks get a toast; earned stickers drop on screen.
- New stickers: Antiroad Aktion (Orgs), Bitcoin and Solana in a new 🪙 Crypto
  tab. Set bonus 🪙 Cold Storage: golden-sticker cash ×1.25.
- More earned books: The State (first secession), Anatomy of the State (5th
  secession), The Gulag Archipelago (win the Communism challenge). Achievement
  🐛 Bookworm: earn every book money can't buy (`EARNED_BOOKS`).
- More for-sale unlocks: 🚁 Physical removal (10 physical removal services),
  "End! The! Fed!" (dodge 100 Fed raids, by hand or by shell company).
- 13 new quotes (41 in all). A quote can span lines (`\n`), and a line in
  `*asterisks*` is shown in italics ("Man Acts / *Bottom Text*").
- Fix: golden stickers no longer look like Christmas stickers outside the event.

Ideas for later:
- Javier Milei's birthday (Oct 22): needs a popup image.
- Tax Day (Apr 15) and Bitcoin White Paper Day (Oct 31) as full events.
- A New Year's Eve countdown in the news ticker.

## Phase 5: The rest, one at a time

- Port each remaining game to TypeScript when it's actually being worked on.
- Move an action game (Econ Defender, Kindergarten Defender, Road to Liberty)
  to Phaser or Kaplay only if it outgrows plain canvas/DOM.
