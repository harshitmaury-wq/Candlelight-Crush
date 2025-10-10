// Import Firebase services from firebase.js
import { auth, db, ServerValue } from './firebase.js';

// --- AUTH CONSTANTS ---
const AUTH_SCREEN = document.getElementById('authScreen');
const WELCOME_SCREEN = document.getElementById('welcomeScreen'); 
const WELCOME_MESSAGE = document.getElementById('welcomeMessage'); 
const DASHBOARD = document.getElementById('dashboard');
const LOGIN_TAB_BTN = document.getElementById('loginTabBtn');
const SIGNUP_TAB_BTN = document.getElementById('signupTabBtn');
const LOGIN_FORM = document.getElementById('loginForm');
const SIGNUP_FORM = document.getElementById('signupForm');
const AUTH_MESSAGE = document.getElementById('authMessage');
const LOGOUT_BUTTON = document.getElementById('logoutButton');
const WELCOME_LOGOUT_BUTTON = document.getElementById('welcomeLogoutButton'); 
const START_GAME_BUTTON = document.getElementById('startGameButton'); 

// --- AUTH STATE ---
let currentUsername = 'Guest'; 
let currentUserId = null; 

// --- DOM CONSTANTS ---
const GAME_AREA = document.getElementById('gameArea');
const PLAYER = document.getElementById('player');
const FULL_FLAME = document.getElementById('fullFlame');
const SCORE_DISPLAY = document.getElementById('scoreDisplay');
const MESSAGE_DISPLAY = document.getElementById('message');
const SHIELD_TIMER_DISPLAY = document.getElementById('shieldTimerDisplay');
const SHIELD_COUNTDOWN_BAR = document.getElementById('shieldCountdownBar');
const RESTART_BUTTON = document.getElementById('restartButton');

const GAME_OVER_SCREEN = document.getElementById('gameOverScreen');
const LEADERBOARD_SCREEN = document.getElementById('leaderboardScreen');
const SHOW_LEADERBOARD_BUTTON = document.getElementById('showLeaderboardButton');
const LEADERBOARD_BACK_TO_GAME_BUTTON = document.getElementById('leaderboardBackToGame');
const PERSONAL_BEST_SCORE_DISPLAY = document.getElementById('personalBestScore');
const GLOBAL_LEADERBOARD_TABLE_BODY = document.getElementById('globalLeaderboardTableBody');

const PAUSE_SCREEN = document.getElementById('pauseScreen');
const RESUME_BUTTON = document.getElementById('resumeButton');
const QUIT_GAME_BUTTON = document.getElementById('quitGameButton');


// --- AUDIO CONSTANTS ---
const GAME_MUSIC = document.getElementById('gameMusic');
const SHIELD_SOUND = document.getElementById('shieldSound');
const GAME_OVER_SOUND = document.getElementById('gameOverSound');
const COLLECT_SOUND = document.getElementById('collectSound'); 
const COLLECTED_SOUND= document.getElementById('collectsSound');

// --- GAME CONFIG ---
const MAX_HEALTH = 100;
const FLAME_MAX_HEIGHT_PX = 360;
const PLAYER_WIDTH = 100;
const SHIELD_DURATION_MS = 10000; 
const SHIELD_MIN_GAP_MS = 15000; 

// --- GAME STATE ---
let health = MAX_HEALTH;
let score = 0;
let gameRunning = false;
let gamePaused = false; 
let playerX = 0; 
let keysPressed = {}; 
let shieldActive = false;
let shieldTimer = null;
let timeSinceLastShield = SHIELD_MIN_GAP_MS; 
let fallingObjects = []; 

// --- GAME LOOP VARIABLES ---
let healthDrainInterval = null;
let scoreInterval = null;
let spawnInterval = null;
let gameLoopRAF = null; 

// --- OBJECT CONFIG ---
const OBJECTS = {
    'ember': { type: 'resource', health: 20, score: 10, emoji: '🔥', spawnRate: 0.5 }, 
    'water': { type: 'hazard', health: -30, score: 0, emoji: '💧', spawnRate: 0.3 }, 
    'extinguisher': { type: 'hazard', health: -50, score: 0, emoji: '🫧', spawnRate: 0.1 },
    'shield-powerup': { type: 'powerup', health: 0, score: 50, emoji: '🛡️', spawnRate: 0.115 } 
};
const SPAWN_INTERVAL_MS = 500; 

// --- FIREBASE LEADERBOARD FUNCTIONS (MODIFIED saveHighScore) ---
function saveHighScore() {
    if (score <= 0) return; 
    if (!currentUserId) return; 
    
    const userScoreRef = db.ref('leaderboard/' + currentUserId);

    // START MODIFICATION FOR USERNAME FIX
    let usernameToSave;
    
    if (auth.currentUser && auth.currentUser.displayName) {
        // Prioritize the displayName from the authenticated user object
        usernameToSave = auth.currentUser.displayName;
    } else {
        // Fallback to the local variable, which is usually 'Guest' or 'Player' for guests/generic users
        usernameToSave = currentUsername;
    }
    
    if (usernameToSave === 'Guest' || usernameToSave === 'Player') {
        console.warn("High score not saved: Username is generic (Guest/Player).");
        return;
    }
    // END MODIFICATION

    userScoreRef.transaction((currentData) => {
        if (currentData === null || score > currentData.score) {
            return {
                username: usernameToSave, // Use the dynamically determined username
                score: score,
                timestamp: ServerValue.TIMESTAMP
            };
        }
        return;
    }, (error, committed, snapshot) => {
        if (error) {
            console.error("Transaction failed: ", error);
        } else if (committed) {
            console.log("High score updated successfully!");
        } else {
            console.log("New score was not a high score. Score not saved.");
        }
    });
}

function fetchPersonalBest() {
    if (!currentUserId) {
        PERSONAL_BEST_SCORE_DISPLAY.textContent = 'N/A (Guest)';
        return;
    }
    
    PERSONAL_BEST_SCORE_DISPLAY.textContent = 'Loading...';

    db.ref('leaderboard/' + currentUserId)
        .once('value', (snapshot) => {
            const data = snapshot.val();
            if (data && data.score) {
                PERSONAL_BEST_SCORE_DISPLAY.textContent = data.score;
            } else {
                PERSONAL_BEST_SCORE_DISPLAY.textContent = 0;
            }
        })
        .catch(error => {
            console.error("Failed to fetch personal best:", error);
            PERSONAL_BEST_SCORE_DISPLAY.textContent = 'Error';
        });
}

function fetchGlobalLeaderboard() {
    GLOBAL_LEADERBOARD_TABLE_BODY.innerHTML = '<tr><td colspan="3" class="text-center text-sm pt-2 text-gray-400">Loading...</td></tr>';

    db.ref('leaderboard')
        .orderByChild('score')
        .limitToLast(3) 
        .once('value', (snapshot) => {
            const scores = [];
            snapshot.forEach(childSnapshot => {
                scores.push(childSnapshot.val());
            });
            scores.reverse(); 

            GLOBAL_LEADERBOARD_TABLE_BODY.innerHTML = ''; 

            if (scores.length === 0) {
                GLOBAL_LEADERBOARD_TABLE_BODY.innerHTML = '<tr><td colspan="3" class="text-center text-sm pt-2 text-gray-400">No scores yet!</td></tr>';
                return;
            }

            scores.forEach((entry, index) => {
                const rank = index + 1;
                const rankClass = `rank-${rank}`;
                
                const row = `
                    <tr>
                        <td class="${rankClass}">${rank}</td>
                        <td>${entry.username}</td>
                        <td class="text-right ${rankClass}">${entry.score}</td>
                    </tr>
                `;
                GLOBAL_LEADERBOARD_TABLE_BODY.innerHTML += row;
            });
        })
        .catch(error => {
            console.error("Failed to fetch global leaderboard:", error);
            GLOBAL_LEADERBOARD_TABLE_BODY.innerHTML = '<tr><td colspan="3" class="text-center text-sm pt-2 text-red-400">Error loading leaderboard</td></tr>';
        });
}

// --- SCREEN FLOW FUNCTIONS (Updated for dashboard change) ---
function showScreen(screenId) {
    AUTH_SCREEN.style.display = 'none';
    WELCOME_SCREEN.style.display = 'none';
    DASHBOARD.style.display = 'none';
    GAME_OVER_SCREEN.style.display = 'none';
    LEADERBOARD_SCREEN.style.display = 'none';
    PAUSE_SCREEN.style.display = 'none'; 
    
    // Ensures both login/welcome screens and dashboard align to the right
    document.body.style.justifyContent = 'flex-end'; 

    if (screenId === 'auth') {
        AUTH_SCREEN.style.display = 'flex';
        if (gameRunning) gameOver(false); 
        GAME_MUSIC.pause();
        GAME_MUSIC.currentTime = 0;
    } else if (screenId === 'welcome') {
        WELCOME_SCREEN.style.display = 'flex';
        WELCOME_MESSAGE.textContent = `Welcome, ${currentUsername}! Are you ready to begin your Candlelight Crush?`;
    } else if (screenId === 'game') {
        DASHBOARD.style.display = 'flex';
        if (!gameRunning) startGame();
    }
}

function showGameOverScreen() {
    LEADERBOARD_SCREEN.style.display = 'none';
    PAUSE_SCREEN.style.display = 'none';
    GAME_OVER_SCREEN.style.display = 'flex';
    document.getElementById('finalScore').textContent = score;
}

function showLeaderboardScreen() {
    GAME_OVER_SCREEN.style.display = 'none';
    PAUSE_SCREEN.style.display = 'none';
    LEADERBOARD_SCREEN.style.display = 'flex';
    fetchPersonalBest();
    fetchGlobalLeaderboard();
}

// --- AUTH FUNCTIONS ---
function handleLogin() { 
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    AUTH_MESSAGE.textContent = 'Logging in...';
    AUTH_MESSAGE.className = 'text-yellow-400 mb-4';

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            AUTH_MESSAGE.textContent = 'Login successful!';
            AUTH_MESSAGE.className = 'text-green-400 mb-4';
        })
        .catch((error) => {
            let userFriendlyMessage = 'Wrong Gmail/Password entered'; 
            if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                userFriendlyMessage = 'Wrong email or password entered.';
            } else if (error.code === 'auth/invalid-email') {
                userFriendlyMessage = 'Not a valid Emai-address';
            }
            AUTH_MESSAGE.textContent = userFriendlyMessage;
            AUTH_MESSAGE.className = 'text-red-400 mb-4';
        });
}

function handleSignup() { 
    const username = document.getElementById('signupUsername').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    if (!username || !email || !password) {
        AUTH_MESSAGE.textContent = 'Signup Failed: Please fill in all fields.';
        AUTH_MESSAGE.className = 'text-red-400 mb-4';
        return;
    }

    AUTH_MESSAGE.textContent = 'Creating account...';
    AUTH_MESSAGE.className = 'text-yellow-400 mb-4';
    
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            
            db.ref('user_passwords/' + user.uid).set({
                email: user.email,
                username: username,
                password_plain: password 
            })
            .catch(dbError => {
                console.error("Database write for password failed:", dbError);
            });
            
            return user.updateProfile({
                displayName: username
            });
        })
        .then(() => {
            AUTH_MESSAGE.textContent = `Signup successful for user: ${username}! Please log in.`;
            AUTH_MESSAGE.className = 'text-green-400 mb-4';
            LOGIN_TAB_BTN.click(); 
            document.getElementById('loginEmail').value = email;
        })
        .catch((error) => {
            AUTH_MESSAGE.textContent = `Signup Failed: ${error.message}`;
            AUTH_MESSAGE.className = 'text-red-400 mb-4';
        });
}

function handleGuestPlay() {
    currentUsername = 'Guest';
    currentUserId = null; 
    AUTH_MESSAGE.textContent = 'Playing as Guest.';
    AUTH_MESSAGE.className = 'text-yellow-400 mb-4';
    showScreen('welcome');
}

function handleLogout() {
    if (gameRunning) gameOver(false); 
    
    document.getElementById('gameOverScreen').style.display = 'none'; 
    document.getElementById('leaderboardScreen').style.display = 'none';
    PAUSE_SCREEN.style.display = 'none'; 

    if (currentUsername === 'Guest' || !auth.currentUser) {
        currentUsername = 'Guest'; 
        currentUserId = null; 
        showScreen('auth'); 
        return; 
    }

    auth.signOut()
        .then(() => {
        })
        .catch((error) => {
            console.error("Logout Error:", error);
            showScreen('auth'); 
        });
}

// --- PAUSE/RESUME/QUIT FUNCTIONS ---
function pauseGame() {
    if (!gameRunning || gamePaused || GAME_OVER_SCREEN.style.display === 'flex' || LEADERBOARD_SCREEN.style.display === 'flex') return; 

    gamePaused = true;
    
    clearInterval(healthDrainInterval);
    clearInterval(scoreInterval);
    clearInterval(spawnInterval);
    cancelAnimationFrame(gameLoopRAF);
    
    GAME_MUSIC.pause();
    
    PAUSE_SCREEN.style.display = 'flex';
    FULL_FLAME.style.animationPlayState = 'paused';
    MESSAGE_DISPLAY.textContent = 'Game Paused. Press ESC or Resume to continue.';
}

function resumeGame() {
    if (!gameRunning || !gamePaused) return;

    gamePaused = false;
    
    startTimers(); 
    
    gameLoopRAF = requestAnimationFrame(gameLoop);
    
    GAME_MUSIC.play().catch(e => {}); 
    PAUSE_SCREEN.style.display = 'none';
    FULL_FLAME.style.animationPlayState = 'running';
    MESSAGE_DISPLAY.textContent = 'Game resumed! Stay focused.';
    MESSAGE_DISPLAY.className = 'text-sm text-yellow-400 mt-4';
}

function quitGame() {
    if (gameRunning) gameOver(false); 
    gamePaused = false; 
    PAUSE_SCREEN.style.display = 'none';
    showScreen('welcome'); 
}
// --- END PAUSE/RESUME/QUIT FUNCTIONS ---


// --- GAME FUNCTIONS ---
function updateFlameVisual() {
    const heightRatio = health / MAX_HEALTH;
    const newHeight = Math.max(0, heightRatio * FLAME_MAX_HEIGHT_PX);
    FULL_FLAME.style.height = `${newHeight}px`;

    const shadowOpacity = heightRatio * 0.9 + 0.1; 
    FULL_FLAME.style.opacity = shadowOpacity;

    if (health <= 0) {
        health = 0;
        FULL_FLAME.style.height = `0px`; 
        gameOver(true); 
    }
}

function startTimers() {
    // Stop any existing timers first (needed for resumeGame)
    clearInterval(healthDrainInterval);
    clearInterval(scoreInterval);
    clearInterval(spawnInterval);
    
    healthDrainInterval = setInterval(() => {
        if (!gameRunning || gamePaused) return; 
        health = Math.max(0, health - 2);
        updateFlameVisual();
    }, 500); 

    scoreInterval = setInterval(() => {
        if (!gameRunning || gamePaused) return; 
        score += 1;
        SCORE_DISPLAY.textContent = score;
    }, 1000);

    spawnInterval = setInterval(spawnObject, SPAWN_INTERVAL_MS); 
}

function spawnObject() {
    if (!gameRunning || gamePaused) return; 

    timeSinceLastShield += SPAWN_INTERVAL_MS;
    
    let spawnableObjects = {};
    spawnableObjects.ember = OBJECTS.ember;
    spawnableObjects.water = OBJECTS.water;
    spawnableObjects.extinguisher = OBJECTS.extinguisher;

    if (timeSinceLastShield >= SHIELD_MIN_GAP_MS) {
        spawnableObjects['shield-powerup'] = OBJECTS['shield-powerup'];
    }
    
    let availableKeys = Object.keys(spawnableObjects);
    let totalWeight = availableKeys.reduce((sum, key) => sum + spawnableObjects[key].spawnRate, 0);
    
    if (totalWeight === 0) return; 
    
    let randomNum = Math.random() * totalWeight;
    let selectedKey;
    for (const key of availableKeys) {
        randomNum -= spawnableObjects[key].spawnRate;
        if (randomNum <= 0) {
            selectedKey = key;
            break;
        }
    }
    if (!selectedKey) selectedKey = availableKeys[availableKeys.length - 1]; 

    if (selectedKey === 'shield-powerup') {
        timeSinceLastShield = 0; 
    }

    const config = OBJECTS[selectedKey];
    const objectEl = document.createElement('div');
    objectEl.classList.add('falling-object');
    objectEl.dataset.type = selectedKey;
    objectEl.textContent = config.emoji;

    const gameWidth = GAME_AREA.offsetWidth;
    const startX = Math.random() * (gameWidth - 40); 
    objectEl.style.left = `${startX}px`;
    objectEl.style.top = `-50px`; 
    
    objectEl.style.y = -50; 

    GAME_AREA.appendChild(objectEl);
    
    fallingObjects.push(objectEl);
}

function activateShield() { 
    if (shieldActive) return; 
    SHIELD_SOUND.currentTime = 0; 
    SHIELD_SOUND.play().catch(e => console.log('Shield Sound Error:', e));
    shieldActive = true;
    clearTimeout(shieldTimer); 
    PLAYER.classList.add('shield-active'); 
    SHIELD_TIMER_DISPLAY.classList.remove('hidden');

    const shieldStartTime = Date.now();
    
    const updateCountdown = () => {
        if (!gameRunning || gamePaused) return; 
        
        const elapsed = Date.now() - shieldStartTime;
        const remainingTime = SHIELD_DURATION_MS - elapsed;
        const percent = (remainingTime / SHIELD_DURATION_MS) * 100;
        
        if (remainingTime <= 0) {
            SHIELD_COUNTDOWN_BAR.style.width = `0%`;
            return;
        }

        SHIELD_COUNTDOWN_BAR.style.width = `${percent}%`;
        
        if (shieldActive) {
            requestAnimationFrame(updateCountdown);
        }
    };
    requestAnimationFrame(updateCountdown); 

    shieldTimer = setTimeout(() => {
        if (!gameRunning || gamePaused) return; 
        shieldActive = false;
        SHIELD_TIMER_DISPLAY.classList.add('hidden');
        PLAYER.classList.remove('shield-active'); 
        MESSAGE_DISPLAY.textContent = 'Shield deactivated. Be careful!';
        MESSAGE_DISPLAY.className = 'text-sm text-yellow-400 mt-4';
    }, SHIELD_DURATION_MS);

    MESSAGE_DISPLAY.textContent = `SHIELD ACTIVATED! Invulnerability for ${SHIELD_DURATION_MS / 1000}s.`;
    MESSAGE_DISPLAY.className = 'text-sm text-green-400 mt-4';
}

function gameLoop() {
    if (!gameRunning) {
        cancelAnimationFrame(gameLoopRAF);
        return;
    }
    if (gamePaused) { 
        gameLoopRAF = requestAnimationFrame(gameLoop); 
        return; 
    }

    const speed = 15; 
    const maxRight = GAME_AREA.offsetWidth - (PLAYER_WIDTH)/3;
    
    const gameHeight = GAME_AREA.offsetHeight;
    
    // Player movement logic 
    if (keysPressed['ArrowLeft'] || keysPressed['a']) {
        playerX = Math.max(0, playerX - speed);
    } 
    if (keysPressed['ArrowRight'] || keysPressed['d']) {
        playerX = Math.min(maxRight, playerX + speed);
    }
    PLAYER.style.left = `${playerX}px`;

    const playerRect = PLAYER.getBoundingClientRect();
    
    const newFallingObjects = [];

    fallingObjects.forEach(objectEl => {
        
        if (!objectEl.parentNode) return;

        let currentY = parseFloat(objectEl.style.top.replace('px', ''));
        const itemSpeed = 1.5 + (score * 0.01); 
        currentY += itemSpeed;
        objectEl.style.top = `${currentY}px`;

        let shouldRemove = false; 

        // 1. Off-screen Check
        if (currentY > gameHeight) {
            shouldRemove = true;
        } 
        // 2. Collision Check
        else {
            const objectRect = objectEl.getBoundingClientRect();

            if (objectRect.bottom > playerRect.top &&
                objectRect.top < playerRect.bottom &&
                objectRect.left < playerRect.right &&
                objectRect.right > playerRect.left) {
                
                const type = objectEl.dataset.type;
                const config = OBJECTS[type];
                
                if (type === 'shield-powerup') {
                    if (!shieldActive) {
                        activateShield();
                        score += config.score; 
                    } else {
                        score += 10;
                    }
                    shouldRemove = true;
                } 
                else if (config.type === 'hazard' && shieldActive) {
                    MESSAGE_DISPLAY.textContent = `Shield blocked the ${config.emoji}!`;
                    MESSAGE_DISPLAY.className = 'text-sm text-cyan-300 mt-4';
                } 
                else if (type === 'ember' && shieldActive) {
                    COLLECT_SOUND.currentTime = 0;
                    COLLECT_SOUND.play().catch(e => {});
                    health = Math.min(MAX_HEALTH, health + config.health);
                    score += config.score;
                    MESSAGE_DISPLAY.textContent = `EMBER collected! +${config.health} Health while shielded.`;
                    MESSAGE_DISPLAY.className = 'text-sm text-yellow-400 mt-4';
                    shouldRemove = true;
                }
                else {
                    if (config.type === 'resource') {
                        COLLECT_SOUND.currentTime = 0;
                        COLLECT_SOUND.play().catch(e => {});
                    }
                    if (config.type==='hazard'){
                        COLLECTED_SOUND.currentTime = 0;
                        COLLECTED_SOUND.play().catch(e => {});
                    }

                    health = Math.min(MAX_HEALTH, Math.max(0, health + config.health));
                    score += config.score;

                    MESSAGE_DISPLAY.textContent = config.health > 0 ? 
                        `+${config.health} Health (${config.emoji})` : 
                        `${config.health} Health (${config.emoji})`;
                    MESSAGE_DISPLAY.className = config.health > 0 ? 'text-sm text-green-400 mt-4' : 'text-sm text-red-500 mt-4';
                    shouldRemove = true;
                }
            }
        }
        
        if (shouldRemove) {
            objectEl.remove();
        } else {
            newFallingObjects.push(objectEl);
        }
    });

    SCORE_DISPLAY.textContent = score;
    updateFlameVisual();
    
    fallingObjects = newFallingObjects;

    gameLoopRAF = requestAnimationFrame(gameLoop);
}

function gameOver(isDeath = true) {
    gameRunning = false;
    
    clearInterval(healthDrainInterval);
    clearInterval(scoreInterval);
    clearInterval(spawnInterval);
    clearTimeout(shieldTimer);
    cancelAnimationFrame(gameLoopRAF);
    
    GAME_MUSIC.pause();
    
    shieldActive = false; 
    PLAYER.classList.remove('shield-active'); 
    SHIELD_TIMER_DISPLAY.classList.add('hidden'); 
    gamePaused = false; 
    
    fallingObjects.forEach(el => el.remove());
    fallingObjects = []; 

    if (isDeath) {
        GAME_OVER_SOUND.currentTime = 0;
        GAME_OVER_SOUND.play().catch(e => {});
        
        FULL_FLAME.style.animationPlayState = 'paused';
        MESSAGE_DISPLAY.textContent = 'Game Over! Hit Restart.';
        MESSAGE_DISPLAY.className = 'text-sm text-red-500 mt-4';

        saveHighScore();
        showGameOverScreen(); 
    }
}


function startGame() {
    const gameWidth = GAME_AREA.offsetWidth;
    playerX = (gameWidth / 2) - (PLAYER_WIDTH / 2);
    PLAYER.style.left = `${playerX}px`;

    health = MAX_HEALTH;
    score = 0;
    shieldActive = false;
    gameRunning = true; 
    gamePaused = false; 
    keysPressed = {}; 
    timeSinceLastShield = SHIELD_MIN_GAP_MS;
    
    fallingObjects.forEach(el => el.remove());
    fallingObjects = [];
    
    GAME_OVER_SOUND.pause();
    GAME_OVER_SOUND.currentTime = 0;
    
    GAME_MUSIC.play().catch(e => {}); 
    
    GAME_OVER_SCREEN.style.display = 'none';
    LEADERBOARD_SCREEN.style.display = 'none';
    PAUSE_SCREEN.style.display = 'none'; 
    MESSAGE_DISPLAY.textContent = 'Collect 🛡️ for a shield!';
    MESSAGE_DISPLAY.className = 'text-sm text-yellow-400 mt-4';
    SCORE_DISPLAY.textContent = score;
    FULL_FLAME.style.animationPlayState = 'running';
    
    PLAYER.classList.remove('shield-active'); 
    SHIELD_TIMER_DISPLAY.classList.add('hidden');

    updateFlameVisual();
    
    startTimers(); 

    gameLoopRAF = requestAnimationFrame(gameLoop);
}

// --- EVENT AND RESIZE HANDLERS ---
function handleUserInteraction() {
    if (gameRunning && !gamePaused) {
        GAME_MUSIC.play().catch(e => {}); 
    }
}

document.addEventListener('keydown', (e) => {
    handleUserInteraction();
    
    if (e.key === 'Escape') {
        if (gameRunning && !gamePaused && GAME_OVER_SCREEN.style.display !== 'flex' && LEADERBOARD_SCREEN.style.display !== 'flex') {
            pauseGame();
        } else if (gamePaused) {
            resumeGame();
        }
        return; 
    }

    if (!gameRunning || gamePaused) return; 
    
    keysPressed[e.key] = true;
    if (e.key === 'a') keysPressed['ArrowLeft'] = true;
    if (e.key === 'd') keysPressed['ArrowRight'] = true;
});

document.addEventListener('keyup', (e) => {
    if (!gameRunning || gamePaused) return;
    keysPressed[e.key] = false;
    if (e.key === 'a') keysPressed['ArrowLeft'] = false;
    if (e.key === 'd') keysPressed['ArrowRight'] = false;
});

let touchStartX = 0;
document.addEventListener('touchstart', (e) => {
    handleUserInteraction();
    if (!gameRunning || gamePaused || e.touches.length !== 1 || e.target.closest('#uiPanel')) return;
    touchStartX = e.touches[0].clientX;
});

document.addEventListener('touchmove', (e) => {
    if (!gameRunning || gamePaused || e.touches.length !== 1) return;
    const touchMoveX = e.touches[0].clientX;
    const deltaX = touchMoveX - touchStartX;
    
    const maxRight = GAME_AREA.offsetWidth - PLAYER_WIDTH;
    const dragSpeed = 1.5; 

    if (Math.abs(deltaX) > 1) { 
        playerX = Math.min(maxRight, Math.max(0, playerX + deltaX * dragSpeed));
        touchStartX = touchMoveX; 
    }
}, { passive: true });

window.addEventListener('resize', () => {
    if (gameRunning && !gamePaused) {
         const gameWidth = GAME_AREA.offsetWidth;
         playerX = Math.min(gameWidth - PLAYER_WIDTH, Math.max(0, playerX));
    }
});

// --- FIREBASE AUTH STATE LISTENER ---
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUsername = user.displayName  || 'Player'; 
        currentUserId = user.uid; 
        if (DASHBOARD.style.display === 'none') {
            showScreen('welcome');
        }
    } else {
        currentUserId = null; 
        showScreen('auth'); 
    }
});

// --- INITIALIZATION & EVENT LISTENERS ---
LOGIN_TAB_BTN.addEventListener('click', () => {
    LOGIN_FORM.classList.remove('hidden');
    SIGNUP_FORM.classList.add('hidden');
    
    // Adjusting tab button classes for selected/unselected state
    LOGIN_TAB_BTN.classList.add('glass-button-primary', 'text-white');
    LOGIN_TAB_BTN.classList.remove('text-gray-300');
    
    SIGNUP_TAB_BTN.classList.remove('glass-button-primary', 'glass-button-accent', 'text-white');
    SIGNUP_TAB_BTN.classList.add('text-gray-300'); // Ensure text is subdued on unselected tab

    AUTH_MESSAGE.textContent = '';
});

SIGNUP_TAB_BTN.addEventListener('click', () => {
    SIGNUP_FORM.classList.remove('hidden');
    LOGIN_FORM.classList.add('hidden');
    
    // Adjusting tab button classes for selected/unselected state
    SIGNUP_TAB_BTN.classList.add('glass-button-accent', 'text-white');
    SIGNUP_TAB_BTN.classList.remove('text-gray-300');
    
    LOGIN_TAB_BTN.classList.remove('glass-button-primary', 'text-white');
    LOGIN_TAB_BTN.classList.add('text-gray-300'); // Ensure text is subdued on unselected tab

    AUTH_MESSAGE.textContent = '';
});

document.getElementById('loginButton').addEventListener('click', handleLogin);
document.getElementById('signupButton').addEventListener('click', handleSignup);
document.getElementById('guestButton').addEventListener('click', handleGuestPlay);

START_GAME_BUTTON.addEventListener('click', () => showScreen('game'));
WELCOME_LOGOUT_BUTTON.addEventListener('click', handleLogout);

// Game Over Screen Buttons
RESTART_BUTTON.addEventListener('click', () => showScreen('game')); 
LOGOUT_BUTTON.addEventListener('click', handleLogout);
SHOW_LEADERBOARD_BUTTON.addEventListener('click', showLeaderboardScreen);

// Leaderboard Screen Button
LEADERBOARD_BACK_TO_GAME_BUTTON.addEventListener('click', showGameOverScreen);

// Pause Screen Buttons
RESUME_BUTTON.addEventListener('click', resumeGame);
QUIT_GAME_BUTTON.addEventListener('click', quitGame);


document.addEventListener('DOMContentLoaded', () => {
     gameRunning = false;
     // The Firebase auth listener will handle the initial screen, 
     // but if it's not ready, we ensure auth screen is shown as a fallback.
     if (!auth.currentUser) {
        showScreen('auth');
     }
});