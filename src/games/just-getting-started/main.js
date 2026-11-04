import { spawnText } from '../../shared/effects.ts';
import { formatCompact as formatNumber } from '../../shared/format.ts';

// Game State
let state = {
    money: 0,
    cps: 0,
    clickPower: 1,
    totalClicks: 0
};

// Configuration
const upgrades = [
    { id: 1, name: "Unpaid Interns", cost: 15, cps: 1, emoji: "📧" },
    { id: 2, name: "Rent Hike", cost: 100, cps: 5, emoji: "🏠" },
    { id: 3, name: "Drop Shipping Course", cost: 500, cps: 20, emoji: "📦" },
    { id: 4, name: "Offshore Accounts", cost: 2000, cps: 50, emoji: "🏝️" },
    { id: 5, name: "AI Replacement", cost: 10000, cps: 150, emoji: "🤖" },
    { id: 6, name: "Lobbying Firm", cost: 50000, cps: 500, emoji: "🤝" },
    { id: 7, name: "Monetize Oxygen", cost: 200000, cps: 1500, emoji: "💨" },
    { id: 8, name: "Mars Colony", cost: 1000000, cps: 5000, emoji: "🚀" }
];

// DOM Elements
const moneyEl = document.getElementById('money');
const cpsEl = document.getElementById('cps');
const shopList = document.getElementById('shop-list');
const bossEl = document.getElementById('boss');
const bodyEl = document.body;
const laserL = document.getElementById('laser-l');
const laserR = document.getElementById('laser-r');
const eyeL = document.getElementById('eye-l');
const eyeR = document.getElementById('eye-r');

// Initialize Shop
function renderShop() {
    shopList.innerHTML = '';
    upgrades.forEach(upg => {
        const item = document.createElement('div');
        item.className = 'upgrade-item';
        item.id = `upg-${upg.id}`;
        item.onclick = () => buyUpgrade(upg);

        item.innerHTML = `
            <div class="upgrade-info">
                <h3>${upg.emoji} ${upg.name}</h3>
                <p>+${upg.cps} CPS</p>
            </div>
            <div class="upgrade-cost">$${formatNumber(upg.cost)}</div>
        `;
        shopList.appendChild(item);
    });
    checkAffordability();
}

// Core Mechanics
function grind(e) {
    // Add money
    state.money += state.clickPower;
    state.totalClicks++;
    updateUI();

    // Visual FX
    createFloater(state.clickPower);
    triggerLasers();

    // Shake effect based on progress
    if (state.money > 1000) {
        const intensity = Math.min(10, Math.floor(state.money / 1000));
        bodyEl.style.transform = `translate(${Math.random()*intensity - intensity/2}px, ${Math.random()*intensity - intensity/2}px)`;
        setTimeout(() => bodyEl.style.transform = 'none', 50);
    }
}

function buyUpgrade(upg) {
    if (state.money >= upg.cost) {
        state.money -= upg.cost;
        state.cps += upg.cps;

        // Price inflation
        upg.cost = Math.floor(upg.cost * 1.3);

        renderShop();
        updateUI();

        // Sound effect placeholder (visual flash)
        document.body.style.backgroundColor = '#300';
        setTimeout(() => document.body.style.backgroundColor = '#000', 50);
    }
}

// Passive Income Loop
setInterval(() => {
    if (state.cps > 0) {
        state.money += state.cps;
        updateUI();
        checkAffordability();
        updateVisualIntensity();
    }
}, 1000);

// Helper Functions
function updateUI() {
    moneyEl.innerText = formatNumber(Math.floor(state.money));
    cpsEl.innerText = formatNumber(state.cps);
    checkAffordability();
}

function checkAffordability() {
    upgrades.forEach(upg => {
        const el = document.getElementById(`upg-${upg.id}`);
        if (state.money >= upg.cost) {
            el.classList.remove('disabled');
        } else {
            el.classList.add('disabled');
        }
        // Update cost text
        el.querySelector('.upgrade-cost').innerText = '$' + formatNumber(upg.cost);
    });
}


function createFloater(amount) {
    // Random position around center
    const rect = bossEl.getBoundingClientRect();
    const x = rect.left + rect.width / 2 + (Math.random() * 100 - 50);
    const y = rect.top + (Math.random() * 50);

    spawnText({ text: `+$${amount}`, className: 'floater', x, y });
}

function triggerLasers() {
    // Flash eyes
    eyeL.style.opacity = 1;
    eyeR.style.opacity = 1;
    eyeL.style.boxShadow = "0 0 20px red, 0 0 50px red";
    eyeR.style.boxShadow = "0 0 20px red, 0 0 50px red";

    // Show lasers briefly
    laserL.style.opacity = 0.8;
    laserR.style.opacity = 0.8;

    setTimeout(() => {
        eyeL.style.opacity = 0.5;
        eyeR.style.opacity = 0.5;
        eyeL.style.boxShadow = "0 0 15px red, 0 0 30px red";
        eyeR.style.boxShadow = "0 0 15px red, 0 0 30px red";
        laserL.style.opacity = 0;
        laserR.style.opacity = 0;
    }, 100);
}

function updateVisualIntensity() {
    // As money goes up, the screen gets more "Deep Fried"
    if (state.money > 1000000) {
        bodyEl.className = 'stage-4 shaking';
    } else if (state.money > 100000) {
        bodyEl.className = 'stage-3';
    } else if (state.money > 10000) {
        bodyEl.className = 'stage-2';
    } else if (state.money > 1000) {
        bodyEl.className = 'stage-1';
    }
}

// Initial Render
renderShop();
updateUI();

// Functions called from inline onclick="" attributes in the HTML.
Object.assign(window, { grind });
