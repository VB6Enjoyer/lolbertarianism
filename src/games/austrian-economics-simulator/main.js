// Game State
const state = {
    cash: 98,
    hasCover: false,
    inventory: {
        assetA: 0,
        assetB: 0
    },
    prices: {
        assetA: 50,
        assetB: 50
    },
    history: {
        assetA: Array(20).fill(50),
        assetB: Array(20).fill(50)
    }
};

// DOM Elements
const elBudget = document.getElementById('budgetDisplay');
const elStatus = document.getElementById('coverStatus');
const elCover = document.getElementById('manholeCover');
const elBtnSteal = document.getElementById('btnSteal');
const elBtnSell = document.getElementById('btnSell');
const elCashBar = document.getElementById('cashBar');
const elPriceA = document.getElementById('priceA');
const elPriceB = document.getElementById('priceB');

// Canvas Setup
const cvsA = document.getElementById('canvasA');
const cvsB = document.getElementById('canvasB');
const ctxA = cvsA.getContext('2d');
const ctxB = cvsB.getContext('2d');

function resizeCanvas() {
    cvsA.width = cvsA.offsetWidth;
    cvsA.height = cvsA.offsetHeight;
    cvsB.width = cvsB.offsetWidth;
    cvsB.height = cvsB.offsetHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Game Logic
function updateUI() {
    elBudget.innerText = Math.floor(state.cash) + "$";

    // Update Manhole UI
    if (state.hasCover) {
        elStatus.innerText = "AVAILABLE";
        elStatus.style.color = "var(--green)";
        elCover.classList.remove('missing');
        elBtnSteal.disabled = true;
        elBtnSell.disabled = false;
    } else {
        elStatus.innerText = "NOT AVAILABLE";
        elStatus.style.color = "var(--red)";
        elCover.classList.add('missing');
        elBtnSteal.disabled = false;
        elBtnSell.disabled = true;
    }

    // Update Bar
    let barHeight = Math.min(100, (state.cash / 200) * 100);
    elCashBar.style.height = barHeight + "%";

    // Update Prices Text
    elPriceA.innerText = state.prices.assetA.toFixed(2);
    elPriceB.innerText = state.prices.assetB.toFixed(2);
}

function stealCover() {
    // "Stealing" costs "Reputation" or just takes effort. 
    // For this sim, let's say it costs 5$ in bribes/tools, 
    // but if you have 0 money you can still do it (debt).
    state.cash -= 5;
    state.hasCover = true;
    updateUI();
}

function sellCover() {
    state.cash += 15;
    state.hasCover = false;
    updateUI();
}

function buyAsset(type) {
    const price = type === 'A' ? state.prices.assetA : state.prices.assetB;
    if (state.cash >= price) {
        state.cash -= price;
        if (type === 'A') state.inventory.assetA++;
        else state.inventory.assetB++;
        updateUI();
    } else {
        // Flash red
        elBudget.style.color = 'red';
        setTimeout(() => elBudget.style.color = 'var(--green)', 200);
    }
}

// Market Simulation
function updateMarket() {
    // Random walk
    ['assetA', 'assetB'].forEach(asset => {
        let change = (Math.random() - 0.5) * 10;
        state.prices[asset] += change;
        if (state.prices[asset] < 1) state.prices[asset] = 1;
        if (state.prices[asset] > 100) state.prices[asset] = 100;

        // Update history
        state.history[asset].push(state.prices[asset]);
        if (state.history[asset].length > 20) state.history[asset].shift();
    });

    drawGraph(ctxA, state.history.assetA, '#5ffbf1');
    drawGraph(ctxB, state.history.assetB, '#5fff8f');
    updateUI();
}

function drawGraph(ctx, data, color) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    const step = w / (data.length - 1);
    const maxVal = 100; // Fixed scale for stability

    data.forEach((val, i) => {
        const x = i * step;
        const y = h - (val / maxVal) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

// Loop
setInterval(updateMarket, 500);
updateUI();

// Functions called from inline onclick="" attributes in the HTML.
Object.assign(window, { stealCover, sellCover, buyAsset });
