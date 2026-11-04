// Game State
const state = {
    playing: true,
    score: 0,
    position: 0, // -1 (left) to 1 (right)
    obstacles: [],
    lastFrame: 0,
    spawnTimer: 0
};

// DOM Elements
const road = document.getElementById('road');
const scoreEl = document.getElementById('score');
const finalScoreEl = document.getElementById('final-score');
const gameOverEl = document.getElementById('game-over');
const wheel = document.getElementById('steering-column');
const arm = document.getElementById('arm-wrapper');
const gameContainer = document.getElementById('game-container');

// Input Handling
let targetPos = 0;

gameContainer.addEventListener('mousemove', (e) => {
    if (!state.playing) return;
    const x = e.clientX / window.innerWidth; // 0 to 1
    targetPos = (x - 0.5) * 2.5; // -1.25 to 1.25
    // Clamp
    if (targetPos < -1) targetPos = -1;
    if (targetPos > 1) targetPos = 1;
});

gameContainer.addEventListener('touchmove', (e) => {
    if (!state.playing) return;
    const x = e.touches[0].clientX / window.innerWidth;
    targetPos = (x - 0.5) * 2.5;
    if (targetPos < -1) targetPos = -1;
    if (targetPos > 1) targetPos = 1;
});

// Game Loop
function loop(timestamp) {
    if (!state.playing) return;

    const delta = timestamp - state.lastFrame;
    state.lastFrame = timestamp;

    // Smooth steering
    state.position += (targetPos - state.position) * 0.1;

    // Update Visuals
    updateVisuals();

    // Spawn Entities
    state.spawnTimer += delta;
    if (state.spawnTimer > 1000 - (state.score * 2)) { // Gets harder
        spawnEntity();
        state.spawnTimer = 0;
    }

    // Move Entities
    moveEntities();

    // Background movement (fake road scrolling)
    // We simulate this by moving markers, but for simplicity in this 3D setup,
    // we just move the objects towards the camera.

    requestAnimationFrame(loop);
}

function updateVisuals() {
    // Rotate wheel
    const rot = state.position * 90;
    wheel.style.transform = `translateX(${state.position * 20}px) rotate(${rot}deg)`;

    // Move Arm slightly to simulate muscle tension
    const armShift = state.position * 10;
    arm.style.transform = `translateX(${armShift}px) rotate(${state.position * 5}deg)`;

    // Move Road to simulate lateral movement
    // In a real 3D game we move the camera, here we shift the road container
    road.style.transform = `translateX(calc(-50% + ${-state.position * 200}px)) rotateX(60deg)`;
}

function spawnEntity() {
    const type = Math.random() > 0.3 ? 'tax' : 'gold';
    const lane = (Math.random() * 1.8) - 0.9; // -0.9 to 0.9, keeps entities off the very edge

    const el = document.createElement('div');
    el.classList.add('entity');

    if (type === 'tax') {
        el.classList.add('obstacle');
        el.innerHTML = Math.random() > 0.5 ? '🚩' : '🎅'; // Red flag or Marx-like Santa
        // Sometimes spawn a police car
        if (Math.random() > 0.8) el.innerHTML = '🚓';
    } else {
        el.classList.add('collectible');
        el.innerHTML = '💰';
    }

    road.appendChild(el);

    state.obstacles.push({
        el: el,
        x: lane,
        z: -1000, // Starts far away at the top of the road
        type: type
    });
}

function moveEntities() {
    // Speed increases with score
    const speed = 10 + (state.score * 0.5);

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
        const obs = state.obstacles[i];
        obs.z += speed;

        // X positioning
        // The road is 600px wide. x is -1 to 1.
        // 0 is center.
        const xPos = obs.x * 250;

        // We use a true 3D transform. The `perspective` on the parent container
        // will handle the scaling and Y-positioning automatically.
        // z goes from -1000 (far) to 0 (near).
        obs.el.style.transform = `translate3d(${xPos}px, 0, ${obs.z}px)`;
        obs.el.style.zIndex = Math.floor(obs.z + 1000);

        // Collision Detection
        // Check for collision when the object is near the bottom of the screen (close to the player)
        // This happens as z approaches 0.
        if (obs.z > -150 && obs.z < 0) {
            // Check lateral distance
            const dist = Math.abs(obs.x - state.position);
            if (dist < 0.3) { // Hit
                if (obs.type === 'tax') {
                    gameOver();
                } else {
                    if (!obs.collected) collect(obs, i);
                }
            }
        }

        // Cleanup
        if (obs.z > 0) {
            obs.el.remove();
            state.obstacles.splice(i, 1);
        }
    }
}

function collect(obs, index) {
    obs.collected = true; // Prevent double collection
    state.score += 100;
    scoreEl.innerText = state.score;
    obs.el.remove();
    state.obstacles.splice(index, 1);

    // Visual feedback
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.background = 'rgba(255, 215, 0, 0.3)';
    flash.style.pointerEvents = 'none';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 100);
}

function gameOver() {
    state.playing = false;
    finalScoreEl.innerText = state.score;
    gameOverEl.style.display = 'block';

    // Shake effect
    gameContainer.style.animation = 'shake 0.5s';
    setTimeout(() => gameContainer.style.animation = '', 500);
}

function restartGame() {
    state.score = 0;
    state.obstacles.forEach(o => o.el.remove());
    state.obstacles = [];
    scoreEl.innerText = '0';
    gameOverEl.style.display = 'none';
    state.playing = true;
    state.lastFrame = performance.now();
    requestAnimationFrame(loop);
}

// Add shake animation
const style = document.createElement('style');
style.innerHTML = `
    @keyframes shake {
        0% { transform: translate(1px, 1px) rotate(0deg); }
        10% { transform: translate(-1px, -2px) rotate(-1deg); }
        20% { transform: translate(-3px, 0px) rotate(1deg); }
        30% { transform: translate(3px, 2px) rotate(0deg); }
        40% { transform: translate(1px, -1px) rotate(1deg); }
        50% { transform: translate(-1px, 2px) rotate(-1deg); }
        60% { transform: translate(-3px, 1px) rotate(0deg); }
        70% { transform: translate(3px, 1px) rotate(-1deg); }
        80% { transform: translate(-1px, -1px) rotate(1deg); }
        90% { transform: translate(1px, 2px) rotate(0deg); }
        100% { transform: translate(1px, -2px) rotate(-1deg); }
    }
`;
document.head.appendChild(style);

// Start
requestAnimationFrame(loop);

// Functions called from inline onclick="" attributes in the HTML.
Object.assign(window, { restartGame });
