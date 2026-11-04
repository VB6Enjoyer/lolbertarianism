import { pick, spawnText } from '../../shared/effects.ts';

// Game State
let score = 10;
let wave = 1;
let isPlaying = false;
let spawnRate = 2000;
let enemySpeed = 2;
let enemies = [];
let animationFrameId;
let lastSpawnTime = 0;

// DOM Elements
const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
const gameStage = document.getElementById('game-stage');
const blockPile = document.getElementById('block-pile');
const overlay = document.getElementById('overlay-screen');
const teacherBubble = document.getElementById('teacher-bubble');
const jackBubble = document.getElementById('jack-bubble');
const startBtn = document.getElementById('start-btn');
const h1 = document.querySelector('h1');

// Quotes
const teacherQuotes = [
    "Jack, you should share your toys.",
    "Sharing is caring!",
    "Think of the other children.",
    "It's for the greater good.",
    "Don't be selfish, Jack.",
    "We need to redistribute these.",
    "Ownership is a social construct."
];

const jackQuotes = [
    "Fuck off you communist!",
    "Have you not heard about property rights?",
    "Taxation is theft!",
    "Read some economics!",
    "This is my private property!",
    "Don't tread on me!",
    "I homesteaded these blocks!"
];

function randomLetter() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return chars.charAt(Math.floor(Math.random() * chars.length));
}

function renderBlocks() {
    blockPile.innerHTML = '';
    for(let i=0; i<score; i++) {
        const b = document.createElement('div');
        b.className = 'block';
        b.innerText = randomLetter();
        blockPile.appendChild(b);
    }
}

function showBubble(element, text) {
    element.innerText = text;
    element.style.opacity = 1;
    setTimeout(() => {
        element.style.opacity = 0;
    }, 2000);
}

function spawnEnemy() {
    const el = document.createElement('div');
    el.className = 'enemy';
    el.innerText = '👋'; // The grabbing hand

    // Start from left side (Teacher's side)
    const startY = Math.random() * (window.innerHeight - 200) + 100;
    el.style.left = '-50px';
    el.style.top = startY + 'px';

    // Target: Center of screen (Block pile)
    const targetX = window.innerWidth / 2;
    const targetY = window.innerHeight - 100;

    // Store data
    const enemy = {
        el: el,
        x: -50,
        y: startY,
        vx: (Math.random() * 1 + 1) * (1 + (wave * 0.1)), // Speed increases with wave
        vy: (targetY - startY) / 200 // Slight arc
    };

    // Click handler
    el.onmousedown = (e) => {
        e.stopPropagation();
        killEnemy(enemy);
        showBubble(jackBubble, jackQuotes[Math.floor(Math.random() * jackQuotes.length)]);
    };

    gameStage.appendChild(el);
    enemies.push(enemy);

    // Teacher speaks occasionally
    if(Math.random() > 0.7) {
        showBubble(teacherBubble, teacherQuotes[Math.floor(Math.random() * teacherQuotes.length)]);
    }
}

function createParticles(x, y) {
    for(let i=0; i<5; i++) {
        spawnText({
            text: pick(['💥', '🚫', '💢']),
            className: 'particle',
            x,
            y,
            parent: gameStage,
            vars: { '--tx': (Math.random()*100 - 50) + 'px', '--ty': (Math.random()*100 - 50) + 'px' },
        });
    }
}

function killEnemy(enemy) {
    const index = enemies.indexOf(enemy);
    if (index > -1) {
        enemies.splice(index, 1);
        createParticles(enemy.x, enemy.y);
        enemy.el.remove();
    }
}

function updateGame(timestamp) {
    if (!isPlaying) return;

    // Spawning
    if (timestamp - lastSpawnTime > spawnRate) {
        spawnEnemy();
        lastSpawnTime = timestamp;
        // Increase difficulty
        if (spawnRate > 500) spawnRate -= 20;
    }

    // Move Enemies
    const pileRect = blockPile.getBoundingClientRect();

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.x += e.vx;
        e.y += e.vy * 0.5; // Move towards bottom center

        e.el.style.transform = `translate(${e.x}px, 0)`;

        // Collision Detection with Pile
        if (e.x > pileRect.left - 50) {
            // Steal block
            score--;
            scoreEl.innerText = score;
            renderBlocks();

            // Visual feedback
            document.body.classList.add('shake');
            setTimeout(()=>document.body.classList.remove('shake'), 500);

            // Remove enemy
            e.el.remove();
            enemies.splice(i, 1);

            if (score <= 0) {
                gameOver();
            }
        }
    }

    // Wave Logic based on time or score? Let's do time roughly
    if (timestamp % 10000 < 20) {
        wave++;
        waveEl.innerText = wave;
    }

    animationFrameId = requestAnimationFrame(updateGame);
}

function startGame() {
    score = 10;
    wave = 1;
    spawnRate = 2000;
    enemies.forEach(e => e.el.remove());
    enemies = [];
    scoreEl.innerText = score;
    waveEl.innerText = wave;
    renderBlocks();

    overlay.style.display = 'none';
    isPlaying = true;
    lastSpawnTime = performance.now();
    requestAnimationFrame(updateGame);
}

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(animationFrameId);
    overlay.style.display = 'flex';
    h1.innerText = "PROPERTY SEIZED";
    document.querySelector('#overlay-screen p').innerHTML = `The state has redistributed all your toys.<br>You survived ${wave} waves.`;
    startBtn.innerText = "TRY AGAIN";
}

// Initial render
renderBlocks();

// Functions called from inline onclick="" attributes in the HTML.
Object.assign(window, { startGame });
