// Configuration
const CELL_SIZE = 32;
const GRID_WIDTH = 12;
const GRID_HEIGHT = 20;
const BG_COLOR = '#1a1a1a';
const MIN_SWIPE_DISTANCE = 50;

// Sprite paths
const SPRITE_PATHS = {
    head_up: './images/head_up.png',
    head_down: './images/head_down.png',
    head_left: './images/head_left.png',
    head_right: './images/head_right.png',
    tail_up: './images/tail_up.png',
    tail_down: './images/tail_down.png',
    tail_left: './images/tail_left.png',
    tail_right: './images/tail_right.png',
    body_vertical: './images/body_vertical.png',
    body_horizontal: './images/body_horizontal.png',
    body_topleft: './images/body_topleft.png',
    body_topright: './images/body_topright.png',
    body_bottomleft: './images/body_bottomleft.png',
    body_bottomright: './images/body_bottomright.png',
    apple: './images/apple.png',
    grass: './images/grass.png',
    melon_slice: './images/melon_slice.png',
    survivor: './images/survivor.png',
    banana: './images/banana.png',
    ghost: './images/ghost.png',
    stall_spritesheet: './images/stall_red.png'
};

// Sound paths
const SOUND_PATHS = {
    eat: './sounds/eat.wav',
    game_over: './sounds/game_over.wav',
    powerup: './sounds/powerup.wav'
};

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Sprite & Sound storage
const sprites = {};
const sounds = {};
let spritesLoaded = false;
let soundsLoaded = false;

// Spritesheet animation
const STALL_FRAMES = 4;
const STALL_FRAME_WIDTH = 32;
let animationFrame = 0;
let animationTimer = 0;
const ANIMATION_SPEED = 0.2;

// Game state
let gameMode = 'classic';
let timeAttackTimer = 0;
const TIME_ATTACK_DURATION = 60;
let currentSkin = 'classic';
const SKINS = {
    classic: { head: '#22c55e', body: '#16a34a', name: 'Classic Green' },
    blue: { head: '#3b82f6', body: '#1d4ed8', name: 'Ocean Blue' },
    purple: { head: '#a855f7', body: '#7e22ce', name: 'Royal Purple' },
    golden: { head: '#fbbf24', body: '#d97706', name: 'Golden Snake' },
    rainbow: { head: 'rainbow', body: 'rainbow', name: 'Rainbow' }
};
let rainbowHue = 0;

let snakeBody = [];
let direction = { x: 0, y: 1 };
let nextDirection = { x: 0, y: 1 };
let foodPosition = { x: 0, y: 0 };
let specialFoodPosition = { x: 0, y: 0 };
let specialFoodType = '';
let specialFoodActive = false;
let obstacles = [];
const MAX_OBSTACLES = 5;
let score = 0;
let highScore = 0;
let level = 1;
let gameOver = false;
let paused = false;
let moveInterval = 0.2;
let moveTimer = 0;
let lastTime = 0;

// Ghost mode
let ghostMode = false;
let ghostTimer = 0;
const GHOST_DURATION = 20;

// Settings
let soundEnabled = true;
let vibrationEnabled = true;
let showSettings = false;

// Touch handling
let touchStart = { x: 0, y: 0 };

// Particles
let particles = [];

// Responsive scaling
let scaleFactor = 1;
let offsetX = 0;
let offsetY = 0;

// Audio context
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// ============ LOAD RESOURCES ============

async function loadSprites() {
    const loadingStatus = document.getElementById('loadingStatus');
    const spriteNames = Object.keys(SPRITE_PATHS);
    let loadedCount = 0;
    
    const loadPromises = spriteNames.map(name => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                sprites[name] = img;
                loadedCount++;
                loadingStatus.textContent = `Sprites: ${loadedCount}/${spriteNames.length}`;
                resolve();
            };
            img.onerror = () => {
                console.warn(`Failed to load sprite: ${name}`);
                sprites[name] = null;
                loadedCount++;
                loadingStatus.textContent = `Sprites: ${loadedCount}/${spriteNames.length}`;
                resolve();
            };
            img.src = SPRITE_PATHS[name];
        });
    });
    
    await Promise.all(loadPromises);
    spritesLoaded = true;
    await loadSounds();
    
    loadingStatus.textContent = 'Vita! 🎮';
    setTimeout(() => {
        document.getElementById('loadingScreen').style.display = 'none';
        init();
    }, 500);
}

async function loadSounds() {
    const loadingStatus = document.getElementById('loadingStatus');
    const soundNames = Object.keys(SOUND_PATHS);
    let loadedCount = 0;
    
    const loadPromises = soundNames.map(name => {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.oncanplaythrough = () => {
                sounds[name] = audio;
                loadedCount++;
                loadingStatus.textContent = `Sounds: ${loadedCount}/${soundNames.length}`;
                resolve();
            };
            audio.onerror = () => {
                console.warn(`Failed to load sound: ${name}`);
                sounds[name] = null;
                loadedCount++;
                loadingStatus.textContent = `Sounds: ${loadedCount}/${soundNames.length}`;
                resolve();
            };
            audio.src = SOUND_PATHS[name];
            audio.load();
        });
    });
    
    await Promise.all(loadPromises);
    soundsLoaded = true;
}

// ============ INITIALIZATION ============

function init() {
    loadSettings();
    loadHighScore();
    loadSkin();
    loadGameMode();
    setupCanvas();
    resetGame();
    setupEventListeners();
    requestAnimationFrame(gameLoop);
}

function setupCanvas() {
    const gameWidth = GRID_WIDTH * CELL_SIZE;
    const gameHeight = GRID_HEIGHT * CELL_SIZE;
    
    const scaleX = window.innerWidth / gameWidth;
    const scaleY = window.innerHeight / gameHeight;
    scaleFactor = Math.min(scaleX, scaleY);
    
    canvas.width = gameWidth;
    canvas.height = gameHeight;
    canvas.style.width = `${gameWidth * scaleFactor}px`;
    canvas.style.height = `${gameHeight * scaleFactor}px`;
    
    const scaledWidth = gameWidth * scaleFactor;
    const scaledHeight = gameHeight * scaleFactor;
    offsetX = (window.innerWidth - scaledWidth) / 2;
    offsetY = (window.innerHeight - scaledHeight) / 2;
}

function resetGame() {
    snakeBody = [
        { x: Math.floor(GRID_WIDTH / 2), y: Math.floor(GRID_HEIGHT / 2) },
        { x: Math.floor(GRID_WIDTH / 2), y: Math.floor(GRID_HEIGHT / 2) - 1 },
        { x: Math.floor(GRID_WIDTH / 2), y: Math.floor(GRID_HEIGHT / 2) - 2 }
    ];
    direction = { x: 0, y: 1 };
    nextDirection = { x: 0, y: 1 };
    score = 0;
    level = 1;
    gameOver = false;
    paused = false;
    ghostMode = false;
    ghostTimer = 0;
    specialFoodActive = false;
    obstacles = [];
    particles = [];
    rainbowHue = 0;
    
    // Mode-specific setup
    if (gameMode === 'timeattack') {
        timeAttackTimer = TIME_ATTACK_DURATION;
        moveInterval = 0.15;
        document.getElementById('timerDisplay').style.display = 'block';
    } else if (gameMode === 'survival') {
        moveInterval = 0.18;
        document.getElementById('timerDisplay').style.display = 'none';
    } else if (gameMode === 'zen') {
        moveInterval = 0.25;
        document.getElementById('timerDisplay').style.display = 'none';
    } else {
        moveInterval = 0.2;
        document.getElementById('timerDisplay').style.display = 'none';
    }
    
    spawnFood();
    spawnObstacles();
    updateUI();
    document.getElementById('gameOverOverlay').style.display = 'none';
}

// ============ FOOD & OBSTACLES ============

function spawnFood() {
    do {
        foodPosition = {
            x: Math.floor(Math.random() * GRID_WIDTH),
            y: Math.floor(Math.random() * GRID_HEIGHT)
        };
    } while (snakeBody.some(s => s.x === foodPosition.x && s.y === foodPosition.y));
    
    if (Math.random() < 0.2) {
        spawnSpecialFood();
    }
}

function spawnSpecialFood() {
    do {
        specialFoodPosition = {
            x: Math.floor(Math.random() * GRID_WIDTH),
            y: Math.floor(Math.random() * GRID_HEIGHT)
        };
    } while (
        snakeBody.some(s => s.x === specialFoodPosition.x && s.y === specialFoodPosition.y) ||
        (specialFoodPosition.x === foodPosition.x && specialFoodPosition.y === foodPosition.y)
    );
    
    const types = ['golden', 'speed', 'slow', 'ghost'];
    specialFoodType = types[Math.floor(Math.random() * types.length)];
    specialFoodActive = true;
}

function spawnObstacles() {
    obstacles = [];
    
    if (gameMode === 'zen') return;
    
    let numObstacles;
    if (gameMode === 'survival') {
        numObstacles = Math.min(MAX_OBSTACLES + 3, Math.floor(level / 2) + 5);
    } else {
        numObstacles = Math.min(MAX_OBSTACLES, Math.floor(level / 2));
    }
    
    for (let i = 0; i < numObstacles; i++) {
        let pos;
        let attempts = 0;
        do {
            pos = {
                x: Math.floor(Math.random() * GRID_WIDTH),
                y: Math.floor(Math.random() * GRID_HEIGHT)
            };
            attempts++;
        } while (
            (snakeBody.some(s => s.x === pos.x && s.y === pos.y) ||
            (pos.x === foodPosition.x && pos.y === foodPosition.y) ||
            (specialFoodActive && pos.x === specialFoodPosition.x && pos.y === specialFoodPosition.y) ||
            obstacles.some(o => o.x === pos.x && o.y === pos.y)) &&
            attempts < 100
        );
        
        if (attempts < 100) {
            obstacles.push(pos);
        }
    }
}

// ============ GAME LOOP ============

function gameLoop(currentTime) {
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    if (!gameOver && !paused && !showSettings) {
        update(deltaTime);
    }
    
    render();
    requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
    // Time Attack timer
    if (gameMode === 'timeattack' && !gameOver) {
        timeAttackTimer -= deltaTime;
        document.getElementById('timerDisplay').textContent = `${Math.ceil(timeAttackTimer)}s`;
        
        if (timeAttackTimer <= 0) {
            endGame();
            return;
        }
    }
    
    if (ghostMode) {
        ghostTimer -= deltaTime;
        if (ghostTimer <= 0) {
            ghostMode = false;
            document.getElementById('ghostModeDisplay').style.display = 'none';
        } else {
            document.getElementById('ghostModeDisplay').textContent = `GHOST: ${Math.ceil(ghostTimer)}s`;
        }
    }
    
    // Rainbow animation
    if (currentSkin === 'rainbow') {
        rainbowHue = (rainbowHue + deltaTime * 100) % 360;
    }
    
    // Spritesheet animation
    animationTimer += deltaTime;
    if (animationTimer >= ANIMATION_SPEED) {
        animationTimer = 0;
        animationFrame = (animationFrame + 1) % STALL_FRAMES;
    }
    
    moveTimer += deltaTime;
    if (moveTimer >= moveInterval) {
        moveTimer = 0;
        moveSnake();
    }
    
    updateParticles(deltaTime);
}

function moveSnake() {
    direction = { ...nextDirection };
    
    let newHead = {
        x: snakeBody[0].x + direction.x,
        y: snakeBody[0].y + direction.y
    };
    
    if (ghostMode) {
        if (newHead.x < 0) newHead.x = GRID_WIDTH - 1;
        else if (newHead.x >= GRID_WIDTH) newHead.x = 0;
        if (newHead.y < 0) newHead.y = GRID_HEIGHT - 1;
        else if (newHead.y >= GRID_HEIGHT) newHead.y = 0;
    } else {
        if (newHead.x < 0 || newHead.x >= GRID_WIDTH || 
            newHead.y < 0 || newHead.y >= GRID_HEIGHT) {
            endGame();
            return;
        }
    }
    
    if (snakeBody.some(s => s.x === newHead.x && s.y === newHead.y)) {
        endGame();
        return;
    }
    
    if (!ghostMode && obstacles.some(o => o.x === newHead.x && o.y === newHead.y)) {
        endGame();
        return;
    }
    
    snakeBody.unshift(newHead);
    
    if (newHead.x === foodPosition.x && newHead.y === foodPosition.y) {
        score += 10;
        level = Math.floor(score / 50) + 1;
        createParticles(foodPosition.x * CELL_SIZE + CELL_SIZE / 2,
            foodPosition.y * CELL_SIZE + CELL_SIZE / 2, '#22c55e');
        playEatSound();
        vibrate(50);
        spawnFood();
        
        if (score % 50 === 0) {
            spawnObstacles();
        }
        
        if (gameMode === 'survival') {
            snakeBody.pop();
        }
        
        moveInterval = Math.max(0.08, moveInterval - 0.003);
        updateUI();
    } else if (specialFoodActive && newHead.x === specialFoodPosition.x &&
        newHead.y === specialFoodPosition.y) {
        handleSpecialFood();
    } else {
        snakeBody.pop();
    }
}

function handleSpecialFood() {
    const x = specialFoodPosition.x * CELL_SIZE + CELL_SIZE/2;
    const y = specialFoodPosition.y * CELL_SIZE + CELL_SIZE/2;
    
    switch(specialFoodType) {
        case 'golden':
            score += 50;
            level = Math.floor(score / 50) + 1;
            createParticles(x, y, '#fbbf24');
            break;
        case 'speed':
            moveInterval = Math.max(0.05, moveInterval - 0.05);
            createParticles(x, y, '#06b6d4');
            break;
        case 'slow':
            moveInterval = Math.min(0.25, moveInterval + 0.05);
            createParticles(x, y, '#3b82f6');
            break;
        case 'ghost':
            ghostMode = true;
            ghostTimer = GHOST_DURATION;
            document.getElementById('ghostModeDisplay').style.display = 'block';
            createParticles(x, y, '#a855f7');
            break;
    }
    
    playPowerupSound();
    vibrate(100);
    specialFoodActive = false;
    updateUI();
}

function endGame() {
    gameOver = true;
    playDeathSound();
    vibrate(300);
    
    if (score > highScore) {
        highScore = score;
        saveHighScore();
        document.getElementById('newRecord').style.display = 'block';
    } else {
        document.getElementById('newRecord').style.display = 'none';
    }
    
    document.getElementById('finalScore').textContent = `Score: ${score} | Level: ${level}`;
    document.getElementById('gameOverOverlay').style.display = 'flex';
}

// ============ RENDERING ============

function getHeadSprite() {
    if (!spritesLoaded) return null;
    if (direction.y === -1) return sprites.head_up;
    if (direction.y === 1) return sprites.head_down;
    if (direction.x === -1) return sprites.head_left;
    if (direction.x === 1) return sprites.head_right;
    return sprites.head_down;
}

function getTailSprite(index) {
    if (!spritesLoaded || snakeBody.length < 2) return null;
    
    const tail = snakeBody[index];
    const beforeTail = snakeBody[index - 1];
    const dx = tail.x - beforeTail.x;
    const dy = tail.y - beforeTail.y;
    
    if (dy === -1) return sprites.tail_up;
    if (dy === 1) return sprites.tail_down;
    if (dx === -1) return sprites.tail_left;
    if (dx === 1) return sprites.tail_right;
    return sprites.tail_down;
}

function getBodySprite(index) {
    if (!spritesLoaded || index === 0 || index >= snakeBody.length - 1) return null;
    
    const current = snakeBody[index];
    const prev = snakeBody[index - 1];
    const next = snakeBody[index + 1];
    
    const fromPrev = { x: current.x - prev.x, y: current.y - prev.y };
    const toNext = { x: next.x - current.x, y: next.y - current.y };
    
    if (fromPrev.x === 0 && toNext.x === 0) return sprites.body_vertical;
    if (fromPrev.y === 0 && toNext.y === 0) return sprites.body_horizontal;
    
    if ((fromPrev.x > 0 && toNext.y < 0) || (fromPrev.y > 0 && toNext.x < 0)) 
        return sprites.body_topleft;
    if ((fromPrev.x > 0 && toNext.y > 0) || (fromPrev.y < 0 && toNext.x < 0)) 
        return sprites.body_bottomleft;
    if ((fromPrev.x < 0 && toNext.y < 0) || (fromPrev.y > 0 && toNext.x > 0)) 
        return sprites.body_topright;
    if ((fromPrev.x < 0 && toNext.y > 0) || (fromPrev.y < 0 && toNext.x > 0)) 
        return sprites.body_bottomright;
    
    return sprites.body_vertical;
}

function render() {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grass background
    if (sprites.grass && spritesLoaded) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            for (let y = 0; y < GRID_HEIGHT; y++) {
                ctx.drawImage(sprites.grass, x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
        }
    } else {
        // Checkerboard fallback
        ctx.fillStyle = '#0f0f0f';
        for (let x = 0; x < GRID_WIDTH; x++) {
            for (let y = 0; y < GRID_HEIGHT; y++) {
                if ((x + y) % 2 === 0) {
                    ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                }
            }
        }
    }
    
    // Particles
    particles.forEach(p => {
        ctx.globalAlpha = p.lifetime / p.maxLifetime;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
    
    // Snake
    snakeBody.forEach((segment, i) => {
        const x = segment.x * CELL_SIZE;
        const y = segment.y * CELL_SIZE;
        
        let sprite = null;
        if (i === 0) {
            sprite = getHeadSprite();
        } else if (i === snakeBody.length - 1) {
            sprite = getTailSprite(i);
        } else {
            sprite = getBodySprite(i);
        }
        
        if (sprite && spritesLoaded) {
            ctx.save();
            if (ghostMode) ctx.globalAlpha = 0.6;
            
            if (currentSkin === 'rainbow') {
                ctx.filter = `hue-rotate(${rainbowHue}deg) saturate(150%)`;
            }
            
            ctx.drawImage(sprite, x, y, CELL_SIZE, CELL_SIZE);
            ctx.restore();
        } else {
            // Fallback with skin colors
            let headColor, bodyColor;
            
            if (currentSkin === 'rainbow') {
                headColor = `hsl(${rainbowHue}, 100%, 50%)`;
                bodyColor = `hsl(${(rainbowHue + 30) % 360}, 100%, 40%)`;
            } else {
                const skin = SKINS[currentSkin];
                headColor = skin.head;
                bodyColor = skin.body;
            }
            
            if (ghostMode) {
                ctx.globalAlpha = 0.6;
                ctx.fillStyle = '#8b5cf6';
            } else {
                ctx.fillStyle = i === 0 ? headColor : bodyColor;
            }
            ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
            ctx.globalAlpha = 1;
        }
    });
    
    // Food
    if (sprites.apple && spritesLoaded) {
        ctx.drawImage(sprites.apple, 
            foodPosition.x * CELL_SIZE, 
            foodPosition.y * CELL_SIZE, 
            CELL_SIZE, CELL_SIZE);
    } else {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(foodPosition.x * CELL_SIZE + CELL_SIZE/2, 
               foodPosition.y * CELL_SIZE + CELL_SIZE/2, 
               CELL_SIZE/2 - 4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Special food
    if (specialFoodActive) {
        const x = specialFoodPosition.x * CELL_SIZE;
        const y = specialFoodPosition.y * CELL_SIZE;
        
        let sprite = null;
        let color = '#fbbf24';
        
        switch(specialFoodType) {
            case 'speed':
                sprite = sprites.melon_slice;
                color = '#06b6d4';
                break;
            case 'slow':
                sprite = sprites.banana;
                color = '#3b82f6';
                break;
            case 'ghost':
                sprite = sprites.ghost;
                color = '#a855f7';
                break;
            case 'golden':
                sprite = sprites.survivor;
                color = '#fbbf24';
                break;
        }
        
        if (sprite && spritesLoaded) {
            ctx.drawImage(sprite, x, y, CELL_SIZE, CELL_SIZE);
        } else {
            ctx.fillStyle = color;
            ctx.fillRect(x + 6, y + 6, CELL_SIZE - 12, CELL_SIZE - 12);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 6, y + 6, CELL_SIZE - 12, CELL_SIZE - 12);
        }
    }
    
    // Obstacles
    obstacles.forEach(obs => {
        const x = obs.x * CELL_SIZE;
        const y = obs.y * CELL_SIZE;
        
        if (sprites.stall_spritesheet && spritesLoaded) {
            const frameX = animationFrame * STALL_FRAME_WIDTH;
            ctx.drawImage(
                sprites.stall_spritesheet,
                frameX, 0,
                STALL_FRAME_WIDTH, CELL_SIZE,
                x, y,
                CELL_SIZE, CELL_SIZE
            );
        } else {
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(x + 4, y + 4, CELL_SIZE - 8, CELL_SIZE - 8);
            
            ctx.fillStyle = '#6b6b6b';
            ctx.fillRect(x + 6, y + 6, CELL_SIZE - 16, CELL_SIZE - 16);
            
            ctx.strokeStyle = '#2a2a2a';
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 4, y + 4, CELL_SIZE - 8, CELL_SIZE - 8);
        }
    });
}

// ============ PARTICLES ============

function createParticles(x, y, color) {
    for (let i = 0; i < 12; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 160,
            vy: (Math.random() - 0.5) * 160,
            lifetime: Math.random() * 0.2 + 0.3,
            maxLifetime: Math.random() * 0.2 + 0.3,
            size: Math.random() * 2 + 3,
            color: color
        });
    }
}

function updateParticles(deltaTime) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.lifetime -= deltaTime;
        
        if (p.lifetime <= 0) {
            particles.splice(i, 1);
        } else {
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            p.vx *= 0.95;
            p.vy *= 0.95;
        }
    }
}

function updateUI() {
    document.getElementById('scoreDisplay').textContent = `Score: ${score}`;
    document.getElementById('levelDisplay').textContent = `Level: ${level}`;
    document.getElementById('highScoreDisplay').textContent = `Best: ${highScore}`;
}

// ============ EVENT LISTENERS ============

function setupEventListeners() {
    window.addEventListener('resize', setupCanvas);
    
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // Pause button
    document.getElementById('pauseBtn').addEventListener('click', () => {
        if (!gameOver && !showSettings) {
            paused = !paused;
            document.getElementById('pauseOverlay').style.display = paused ? 'flex' : 'none';
            document.getElementById('pauseBtn').textContent = paused ? '▶' : '⏸';
        }
    });
    
    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', () => {
        showSettings = !showSettings;
        document.getElementById('settingsPanel').style.display = showSettings ? 'block' : 'none';
    });
    
    // Sound toggle
    document.getElementById('soundToggle').addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        saveSettings();
        updateSettingsUI();
    });
    
    // Vibration toggle
    document.getElementById('vibrationToggle').addEventListener('click', () => {
        vibrationEnabled = !vibrationEnabled;
        saveSettings();
        updateSettingsUI();
    });
    
    // Close settings
    document.getElementById('closeSettingsBtn').addEventListener('click', () => {
        showSettings = false;
        document.getElementById('settingsPanel').style.display = 'none';
    });
    
    // Game over overlay
    document.getElementById('gameOverOverlay').addEventListener('click', () => {
        if (gameOver) {
            resetGame();
        }
    });
    
    // Pause overlay
    document.getElementById('pauseOverlay').addEventListener('click', () => {
        paused = false;
        document.getElementById('pauseOverlay').style.display = 'none';
        document.getElementById('pauseBtn').textContent = '⏸';
    });
    
    // Mode selector in settings
    document.querySelectorAll('.mode-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            
            // Update active state
            document.querySelectorAll('.mode-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Save and apply mode
            gameMode = mode;
            saveGameMode();
            
            // Show mode info if game is over
            if (gameOver) {
                showModeInfo(mode);
            }
        });
    });
    
    // Skin selector
    document.getElementById('skinSelector').addEventListener('click', () => {
        const skins = Object.keys(SKINS);
        const currentIndex = skins.indexOf(currentSkin);
        const nextIndex = (currentIndex + 1) % skins.length;
        currentSkin = skins[nextIndex];
        
        document.getElementById('skinSelector').textContent = `🎨 ${SKINS[currentSkin].name}`;
        saveSkin();
    });
    
    // Mode info overlay
    document.getElementById('modeInfoBtn').addEventListener('click', () => {
        document.getElementById('modeInfoOverlay').style.display = 'none';
        showSettings = false;
        document.getElementById('settingsPanel').style.display = 'none';
        resetGame();
    });
}

function handleTouchStart(e) {
    e.preventDefault();
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}

function handleTouchEnd(e) {
    e.preventDefault();
    
    if (gameOver || paused || showSettings) return;
    
    const touchEnd = { 
        x: e.changedTouches[0].clientX, 
        y: e.changedTouches[0].clientY 
    };
    
    const dx = touchEnd.x - touchStart.x;
    const dy = touchEnd.y - touchStart.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance >= MIN_SWIPE_DISTANCE) {
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0 && direction.x !== -1) {
                nextDirection = { x: 1, y: 0 };
            } else if (dx < 0 && direction.x !== 1) {
                nextDirection = { x: -1, y: 0 };
            }
        } else {
            if (dy > 0 && direction.y !== -1) {
                nextDirection = { x: 0, y: 1 };
            } else if (dy < 0 && direction.y !== 1) {
                nextDirection = { x: 0, y: -1 };
            }
        }
    }
}

// ============ SETTINGS UI ============

function updateSettingsUI() {
    const soundToggle = document.getElementById('soundToggle');
    const vibrationToggle = document.getElementById('vibrationToggle');
    
    soundToggle.textContent = soundEnabled ? '🔊 Sound: ON' : '🔊 Sound: OFF';
    soundToggle.className = soundEnabled ? 'setting-option on' : 'setting-option off';
    
    vibrationToggle.textContent = vibrationEnabled ? '📳 Vibrate: ON' : '📳 Vibrate: OFF';
    vibrationToggle.className = vibrationEnabled ? 'setting-option on' : 'setting-option off';
}

// ============ STORAGE ============

function saveSettings() {
    localStorage.setItem('snakeSettings', JSON.stringify({
        sound: soundEnabled,
        vibration: vibrationEnabled
    }));
}

function loadSettings() {
    const saved = localStorage.getItem('snakeSettings');
    if (saved) {
        const settings = JSON.parse(saved);
        soundEnabled = settings.sound;
        vibrationEnabled = settings.vibration;
        updateSettingsUI();
    }
}

function saveHighScore() {
    localStorage.setItem('snakeHighScore', highScore.toString());
}

function loadHighScore() {
    const saved = localStorage.getItem('snakeHighScore');
    if (saved) {
        highScore = parseInt(saved);
    }
}

function saveSkin() {
    localStorage.setItem('snakeSkin', currentSkin);
}

function loadSkin() {
    const saved = localStorage.getItem('snakeSkin');
    if (saved && SKINS[saved]) {
        currentSkin = saved;
        document.getElementById('skinSelector').textContent = `🎨 ${SKINS[currentSkin].name}`;
    }
}

function saveGameMode() {
    localStorage.setItem('snakeGameMode', gameMode);
}

function loadGameMode() {
    const saved = localStorage.getItem('snakeGameMode');
    if (saved) {
        gameMode = saved;
        
        // Update active button
        document.querySelectorAll('.mode-option').forEach(btn => {
            if (btn.dataset.mode === gameMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
}

function showModeInfo(mode) {
    const modeInfo = {
        classic: {
            title: 'Classic Mode',
            desc: 'Mode mahazatra - mitombo ny bibilava, miha-sarotra rehefa mitombo level. Obstacles miseho rehefa level up.'
        },
        timeattack: {
            title: 'Time Attack',
            desc: '60 segondra ihany! Mahazo score betsaka araka izay azonao atao. Haingana kokoa noho ny classic.'
        },
        survival: {
            title: 'Survival Mode',
            desc: 'Obstacles maro be! Ny bibilava tsy mitombo, fa ny zavatra sarotra dia ny misoroka ny sakana rehetra.'
        },
        zen: {
            title: 'Zen Mode',
            desc: 'Tsy misy obstacles, mora fotsiny. Mialà sasatra sy miala voly amin\'ity mode ity.'
        }
    };
    
    const info = modeInfo[mode];
    document.getElementById('modeInfoTitle').textContent = info.title;
    document.getElementById('modeInfoDesc').textContent = info.desc;
    document.getElementById('modeInfoOverlay').style.display = 'block';
}

// ============ AUDIO ============

function playEatSound() {
    if (!soundEnabled) return;
    
    if (sounds.eat && soundsLoaded) {
        const audio = sounds.eat.cloneNode();
        audio.volume = 0.3;
        audio.play().catch(e => console.warn('Audio play failed:', e));
    } else {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 400;
        gain.gain.value = 0.1;
        osc.start();
        osc.stop(audioContext.currentTime + 0.1);
    }
}

function playPowerupSound() {
    if (!soundEnabled) return;
    
    if (sounds.powerup && soundsLoaded) {
        const audio = sounds.powerup.cloneNode();
        audio.volume = 0.3;
        audio.play().catch(e => console.warn('Audio play failed:', e));
    } else {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 600;
        gain.gain.value = 0.1;
        osc.start();
        osc.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.2);
        osc.stop(audioContext.currentTime + 0.2);
    }
}

function playDeathSound() {
    if (!soundEnabled) return;
    
    if (sounds.game_over && soundsLoaded) {
        const audio = sounds.game_over.cloneNode();
        audio.volume = 0.4;
        audio.play().catch(e => console.warn('Audio play failed:', e));
    } else {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 200;
        gain.gain.value = 0.15;
        osc.start();
        osc.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        osc.stop(audioContext.currentTime + 0.5);
    }
}

function vibrate(duration) {
    if (vibrationEnabled && 'vibrate' in navigator) {
        navigator.vibrate(duration);
    }
}

// ============ START GAME ============

window.addEventListener('DOMContentLoaded', loadSprites);