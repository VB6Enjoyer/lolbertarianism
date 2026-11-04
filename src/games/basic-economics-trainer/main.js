// --- Game State & Data ---
const questions = [
    {
        q: "If the government prints a trillion dollars and gives it to everyone, what happens?",
        options: ["Everyone gets rich!", "Inflation (Money loses value)", "The economy doubles", "Nothing changes"],
        correct: 1,
        reaction: "smug", // Anya looks smug if you get it right
        wrongReaction: "shock", // Anya looks shocked at your stupidity
        comment: "Correct. More money chasing the same goods equals higher prices."
    },
    {
        q: "Why does a diamond cost more than water, even though water is essential for life?",
        options: ["Diamonds are shiny", "Corporate greed", "Scarcity", "Water is heavy"],
        correct: 2,
        reaction: "happy",
        wrongReaction: "smug",
        comment: "Exactly. It's the law of Scarcity. Water is abundant; diamonds are rare."
    },
    {
        q: "Rent control (setting a maximum price for rent) usually leads to...",
        options: ["Cheaper housing for everyone", "Housing Shortages", "Better quality apartments", "Landlords becoming generous"],
        correct: 1,
        reaction: "smug",
        wrongReaction: "shock",
        comment: "Basic supply and demand. Price ceilings create shortages."
    },
    {
        q: "What is 'Opportunity Cost'?",
        options: ["The price tag on an item", "The value of the next best alternative you give up", "The cost of starting a business", "A discount coupon"],
        correct: 1,
        reaction: "happy",
        wrongReaction: "smug",
        comment: "Yes. There are no solutions, only trade-offs."
    },
    {
        q: "Free trade between two countries generally...",
        options: ["Makes both countries poorer", "Only helps the rich country", "Benefits both sides", "Causes war"],
        correct: 2,
        reaction: "happy",
        wrongReaction: "shock",
        comment: "Correct. Comparative advantage means both sides win."
    }
];

let currentQ = 0;
let score = 0;
let isTyping = false;

// --- DOM Elements ---
const dialogText = document.getElementById('dialog-text');
const optionsGrid = document.getElementById('options-grid');
const nextBtn = document.getElementById('next-btn');
const mouth = document.getElementById('mouth');
const book = document.getElementById('book');
const character = document.getElementById('character');

// --- Typewriter Effect ---
function typeText(text, callback) {
    isTyping = true;
    dialogText.innerHTML = "";
    let i = 0;
    const speed = 30;

    function type() {
        if (i < text.length) {
            dialogText.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        } else {
            isTyping = false;
            if (callback) callback();
        }
    }
    type();
}

// --- Game Logic ---
function startGame() {
    // Animation: Book moves to user
    book.style.transform = "scale(1.5) translateY(-50px) rotateY(0)";
    book.style.zIndex = "100";

    // Remove click handler
    book.onclick = null;

    typeText("Finally. Open it. Let's see if you can understand the basics.", () => {
        setTimeout(showQuestion, 1000);
    });
}

function showQuestion() {
    if (currentQ >= questions.length) {
        endGame();
        return;
    }

    const q = questions[currentQ];
    optionsGrid.innerHTML = "";
    optionsGrid.style.display = "grid";
    nextBtn.classList.add("hidden");

    // Reset face
    mouth.className = "mouth"; 

    typeText(q.q, () => {
        q.options.forEach((opt, index) => {
            const btn = document.createElement('button');
            btn.className = "option-btn";
            btn.innerText = opt;
            btn.onclick = () => handleAnswer(index);
            optionsGrid.appendChild(btn);
        });
    });
}

function handleAnswer(index) {
    const q = questions[currentQ];
    const isCorrect = index === q.correct;

    optionsGrid.style.display = "none";

    if (isCorrect) {
        score++;
        mouth.className = `mouth ${q.reaction}`; // Happy or Smug
        typeText(`Heh. ${q.comment}`, () => {
            nextBtn.classList.remove("hidden");
        });
    } else {
        mouth.className = `mouth ${q.wrongReaction}`; // Shock or Smug
        character.classList.add("shake");
        setTimeout(() => character.classList.remove("shake"), 500);
        typeText(`Wrong. ${q.comment} Try to keep up.`, () => {
            nextBtn.classList.remove("hidden");
        });
    }
}

nextBtn.onclick = () => {
    currentQ++;
    showQuestion();
};

function endGame() {
    const overlay = document.getElementById('end-screen');
    const verdict = document.getElementById('final-verdict');
    const scoreText = document.getElementById('final-score');

    overlay.style.display = "flex";
    scoreText.innerText = `Score: ${score}/${questions.length}`;

    if (score === 5) {
        verdict.innerText = "NOT DUMB";
        verdict.style.color = "#27ae60";
    } else if (score >= 3) {
        verdict.innerText = "MEDIOCRE";
        verdict.style.color = "#f39c12";
    } else {
        verdict.innerText = "STILL DUMB";
        verdict.style.color = "#c0392b";
    }
}

// --- Init ---
window.onload = () => {
    typeText("Take the book. I don't have all day.");
};

// Functions called from inline onclick="" attributes in the HTML.
Object.assign(window, { startGame });
