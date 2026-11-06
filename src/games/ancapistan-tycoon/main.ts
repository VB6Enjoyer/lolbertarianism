import { pick, spawnText } from '../../shared/effects.ts';
import { formatMoney } from '../../shared/format.ts';
import {
  ACHIEVEMENTS,
  BALANCE,
  CHALLENGES,
  CHARTERS,
  CLICK_PHRASES,
  PERKS,
  PRESENT_EFFECTS,
  SECRET_PHRASE,
  STICKERS,
  STICKER_CATEGORIES,
  STICKER_LABELS,
  STICKER_SETS,
  UPGRADES,
  type Achievement,
  type Challenge,
  type ChallengeId,
  type Charter,
  type GameEvent,
  type GoldenEffect,
  type SecretAchievementId,
  type StickerCategory,
} from './data.ts';
import {
  activeBuffs,
  bannedReason,
  buyCharter,
  buyPerk,
  buySticker,
  buyUpgrade,
  catchGolden,
  challengeOf,
  citiesAvailable,
  click,
  completedStickerSets,
  derive,
  earn,
  earningsForCities,
  goldenDelayMultiplier,
  grantAchievement,
  hasCharter,
  hasPerk,
  hasSticker,
  newState,
  offlineEarnings,
  offlineSettings,
  pendingCities,
  perkCost,
  pickGoldenEffect,
  priceOfSticker,
  purchaseQuote,
  raidChance,
  raidEvadeBonus,
  raidMinScore,
  raidsBlocked,
  secede,
  secretDateAchievements,
  stickerCost,
  stickerForSale,
  tick,
  unlockAchievements,
  type BuyAmount,
  type GameState,
} from './logic.ts';
import {
  challengeById,
  challengeProgress,
  checkChallengeWin,
  enterChallenge,
  leaveChallenge,
  type ChallengeWin,
} from './challenges.ts';
import { eventsOn, gameDate, isEventActive, seasonKey } from './events.ts';
import { pickHeadline, type NewsContext } from './news.ts';
import { formatPlaytime } from './stats.ts';
import { clearSave, exportSave, importSave, loadState, saveState } from './save.ts';
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
  challenges: byId<HTMLButtonElement>('btn-challenges'),
  reshuffle: byId<HTMLButtonElement>('btn-reshuffle'),
  challengeBanner: byId('challenge-banner'),
  challengeName: byId('challenge-name'),
  challengeFill: byId('challenge-fill'),
  challengeProgress: byId('challenge-progress'),
  challengeDetails: byId('challenge-details'),
  raidTitle: byId('raid-title'),
  raidText: byId('raid-text'),
  raidButton: byId('btn-evade'),
  eventChip: byId<HTMLButtonElement>('event-chip'),
  santaHat: byId('santa-hat'),
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
/** For secret achievements: when the current raid started, and when the snake was last clicked. */
let raidStartedAt = 0;
let lastClickAt = Date.now();

/** The game's "today": the real date, or the `?date=YYYY-MM-DD` preview date. */
const today = () => gameDate();
const christmas = () => isEventActive('christmas', today());

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
      <div class="special-upgrade-cost">${owned ? '✔ Owned' : money(perkCost(state, p))}</div>
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
    if (!btn) continue;
    const owned = hasPerk(state, p.id);
    const cost = perkCost(state, p);
    btn.classList.toggle('disabled', owned || state.score < cost);
    const price = btn.querySelector('.special-upgrade-cost');
    if (price && !owned) price.textContent = money(cost); // challenge inflation moves prices
  }
  for (const u of UPGRADES) {
    const btn = document.getElementById(`btn-${u.id}`);
    if (!btn) continue;
    const banned = bannedReason(state, u);
    const { count, cost } = purchaseQuote(state, u);
    btn.classList.toggle('disabled', !!banned || state.score < cost);
    btn.classList.toggle('banned', !!banned);
    const price = btn.querySelector('.item-cost');
    if (price) price.textContent = banned ?? (count > 1 ? `×${count} · ${money(cost)}` : money(cost));
  }
  for (const b of els.buyAmount.querySelectorAll<HTMLElement>('button')) {
    b.classList.toggle('active', b.dataset.amount === String(state.buyAmount));
  }
  renderBuffs();

  // Prestige summary, once there's something to show.
  const bonus = Math.round((d.globalMultiplier - 1) * 100);
  els.prestige.hidden = !!state.activeChallenge || (state.cities === 0 && state.achievements.length === 0);
  const unspent = citiesAvailable(state);
  els.prestige.textContent =
    `🏙️ ${state.cities} Free Private ${state.cities === 1 ? 'City' : 'Cities'}` +
    (unspent && state.charters.length < CHARTERS.length ? ` (${unspent} unspent)` : '') +
    ` · 🏆 ${state.achievements.length}/${ACHIEVEMENTS.length} · +${bonus}% income`;

  const inChallenge = !!state.activeChallenge;
  els.charters.hidden = inChallenge || (state.cities === 0 && state.charters.length === 0);
  // Challenges open up after your first secession.
  els.challenges.hidden = inChallenge || (state.cities === 0 && state.completedChallenges.length === 0);
  els.secede.hidden = inChallenge;
  // Nothing to reshuffle until you own a sticker.
  els.reshuffle.hidden = state.stickers.length === 0;
  renderChallengeBanner();
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

/** Unlocks an achievement the game grants directly (secret or seasonal); no-op if already unlocked. */
function unlockSecret(id: SecretAchievementId | string) {
  const a = grantAchievement(state, id);
  if (!a) return;
  sfx.achievement();
  toast(a.secret ? `🤫 Secret achievement: ${a.icon} ${a.name}` : `${a.icon} Achievement unlocked: ${a.name}`, a.description);
  updateUI();
}

function achievementCard(a: Achievement) {
  const unlocked = state.achievements.includes(a.id);
  const card = el('div', `achievement${unlocked ? '' : ' locked'}${a.secret ? ' secret' : ''}`);
  const hidden = a.secret && !unlocked;
  card.append(
    el('span', 'achievement-icon', unlocked ? a.icon : hidden ? '🤫' : '🔒'),
    el('span', 'achievement-name', hidden ? '???' : a.name),
    el('span', 'achievement-desc', hidden ? `Hint: ${a.hint}` : a.description),
  );
  if (a.secret && unlocked) card.append(el('span', 'achievement-secret-tag', '🤫 Secret'));
  if (unlocked && a.reward) {
    const link = el('a', '', `${a.reward.label} →`);
    link.href = a.reward.href;
    card.append(link);
  }
  return card;
}

function showAchievements() {
  const body = el('div');
  const pct = Math.round((derive(state).achievementMultiplier - 1) * 100);
  const secrets = ACHIEVEMENTS.filter((a) => a.secret);
  const regular = ACHIEVEMENTS.length - secrets.length;
  const has = (a: Achievement) => state.achievements.includes(a.id);
  body.append(
    el(
      'p',
      'achievement-summary',
      `${ACHIEVEMENTS.filter((a) => !a.secret && has(a)).length} / ${regular} unlocked · ` +
        `🤫 ${secrets.filter(has).length} / ${secrets.length} secret · +${pct}% income`,
    ),
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
  (els.modalBody.parentElement as HTMLElement).style.width = '';
  // Show the next queued dialog (e.g. the event popup after "Welcome back!").
  const next = modalQueue.shift();
  if (next) next();
}

const modalQueue: (() => void)[] = [];

/** Opens a dialog now, or right after the one that's open. */
function queueModal(show: () => void) {
  if (isModalOpen()) modalQueue.push(show);
  else show();
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
    `You own ${state.stickers.length} stickers: +${pct(bonus)} income/sec. ` +
    `Each one adds +${pct(BALANCE.stickers.bonusEach)}, and every purchase makes the next one pricier.`
  );
}

/** Tabs to show: limited-edition tabs only while on sale, or once you own one. */
function visibleCategories() {
  return STICKER_CATEGORIES.filter((c) => {
    const inCat = STICKERS.filter((s) => s.category === c.id);
    const seasonal = inCat.some((s) => s.season);
    return !seasonal || inCat.some((s) => stickerForSale(s.id, today()) || hasSticker(state, s.id));
  });
}

/** Price label for a sticker card. */
function stickerPriceLabel(id: string) {
  if (!stickerForSale(id, today())) return '🎄 Christmas only';
  return `Buy · ${money(priceOfSticker(state, id))}`;
}

function renderStickerShop(): HTMLElement {
  const tab = shopTab ?? 'quote';
  const body = el('div', 'sticker-shop');

  body.append(el('p', 'fine-print sticker-summary', shopSummary()));

  const next = el('div', 'big-number sticker-next', `Next sticker: ${money(stickerCost(state))}`);
  body.append(next);
  if (tab === 'christmas') {
    body.append(
      el('p', 'fine-print sticker-summary', 'Limited edition: on sale only during the Christmas event, priced at 10 minutes of your income, and kept forever (even after seceding).'),
    );
  }

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
  for (const c of visibleCategories()) {
    const inCat = STICKERS.filter((s) => s.category === c.id);
    const owned = inCat.filter((s) => hasSticker(state, s.id)).length;
    const done = owned === inCat.length;
    const btn = el(
      'button',
      `sticker-tab${c.id === tab ? ' active' : ''}${done ? ' complete' : ''}`,
      `${c.label} ${done ? '✔' : `${owned}/${inCat.length}`}`,
    );
    btn.addEventListener('click', () => {
      shopTab = c.id;
      els.modalBody.replaceChildren(renderStickerShop());
    });
    tabs.append(btn);
  }
  body.append(tabs);

  const set = STICKER_SETS.find((x) => x.category === tab);
  if (set) {
    const inCat = STICKERS.filter((s) => s.category === tab);
    const left = inCat.filter((s) => !hasSticker(state, s.id)).length;
    const banner = el('div', `sticker-set${left ? '' : ' complete'}`);
    banner.append(
      el('span', 'sticker-set-name', `${set.icon} Set bonus: ${set.name}`),
      el('span', 'sticker-set-desc', set.description),
      el('span', 'sticker-set-status', left ? `${left} to go` : '✔ Active'),
    );
    body.append(banner);
  }

  const grid = el('div', 'sticker-grid');
  for (const s of STICKERS.filter((x) => x.category === tab)) {
    const owned = hasSticker(state, s.id);
    const card = el('button', `sticker-card${owned ? ' owned' : ''}`);
    const label = STICKER_LABELS[s.id];
    card.title = label ? [label.name, label.note].filter(Boolean).join(': ') : s.content;
    card.dataset.id = s.id;
    card.append(stickerPreview(s.id));
    if (label) {
      const caption = el('span', 'sticker-caption');
      caption.append(el('span', 'sticker-name', label.name));
      if (label.note) caption.append(el('span', 'sticker-note', label.note));
      card.append(caption);
    }
    card.append(el('span', 'sticker-price', owned ? '✔ Owned' : stickerPriceLabel(s.id)));
    if (owned || !stickerForSale(s.id, today())) {
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
    const id = card.dataset.id!;
    card.classList.toggle('disabled', state.score < priceOfSticker(state, id));
    const price = card.querySelector('.sticker-price');
    if (price) price.textContent = stickerPriceLabel(id);
  });
}

function showStickerShop() {
  shopTab ??= 'quote';
  openModal('🎨 Sticker Shop', renderStickerShop(), [{ label: 'Done' }]);
  updateShopPrices();
}

function onBuySticker(id: string) {
  const firstPurchase = state.stickers.length === 0;
  const setsBefore = completedStickerSets(state).length;
  if (!buySticker(state, id, today())) return;
  const newSet = completedStickerSets(state).length > setsBefore
    ? STICKER_SETS.find((x) => x.category === STICKERS.find((s) => s.id === id)?.category)
    : undefined;
  if (newSet) {
    toast(`${newSet.icon} Set complete: ${newSet.name}`, newSet.description);
    sfx.perk();
  }
  if (firstPurchase && id === 'flag-eu-cross') unlockSecret('brussels-effect');
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
  openModal('📊 Stats', renderStats(), [{ label: '💾 Save / Load', secondary: true, onClick: showSaveData }, { label: 'Close' }]);
  statsOpen = true;
}

// ---------------------------------------------------------------------------
// Challenge runs
// ---------------------------------------------------------------------------

function renderChallengeBanner() {
  const challenge = challengeOf(state);
  els.challengeBanner.hidden = !challenge;
  document.body.dataset.challenge = challenge?.id ?? '';
  if (!challenge) return;
  const progress = challengeProgress(state);
  const pct = Math.floor(progress * 100);
  els.challengeName.textContent = `${challenge.icon} ${challenge.name}`;
  els.challengeFill.style.width = `${progress * 100}%`;
  els.challengeProgress.setAttribute('aria-valuenow', String(pct));
  const tax = derive(state).taxRate;
  els.challengeDetails.textContent =
    `${money(state.runEarnings)} / ${money(challenge.goal)} earned (${pct}%) · ⏱️ ${formatPlaytime(state.stats.runSeconds)}` +
    (tax ? ` · Taxes: ${Math.round(tax * 100)}%` : '');
}

function challengeCard(c: Challenge) {
  const won = state.completedChallenges.includes(c.id);
  const best = state.bestChallengeTimes[c.id];
  const card = el('div', `challenge-card${won ? ' won' : ''}`);
  card.append(el('span', 'challenge-card-title', `${c.icon} ${c.name}`), el('span', 'challenge-card-tagline', c.tagline));
  const rules = el('ul', 'challenge-card-rules');
  for (const rule of c.ruleText) rules.append(el('li', '', rule));
  card.append(
    rules,
    el('span', 'challenge-card-goal', `🎯 Goal: earn ${money(c.goal)}`),
    el('span', 'challenge-card-reward', `🎁 Reward: ${c.reward}${won ? ' (✔ unlocked)' : ''}`),
  );
  if (best !== undefined) card.append(el('span', 'challenge-card-best', `🏆 Best time: ${formatPlaytime(best)}`));
  const start = el('button', 'btn-reshuffle', won ? 'Play again' : 'Start challenge');
  start.addEventListener('click', () => confirmStartChallenge(c.id));
  card.append(start);
  return card;
}

function showChallenges() {
  const body = el('div', 'challenge-shop');
  body.append(
    paragraph(
      'Try running your empire under a different system. Your empire is saved and paused while you play; ' +
        'cities, charters and achievement bonuses are switched off. Win to unlock a permanent perk. ' +
        'You can abandon a challenge at any time and go straight back.',
      'fine-print',
    ),
  );
  const grid = el('div', 'challenge-grid');
  grid.append(...CHALLENGES.map(challengeCard));
  body.append(grid);
  openModal('🏁 Challenges', body, [{ label: 'Not today' }]);
}

function confirmStartChallenge(id: ChallengeId) {
  const c = challengeById(id);
  confirmDialog(
    `${c.icon} Start ${c.name}?`,
    `Your empire will be saved and paused until you win or abandon the challenge. Goal: earn ${money(c.goal)}.`,
    'Start',
    'Cancel',
    () => {
      const run = enterChallenge(state, id);
      if (!run) return;
      replaceState(run);
      toast(`${c.icon} ${c.name}`, c.tagline);
      sfx.raid();
    },
  );
}

function confirmAbandonChallenge() {
  const c = challengeOf(state);
  if (!c) return;
  confirmDialog(
    'Abandon the challenge?',
    `You'll go back to your empire exactly as you left it. Progress in ${c.name} will be lost.`,
    'Abandon',
    'Keep going',
    () => {
      replaceState(leaveChallenge(state));
      toast('🏃 Challenge abandoned', 'Back to the free market.');
    },
  );
}

function finishChallenge(win: ChallengeWin) {
  replaceState(leaveChallenge(state));
  sfx.secede();
  const body = el('div');
  body.append(
    paragraph(`You beat ${win.challenge.name} in`),
    el('div', 'big-number', formatPlaytime(win.seconds)),
    paragraph(win.newBest && !win.firstWin ? '🏆 A new best time!' : win.firstWin ? `🎁 Unlocked for good: ${win.challenge.reward}.` : ''),
  );
  if (win.achievements.length) {
    const list = el('ul', 'challenge-win-achievements');
    for (const a of win.achievements) list.append(el('li', '', `${a.icon} ${a.name}`));
    body.append(paragraph('Achievements unlocked:', 'fine-print'), list);
  }
  body.append(paragraph('Welcome back to your empire. It waited for you.', 'fine-print'));
  openModal(`${win.challenge.icon} Challenge won!`, body, [{ label: 'Back to my empire' }]);
}

// ---------------------------------------------------------------------------
// Seasonal events
// ---------------------------------------------------------------------------

/** The event popup: the event's image (the dialog sizes itself to it), message, dates and features. */
function showEventPopup(event: GameEvent) {
  const { popup } = event;
  const body = el('div', 'event-popup');
  if (popup.image) {
    const img = el('img', 'event-popup-image');
    img.src = popup.image;
    img.alt = popup.imageAlt ?? '';
    // Fit the dialog to the picture: its width, unless that won't fit on screen.
    const fit = () => {
      if (!img.naturalWidth) return;
      const maxH = window.innerHeight * 0.55;
      const shown = Math.min(img.naturalWidth, (img.naturalWidth * maxH) / img.naturalHeight);
      (els.modalBody.parentElement as HTMLElement).style.width = `min(${Math.round(shown) + 48}px, 100%)`;
    };
    if (img.complete) fit();
    else img.addEventListener('load', fit, { once: true });
    body.append(img);
  }
  body.append(el('p', 'event-popup-message', popup.message), el('p', 'event-popup-when', popup.when));
  const list = el('ul', 'event-popup-features');
  for (const f of popup.features) list.append(el('li', '', f));
  body.append(list);
  openModal(popup.title, body, [{ label: "Let's go!" }]);
}

/** Shows each running event's popup the first time the game is opened that season. */
function greetEvents() {
  const date = today();
  for (const event of eventsOn(date)) {
    const key = seasonKey(event, date);
    if (state.seenEvents.includes(key)) continue;
    state.seenEvents.push(key);
    queueModal(() => showEventPopup(event));
  }
  updateEventDecor();
}

/** Seasonal looks and the event chip, plus achievements for being here on the day. */
function updateEventDecor() {
  const date = today();
  const running = eventsOn(date);
  const isChristmas = running.some((e) => e.id === 'christmas');
  document.body.classList.toggle('christmas', isChristmas);
  els.santaHat.hidden = !isChristmas;
  if (isChristmas && !document.querySelector('.snow')) letItSnow();
  if (!isChristmas) document.querySelector('.snow')?.remove();

  els.eventChip.hidden = running.length === 0;
  els.eventChip.textContent = running.map((e) => `${e.icon} ${e.name}`).join(' · ');

  if (isChristmas) unlockSecret('murray-christmas');
  if (date.getMonth() === 0 && date.getDate() === 1) unlockSecret('hoppe-new-year');
}

/** Gentle CSS snowfall behind the game (skipped for reduced motion). */
function letItSnow() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const snow = el('div', 'snow');
  snow.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 40; i++) {
    const flake = el('span', 'snowflake', Math.random() < 0.5 ? '❄' : '•');
    flake.style.left = `${Math.random() * 100}%`;
    flake.style.fontSize = `${8 + Math.random() * 14}px`;
    flake.style.animationDuration = `${8 + Math.random() * 10}s`;
    flake.style.animationDelay = `${-Math.random() * 18}s`;
    flake.style.opacity = String(0.4 + Math.random() * 0.5);
    snow.append(flake);
  }
  document.body.append(snow);
}

// ---------------------------------------------------------------------------
// Save data: export, import, start over
// ---------------------------------------------------------------------------

/** Swaps in a whole new game state (loaded code or fresh start) and redraws everything. */
function replaceState(next: GameState) {
  state = next;
  raidActive = false;
  els.raid.style.display = 'none';
  if (!state.stats.firstPlayed) state.stats.firstPlayed = Date.now();
  lastClickAt = Date.now();
  updateSoundButton();
  renderShop();
  renderPerks();
  showStickers();
  save();
  refresh();
}

function confirmDialog(title: string, text: string, yes: string, no: string, onYes: () => void) {
  openModal(title, paragraph(text), [{ label: no, secondary: true }, { label: yes, onClick: onYes }]);
}

function showSaveData() {
  const body = el('div', 'save-data');

  body.append(
    el('h3', '', '📤 Your save code'),
    paragraph('Copy this and keep it somewhere safe, or paste it into the game on another browser or device.', 'fine-print'),
  );
  const out = el('textarea', 'save-code');
  out.readOnly = true;
  out.rows = 4;
  out.value = exportSave(state);
  out.addEventListener('focus', () => out.select());
  const copy = el('button', 'btn-reshuffle', '📋 Copy code');
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(out.value);
      copy.textContent = '✔ Copied!';
    } catch {
      out.focus();
      out.select();
      copy.textContent = 'Selected: press Ctrl+C / ⌘C';
    }
  });
  body.append(out, copy);

  body.append(
    el('h3', '', '📥 Load a save code'),
    paragraph('This replaces your current progress with the one in the code.', 'fine-print'),
  );
  const input = el('textarea', 'save-code');
  input.rows = 4;
  input.placeholder = 'Paste a save code here (it starts with ANCAP1:)';
  const error = el('p', 'save-error');
  const load = el('button', 'btn-reshuffle', '📥 Load code');
  load.addEventListener('click', () => {
    const next = importSave(input.value);
    if (!next) {
      error.textContent = "That doesn't look like an Ancapistan Tycoon save code. Check that you copied all of it.";
      return;
    }
    confirmDialog(
      'Load this save?',
      `It has ${money(next.allTimeEarnings)} earned all-time and ${next.cities} Free Private ${next.cities === 1 ? 'City' : 'Cities'}. ` +
        'Your current progress will be replaced.',
      'Load it',
      'Cancel',
      () => {
        replaceState(next);
        toast('💾 Save loaded', 'Welcome back to your empire.');
      },
    );
  });
  body.append(input, load, error);

  body.append(
    el('h3', '', '🧨 Start over'),
    paragraph('Deletes everything: cash, upgrades, cities, charters, achievements and stats. Copy your save code first if you might want it back.', 'fine-print'),
  );
  const reset = el('button', 'btn-reshuffle btn-danger', 'Delete my progress…');
  reset.addEventListener('click', () =>
    confirmDialog(
      'Delete everything?',
      'Your whole empire will be gone for good, unless you saved your code.',
      'Delete everything',
      'Keep my empire',
      () => {
        clearSave();
        replaceState(newState());
        toast('🧨 Fresh start', 'Back to square one. Taxation is still theft.');
      },
    ),
  );
  body.append(reset);

  openModal('💾 Save data', body, [{ label: 'Done' }]);
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
  const delay = (minDelaySec + Math.random() * (maxDelaySec - minDelaySec)) * 1000 * goldenDelayMultiplier(state, today());
  setTimeout(spawnGolden, delay);
}

/** Drops a glowing golden sticker somewhere on screen. Catch it before it fades. */
function spawnGolden() {
  if (raidActive || document.hidden) {
    scheduleGolden();
    return;
  }
  const present = christmas();
  const pool = state.stickers.length ? state.stickers : STICKERS.map((s) => s.id);
  const btn = el('button', `golden-sticker${present ? ' present' : ''}`);
  btn.setAttribute('aria-label', present ? 'A Christmas present! Click it' : 'Golden sticker! Click it');
  btn.append(present ? stickerPreview('ancap-gift') : stickerPreview(pick(pool)));
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
    const effects = present ? PRESENT_EFFECTS : undefined;
    onCatchGolden(pickGoldenEffect(Math.random(), effects), e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2);
    finish();
  });
  setTimeout(finish, BALANCE.golden.lifetimeSec * 1000);
  document.body.append(btn);
  sfx.goldenAppear();
}

function onCatchGolden(effect: GoldenEffect, x: number, y: number) {
  const cash = catchGolden(state, effect);
  sfx.goldenCatch();
  if (effect.id === 'chainsaw' && els.stickers.querySelector('[data-id="milei"]') && !els.stickers.hidden) {
    unlockSecret('afuera');
  }
  spawnFloater(x, y, cash ? `${effect.icon} +${money(cash)}!` : `${effect.icon} ${effect.name.toUpperCase()}!`, '#c9a100');
  toast(`${effect.icon} ${effect.name}`, cash ? `${effect.description} +${money(cash)}` : effect.description);
  refresh();
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function onClickMain(x: number, y: number) {
  if (raidActive) return;
  lastClickAt = Date.now();
  const { amount, crit, requisitioned } = click(state, Math.random());
  if (requisitioned) {
    spawnFloater(x, y, 'REQUISITIONED! ☭', '#c0392b');
    sfx.click();
    refresh();
    return;
  }
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
  const { count: bought, failed } = buyUpgrade(state, upgrade);
  const { x, y } = center();
  if (failed) {
    spawnFloater(x, y, 'BUSINESS FAILED! Permit denied.', '#c0392b');
    sfx.evade();
    refresh();
    return;
  }
  if (!bought) return;
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
  const broke = state.score < 1;
  const gained = secede(state);
  if (!gained) return;
  if (broke) unlockSecret('exit-liquidity');
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
  checkTimedSecrets();
  const win = checkChallengeWin(state);
  if (win) {
    finishChallenge(win);
    return;
  }
  refresh();
}

/** Secret achievements that depend on time passing, or on the date and hour. */
function checkTimedSecrets() {
  const now = Date.now();
  if (raidActive && now - raidStartedAt >= 60_000) unlockSecret('civil-disobedience');
  if (now - lastClickAt >= 10 * 60_000 && derive(state, now).incomePerSec >= 1e6) unlockSecret('zero-time-preference');
  for (const id of secretDateAchievements(new Date(now))) unlockSecret(id);
}

// Raid Event Logic
function tryRaid() {
  if (raidActive || isModalOpen() || raidsBlocked(state)) return;
  if (state.score >= raidMinScore(state) && Math.random() < raidChance(state, today())) {
    if (Math.random() < derive(state).raidEvasionChance) {
      state.stats.raidsAutoEvaded++;
      spawnFloater(window.innerWidth / 2, 50, 'Raid Evaded!', 'blue');
      sfx.evade();
      refresh();
      return; // Automatically evaded
    }
    raidActive = true;
    raidStartedAt = Date.now();
    const themed = challengeOf(state)?.raid;
    els.raidTitle.textContent = themed?.title ?? '🚨 THE FED IS HERE! 🚨';
    els.raidText.textContent = themed?.text ?? 'They want to audit your crypto wallet!';
    els.raidButton.textContent = themed?.button ?? 'HIDE ASSETS!';
    els.raid.style.display = 'flex';
    sfx.raid();
    // Penalty if ignored: income stops until you hide your assets.
  }
}

function evadeTax() {
  raidActive = false;
  els.raid.style.display = 'none';
  const { x, y } = center();
  const fedBirthday = isEventActive('fed-birthday', today());
  const bonus = raidEvadeBonus(state, today());
  spawnFloater(x, y, fedBirthday ? `🍰 SLICE OF FED CAKE! +${money(bonus)}` : 'TAX EVADED!', 'blue');
  sfx.evade();
  state.stats.raidsEvaded++;
  earn(state, bonus); // Bonus for evasion (a slice of cake on the Fed's birthday)
  if (fedBirthday) unlockSecret('party-pooper');
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
    events: eventsOn(today()).map((e) => e.id),
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

let soundToggles = 0;
let lastSoundToggle = 0;
els.sound.addEventListener('click', () => {
  const now = Date.now();
  soundToggles = now - lastSoundToggle < 2000 ? soundToggles + 1 : 1;
  lastSoundToggle = now;
  if (soundToggles >= 10) unlockSecret('make-up-your-mind');
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
els.challenges.addEventListener('click', showChallenges);
els.eventChip.addEventListener('click', () => {
  for (const event of eventsOn(today())) queueModal(() => showEventPopup(event));
});
byId('btn-abandon').addEventListener('click', confirmAbandonChallenge);
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

enableStickerDragging(els.stickers, (sticker) => {
  state.stats.stickersDragged++;
  if (sticker.dataset.id === 'rothbard') {
    // Stickers ease into place (0.8s), so check once Rothbard has settled.
    setTimeout(() => {
      const mises = els.stickers.querySelector<HTMLElement>('[data-id="mises"]');
      if (mises && overlaps(sticker, mises)) unlockSecret('student-and-teacher');
    }, 900);
  }
  refresh();
});

function overlaps(a: HTMLElement, b: HTMLElement) {
  const r = a.getBoundingClientRect();
  const s = b.getBoundingClientRect();
  return r.left < s.right && r.right > s.left && r.top < s.bottom && r.bottom > s.top;
}

els.newsTrack.addEventListener('click', () => unlockSecret('fine-print'));

let typed = '';
document.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement;
  if (target.matches('input, textarea') || e.key.length !== 1) return;
  typed = (typed + e.key.toLowerCase()).slice(-SECRET_PHRASE.length);
  if (typed === SECRET_PHRASE) unlockSecret('say-it');
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
greetEvents(); // event popups wait until "Welcome back!" is closed
save();

setInterval(gameLoop, 1000);
setInterval(updateEventDecor, 60_000); // events start and end at midnight
setInterval(tryRaid, BALANCE.raid.intervalMs);
setInterval(save, BALANCE.saveIntervalMs);
scheduleGolden();
