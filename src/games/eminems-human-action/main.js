import { spawnText } from '../../shared/effects.ts';
import { formatNumber } from '../../shared/format.ts';

// Game State
let gameActive = false;
let score = 0;
let inflation = 2; // Starts at 2%
let gameLoopId;
let spawnLoopId;
let lyricsInterval;

// Elements
const gameArea = document.getElementById('game-area');
const scoreEl = document.getElementById('score');
const inflationEl = document.getElementById('inflation');
const lyricsBox = document.getElementById('lyrics-display');
const lyricsText = document.getElementById('lyrics-text');
const rapper = document.getElementById('rapper');
const heldBook = document.getElementById('held-book');

// Data
const lyrics = [
    "His palms are sweaty, knees weak, arms are heavy / There's inflation on his sweater already, Keynes' spaghetti.",
    "You better lose yourself in the free market, the moment / You own it, you better never let the state control it.",
    "Snap back to reality, oh there goes gravity / Oh, there goes the fiat currency, choked by depravity.",
    "I'm beginning to feel like an Econ God, Econ God / All my people from the Austrian School nod, front to back nod.",
    "Supply and demand, that's the only law I obey / Central planners try to plan but they just get in the way.",
    "Look, if you had one shot, or one opportunity / To seize sound money for your community... would you capture it?",
    "Praxeology, the logic of action / Human behavior, not a mathematical fraction.",
    "They printing money like it's going out of style / But the purchasing power drops every single mile."
];

const enemies = [
    { emoji: '🖨️', name: 'Money Printer', speed: 2, points: 100 },
    { emoji: '🏦', name: 'Central Bank', speed: 1.5, points: 150 },
    { emoji: '📉', name: 'Price Control', speed: 2.5, points: 50 },
    { emoji: '👻', name: 'Keynes Ghost', speed: 3, points: 200 },
    { emoji: '💸', name: 'Stimulus Check', speed: 2.2, points: 75 }
];

// Audio Simulation (Visual)
const sounds = ["POW!", "FACTS!", "LOGIC!", "READ!", "BOOM!"];

function startGame() {
    document.getElementById('start-screen').style.display = 'none';
    gameActive = true;
    score = 0;
    inflation = 2.0;
    updateUI();

    // Start Loops
    spawnLoopId = setInterval(spawnEnemy, 1500);
    gameLoopId = requestAnimationFrame(gameLoop);

    // Start Lyrics
    cycleLyrics();
    lyricsInterval = setInterval(cycleLyrics, 5000);
}

function cycleLyrics() {
    lyricsBox.classList.remove('show');
    setTimeout(() => {
        const randomLine = lyrics[Math.floor(Math.random() * lyrics.length)];
        lyricsText.innerText = `"${randomLine}"`;
        lyricsBox.classList.add('show');
    }, 300);
}

function updateUI() {
    scoreEl.innerText = formatNumber(score);
    inflationEl.innerText = inflation.toFixed(1) + '%';

    if (inflation > 50) {
        inflationEl.style.color = 'red';
        document.body.style.boxShadow = "inset 0 0 50px red";
    } else {
        document.body.style.boxShadow = "none";
    }
}

function spawnEnemy() {
    if (!gameActive) return;

    const type = enemies[Math.floor(Math.random() * enemies.length)];
    const el = document.createElement('div');
    el.classList.add('enemy');
    el.innerText = type.emoji;
    el.dataset.points = type.points;
    el.dataset.speed = type.speed;

    // Random X position
    const x = Math.random() * (window.innerWidth - 50);
    el.style.left = x + 'px';
    el.style.top = '-50px';

    gameArea.appendChild(el);

    // Increase difficulty
    if (Math.random() > 0.8) inflation += 0.5;
    updateUI();

    if (inflation > 100) gameOver();
}

function handleTap(e) {
    if (!gameActive) return;

    // Rapper animation
    rapper.style.transform = "translateX(-50%) scale(1.1)";
    setTimeout(() => rapper.style.transform = "translateX(-50%) scale(1)", 100);

    // Create projectile (The Book)
    const book = document.createElement('div');
    book.className = 'book';
    book.innerHTML = `
        <div class="book-spine"></div>
        <div class="book-title">HUMAN<br>ACTION</div>
        <div class="book-author">Mises</div>
    `;

    // Start position (from rapper hand)
    const startX = window.innerWidth / 2 + 20;
    const startY = window.innerHeight - 100;

    book.style.left = startX + 'px';
    book.style.top = startY + 'px';
    book.style.transition = 'all 0.6s cubic-bezier(0.19, 1, 0.22, 1)';

    gameArea.appendChild(book);

    // Force reflow
    book.getBoundingClientRect();

    // Target position (click coordinates)
    const targetX = e.clientX - 30; // center book
    const targetY = e.clientY - 45;

    // Calculate rotation based on direction
    const angle = Math.atan2(targetY - startY, targetX - startX) * 180 / Math.PI;

    book.style.transform = `translate(${targetX - startX}px, ${targetY - startY}px) rotate(${angle + 720}deg) scale(1.5)`;

    // Check collision after animation
    setTimeout(() => {
        checkHit(targetX, targetY);
        book.style.opacity = '0';
        setTimeout(() => book.remove(), 200);
    }, 600);
}

function checkHit(x, y) {
    const enemies = document.querySelectorAll('.enemy');
    const hitRadius = 60;
    let hit = false;

    enemies.forEach(enemy => {
        const rect = enemy.getBoundingClientRect();
        const enemyX = rect.left + rect.width / 2;
        const enemyY = rect.top + rect.height / 2;

        const dist = Math.hypot(x - enemyX, y - enemyY);

        if (dist < hitRadius) {
            // Hit!
            createExplosion(enemyX, enemyY, sounds[Math.floor(Math.random() * sounds.length)]);
            score += parseInt(enemy.dataset.points);
            inflation = Math.max(2, inflation - 0.5); // Reduce inflation
            enemy.remove();
            hit = true;
        }
    });

    if (!hit) {
        // Miss penalty
        inflation += 0.2;
    }
    updateUI();
}

function createExplosion(x, y, text) {
    spawnText({ text, className: 'explosion', x, y, parent: gameArea });
}

function gameLoop() {
    if (!gameActive) return;

    const enemies = document.querySelectorAll('.enemy');
    enemies.forEach(enemy => {
        let top = parseFloat(enemy.style.top || -50);
        let speed = parseFloat(enemy.dataset.speed);

        // Move down
        top += speed;
        enemy.style.top = top + 'px';

        // Check if reached bottom
        if (top > window.innerHeight) {
            enemy.remove();
            inflation += 2.0; // Penalty for missing
            updateUI();
            if (inflation > 100) gameOver();
        }
    });

    gameLoopId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameActive = false;
    clearInterval(spawnLoopId);
    cancelAnimationFrame(gameLoopId);
    clearInterval(lyricsInterval);

    document.getElementById('start-screen').style.display = 'flex';
    document.querySelector('#start-screen h1').innerText = "HYPERINFLATION!";
    document.querySelector('#start-screen h2').innerText = "You let the economy collapse.";
    document.querySelector('#start-screen button').innerText = "Try Again";

    // Clear enemies
    document.querySelectorAll('.enemy').forEach(e => e.remove());
}

// Functions called from inline onclick="" attributes in the HTML.
Object.assign(window, { startGame, handleTap });
