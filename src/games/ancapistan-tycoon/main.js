import { spawnText } from '../../shared/effects.ts';
import { formatNumber } from '../../shared/format.ts';
import { createSaveSlot } from '../../shared/storage.ts';

// Saves live under "lolbertarianism:ancapistan-tycoon"; old "ancapTycoonSave" saves are picked up automatically.
const saveSlot = createSaveSlot({ game: 'ancapistan-tycoon', version: 1, legacyKeys: ['ancapTycoonSave'] });

// Game State
let score = 0;
let income = 0;
let clickValue = 1;
let raidActive = false;
let raidTimer = null;

// Perk State
let clickMultiplier = 1;
let critChance = 0;
let passiveMultiplier = 1;
let incomeToClickPercent = 0;
let raidEvasionChance = 0;


// Upgrades Configuration
const upgrades = [
    { id: 1, name: "Buy theory book", icon: "📙", cost: 15, income: 0, clickBonus: 1, type: "click", lore: "It all starts with an idea. Read the sacred texts." },
    { id: 2, name: "Unlicensed lemonade stand", icon: "🍋", cost: 25, income: 1, clickBonus: 0, type: "passive", lore: "Where 6-year-olds learn the state is the enemy." },
    { id: 3, name: "Buy AK-47", icon: "<img src='img/ak47.webp'>", cost: 800, income: 0, clickBonus: 5, type: "click", lore: "An armed society is a polite society. And a profitable one." },
    { id: 4, name: "Raw milk smuggling ring", icon: "🥛", cost: 2000, income: 10, clickBonus: 0, type: "passive", lore: "The FDA can't stop the signal. Or the delicious, unpasteurized profits." },
    { id: 5, name: "Homestead empty land", icon: "🏡", cost: 5000, income: 0, clickBonus: 10, type: "click", lore: "If you mix your labor with it, it's yours. John Locke said so." },
    { id: 6, name: "Overseas crypto farm", icon: "🪙", cost: 10000, income: 25, type: "passive", lore: "Somewhere off in South East Asia. Untraceable, unseizable, and unstoppable. The perfect asset for a free individual." },
    { id: 7, name: "Invoke the invisible hand", icon: "🖐️", cost: 50000, income: 0, clickBonus: 50, type: "click", lore: "Adam Smith's ghost now guides your clicking finger towards maximum efficiency." },
    { id: 8, name: "Privatize roads", icon: "🚧", cost: 200000, income: 100, clickBonus: 0, type: "passive", lore: "Who will build the roads? You will. And you'll charge a toll." },
    { id: 9, name: "Hire PMC", icon: "🪖", cost: 500000, income: 0, clickBonus: 100, type: "click", lore: "Make your life easier and enforce the NAP through a Private Military Contractor." },
    { id: 10, name: "Seasteading platform", icon: "🌊", cost: 1000000, income: 500, clickBonus: 0, type: "passive", lore: "Escape the clutches of terrestrial governments by building your own nation on the high seas." },
    { id: 11, name: "Recreational McNuke silo", icon: "☢️", cost: 10000000, income: 0, clickBonus: 500, type: "click", lore: "For defending your property against particularly aggressive trespassers. Or just for fun." },
    { id: 12, name: "Homestead the moon", icon: "🌑", cost: 75000000, income: 1000, clickBonus: 0, type: "passive", lore: "One small step for man, one giant leap for private property." },
    { id: 13, name: "Interplanetary drug smuggling", icon: "💊", cost: 250000000, income: 0, clickBonus: 1000, type: "click", lore: "The war on drugs doesn't apply in zero gravity." },
    { id: 14, name: "Privatize solar system", icon: "🌌", cost: 1000000000, income: 10000, clickBonus: 0, type: "passive", lore: "Why stop at one planet? It's all un-homesteaded real estate." },
];

const specialUpgrades = [
    { id: 'su1', name: "Austrian Knowledge", icon: "🧠", cost: 250000, effect: 'crit', value: 0.05, purchased: false, description: "5% chance for a Critical Click (x5 value)!", lore: "You understand that value is subjective, but crits are objectively awesome." },
    { id: 'su2', name: "Golden Standard", icon: "🪙", cost: 1000000, effect: 'click_multiplier', value: 2, purchased: false, description: "Doubles the value of each click!", lore: "Return to sound money. Every dollar you make is now backed by pure, unadulterated value." },
    { id: 'su3', name: "Praxeology", icon: "📈", cost: 5000000, effect: 'crit', value: 0.10, purchased: false, description: "Increases Critical Click chance by 10%!", lore: "The study of human action leads you to one conclusion: act to get more critical clicks." },
    { id: 'su4', name: "Capital Accumulation", icon: "🏭", cost: 15000000, effect: 'passive_multiplier', value: 1.5, purchased: false, description: "Increases all passive income by 50%!", lore: "Your capital is no longer just working, it's putting in overtime. The compounding returns of liberty." },
    { id: 'su5', name: "Agorism", icon: "🏴", cost: 50000000, effect: 'income_to_click', value: 0.01, purchased: false, description: "Adds 1% of your income-per-second to your click value.", lore: "Engage in counter-economics. Every part of your enterprise now fuels your direct action." },
    { id: 'su6', name: "Shell Companies", icon: "🏢", cost: 100000000, effect: 'raid_evasion', value: 0.5, purchased: false, description: "Gain a 50% chance to automatically evade Fed raids.", lore: "A labyrinth of paperwork and legal entities makes you a ghost to the State." }
];

// Collage Content for Background
const stickersData = [
    // Quotes
    { type: 'text', category: "quote", content: "Taxation is theft!", },
    { type: 'text', category: "quote", content: "End! The! Fed!" },
    { type: 'text', category: "quote", content: "Free Market Enjoyer" },
    { type: 'text', category: "quote", content: "RESPECT THE NAP!" },
    { type: 'text', category: "quote", content: "Neo-Feudalist Bootlicker" },
    { type: 'text', category: "quote", content: "Agorism Now!" },
    { type: 'text', category: "quote", content: "Buy crypto!" },
    { type: 'text', category: "quote", content: "Commies want to take my stuff!" },
    { type: 'text', category: "quote", content: "Return to sound money!" },
    { type: 'text', category: "quote", content: "No free lunch!!!" },
    { type: 'text', category: "quote", content: "DO NOT TREAD" },
    { type: 'text', category: "quote", content: "Live and let live" },
    { type: 'text', category: "quote", content: "I love my M249 and my weed farm" },
    { type: 'text', category: "quote", content: "End the drug war!" },
    { type: 'text', category: "quote", content: "I would privatize the sun" },
    { type: 'text', category: "quote", content: "Rothbard my beloved ❤️" },
    { type: 'text', category: "quote", content: "FUERA!" },
    { type: 'text', category: "quote", content: "¡VIVA LA LIBERTAD CARAJO!" },
    { type: 'text', category: "quote", content: "🇿🇿" },
    { type: 'text', category: "quote", content: "Ancapistan in my head" },
    { type: 'text', category: "quote", content: "So to speak" },
    { type: 'text', category: "quote", content: "Abolish IP" },
    { type: 'text', category: "quote", content: "ACAB" },
    { type: 'text', category: "quote", content: "1000 🇱🇮" },
    { type: 'text', category: "quote", content: "Support piracy!" },
    { type: 'text', category: "quote", content: "Tu ne cede malis sed contra audentior ito" },
    { type: 'text', category: "quote", content: "The best government is no government at all" },
    { type: 'text', category: "quote", content: "Why not try freedom?" },
    // Emotes
    { type: 'emoji', category: "emoji", content: "🐍" }, // Gadsden
    { type: 'emoji', category: "emoji", content: "💉" },
    { type: 'emoji', category: "emoji", content: "📉" },
    { type: 'emoji', category: "emoji", content: "📈" },
    { type: 'emoji', category: "emoji", content: "🚁" }, // Pinochet helicopter
    { type: 'emoji', category: "emoji", content: "💰" }, // Money bag
    { type: 'emoji', category: "emoji", content: "🦔" }, // Libertarian Porcupine
    { type: 'emoji', category: "emoji", content: "🪙" }, // Sound money/gold
    { type: 'emoji', category: "emoji", content: "🇱🇮" },
    { type: 'emoji', category: "emoji", content: "☢️" },
    { type: 'emoji', category: "emoji", content: "🏴‍☠️" },
    { type: 'emoji', category: "emoji", content: "🗽" },
    { type: 'emoji', category: "emoji", content: "💊" },
    // HTML
    { type: 'html', category: "html", content: '<div class="flag-ancap"></div>' },
    { type: 'html', category: "html", content: '<div class="flag-eu-cross">🇪🇺</div>' },
    // People
    { type: 'image', category: "person", content: 'img/rothbard.webp' },
    { type: 'image', category: "person", content: 'img/hoppe.webp' },
    { type: 'image', category: "person", content: 'img/mises.webp' },
    { type: 'image', category: "person", content: 'img/kinsella.webp' },
    { type: 'image', category: "person", content: 'img/tucker.webp' },
    { type: 'image', category: "person", content: 'img/hayek.webp' },
    { type: 'image', category: "person", content: 'img/ronpaul.webp' },
    { type: 'image', category: "person", content: 'img/menger.webp' },
    { type: 'image', category: "person", content: 'img/bohmbawerk.webp' },
    { type: 'image', category: "person", content: 'img/hazlitt.webp' },
    { type: 'image', category: "person", content: 'img/murphy.webp' },
    { type: 'image', category: "person", content: 'img/kirzner.webp' },
    { type: 'image', category: "person", content: 'img/gordon.webp' },
    { type: 'image', category: "person", content: 'img/lewrockwell.webp' },
    { type: 'image', category: "person", content: 'img/caplan.webp' },
    { type: 'image', category: "person", content: 'img/salerno.webp' },
    { type: 'image', category: "person", content: 'img/woods.webp' },
    { type: 'image', category: "person", content: 'img/block.webp' },
    { type: 'image', category: "person", content: 'img/bylund.webp' },
    { type: 'image', category: "person", content: 'img/nock.webp' },
    { type: 'image', category: "person", content: 'img/hansen.webp' },
    { type: 'image', category: "person", content: 'img/dfriedman.webp' },
    { type: 'image', category: "person", content: 'img/deist.webp' },
    { type: 'image', category: "person", content: 'img/hulsmann.webp' },
    { type: 'image', category: "person", content: 'img/ammous.webp' },
    { type: 'image', category: "person", content: 'img/dilorenzo.webp' },
    { type: 'image', category: "person", content: 'img/bagus.webp' },
    { type: 'image', category: "person", content: 'img/jhs.webp' },
    { type: 'image', category: "person", content: 'img/milei.webp' },
    // Organizations 
    { type: 'image', category: "organization", content: 'img/misesinstitute.webp' },
    { type: 'image', category: "organization", content: 'img/liberland.webp' },
    // Items
    { type: 'image', category: "item", content: 'img/pistol.webp' },
    { type: 'image', category: "item", content: 'img/m249.webp' },
    { type: 'image', category: "item", content: 'img/ak47.webp' },
];

// Initialize
window.onload = function () {
    // Initialize upgrades with owned count and base cost
    upgrades.forEach(u => {
        u.baseCost = u.cost;
        u.owned = 0;
    });

    loadGame(); // Load progress before rendering

    renderShop();
    renderSpecialUpgrades();
    spawnStickers();
    setInterval(gameLoop, 1000);
    setInterval(tryRaid, 30000); // Chance of raid every 30s
    setInterval(saveGame, 5000); // Save progress every 5 seconds
};

// Core Game Logic
function clickMain() {
    if (raidActive) return;

    let baseClick = clickValue + (income * incomeToClickPercent);
    let currentClickValue = baseClick * clickMultiplier;
    let isCrit = Math.random() < critChance;

    if (isCrit) {
        currentClickValue *= 5; // 5x value on crit
        spawnFloater(event.clientX, event.clientY, `CRIT! +$${formatNumber(currentClickValue)}`, "orange");
    } else {
        spawnFloater(event.clientX, event.clientY, `+$${formatNumber(currentClickValue)}`);
    }
    addScore(currentClickValue);

    // Random chance for meme text
    if (Math.random() < 0.1) {
        const phrases = ["Freedom!", "My Property!", "Based", "No Step!"];
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        setTimeout(() => spawnFloater(event.clientX + (Math.random() * 40 - 20), event.clientY - 40, phrase, "black"), 100);
    }
}

function addScore(amount) {
    score += amount;
    updateUI();
}

function gameLoop() {
    if (!raidActive) {
        score += (income * passiveMultiplier);
        updateUI();
    }
}

function updateUI() {
    document.getElementById('score').innerText = formatNumber(Math.floor(score));
    document.getElementById('income').innerText = formatNumber(income * passiveMultiplier);

    // Update special upgrade buttons
    specialUpgrades.forEach(su => {
        const btn = document.getElementById(`btn-${su.id}`);
        if (btn) {
            if (score >= su.cost && !su.purchased) {
                btn.classList.remove('disabled');
            } else {
                btn.classList.add('disabled');
            }
        }
    });

    // Update shop buttons availability
    upgrades.forEach(u => {
        const btn = document.getElementById(`btn-${u.id}`);
        if (btn) {
            if (score >= u.cost) {
                btn.classList.remove('disabled');
            } else {
                btn.classList.add('disabled');
            }
        }
    });
}

// Shop Logic
function renderShop() {
    const container = document.getElementById('shop-list');
    container.innerHTML = "";
    upgrades.forEach(u => {
        const div = document.createElement('div');
        div.className = "shop-item disabled";
        div.id = `btn-${u.id}`;
        div.onclick = () => buyUpgrade(u);
        div.title = u.lore || '';
        div.innerHTML = `
            <div class="item-icon">${u.icon}</div>
            <div class="item-info">
                <span class="item-name">${u.name}</span>
                <span class="item-cost">$${formatNumber(u.cost)}</span>
            </div>
            <div style="font-size:0.8em; color:#666;">
                ${u.type === 'passive' ? '+' + u.income + '/s' : '+' + u.clickBonus + '/click'}
            </div>
        `;
        container.appendChild(div);
    });
}

function buyUpgrade(item) {
    if (score >= item.cost) {
        score -= item.cost;
        item.owned++;

        const growthFactor = 1.15;
        item.cost = Math.ceil(item.baseCost * Math.pow(growthFactor, item.owned));

        if (item.type === 'passive') {
            income += item.income;
        } else {
            clickValue += item.clickBonus;
        }

        spawnFloater(window.innerWidth / 2, window.innerHeight / 2, "PURCHASED!", "green");
        renderShop(); // Re-render to update costs
        updateUI();
    }
}

function renderSpecialUpgrades() {
    const container = document.getElementById('special-upgrades-container');
    container.innerHTML = "";
    specialUpgrades.forEach(su => {
        const div = document.createElement('div');
        div.className = "special-upgrade disabled";
        if (su.purchased) {
            div.classList.add('disabled');
        }
        div.id = `btn-${su.id}`;
        div.onclick = () => buySpecialUpgrade(su);
        div.title = `${su.description}\n\n${su.lore}`;
        div.innerHTML = `
            <div class="special-upgrade-icon">${su.icon}</div>
            <div class="special-upgrade-name">${su.name}</div>
            <div class="special-upgrade-cost">$${formatNumber(su.cost)}</div>
        `;
        container.appendChild(div);
    });
}

function buySpecialUpgrade(item) {
    if (score >= item.cost && !item.purchased) {
        score -= item.cost;
        item.purchased = true;

        if (item.effect === 'crit') {
            critChance += item.value;
        } else if (item.effect === 'click_multiplier') {
            clickMultiplier *= item.value;
        } else if (item.effect === 'passive_multiplier') {
            passiveMultiplier *= item.value;
        } else if (item.effect === 'income_to_click') {
            incomeToClickPercent += item.value;
        } else if (item.effect === 'raid_evasion') {
            raidEvasionChance += item.value;
        }

        spawnFloater(window.innerWidth / 2, window.innerHeight / 2, "PERK UNLOCKED!", "gold");
        renderSpecialUpgrades();
        updateUI();
    }
}

// Save and Load Logic
function saveGame() {
    const saveData = {
        score: score,
        upgrades: upgrades.map(u => ({ id: u.id, owned: u.owned })),
        specialUpgrades: specialUpgrades.map(su => ({ id: su.id, purchased: su.purchased }))
    };
    saveSlot.save(saveData);
    console.log("Game Saved!");
}

function loadGame() {
    const data = saveSlot.load();
    if (data) {

        score = data.score || 0;

        // Reset derived stats before recalculating
        income = 0;
        clickValue = 1;
        clickMultiplier = 1;
        critChance = 0;
        passiveMultiplier = 1;
        incomeToClickPercent = 0;
        raidEvasionChance = 0;

        // Load regular upgrades
        if (data.upgrades) {
            data.upgrades.forEach(savedUpgrade => {
                const gameUpgrade = upgrades.find(u => u.id === savedUpgrade.id);
                if (gameUpgrade) {
                    gameUpgrade.owned = savedUpgrade.owned;
                    for (let i = 0; i < gameUpgrade.owned; i++) {
                        if (gameUpgrade.type === 'passive') income += gameUpgrade.income;
                        else clickValue += gameUpgrade.clickBonus;
                    }
                    const growthFactor = 1.15;
                    gameUpgrade.cost = Math.ceil(gameUpgrade.baseCost * Math.pow(growthFactor, gameUpgrade.owned));
                }
            });
        }

        // Load special upgrades and apply their effects
        if (data.specialUpgrades) {
            data.specialUpgrades.forEach(savedSpecial => {
                const gameSpecial = specialUpgrades.find(su => su.id === savedSpecial.id);
                if (gameSpecial && savedSpecial.purchased) {
                    gameSpecial.purchased = true;
                    // Apply effects directly
                    if (gameSpecial.effect === 'crit') critChance += gameSpecial.value;
                    else if (gameSpecial.effect === 'click_multiplier') clickMultiplier *= gameSpecial.value;
                    else if (gameSpecial.effect === 'passive_multiplier') passiveMultiplier *= gameSpecial.value;
                    else if (gameSpecial.effect === 'income_to_click') incomeToClickPercent += gameSpecial.value;
                    else if (gameSpecial.effect === 'raid_evasion') raidEvasionChance += gameSpecial.value;
                }
            });
        }
        console.log("Game Loaded!");
    }
}

// Visual Effects
function spawnFloater(x, y, text, color = "#2ecc71") {
    spawnText({ text, className: 'floater', x, y, style: { color } });
}

function reshuffleStickers() {
    const container = document.getElementById('sticker-container');
    container.innerHTML = ''; // Clear existing stickers
    spawnStickers();
}

// Draggable Stickers Logic
function spawnStickers() {
    const container = document.getElementById('sticker-container');
    const stickersToSpawn = [];

    const counts = {
        quote: 7,
        emoji: 7,
        html: 2,
        person: 5,
        organization: 2,
        item: 3
    };

    for (const category in counts) {
        const itemsInCategory = stickersData.filter(s => s.category === category);
        // Shuffle and pick
        const shuffled = itemsInCategory.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, counts[category]);
        stickersToSpawn.push(...selected);
    }

    // Shuffle the final list to mix categories
    stickersToSpawn.sort(() => 0.5 - Math.random());

    stickersToSpawn.forEach((data, index) => {
        const el = document.createElement('div');
        el.className = 'sticker';

        // Calculate final position
        const finalLeft = (Math.random() * (window.innerWidth - 100)) + 'px';
        const finalTop = (Math.random() * (window.innerHeight - 100)) + 'px';

        // Set initial off-screen position
        el.style.left = finalLeft;
        el.style.top = '-200px';

        if (data.type === 'text') {
            el.classList.add('text');
            el.innerText = data.content;
        } else if (data.type === 'emoji') {
            el.classList.add('img-rep');
            el.innerText = data.content;
            el.style.fontSize = (Math.random() * 40 + 30) + 'px';
        } else if (data.type === 'image') {
            el.classList.add('image');
            const img = document.createElement('img');
            img.src = data.content;
            el.appendChild(img);
        } else {
            el.innerHTML = data.content;
        }
        el.style.transform = `rotate(${Math.random() * 40 - 20}deg)`;

        makeDraggable(el);
        container.appendChild(el);

        // Trigger the animation to the final position after a short delay
        setTimeout(() => {
            el.style.top = finalTop;
        }, 50 + index * 20); // Stagger the fall
    });
}

function makeDraggable(el) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    el.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = el.offsetLeft;
        initialTop = el.offsetTop;
        el.style.zIndex = 1000; // Bring to front
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            el.style.left = (initialLeft + dx) + 'px';
            el.style.top = (initialTop + dy) + 'px';
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            el.style.zIndex = 21;
        }
    });
}

// Raid Event Logic
function tryRaid() {
    if (score > 5000 && Math.random() > 0.7) {
        if (Math.random() < raidEvasionChance) {
            spawnFloater(window.innerWidth / 2, 50, "Raid Evaded!", "blue");
            return; // Automatically evaded
        }

        raidActive = true;
        document.getElementById('raid-overlay').style.display = 'flex';
        // Penalty if ignored (simulated by just blocking income)
    }
}

function evadeTax() {
    raidActive = false;
    document.getElementById('raid-overlay').style.display = 'none';
    spawnFloater(window.innerWidth / 2, window.innerHeight / 2, "TAX EVADED!", "blue");
    addScore(100); // Bonus for evasion
}

// Functions called from inline onclick="" attributes in the HTML.
Object.assign(window, { clickMain, reshuffleStickers, evadeTax });
