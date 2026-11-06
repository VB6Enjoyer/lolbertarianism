import { pick, spawnText } from '../../shared/effects.ts';
import { formatMoney } from '../../shared/format.ts';
import {
  ACHIEVEMENTS,
  BALANCE,
  CHARTERS,
  CLICK_PHRASES,
  PERKS,
  STARTER_STICKERS,
  STICKERS,
  STICKER_CATEGORIES,
  UPGRADES,
  type Achievement,
  type Charter,
  type GoldenEffect,
  type StickerCategory,
} from './data.ts';
import {
  activeBuffs,
  buyCharter,
  buyPerk,
  buySticker,
  buyUpgrade,
  catchGolden,
  citiesAvailable,
  click,
  derive,
  earn,
  earningsForCities,
  goldenDelayMultiplier,
  hasCharter,
  hasPerk,
  hasSticker,
  newState,
  offlineEarnings,
  offlineSettings,
  pendingCities,
  pickGoldenEffect,
  purchaseQuote,
  raidChance,
  raidsBlocked,
  secede,
  stickerCost,
  tick,
  unlockAchievements,
  type BuyAmount,
  type GameState,
} from './logic.ts';
import { pickHeadline, type NewsContext } from './news.ts';
import { loadState, saveState } from './save.ts';
import { setMuted, sfx } from './sfx.ts';
import { buildStats } from './stats.ts';
import { dropSticker, enableStickerDragging, spawnStickers, stickerPreview } from './stickers.ts';

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const els = {
  score: byId('score'),
  income: byId('income'),
  prestige: byId('prestige-line'),
  buffs: byId('buff-bar'),
  buyAmount: byId('buy-amount'),
  mainBtn: byId('main-btn'),
  shop: byId('shop-list'),
  perks: byId('special-upgrades-container'),
  stickers: byId('sticker-container'),
  raid: byId('raid-overlay'),
  secede: byId<HTMLButtonElement>('btn-secede'),
  charters: byId<HTMLButtonElement>('btn-charters'),
  modal: byId('modal'),
  modalTitle: byId('modal-title'),
  modalBody: byId('modal-body'),
  modalActions: byId('modal-actions'),
  toasts: byId('toasts'),
  newsTrack: byId('news-track'),
  newsText: byId('news-text'),
  sound: byId<HTMLButtonElement>('btn-sound'),
};

let state: GameState = loadState() ?? newState();
let raidActive = false;
/** Open sticker shop tab, or null when the shop isn't open. */
let shopTab: StickerCategory | null = null;
/** Whether the stats panel is open (it refreshes every tick). */
let statsOpen = false;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const money = (n: number) => `$${formatMoney(n)}`;
const center = () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

function spawnFloater(x: number, y: number, text: string, color = '#2ecc71') {
  spawnText({ text, className: 'floater', x, y, style: { color } });
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${Math.max(1, m)}m`;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderShop() {
  els.shop.innerHTML = '';
  for (const u of UPGRADES) {
    const div = el('div', 'shop-item disabled');
    div.id = `btn-${u.id}`;
    div.title = u.lore;
    div.addEventListener('click', () => onBuyUpgrade(u.id));
    div.innerHTML = `
      <div class="item-icon">${u.icon}</div>
      <div class="item-info">
        <span class="item-name">${u.name}</span>
        <span class="item-cost"></span>
      </div>
      <div style="font-size:0.8em; color:#666;">
        ${u.type === 'passive' ? '+' + formatMoney(u.income) + '/s' : '+' + formatMoney(u.clickBonus) + '/click'}
      </div>
    `;
    els.shop.appendChild(div);
  }
}

function renderPerks() {
  els.perks.innerHTML = '';
  for (const p of PERKS) {
    const owned = hasPerk(state, p.id);
    const div = el('div', `special-upgrade disabled${owned ? ' owned' : ''}`);
    div.id = `btn-${p.id}`;
    div.title = `${p.description}\n\n${p.lore}`;
    div.addEventListener('click', () => onBuyPerk(p.id));
    div.innerHTML = `
      <div class="special-upgrade-icon">${p.icon}</div>
      <div class="special-upgrade-name">${p.name}</div>
      <div class="special-upgrade-cost">${owned ? '✔ Owned' : money(p.cost)}</div>
    `;
    els.perks.appendChild(div);
  }
}

function updateUI() {
  const d = derive(state);
  els.score.innerText = formatMoney(Math.floor(state.score));
  els.income.innerText = formatMoney(d.incomePerSec);

  for (const p of PERKS) {
    const btn = document.getElementById(`btn-${p.id}`);
    btn?.classList.toggle('disabled', hasPerk(state, p.id) || state.score < p.cost);
  }
  for (const u of UPGRADES) {
    const btn = document.getElementById(`btn-${u.id}`);
    if (!btn) continue;
    const { count, cost } = purchaseQuote(state, u);
    btn.classList.toggle('disabled', state.score < cost);
    const price = btn.querySelector('.item-cost');
    if (price) price.textContent = count > 1 ? `×${count} · ${money(cost)}` : money(cost);
  }
  for (const b of els.buyAmount.querySelectorAll<HTMLElement>('button')) {
    b.classList.toggle('active', b.dataset.amount === String(state.buyAmount));
  }
  renderBuffs();

  // Prestige summary, once there's something to show.
  const bonus = Math.round((d.globalMultiplier - 1) * 100);
  els.prestige.hidden = state.cities === 0 && state.achievements.length === 0;
  const unspent = citiesAvailable(state);
  els.prestige.textContent =
    `🏙️ ${state.cities} Free Private ${state.cities === 1 ? 'City' : 'Cities'}` +
    (unspent && state.charters.length < CHARTERS.length ? ` (${unspent} unspent)` : '') +
    ` · 🏆 ${state.achievements.length}/${ACHIEVEMENTS.length} · +${bonus}% income`;

  els.charters.hidden = state.cities === 0 && state.charters.length === 0;
  els.charters.textContent = unspent ? `📜 Charters (${unspent} 🏙️)` : '📜 Charters';

  if (shopTab) updateShopPrices();
  if (statsOpen) els.modalBody.replaceChildren(renderStats());

  const pending = pendingCities(state);
  els.secede.classList.toggle('locked', pending < 1);
  els.secede.textContent = pending >= 1 ? `🏴 Secede (+${pending} 🏙️)` : '🏴 Secede';
  els.secede.title =
    pending >= 1
      ? `Found ${pending} new Free Private ${pending === 1 ? 'City' : 'Cities'}`
      : `Earn ${money(earningsForCities(state.cities + 1) - state.allTimeEarnings)} more to found a Free Private City`;
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

function toast(title: string, detail: string) {
  const t = el('div', 'toast', title);
  t.append(el('small', '', detail));
  els.toasts.append(t);
  setTimeout(() => t.remove(), 4000);
}

/** Checks achievements, announces new ones and refreshes the UI. */
function refresh() {
  const unlocked = unlockAchievements(state);
  if (unlocked.length) sfx.achievement();
  if (unlocked.length > 3) {
    toast(`🏆 ${unlocked.length} achievements unlocked!`, 'Open 🏆 Achievements to see them.');
  } else {
    for (const a of unlocked) toast(`${a.icon} Achievement unlocked: ${a.name}`, a.description);
  }
  updateUI();
}

function achievementCard(a: Achievement) {
  const unlocked = state.achievements.includes(a.id);
  const card = el('div', `achievement${unlocked ? '' : ' locked'}`);
  card.append(
    el('span', 'achievement-icon', unlocked ? a.icon : '🔒'),
    el('span', 'achievement-name', a.name),
    el('span', 'achievement-desc', a.description),
  );
  if (unlocked && a.reward) {
    const link = el('a', '', `${a.reward.label} →`);
    link.href = a.reward.href;
    card.append(link);
  }
  return card;
}

function showAchievements() {
  const body = el('div');
  const pct = Math.round(state.achievements.length * BALANCE.bonusPerAchievement * 100);
  body.append(
    el('p', 'achievement-summary', `${state.achievements.length} / ${ACHIEVEMENTS.length} unlocked · +${pct}% income`),
  );
  const grid = el('div', 'achievement-grid');
  grid.append(...ACHIEVEMENTS.map(achievementCard));
  body.append(grid);
  openModal('🏆 Achievements', body, [{ label: 'Back to the grind' }]);
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

interface ModalAction {
  label: string;
  secondary?: boolean;
  onClick?: () => void;
}

function openModal(title: string, body: Node, actions: ModalAction[]) {
  els.modalTitle.textContent = title;
  els.modalBody.replaceChildren(body);
  els.modalActions.replaceChildren(
    ...actions.map(({ label, secondary, onClick }) => {
      const btn = el('button', `btn-reshuffle${secondary ? ' secondary' : ''}`, label);
      btn.addEventListener('click', () => {
        closeModal();
        onClick?.();
      });
      return btn;
    }),
  );
  els.modal.hidden = false;
  els.modalBody.parentElement!.scrollTop = 0;
  (els.modalActions.lastElementChild as HTMLElement | null)?.focus({ preventScroll: true });
}

function closeModal() {
  els.modal.hidden = true;
  shopTab = null;
  statsOpen = false;
}

const isModalOpen = () => !els.modal.hidden;

function paragraph(text: string, className = '') {
  return el('p', className, text);
}

function showSecession() {
  const pending = pendingCities(state);
  const body = el('div');
  const cityNumber = state.cities + 1;

  if (pending < 1) {
    const needed = earningsForCities(state.cities + 1) - state.allTimeEarnings;
    body.append(
      paragraph('When the State gets too big, you can always leave and start over somewhere freer.'),
      paragraph(`Earn ${money(needed)} more (all-time) to found Free Private City #${cityNumber}.`),
      paragraph(
        `Each city permanently adds +${BALANCE.secession.bonusPerCity * 100}% to all income. ` +
          'The more you earn overall, the more cities you can found.',
        'fine-print',
      ),
    );
    openModal('🏴 Secession', body, [{ label: 'Keep grinding' }]);
    return;
  }

  body.append(
    paragraph(
      'When in the course of human events it becomes necessary for one person to dissolve the political bands ' +
        'which have connected them with the State…',
    ),
    paragraph(`You'll found ${pending === 1 ? `Free Private City #${cityNumber}` : `${pending} new Free Private Cities`}:`),
    el('div', 'big-number', `+${pending} 🏙️ = +${Math.round(pending * BALANCE.secession.bonusPerCity * 100)}% income`),
    paragraph(
      `You leave behind your ${money(state.score)}, every upgrade` +
        (hasCharter(state, 'tenure') ? '' : ', every special upgrade') +
        (hasCharter(state, 'sticker-license') ? '' : ' and your bought stickers') +
        '. Your cities, charters, achievements and lifetime earnings come with you' +
        (hasCharter(state, 'tenure') ? ', and so do your special upgrades' : '') +
        (hasCharter(state, 'sticker-license') ? ', and so do your stickers' : '') +
        '.',
      'fine-print',
    ),
  );
  openModal('🏴 Declaration of Independence', body, [
    { label: 'Not yet', secondary: true },
    { label: 'SECEDE!', onClick: onSecede },
  ]);
}

function showWelcomeBack(seconds: number, amount: number) {
  const body = el('div');
  const { rate, maxSeconds } = offlineSettings(state);
  const hours = maxSeconds / 3600;
  body.append(
    paragraph(`While you were away (${formatDuration(seconds)}), your enterprises made:`),
    el('div', 'big-number', money(amount)),
    paragraph(
      rate >= 1
        ? `Your remote managers believe in incentives: you got 100% of your income. (Counts up to ${hours} hours.)`
        : `You only get ${Math.round(rate * 100)}% of your usual income while away: unsupervised employees ` +
            `embezzled the rest. The market will sort them out. (Counts up to ${hours} hours.)`,
      'fine-print',
    ),
  );
  openModal('Welcome back!', body, [{ label: 'Collect' }]);
}

// ---------------------------------------------------------------------------
// Sticker shop
// ---------------------------------------------------------------------------

/** Draws (or hides) every owned sticker. */
function showStickers() {
  els.stickers.hidden = !state.showStickers;
  spawnStickers(els.stickers, state.showStickers ? state.stickers : []);
}

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

function shopSummary() {
  const bonus = state.stickers.length * BALANCE.stickers.bonusEach;
  return (
    `You own ${state.stickers.length}/${STICKERS.length} stickers: +${pct(bonus)} income/sec. ` +
    `Each one adds +${pct(BALANCE.stickers.bonusEach)}, and every purchase makes the next one pricier.`
  );
}

function renderStickerShop(): HTMLElement {
  const tab = shopTab ?? 'quote';
  const body = el('div', 'sticker-shop');

  body.append(el('p', 'fine-print sticker-summary', shopSummary()));

  const next = el('div', 'big-number sticker-next', `Next sticker: ${money(stickerCost(state))}`);
  body.append(next);

  const toggle = el('label', 'sticker-toggle');
  const box = el('input');
  box.type = 'checkbox';
  box.checked = state.showStickers;
  box.addEventListener('change', () => {
    state.showStickers = box.checked;
    showStickers();
  });
  toggle.append(box, document.createTextNode(' Show stickers on screen (the bonus counts either way)'));
  body.append(toggle);

  const tabs = el('div', 'sticker-tabs');
  for (const c of STICKER_CATEGORIES) {
    const inCat = STICKERS.filter((s) => s.category === c.id);
    const owned = inCat.filter((s) => hasSticker(state, s.id)).length;
    const btn = el('button', `sticker-tab${c.id === tab ? ' active' : ''}`, `${c.label} ${owned}/${inCat.length}`);
    btn.addEventListener('click', () => {
      shopTab = c.id;
      els.modalBody.replaceChildren(renderStickerShop());
    });
    tabs.append(btn);
  }
  body.append(tabs);

  const grid = el('div', 'sticker-grid');
  for (const s of STICKERS.filter((x) => x.category === tab)) {
    const owned = hasSticker(state, s.id);
    const card = el('button', `sticker-card${owned ? ' owned' : ''}`);
    card.title = s.id;
    card.append(stickerPreview(s.id), el('span', 'sticker-price', owned ? '✔ Owned' : `Buy · ${money(stickerCost(state))}`));
    if (owned) {
      card.disabled = true;
    } else {
      card.dataset.locked = '';
      card.addEventListener('click', () => onBuySticker(s.id));
    }
    grid.append(card);
  }
  body.append(grid);
  return body;
}

/** Keeps the open shop's price and buy buttons in sync with your cash. */
function updateShopPrices() {
  const cost = stickerCost(state);
  const next = els.modalBody.querySelector('.sticker-next');
  if (next) next.textContent = `Next sticker: ${money(cost)}`;
  els.modalBody.querySelectorAll<HTMLElement>('.sticker-card[data-locked]').forEach((card) => {
    card.classList.toggle('disabled', state.score < cost);
    const price = card.querySelector('.sticker-price');
    if (price) price.textContent = `Buy · ${money(cost)}`;
  });
}

function showStickerShop() {
  shopTab ??= 'quote';
  openModal('🎨 Sticker Shop', renderStickerShop(), [{ label: 'Done' }]);
  updateShopPrices();
}

function onBuySticker(id: string) {
  if (!buySticker(state, id)) return;
  if (state.showStickers) dropSticker(els.stickers, id);
  const { x, y } = center();
  spawnFloater(x, y, 'STICKER UNLOCKED!', '#8e44ad');
  sfx.sticker();
  els.modalBody.replaceChildren(renderStickerShop());
  refresh();
}

// ---------------------------------------------------------------------------
// Charters (prestige shop)
// ---------------------------------------------------------------------------

function charterCard(c: Charter) {
  const owned = hasCharter(state, c.id);
  const affordable = citiesAvailable(state) >= c.cost;
  const card = el('button', `charter-card${owned ? ' owned' : affordable ? '' : ' disabled'}`);
  card.title = c.lore;
  card.append(
    el('span', 'charter-icon', c.icon),
    el('span', 'charter-name', c.name),
    el('span', 'charter-desc', c.description),
    el('span', 'charter-cost', owned ? '✔ Signed' : `🏙️ ${c.cost}`),
  );
  if (owned) card.disabled = true;
  else card.addEventListener('click', () => onBuyCharter(c));
  return card;
}

function renderCharters(): HTMLElement {
  const body = el('div', 'charter-shop');
  const unspent = citiesAvailable(state);
  body.append(
    paragraph(
      `You've founded ${state.cities} Free Private ${state.cities === 1 ? 'City' : 'Cities'}. ` +
        'Each one can sign one charter: a permanent perk that survives every secession. ' +
        'Signing never reduces the income bonus your cities give.',
      'fine-print',
    ),
    el('div', 'big-number', `${unspent} 🏙️ to spend`),
  );
  const grid = el('div', 'charter-grid');
  grid.append(...CHARTERS.map(charterCard));
  body.append(grid);
  return body;
}

function showCharters() {
  openModal('📜 City Charters', renderCharters(), [{ label: 'Done' }]);
}

function onBuyCharter(c: Charter) {
  if (!buyCharter(state, c)) return;
  const { x, y } = center();
  spawnFloater(x, y, `CHARTER SIGNED: ${c.name.toUpperCase()}!`, '#8e44ad');
  sfx.perk();
  els.modalBody.replaceChildren(renderCharters());
  save();
  refresh();
}

// ---------------------------------------------------------------------------
// Stats panel
// ---------------------------------------------------------------------------

function renderStats(): HTMLElement {
  const body = el('div', 'stats-panel');
  for (const section of buildStats(state)) {
    const box = el('section', 'stats-section');
    box.append(el('h3', '', section.title));
    const list = el('dl');
    for (const [label, value] of section.rows) list.append(el('dt', '', label), el('dd', '', value));
    box.append(list);
    body.append(box);
  }
  return body;
}

function showStats() {
  openModal('📊 Stats', renderStats(), [{ label: 'Close' }]);
  statsOpen = true;
}

// ---------------------------------------------------------------------------
// Golden stickers
// ---------------------------------------------------------------------------

function renderBuffs() {
  const now = Date.now();
  els.buffs.replaceChildren(
    ...activeBuffs(state, now).map(({ effect, endsAt }) => {
      const parts = [];
      if (effect.clickMultiplier !== 1) parts.push(`×${effect.clickMultiplier} clicks`);
      if (effect.incomeMultiplier !== 1) parts.push(`×${effect.incomeMultiplier} income`);
      if (effect.noRaids) parts.push('no raids');
      const secs = Math.max(0, Math.ceil((endsAt - now) / 1000));
      const chip = el('span', 'buff-chip', `${effect.icon} ${effect.name}: ${parts.join(', ')} · ${secs}s`);
      chip.title = effect.description;
      return chip;
    }),
  );
}

function scheduleGolden() {
  const { minDelaySec, maxDelaySec } = BALANCE.golden;
  const delay = (minDelaySec + Math.random() * (maxDelaySec - minDelaySec)) * 1000 * goldenDelayMultiplier(state);
  setTimeout(spawnGolden, delay);
}

/** Drops a glowing golden sticker somewhere on screen. Catch it before it fades. */
function spawnGolden() {
  if (raidActive || document.hidden) {
    scheduleGolden();
    return;
  }
  const pool = state.stickers.length > STARTER_STICKERS.length ? state.stickers : STICKERS.map((s) => s.id);
  const btn = el('button', 'golden-sticker');
  btn.setAttribute('aria-label', 'Golden sticker! Click it');
  btn.append(stickerPreview(pick(pool)));
  btn.style.left = `${40 + Math.random() * (window.innerWidth - 160)}px`;
  btn.style.top = `${40 + Math.random() * (window.innerHeight - 200)}px`;
  btn.style.setProperty('--life', `${BALANCE.golden.lifetimeSec}s`);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    btn.remove();
    scheduleGolden();
  };
  btn.addEventListener('click', (e) => {
    if (done) return;
    onCatchGolden(pickGoldenEffect(Math.random()), e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2);
    finish();
  });
  setTimeout(finish, BALANCE.golden.lifetimeSec * 1000);
  document.body.append(btn);
  sfx.goldenAppear();
}

function onCatchGolden(effect: GoldenEffect, x: number, y: number) {
  const cash = catchGolden(state, effect);
  sfx.goldenCatch();
  spawnFloater(x, y, cash ? `${effect.icon} +${money(cash)}!` : `${effect.icon} ${effect.name.toUpperCase()}!`, '#c9a100');
  toast(`${effect.icon} ${effect.name}`, cash ? `${effect.description} +${money(cash)}` : effect.description);
  refresh();
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function onClickMain(x: number, y: number) {
  if (raidActive) return;
  const { amount, crit } = click(state, Math.random());
  if (crit) sfx.crit();
  else sfx.click();
  if (crit) spawnFloater(x, y, `CRIT! +${money(amount)}`, 'orange');
  else spawnFloater(x, y, `+${money(amount)}`);

  // Random chance for meme text
  if (Math.random() < BALANCE.phraseChance) {
    const phrase = pick(CLICK_PHRASES);
    setTimeout(() => spawnFloater(x + (Math.random() * 40 - 20), y - 40, phrase, 'black'), 100);
  }
  refresh();
}

function onBuyUpgrade(id: number) {
  const upgrade = UPGRADES.find((u) => u.id === id)!;
  const bought = buyUpgrade(state, upgrade);
  if (!bought) return;
  const { x, y } = center();
  spawnFloater(x, y, bought > 1 ? `PURCHASED ×${bought}!` : 'PURCHASED!', 'green');
  sfx.purchase();
  renderShop(); // Re-render to update costs
  refresh();
}

function onBuyPerk(id: string) {
  const perk = PERKS.find((p) => p.id === id)!;
  if (!buyPerk(state, perk)) return;
  const { x, y } = center();
  spawnFloater(x, y, 'PERK UNLOCKED!', 'gold');
  sfx.perk();
  renderPerks();
  refresh();
}

function onSecede() {
  const gained = secede(state);
  if (!gained) return;
  saveState(state);
  renderShop();
  renderPerks();
  showStickers();
  const { x, y } = center();
  spawnFloater(x, y, `INDEPENDENCE! +${gained} 🏙️`, 'black');
  sfx.secede();
  refresh();
}

function gameLoop() {
  tick(state, raidActive);
  refresh();
}

// Raid Event Logic
function tryRaid() {
  if (raidActive || isModalOpen() || raidsBlocked(state)) return;
  if (state.score > BALANCE.raid.minScore && Math.random() < raidChance(state)) {
    if (Math.random() < derive(state).raidEvasionChance) {
      state.stats.raidsAutoEvaded++;
      spawnFloater(window.innerWidth / 2, 50, 'Raid Evaded!', 'blue');
      sfx.evade();
      refresh();
      return; // Automatically evaded
    }
    raidActive = true;
    els.raid.style.display = 'flex';
    sfx.raid();
    // Penalty if ignored: income stops until you hide your assets.
  }
}

function evadeTax() {
  raidActive = false;
  els.raid.style.display = 'none';
  const { x, y } = center();
  spawnFloater(x, y, 'TAX EVADED!', 'blue');
  sfx.evade();
  state.stats.raidsEvaded++;
  earn(state, BALANCE.raid.evadeBonus); // Bonus for evasion
  refresh();
}

// ---------------------------------------------------------------------------
// News ticker and sound toggle
// ---------------------------------------------------------------------------

const recentHeadlines: number[] = [];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
/** Ticker speed in pixels per second. */
const NEWS_SPEED = 70;

function newsContext(): NewsContext {
  return {
    allTimeEarnings: state.allTimeEarnings,
    incomePerSec: derive(state).incomePerSec,
    owned: (id) => state.owned[id] ?? 0,
    cities: state.cities,
    charters: state.charters.length,
    stickers: state.stickers.length,
    secessions: state.stats.secessions,
    raidsEvaded: state.stats.raidsEvaded,
    goldenClicks: state.stats.goldenClicks,
    clicks: state.stats.clicks,
  };
}

/** Shows the next headline: it scrolls across once, then the next one starts. */
function nextHeadline() {
  els.newsText.textContent = pickHeadline(newsContext(), recentHeadlines, Math.random());
  if (reducedMotion.matches || !els.newsText.animate) {
    els.newsText.style.transform = 'none';
    setTimeout(nextHeadline, 9000);
    return;
  }
  const from = els.newsTrack.clientWidth;
  const to = -els.newsText.scrollWidth;
  const animation = els.newsText.animate(
    [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }],
    { duration: ((from - to) / NEWS_SPEED) * 1000, easing: 'linear' },
  );
  animation.onfinish = nextHeadline;
}

function updateSoundButton() {
  setMuted(!state.sound);
  els.sound.textContent = state.sound ? '🔊' : '🔇';
  const label = state.sound ? 'Mute sound' : 'Turn sound on';
  els.sound.title = label;
  els.sound.setAttribute('aria-label', label);
}

els.sound.addEventListener('click', () => {
  state.sound = !state.sound;
  updateSoundButton();
  if (state.sound) sfx.purchase(); // a little confirmation blip
  save();
});

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

els.mainBtn.addEventListener('click', (e) => onClickMain(e.clientX, e.clientY));
els.mainBtn.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
    e.preventDefault();
    const r = els.mainBtn.getBoundingClientRect();
    onClickMain(r.left + r.width / 2, r.top + r.height / 2);
  }
});

byId('btn-reshuffle').addEventListener('click', () => {
  showStickers();
  state.stats.reshuffles++;
  refresh();
});
byId('btn-achievements').addEventListener('click', showAchievements);
byId('btn-stats').addEventListener('click', showStats);
els.charters.addEventListener('click', showCharters);
byId('btn-stickers').addEventListener('click', showStickerShop);
els.buyAmount.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('button[data-amount]');
  if (!btn) return;
  const v = btn.dataset.amount;
  state.buyAmount = (v === 'max' ? 'max' : Number(v)) as BuyAmount;
  updateUI();
});
els.secede.addEventListener('click', showSecession);
byId('btn-evade').addEventListener('click', evadeTax);

els.modal.addEventListener('click', (e) => {
  if (e.target === els.modal) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isModalOpen()) closeModal();
});

enableStickerDragging(els.stickers, () => {
  state.stats.stickersDragged++;
  refresh();
});

const save = () => saveState(state);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') save();
});
window.addEventListener('pagehide', save);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

if (!state.stats.firstPlayed) state.stats.firstPlayed = Date.now();

const away = offlineEarnings(state, Date.now());
if (away.amount > 0) {
  earn(state, away.amount);
  state.stats.offlineCollected++;
}

updateSoundButton();
renderShop();
renderPerks();
showStickers();
refresh(); // Show loaded progress right away
nextHeadline();
save(); // Stamp the time now, so a quick reload can't collect offline earnings twice

if (away.amount > 0) showWelcomeBack(away.seconds, away.amount);

setInterval(gameLoop, 1000);
setInterval(tryRaid, BALANCE.raid.intervalMs);
setInterval(save, BALANCE.saveIntervalMs);
scheduleGolden();
