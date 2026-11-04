import { playTone } from '../../shared/audio.ts';
import { spawnText } from '../../shared/effects.ts';

// Game State
let bankroll = 500;
let isFighting = false;
let leftHP = 100;
let rightHP = 100;
let currentBetAmount = 0;
let currentBetSide = null; // 'left' or 'right'

// DOM Elements
const elBankroll = document.getElementById('bankroll');
const elLeftHP = document.getElementById('hp-left');
const elRightHP = document.getElementById('hp-right');
const elLog = document.getElementById('log');
const elLeftFighter = document.getElementById('left-fighter');
const elRightFighter = document.getElementById('right-fighter');
const elLeftEmoji = elLeftFighter.querySelector('.fighter');
const elRightEmoji = elRightFighter.querySelector('.fighter');
const btnLeft = document.querySelector('.btn-left');
const btnRight = document.querySelector('.btn-right');
const inputBet = document.getElementById('bet-amount');

// Audio Context (Synthesized sounds)

const SOUNDS = {
    hit: {
        wave: 'sawtooth',
        duration: 0.1,
        frequency: [[0, 150], [0.1, 40, 'exp']],
        gain: [[0, 0.1], [0.1, 0.01, 'exp']],
    },
    win: {
        wave: 'square',
        duration: 0.5,
        frequency: [[0, 400], [0.1, 600, 'linear'], [0.3, 1000, 'linear']],
        gain: [[0, 0.1], [0.5, 0, 'linear']],
    },
};

function playSound(type) {
    if (SOUNDS[type]) playTone(SOUNDS[type]);
}

function startGame() {
    document.getElementById('overlay').classList.remove('active');
}

function log(msg, type = '') {
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    div.innerText = `> ${msg}`;
    elLog.prepend(div);
}

function updateUI() {
    elBankroll.innerText = `$${bankroll}`;
    elLeftHP.style.width = `${leftHP}%`;
    elRightHP.style.width = `${rightHP}%`;

    // Color change on low health
    elLeftHP.style.background = leftHP < 30 ? '#e74c3c' : '#27ae60';
    elRightHP.style.background = rightHP < 30 ? '#e74c3c' : '#27ae60';
}

function placeBet(side) {
    if (isFighting) return;

    const amount = parseInt(inputBet.value);
    if (isNaN(amount) || amount <= 0) {
        log("Invalid bet amount. That's bad economics.");
        return;
    }
    if (amount > bankroll) {
        log("You don't have the capital for that!");
        return;
    }

    currentBetAmount = amount;
    currentBetSide = side;
    bankroll -= amount;
    updateUI();

    // Disable controls
    btnLeft.disabled = true;
    btnRight.disabled = true;
    inputBet.disabled = true;

    log(`Bet $${amount} on ${side === 'left' ? 'Austrian School' : 'Chicago School'}. FIGHT!`);
    startFight();
}

async function startFight() {
    isFighting = true;
    leftHP = 100;
    rightHP = 100;
    updateUI();

    // Cheer animation
    document.querySelectorAll('.spectator').forEach(s => s.classList.add('cheer'));

    while (leftHP > 0 && rightHP > 0) {
        await new Promise(r => setTimeout(r, 800 + Math.random() * 1000));

        // Randomly decide who attacks
        const attacker = Math.random() > 0.5 ? 'left' : 'right';
        performAttack(attacker);

        if (leftHP <= 0 || rightHP <= 0) break;
    }

    endFight();
}

function performAttack(attacker) {
    const damage = Math.floor(Math.random() * 15) + 5;
    const crit = Math.random() > 0.8;
    const finalDamage = crit ? damage * 2 : damage;

    // Visuals
    if (attacker === 'left') {
        elLeftEmoji.style.animation = 'attack-right 0.3s';
        setTimeout(() => {
            elLeftEmoji.style.animation = '';
            elRightEmoji.style.animation = 'shake 0.3s';
            showHitEffect(elRightFighter, finalDamage, crit);
        }, 150);
        rightHP = Math.max(0, rightHP - finalDamage);
        logAttack('Austrian', 'Chicago', finalDamage, crit);
    } else {
        elRightEmoji.style.animation = 'attack-left 0.3s';
        setTimeout(() => {
            elRightEmoji.style.animation = '';
            elLeftEmoji.style.animation = 'shake 0.3s';
            showHitEffect(elLeftFighter, finalDamage, crit);
        }, 150);
        leftHP = Math.max(0, leftHP - finalDamage);
        logAttack('Chicago', 'Austrian', finalDamage, crit);
    }

    playSound('hit');
    updateUI();
}

function showHitEffect(targetEl, amount, isCrit) {
    spawnText({
        text: `-${amount}${isCrit ? '!' : ''}`,
        className: 'hit-effect',
        x: '50%',
        y: '0',
        parent: targetEl,
        style: isCrit ? { fontSize: '3rem', color: '#f1c40f' } : undefined,
    });
}

const flavorTexts = [
    "violates the NAP of",
    "deregulates the face of",
    "privatizes the pain of",
    "uses the invisible hand on",
    "debates the gold standard with"
];

function logAttack(attackerName, defenderName, dmg, crit) {
    const action = flavorTexts[Math.floor(Math.random() * flavorTexts.length)];
    const msg = `${attackerName} ${action} ${defenderName} for ${dmg} dmg!${crit ? ' CRITICAL MARKET CORRECTION!' : ''}`;
    log(msg, 'damage');
}

function endFight() {
    isFighting = false;
    document.querySelectorAll('.spectator').forEach(s => s.classList.remove('cheer'));

    const winner = leftHP > 0 ? 'left' : 'right';
    const winnerName = winner === 'left' ? 'Austrian School' : 'Chicago School';

    log(`${winnerName} WINS THE FREE MARKET!`, 'win');
    playSound('win');

    if (winner === currentBetSide) {
        const winnings = currentBetAmount * 2;
        bankroll += winnings;
        log(`You won $${winnings}! The market provides.`, 'win');
        spawnMoneyRain();
    } else {
        log(`You lost your investment. No bailouts here.`);
    }

    updateUI();

    // Reset controls
    btnLeft.disabled = false;
    btnRight.disabled = false;
    inputBet.disabled = false;

    if (bankroll <= 0) {
        log("You are bankrupt. The system works.");
        setTimeout(() => {
            alert("You went bust! Resetting the economy...");
            bankroll = 500;
            updateUI();
        }, 2000);
    }
}

function spawnMoneyRain() {
    for(let i=0; i<20; i++) {
        const money = document.createElement('div');
        money.innerText = '💵';
        money.style.position = 'absolute';
        money.style.left = Math.random() * 100 + '%';
        money.style.top = '-50px';
        money.style.fontSize = '2rem';
        money.style.transition = 'top 2s ease-in, opacity 2s ease-in';
        money.style.zIndex = '100';
        document.getElementById('arena').appendChild(money);

        setTimeout(() => {
            money.style.top = '100%';
            money.style.opacity = '0';
        }, 50);

        setTimeout(() => money.remove(), 2050);
    }
}

// Functions called from inline onclick="" attributes in the HTML.
Object.assign(window, { startGame, placeBet });
