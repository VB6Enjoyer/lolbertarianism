import { pick, spawnText } from '../../shared/effects.ts';
import { formatMoney } from '../../shared/format.ts';
import { ACHIEVEMENTS, BALANCE, CLICK_PHRASES, PERKS, UPGRADES, type Achievement } from './data.ts';
import {
  buyPerk,
  buyUpgrade,
  click,
  derive,
  earn,
  earningsForCities,
  hasPerk,
  newState,
  offlineEarnings,
  ownedCount,
  pendingCities,
  secede,
  unlockAchievements,
  upgradeCost,
  type GameState,
} from './logic.ts';
import { loadState, saveState } from './save.ts';
import { enableStickerDragging, spawnStickers } from './stickers.ts';

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const els = {
  score: byId('score'),
  income: byId('income'),
  prestige: byId('prestige-line'),
  mainBtn: byId('main-btn'),
  shop: byId('shop-list'),
  perks: byId('special-upgrades-container'),
  stickers: byId('sticker-container'),
  raid: byId('raid-overlay'),
  secede: byId<HTMLButtonElement>('btn-secede'),
  modal: byId('modal'),
  modalTitle: byId('modal-title'),
  modalBody: byId('modal-body'),
  modalActions: byId('modal-actions'),
  toasts: byId('toasts'),
};

let state: GameState = loadState() ?? newState();
let raidActive = false;

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
        <span class="item-cost">${money(upgradeCost(u, ownedCount(state, u.id)))}</span>
      </div>
      <div style="font-size:0.8em; color:#666;">
        ${u.type === 'passive' ? '+' + u.income + '/s' : '+' + u.clickBonus + '/click'}
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
    btn?.classList.toggle('disabled', state.score < upgradeCost(u, ownedCount(state, u.id)));
  }

  // Prestige summary, once there's something to show.
  const bonus = Math.round((d.globalMultiplier - 1) * 100);
  els.prestige.hidden = state.cities === 0 && state.achievements.length === 0;
  els.prestige.textContent =
    `🏙️ ${state.cities} Free Private ${state.cities === 1 ? 'City' : 'Cities'} · ` +
    `🏆 ${state.achievements.length}/${ACHIEVEMENTS.length} · +${bonus}% income`;

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
  (els.modalActions.lastElementChild as HTMLElement | null)?.focus();
}

function closeModal() {
  els.modal.hidden = true;
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
      `You leave behind your ${money(state.score)}, every upgrade and every special upgrade. ` +
        'Your cities, achievements and lifetime earnings come with you.',
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
  const keptPct = Math.round(BALANCE.offline.rate * 100);
  body.append(
    paragraph(`While you were away (${formatDuration(seconds)}), your enterprises made:`),
    el('div', 'big-number', money(amount)),
    paragraph(
      `You only get ${keptPct}% of your usual income while away: unsupervised employees embezzled the rest. ` +
        `The market will sort them out. (Counts up to ${BALANCE.offline.maxSeconds / 3600} hours.)`,
      'fine-print',
    ),
  );
  openModal('Welcome back!', body, [{ label: 'Collect' }]);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function onClickMain(x: number, y: number) {
  if (raidActive) return;
  const { amount, crit } = click(state, Math.random());
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
  if (!buyUpgrade(state, upgrade)) return;
  const { x, y } = center();
  spawnFloater(x, y, 'PURCHASED!', 'green');
  renderShop(); // Re-render to update costs
  refresh();
}

function onBuyPerk(id: string) {
  const perk = PERKS.find((p) => p.id === id)!;
  if (!buyPerk(state, perk)) return;
  const { x, y } = center();
  spawnFloater(x, y, 'PERK UNLOCKED!', 'gold');
  renderPerks();
  refresh();
}

function onSecede() {
  const gained = secede(state);
  if (!gained) return;
  saveState(state);
  renderShop();
  renderPerks();
  spawnStickers(els.stickers);
  const { x, y } = center();
  spawnFloater(x, y, `INDEPENDENCE! +${gained} 🏙️`, 'black');
  refresh();
}

function gameLoop() {
  if (!raidActive) earn(state, derive(state).incomePerSec);
  refresh();
}

// Raid Event Logic
function tryRaid() {
  if (raidActive || isModalOpen()) return;
  if (state.score > BALANCE.raid.minScore && Math.random() < BALANCE.raid.chance) {
    if (Math.random() < derive(state).raidEvasionChance) {
      state.stats.raidsAutoEvaded++;
      spawnFloater(window.innerWidth / 2, 50, 'Raid Evaded!', 'blue');
      refresh();
      return; // Automatically evaded
    }
    raidActive = true;
    els.raid.style.display = 'flex';
    // Penalty if ignored: income stops until you hide your assets.
  }
}

function evadeTax() {
  raidActive = false;
  els.raid.style.display = 'none';
  const { x, y } = center();
  spawnFloater(x, y, 'TAX EVADED!', 'blue');
  state.stats.raidsEvaded++;
  earn(state, BALANCE.raid.evadeBonus); // Bonus for evasion
  refresh();
}

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
  spawnStickers(els.stickers);
  state.stats.reshuffles++;
  refresh();
});
byId('btn-achievements').addEventListener('click', showAchievements);
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

const away = offlineEarnings(state, Date.now());
if (away.amount > 0) {
  earn(state, away.amount);
  state.stats.offlineCollected++;
}

renderShop();
renderPerks();
spawnStickers(els.stickers);
refresh(); // Show loaded progress right away
save(); // Stamp the time now, so a quick reload can't collect offline earnings twice

if (away.amount > 0) showWelcomeBack(away.seconds, away.amount);

setInterval(gameLoop, 1000);
setInterval(tryRaid, BALANCE.raid.intervalMs);
setInterval(save, BALANCE.saveIntervalMs);
