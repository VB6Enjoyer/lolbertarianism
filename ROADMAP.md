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

## Phase 4: Ancapistan Tycoon ✅ (v1.0: no longer marked "In progress")

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
  - For sale once unlocked (thresholds raised later, see below): AK-47, M249,
    McNuke, Antiroad Aktion, Gold standard coin, Bitcoin, Solana, "I would privatize the sun"
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
- More for-sale unlocks: 🚁 Physical removal (physical removal services),
  "End! The! Fed!" (dodge 100 Fed raids, by hand or by shell company).
- 13 new quotes (41 in all). A quote can span lines (`\n`), and a line in
  `*asterisks*` is shown in italics ("Man Acts / *Bottom Text*").
- Fix: golden stickers no longer look like Christmas stickers outside the event.

### Upgrade order by absurdity ✅

- The 22 upgrades are re-ordered so each is more absurd than the last: Physical
  removal and Lower your time preference come right after the roads, the
  orbital railgun after the McNuke silo, and Multiverse arbitrage is now the
  final upgrade (Andromeda just before it). Prices keep the same 22 tiers
  ($15 → $200T); each upgrade takes the tier of its new slot, with payouts
  interpolated from the old click and passive curves. Ids don't change, so
  saves, achievements and unlocks still point at the same upgrades.
- Click and passive no longer alternate. Tests now check that prices rise,
  every click upgrade beats the cheaper ones, and no passive pays back faster
  than a cheaper one.
- Pacing: the $200T upgrade at ~38h active / ~88h casual (was ~42h / ~95h);
  all charters ~25h / ~69h. Minarchist Mode got easier (active win ~58m,
  was ~1h 16m) because its free PMC now sits at the $10M tier.

### City names, selling and more achievements ✅

- Seceding asks you to name your new city (prefilled with a random name; 🎲
  rolls another: Rothbardia, Port Hayek, Catallaxy Bay…, `CITY_NAMES`). Click
  the city count to see every city you founded, numbered by secession. Cities
  from before the registry show up as unnamed. Saved in `foundedCities`.
- Sell upgrades: a Buy | Sell switch above the shop. Each copy refunds half of
  what it would cost to buy back now (`BALANCE.sellRefund`); ×1, ×10 or ALL.
  Refunds are cash, not earnings, so they don't count toward cities. Copies a
  challenge hands you (Minarchist's PMC) can't be sold. Stats count them.
- Achievements: ⚡ High-Frequency Trader (10 clicks in a second), 🏭 Voluntary
  Sweatshop (100 in a minute). Secret: 💎 HODL (hold the snake 10 seconds),
  and five for stickers on screen together (`STICKER_COMBOS`): 🎻 The Viennese
  Trinity, 📚 Mr. Libertarian's Bookshelf (5 Rothbard books), 🥊 Family Feud
  (Milei + Hoppe), 🌬️ Chicago Boys, 🕯️ The Forerunners.
- New People sticker: Lysander Spooner (41 people).

### Raids with a timer, penalties and DRO retainers ✅

- Before: an ignored raid had no timer; it froze income until you clicked
  "Hide assets", forever if you were away.
- Now each raid gives 1-30 seconds (random), with a countdown bar. Income stays
  frozen until it ends. If time runs out, the Fed takes one of (equal odds):
  💸 20% of your cash, 🏚️ one random building, 🧊 Asset Freeze (income ×0.5
  for 10 min) or 🚧 Capital Controls (clicks ×0.5 for 15 min). Repeat
  penalties restart their clock instead of stacking, show as red chips, and
  survive a reload (golden boosts still don't).
- 🛡️ DRO retainer: a row above the upgrades. Costs 5 minutes of income (min
  $1,000), stacks, and is kept when you secede. A raid that runs out the clock
  uses one up and you lose nothing; hiding your assets yourself keeps it.
  The raid popup says whether you're covered.
- Achievements: 🛡️ Lawyer Up, 🚔 Should Have Hidden It. Civil Disobedience is
  now "let a raid run out the clock" (raids no longer last a minute).
- The simulator lets slow reactions time out (the casual player reacts in 10s).
- Retainers get 25% pricier for each one you hold (`BALANCE.raid.retainerGrowth`):
  10 held ≈ 9× the base price, 20 ≈ 87×, so you can't bank a stack after a long
  absence and stop checking in. Using one up brings the price back down.
- Grindier sticker unlocks (own this many): AK-47 100, M249 500, McNuke 100,
  Antiroad Aktion 100 roads, Gold standard 100 crypto farms, Bitcoin 100 farms,
  Solana 500 farms, "I would privatize the sun" 50 solar systems, "Free Market
  Enjoyer" 100 invisible hands, 🚁 Physical removal 100 services.

### Bug reports and ideas ✅

- GitHub issue forms in `.github/ISSUE_TEMPLATE/`: 🐞 Bug report (game,
  what happened, steps, browser, optional save code, screenshots) and 💡
  Feature idea. Labeled `bug` / `enhancement`.
- Every game page gets a 🐞 button above the ← that opens both links in a new
  tab, prefilled with the game, a title and the browser (`src/shared/feedback.ts`).
  The homepage footer has the same two links.
- A test keeps the forms' game list in sync with `src/games.ts`.

### More headlines, unlocked for good ✅

- 37 new headlines (102 in all): 31 always-on submissions, plus ones for the
  invisible hand, McNuke, Multiverse arbitrage, a lost raid, your newest city
  (by name) and winning Communism Mode.
- Progress headlines now use `unlock` instead of `when`: once their condition
  is met they stay in rotation for good (saved in `unlockedHeadlines`, carried
  through challenges), so seceding no longer hides them. Event headlines keep
  `when` and only run on their dates.

Ideas for later:
- Javier Milei's birthday (Oct 22): needs a popup image.
- Tax Day (Apr 15) and Bitcoin White Paper Day (Oct 31) as full events.
- A New Year's Eve countdown in the news ticker.

## Phase 5: The rest, one at a time

- Port each remaining game to TypeScript when it's actually being worked on.
- Move an action game (Econ Defender, Kindergarten Defender, Road to Liberty)
  to Phaser or Kaplay only if it outgrows plain canvas/DOM.

### The Road to Liberty: rebuilt ✅

- Was broken: the road was a CSS 3D plane tilted the wrong way (it covered the
  sky), objects never lined up with it, and Marx was something to avoid.
- Now a pseudo-3D canvas racer (OutRun-style segments) in TypeScript: endless
  curvy, hilly road (`logic.ts` rules, `render.ts` drawing, `main.ts` glue).
- Based on the meme: run over Marx (points, a speed boost and a combo) while
  the cops chase you; their distance shows in the rearview mirror (with Hoppe),
  and they catch you if IRS checkpoints, traffic or the grass slow you down too
  much. 💰 gold for extra points. Rothbard is on the phone in the golden,
  veiny arm; the air freshener says "I ❤️ Property and freedom".
- Keyboard (← → / A D, ↓ to brake, P to pause, M to mute), hold-to-steer
  on touch with an on-screen brake. Engine and siren sounds; best score saved.
- Marx, cars and roadblocks are drawn with canvas shapes (no Marx image in the
  repo yet). Tests include an autopilot driver: a careful one outlasts the cops
  for minutes, an idle one gets busted.
- Cockpit pass: Marx is now the photo from the meme (armchair included;
  `public/vidya/img/marx.webp`, original in `art/road-to-liberty/`), with the
  drawn version as a fallback. Roof with sun visors and A-pillars; the mirror
  hangs from the roof and the air freshener hangs from the mirror. The wheel
  moved left with a golden hand on it, behind it an analog speedometer and a
  fuel gauge, plus a Liberty FM radio. The mirror is a canvas: the road behind
  streams away and the cop car is drawn head-on, growing as it closes in.
  Hoppe fills the left of the mirror in close-up, like the meme
  (`hoppe-up-close.webp`, original in `art/road-to-liberty/`).
- Fuel: a tank lasts ~80 s flat out, ⛽ jerry cans refill 40% (more of them
  when you're low), and an empty tank caps you at half speed.
- Rothbard talks: a speech bubble from the phone reacts to Marx hits, combos,
  crashes, fuel, borders, nightfall, rain and close calls, and warns you about
  spikes and cruisers ahead; small talk when nothing happens (`rothbard.ts`).
- Aggressive cops: spike strips across two lanes after 60 s (take the third),
  and cruisers that swerve toward you to box you in after 90 s.
- Borders every 2.5 km: Liberland, the Free State of New Hampshire, Próspera,
  Zug, Seasteadia, Galt's Gulch, Ancapistan, Rothbardia… Crossing one pays a
  growing bonus, holds the cops back 50 m and tops up 25% fuel. The HUD shows
  the next one.
- Day/night and weather: a 3-minute day (sunset, starry night with headlights,
  dawn) and 28-second rain showers that make steering weaker and curves
  stronger. `?time=110` previews later in the cycle; `?debug` exposes the run
  as `window.rtl`.
- Pacing (automated driver): careful 4–6½ min, sloppy 3–4 min.
- Power-ups (your art, in `art/road-to-liberty/`), from 25 s on: 🍩 donuts
  slow the cops to 55% for 10 s, 🚜 the Killdozer plows through checkpoints,
  traffic, spikes and cruisers for 5 s (points per smash, no slowdown), and 💨
  a smoke grenade puts the cops 90 m back and fills the mirror with smoke.
  Active ones show as chips in the HUD.
- Liberty FM 101.1: the dashboard radio scrolls the current song, shuffles
  through the playlist in `radio.ts` every 25 s with a station jingle, and
  skips ahead when clicked. The phone shows it too (for small screens).
- Roadside scenery (`scenery.ts`): billboards with 12 slogans, houses (some
  with a Gadsden flag), saloons with neon signs, Free Market Fuel stations,
  diners and raw-milk barns, set back beyond where you can drive.
- Commies: Marx is joined by Engels ($700), Che ($900), Lenin ($1,000), Mao
  ($1,200) and Stalin ($1,500), rarer the more they're worth (`COMMIES`).
  Each gets his own Rothbard lines; the busted screen shows a tally.
- Car damage: spike strips slow you 10% for 5 s and knock 5% off your top
  speed for good (down to 50%); a cruiser ram halves your top speed for 5 s.
  🔧 Wrench (rare, less rare when you're hurt, Böhm-Bawerk brand) repairs
  everything.
- Harder: power-ups about half as common, and the cops keep speeding up with
  every km (0.5% of your top speed per km, up to 105%), so after ~5 minutes
  they outrun an undamaged car. Automated driver: careful 3–3¾ min, sloppy 2–3.
- The HUD moved into the car: a green LCD trip computer above the wheel (score,
  combo, commies, next border, best) and 2×2 warning lights between the
  gauges (donuts, Killdozer, smoke with seconds left; check engine with your
  top speed %).
- Biomes (`biomes.ts`), a new one every 5 km (every other border), blending
  over ~170 m and announced as you drive in: the countryside; the desert (sand,
  mesas, cacti, cow skulls, no rain); the beach (sea on the right with foam,
  islands on the horizon, palms, surf shacks, lifeguard towers); the snowfield
  (white ground, snowy pines, snowmen, ski lodges, snow instead of rain and a
  little ice all the time); the mountains (snow-capped peaks, pines, boulders,
  log cabins, steeper hills and sharper bends). Then around again.
- Fix: the dashboard now shows where you are (📍, starting in "Statist
  Territory") and the distance to the next gate; the gate names where you're
  going, so crossing "WELCOME TO ZUG" puts Zug on the dashboard. Long names are
  cut off with "…" instead of overflowing the display.
- High scores (`scoreboard.ts`): an arcade table of ten, saved in
  localStorage, starting with the legends (MNR, LVM, HHH, FAH, RON, SEK, FCB,
  WEB, HSH, LYS; hover for the full name). Make the table and you enter three
  initials (remembered for next time); your row is highlighted. On the title
  screen behind "🏆 High scores".
- Achievements (`achievements.ts`): 26, saved in localStorage. Commies
  (first one, Stalin, the whole Politburo, 50 in a run), combos (×5, ×10),
  borders and landscapes, distance, time and score, Killdozer smashes, a
  smoke grenade with the cops right behind, a close shave, 2 minutes
  crash-free, repairs, running dry, a night storm, the high-score table, and
  lifetime ones (10 busts, 500 commies). Pop-ups during the run, a list on
  the busted screen, and a "🏅 Achievements" screen on the title.
- Boss chases: each new landscape brings one for 30 s, alternating 🚁 IRS Air
  Support (drops checkpoints and spikes in your lane; searchlight at night) and
  a 🪖 tank (stays ahead, brake-checks you, swerves to block). Surviving pays a
  growing bonus and holds the cops back 40 m; a Killdozer flattens the tank for
  double. Countdown banner under the mirror.
- 🔥 Nitro: commies (and a little gold) fill a NOS gauge on the LCD; Space or
  Shift (or the NOS button on touch screens) fires it for a burst past top speed.
- 🔧 Free Market Garage (`garage.ts`): every run's earnings go into savings.
  Six upgrades, three levels each: Run-Flat Tires, Long-Range Tank, Austrian
  Turbo, Bigger NOS Bottle, Bull Bar, Radar Jammer. From the title or the busted
  screen. Automated driver: stock car ~2½–5 min, fully upgraded 4–14 min.
- 9 more achievements (35 in all): nitro, bosses, Heemeyer's Revenge, and the
  garage (first upgrade, one maxed, all maxed, $1M saved).
- Legends raised (MNR $500k down to LYS $50k) so the table is a real
  challenge; old saves pick up the new values automatically.
- Lane events about once a minute after the first 50 s: a commie parade
  (seven marchers zig-zagging across the road), a state toll plaza (booths in
  every lane but one; slip through for $1,500) and road work (one lane closed
  with roadblocks).
- 📅 Daily challenge (`daily.ts`): the same seeded road for everyone each day,
  with one of seven twists (hyperinflation, fog, Stalin Day, rush hour,
  drought, night, free market). Daily bests are kept per day and stay off the
  main high-score table.
- Unlockable cars (`cars.ts`), picked in the garage, each with its own cockpit,
  engine and horn: Galt Motors Model R (score $100k; more fuel and nitro),
  Gadsden Pickup (beat the tank; tougher), Seized Trabant (the whole Politburo;
  slow, but commies pay 1.5×), Mises Mustang (4 borders; fast, twitchy).
- 📯 Horn (H, or the button on touch screens): traffic moves out of your lane
  and commies dive off the road.
- 6 more achievements (41 in all): parade, toll, horn, a daily run, seven of
  them, every car.
- 🎙️ Liberty FM talk and ads: after every two songs, a talk segment (the
  Rothbard Call-In Show, the Hoppe Hour, the Mises Minute, traffic, weather,
  sports) or an ad (gold, Galt Motors, Hoppe Home Security, Private Roads
  Inc.…), alternating.
- 📸 Photo finish (`photo.ts`): the run's best moment (the biggest combo, a
  tank flattened, a toll evaded… or a crash if that's all you've got), taken
  from a frame just before it happened, with a caption, as a polaroid on the
  busted screen.
- 🎮 Gamepad (`gamepad.ts`): stick or d-pad to steer, LT/B to brake, A/RB
  nitro, X/Y/LB horn, Start to pause; d-pad, A and B work the menus.
- ⚙️ Options (`settings.ts`): reduced flashing (no screen flashes, no blinking,
  steady police lights; on by default with the system's reduced-motion
  setting), colorblind-friendly colors (blue/orange, outlined warning lights)
  and screen shake on/off. From the title or the pause screen.
- Share (`share.ts`): copy the run as text, or a 1200×630 card with the photo
  finish, score, commies, distance, landscape and car (the share sheet on
  phones, a download elsewhere).
- Declared finished (v1.0): the "Prototype" badge is gone from the homepage,
  with a new screenshot.
- 9 more achievements (49 in all): 250 and 500 commies in a run, 3,000 in
  total, ×25 and ×50 combos, 10 nitros in a run, 30 s hands off the wheel, 10
  spike strips in a run (Killdozer smashes don't count). The Non-Aggression
  Principle now needs 1 minute without a crash instead of 2.
- The tank and IRS Air Support redrawn as detailed SVGs (`bosses.ts`): the tank
  with tracks, fenders, a grille, exhausts, an IRS·1040 plate and a turret
  aiming back at you; the helicopter with a glass cockpit, a yellow stripe,
  skids and a tail fin. Treads, brake lights, both rotors, the beacon and the
  searchlight are animated on top.

### Link previews ✅

- Every page (the homepage, each game, and the old redirect URLs) gets Open
  Graph and Twitter card tags at build time (`src/social.ts`, added by a plugin
  in `vite.config.ts`), so a shared link shows a 1200×630 picture, the title
  and the blurb from `games.ts`. Pictures live in `public/og/`; a test fails if
  a game is missing one.

### Austrian Economics Simulator: The Business Cycle ✅

Rebuilt from three buttons into a small real-time game in TypeScript, around
the meme's loop: steal a manhole cover → sell to the junkyard → buy drugs →
wait for replacement.

- A top-down city (`map.ts`, `render.ts`): the Fed, Cantillon Scrap & Salvage
  (next door), Roundabout Hardware, your squat, the Corner and Last-in-Line
  Recycling. Walk with the arrows/WASD or tap the map; E/Space to act; 1–4 to
  buy. You're Rothbard.
- The Fed (`logic.ts`): a calm start, then 45 s booms (rates at 0.25%, scrap
  prices in a bubble, an infrastructure bill with new manholes, City Works
  crews everywhere) and 35 s busts (rate hikes, a scrap crash, crews cut,
  another cop), announced 8 s ahead on the news ticker. The yard by the Fed
  hears the news first; the far one 12 s later (the Cantillon effect).
- Your fix wears off (faster with tolerance); heroin fills it and slows you
  down, crack fills half and speeds you up. Drugs inflate faster than scrap.
  Being seen prying (cops, crews, passers-by) or carrying covers past a cop
  raises heat; 100 is an arrest. Passers-by and cops fall into open manholes.
- Your squat stores covers for later (low time preference); capital goods at
  the hardware store: crowbar, shopping cart, hi-vis vest, bike.
- The meme itself is the HUD: its arrows light up as you go around, and a full
  lap pays a bonus. Price graphs for both yards and both drugs, DEA raids, 18
  achievements, a personal best. Automated driver: ~8–10 min basic, longer
  with capital goods.
- Deeper economics:
  - 🏛️ The Fed's discount window (its door on the top street): deposit your
    cash and it earns the Fed's rate (≈0.4%/s in a bust, next to nothing in a
    boom while inflation eats it); borrow up to $300 (in today's dollars) at
    the rate plus 3%. Loans are called in when a bust starts: repay before it
    ends, or default and lose your cash, savings, gold and stash (plus heat).
  - 🪙 Gresham Pawn & Gold (a kiosk by Cantillon Scrap): gold keeps up with
    inflation, dips in the boom and rallies in the bust; the shop takes 6% each
    way.
  - Covers come in kinds: brass (one in seven; ×3 value, slower to pry, more
    heat to carry) and the Fed's own gold cover outside its door (×8, twice as
    slow, an alarm that brings the nearest cop; only the Fed replaces it, with
    each boom).
  - 8 more achievements (26 in all): Interest on Reserve Balances, Cheap
    Credit, Sound Finances, Too Small to Bail Out, Gold Bug, Barbarous Relic,
    Historical Revisionism, End the Fed('s Manhole).
- More of the city:
  - City events about every 40–60 s, on the news ticker with a countdown
    banner: 🚗 Cash for Clunkers (scrap ×2 for 15 s), 🚁 Stimulus Check (+$50,
    then prices jump 10%), 🥤 Cover Recall (iron covers turn to plastic, worth
    a tenth, for 25 s), 📜 Minimum Wage Hike (the Corner +30% for 25 s).
  - 🦺 A rival scrapper in a hi-vis vest from 40 s in (a second at 200 s): he
    pries the nearest cover, sells it at the nearer yard and repeats; the crews
    leave him alone. Walk up and press E to shove him: into an open manhole if
    there's one next to him (down 20 s), otherwise he's stunned and you take
    his cover. Cops don't like seeing it.
  - 🏡 The Suburbs (`map.ts` districts, picked on the title screen once you've
    scored 150 utils downtown): a 21×13 map with long streets, the Fed far
    away, no cops at first (two at most) and more brass. Best scores per
    district.
  - 6 more achievements (32 in all).
- Short-term goals:
  - 📋 Contracts: a junkyard posts an order (2–4 covers, or 1–2 brass ones)
    due at the next FOMC meeting (the one after if that's under 20 s away).
    Matching covers sold there pay ×2; filling it pays 20 utils. Shown on the
    HUD, on the yard's sign and on the ticker.
  - 🗨️ Rothbard's commentary (`rothbard.ts`): a speech bubble with his face
    for the start, the Fed's meetings, booms and busts, steals, sales at the
    top or the bottom, the bank, gold, the rival, events and contracts, plus an
    idle line now and then.
  - 📅 The daily cycle (`daily.ts`): a seeded downtown run, the same for
    everyone each day, with a twist that rotates through the week: Weimar Day
    (hyperinflation), Gold Standard Day (no booms, busts or inflation),
    Stagflation Day, Police State Day, Helicopter Money Day, Gilded Age Day
    (half the covers brass), Zero Rates Day (long booms, short busts). Its own
    best per day, kept off the district bests.
  - 5 more achievements (37 in all): Freedom of Contract, Order Book,
    Wheelbarrow of Cash, Daily Cycle, A Week of Cycles.
- Polish:
  - Selling one at a time: the junkyard panel sells the cheapest cover, the
    best one, or all of them (E still sells everything), with the price of
    each, contracts included. Hold the brass for the boom.
  - Touch controls: on touch screens, a d-pad and a big action button under
    the map; swipe on the map to walk in a direction (taps still walk you to
    the spot).
  - 🎵 Elevator jazz (`music.ts`), synthesized: electric piano comping, a
    walking bass, brushed hi-hat and a noodling vibraphone. A ii–V–I in C at
    88 bpm when calm, 118 bpm in the boom, C minor at 70 bpm in the bust. Its
    own toggle in the top bar (saved); off with the sound, and while paused.
- Bug hunt (a rules fuzzer: 225 runs, ~34 h of game time across both
  districts and every twist, checking money, positions, covers and agents
  every frame; plus a browser monkey test of every screen and flow):
  - The rival could be stun-locked by shoving him over and over: shoves now
    have a 4 s cooldown.
  - …or shoved straight back into the hole he was climbing out of: a shove
    only drops him into a neighbouring hole now.
  - City crews covered manholes with a cop or the rival still down them; they
    wait now.
  - The music kept playing in a background tab (the pause came while the frame
    loop was asleep); it stops on pause and on game over now.
  - Clicked buttons kept the focus, so Space or Enter could click them again.
  - A 0-point daily run said "today's best 0 utils" and counted as a day
    played.
