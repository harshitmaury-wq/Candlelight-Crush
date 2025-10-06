// --- GAME CONSTANTS ---
const GAME_AREA = document.getElementById('gameArea');
const PLAYER = document.getElementById('player');
const FULL_FLAME = document.getElementById('fullFlame');
const SCORE_DISPLAY = document.getElementById('scoreDisplay');
const MESSAGE_DISPLAY = document.getElementById('message');
const MAX_HEALTH = 100;
const FLAME_MAX_HEIGHT_PX = 350; // Matches CSS height
const PLAYER_WIDTH = 80;
const PLAYER_SPEED = 10;

// Speed calculation variables
const DROP_SPEED_BASE = 2; 
const DROP_SPEED_MULTIPLIER = 0.045; 

// --- GAME STATE ---
let health = MAX_HEALTH;
let score = 0;
let gameRunning = false;
let playerX = 0; 
let keysPressed = {}; 

// --- INTERVALS ---
let healthDrainInterval = null;
let scoreInterval = null;
let spawnInterval = null;
let gameUpdateInterval = null;

// --- OBJECT CONFIG ---
// NOTE: I replaced the previous Unicode characters with standard Emojis (🔥, 💧,  extinguisher)
const OBJECTS = {
    'ember': { type: 'resource', health: 15, score: 10, emoji: '🔥', spawnRate: 0.6, color: '#FFD700' }, // Ember (Good)
    'water': { type: 'hazard', health: -20, score: 0, emoji: '💧', spawnRate: 0.3, color: '#1E90FF' }, // Water Drop (Bad)
    'extinguisher': { type: 'hazard', health: -40, score: 0, emoji: '🧯', spawnRate: 0.1, color: '#C0392B' } // Extinguisher (Very Bad)
};

// --- GAME FUNCTIONS ---

/**
 * Updates the flame health bar visually and checks for game over.
 */
function updateFlameVisual() {
    const heightRatio = health / MAX_HEALTH;
    const newHeight = Math.max(0, heightRatio * FLAME_MAX_HEIGHT_PX);
    FULL_FLAME.style.height = `${newHeight}px`;

    // Visual feedback on health level
    if (health < 30) {
        FULL_FLAME.style.opacity = '0.7'; // Flicker effect hint
    } else {
        FULL_FLAME.style.opacity = '1';
    }

    if (health <= 0) {
        health = 0;
        
    }
}

/**
 * Starts all the main game timing loops (health drain, score, spawning, game update).
 */
function startTimers() {
    // Clear any old timers first
    clearInterval(healthDrainInterval);
    clearInterval(scoreInterval);
    clearInterval(spawnInterval);
    clearInterval(gameUpdateInterval);
    
    // Health Drain: Lose 2 health every second
    healthDrainInterval = setInterval(() => {
        if (!gameRunning) return; 
        health = Math.max(0, health - 2);
        updateFlameVisual();
    }, 1000); 

    // Score Increment: Gain 1 point every second
    scoreInterval = setInterval(() => {
        if (!gameRunning) return; 
        score += 1;
        SCORE_DISPLAY.textContent = score;
    }, 1000);

     // Object Spawning: Spawn a new object every 1.5 seconds
    spawnInterval = setInterval(spawnObject, 1500); 

    // Game Update Loop: Handles player movement and object physics (approx 33ms = 30 FPS)
    gameUpdateInterval = setInterval(updateGame, 30); 
}

/**
 * Creates and places a new falling object in the game area based on probability.
 */
function spawnObject() {
    if (!gameRunning) return; 
    
    // Simple probability logic for selecting an object
    let selectedKey;
    const r = Math.random();
    if (r < OBJECTS.ember.spawnRate) { 
        selectedKey = 'ember';
    } else if (r < OBJECTS.ember.spawnRate + OBJECTS.water.spawnRate) { 
        selectedKey = 'water';
    } else { 
        selectedKey = 'extinguisher';
    }

    const config = OBJECTS[selectedKey];
    const objectEl = document.createElement('div');
    objectEl.classList.add('falling-object');
    objectEl.dataset.type = selectedKey;
    objectEl.textContent = config.emoji;
    objectEl.style.color = config.color; // Set color for better visibility

    const gameWidth = GAME_AREA.offsetWidth;
    // Ensure the object spawns within bounds
    const startX = Math.random() * (gameWidth - objectEl.offsetWidth);
    
    objectEl.style.left = `${startX}px`;
    objectEl.style.top = `-50px`; // Start off-screen

    GAME_AREA.appendChild(objectEl);
}
