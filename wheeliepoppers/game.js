// Game constants
const GAME_SPEED = 60; // fps
const MOVEMENT_SPEED = 5;
const JUMP_POWER = 20; // Moderate jump power for a Mario-style jump
const GRAVITY = 1.0; // Standard gravity for a classic platformer feel
const STOMP_DAMAGE = 5; // Damage per hit
const REPULSION_FORCE = 15; // Force to push characters apart on collision
const STOMP_COOLDOWN = 800; // ms
const INVINCIBILITY_TIME = 1000; // ms
const BG_EXPLOSION_INTERVAL = 2000; // ms
const MUSIC_VOLUME = 0.5; // 50% volume for background music

// Replace explosion words with character dialogue phrases
const NERD_PHRASES = [
    "Where is the beef!",
    "I am not loving it",
    "bah-dah-bah-dah-bah",
    "would you like fries with that?",
    "super size me baby"
];

const PUNK_PHRASES = [
    "we will rise up against you",
    "You are destroying us all",
    "deny defend dispose",
    "Die corporate scum!",
    "capitalist pig!"
];

// Background explosion colors
const BG_EXPLOSION_COLORS = [
    'rgba(255,215,0,0.8)', // gold
    'rgba(255,87,34,0.7)', // orange
    'rgba(33,150,243,0.7)', // blue
    'rgba(156,39,176,0.7)', // purple
    'rgba(76,175,80,0.7)'   // green
];

// Audio context for sound effects
let audioContext;
let speechSynthesis;
let bgExplosionInterval;
let backgroundMusic; // New variable for background music

// Mobile control states
const touchControls = {
    p1: {
        ArrowUp: false,
        ArrowDown: false,
        ArrowLeft: false,
        ArrowRight: false
    },
    p2: {
        w: false,
        s: false,
        a: false,
        d: false
    }
};

// Game state
const gameState = {
    running: true,
    isMobile: false,
    musicEnabled: true, // Track if music is enabled
    players: {
        p1: {
            element: null,
            health: 100,
            healthBar: null,
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            facingRight: false,
            isJumping: false,
            lastStompTime: 0,
            isInvincible: false,
            controls: {
                left: 'ArrowLeft',
                right: 'ArrowRight',
                up: 'ArrowUp',
                down: 'ArrowDown'
            }
        },
        p2: {
            element: null,
            health: 100,
            healthBar: null,
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            facingRight: true,
            isJumping: false,
            lastStompTime: 0,
            isInvincible: false,
            controls: {
                left: 'a',
                right: 'd',
                up: 'w',
                down: 's'
            }
        }
    },
    keys: {},
    gameArea: null,
    boundaries: {
        left: 0,
        right: 0,
        bottom: 0
    }
};

// Initialize the game
function initGame() {
    // Get game elements
    gameState.gameArea = document.querySelector('.game-area');
    gameState.players.p1.element = document.getElementById('player1');
    gameState.players.p2.element = document.getElementById('player2');
    gameState.players.p1.healthBar = document.getElementById('p1-health');
    gameState.players.p2.healthBar = document.getElementById('p2-health');

    // Check if mobile
    checkIfMobile();

    // Set game boundaries
    updateBoundaries();

    // Set initial positions
    const p1Rect = gameState.players.p1.element.getBoundingClientRect();
    const p2Rect = gameState.players.p2.element.getBoundingClientRect();
    
    gameState.players.p1.position = {
        x: gameState.boundaries.right - 150,
        y: gameState.boundaries.bottom - p1Rect.height
    };
    
    gameState.players.p2.position = {
        x: gameState.boundaries.left + 150,
        y: gameState.boundaries.bottom - p2Rect.height
    };

    // Update initial positions
    updatePlayerPosition('p1');
    updatePlayerPosition('p2');

    // Initialize audio
    initAudio();
    
    // Initialize background music
    initBackgroundMusic();

    // Start background explosions
    startBackgroundExplosions();

    // Event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', handleResize);
    
    // Add touch controls
    initTouchControls();

    // Start game loop
    setInterval(gameLoop, 1000 / GAME_SPEED);
}

// Check if device is mobile
function checkIfMobile() {
    gameState.isMobile = window.innerWidth <= 1024 || 
                         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                         
    // If mobile, make sure the mobile controls are visible
    const mobileControls = document.querySelector('.mobile-controls');
    if (mobileControls) {
        mobileControls.style.display = gameState.isMobile ? 'block' : 'none';
    }
}

// Handle resize
function handleResize() {
    updateBoundaries();
    checkIfMobile();
}

// Initialize touch controls for mobile
function initTouchControls() {
    // Get all d-pad buttons
    const dpadButtons = document.querySelectorAll('.dpad-btn');
    
    // Track active touches to allow multiple simultaneous presses
    const activeTouches = {
        p1: new Set(),
        p2: new Set()
    };
    
    // Add touch event listeners to each button
    dpadButtons.forEach(button => {
        const key = button.getAttribute('data-key');
        const player = button.parentElement.id.includes('p1') ? 'p1' : 'p2';
        
        // Touch start (press down)
        button.addEventListener('touchstart', function(e) {
            e.preventDefault(); // Prevent scrolling
            
            // Store touch identifier
            Array.from(e.changedTouches).forEach(touch => {
                activeTouches[player].add(touch.identifier);
            });
            
            touchControls[player][key] = true;
            gameState.keys[key.toLowerCase()] = true;
            button.classList.add('active');
        });
        
        // Touch move - check if touch is still over this button
        button.addEventListener('touchmove', function(e) {
            e.preventDefault(); // Prevent scrolling
            
            // Get button position
            const rect = button.getBoundingClientRect();
            
            // Check each active touch
            Array.from(e.changedTouches).forEach(touch => {
                const isInside = 
                    touch.clientX >= rect.left && 
                    touch.clientX <= rect.right && 
                    touch.clientY >= rect.top && 
                    touch.clientY <= rect.bottom;
                
                // If touch moved outside button but was previously active
                if (!isInside && activeTouches[player].has(touch.identifier)) {
                    activeTouches[player].delete(touch.identifier);
                    
                    // Only deactivate if no other touches are active on this button
                    if (!Array.from(e.touches).some(t => 
                        t.identifier !== touch.identifier && 
                        t.clientX >= rect.left && 
                        t.clientX <= rect.right && 
                        t.clientY >= rect.top && 
                        t.clientY <= rect.bottom)) {
                        touchControls[player][key] = false;
                        gameState.keys[key.toLowerCase()] = false;
                        button.classList.remove('active');
                    }
                }
                // If touch moved inside button but wasn't previously active
                else if (isInside && !activeTouches[player].has(touch.identifier)) {
                    activeTouches[player].add(touch.identifier);
                    touchControls[player][key] = true;
                    gameState.keys[key.toLowerCase()] = true;
                    button.classList.add('active');
                }
            });
        });
        
        // Touch end (release)
        button.addEventListener('touchend', function(e) {
            e.preventDefault(); // Prevent scrolling
            
            // Remove touch identifiers
            Array.from(e.changedTouches).forEach(touch => {
                activeTouches[player].delete(touch.identifier);
            });
            
            // Only deactivate if no other touches are active on this button
            if (activeTouches[player].size === 0) {
                touchControls[player][key] = false;
                gameState.keys[key.toLowerCase()] = false;
                button.classList.remove('active');
            }
        });
        
        // Touch cancel (e.g. gesture interruption)
        button.addEventListener('touchcancel', function(e) {
            e.preventDefault(); // Prevent scrolling
            
            // Remove touch identifiers
            Array.from(e.changedTouches).forEach(touch => {
                activeTouches[player].delete(touch.identifier);
            });
            
            // Only deactivate if no other touches are active on this button
            if (activeTouches[player].size === 0) {
                touchControls[player][key] = false;
                gameState.keys[key.toLowerCase()] = false;
                button.classList.remove('active');
            }
        });
        
        // For regular mouse clicks (useful for testing on desktop)
        button.addEventListener('mousedown', function(e) {
            touchControls[player][key] = true;
            gameState.keys[key.toLowerCase()] = true;
            button.classList.add('active');
        });
        
        button.addEventListener('mouseup', function(e) {
            touchControls[player][key] = false;
            gameState.keys[key.toLowerCase()] = false;
            button.classList.remove('active');
        });
    });
    
    // Add special handling for diagonal movement (up + left/right)
    const setupDiagonalTouch = (player, direction) => {
        const dpad = document.getElementById(`${player}-dpad`);
        const upBtn = dpad.querySelector('.up');
        const dirBtn = dpad.querySelector(`.${direction}`);
        
        if (!upBtn || !dirBtn) return;
        
        const upKey = upBtn.getAttribute('data-key');
        const dirKey = dirBtn.getAttribute('data-key');
        
        // Create a small invisible overlay for diagonal touch
        const overlay = document.createElement('div');
        overlay.className = `diagonal-overlay ${direction}`;
        overlay.style.position = 'absolute';
        overlay.style.width = '40px';
        overlay.style.height = '40px';
        overlay.style.backgroundColor = 'transparent';
        overlay.style.zIndex = '5';
        
        // Position the overlay at the corner between up and direction
        if (direction === 'left') {
            overlay.style.top = '0';
            overlay.style.left = '0';
        } else { // right
            overlay.style.top = '0';
            overlay.style.right = '0';
        }
        
        dpad.appendChild(overlay);
        
        // Add touch handlers for the overlay
        overlay.addEventListener('touchstart', function(e) {
            e.preventDefault();
            
            // Activate both buttons
            touchControls[player][upKey] = true;
            touchControls[player][dirKey] = true;
            gameState.keys[upKey.toLowerCase()] = true;
            gameState.keys[dirKey.toLowerCase()] = true;
            
            upBtn.classList.add('active');
            dirBtn.classList.add('active');
        });
        
        overlay.addEventListener('touchend', function(e) {
            e.preventDefault();
            
            // Deactivate both buttons
            touchControls[player][upKey] = false;
            touchControls[player][dirKey] = false;
            gameState.keys[upKey.toLowerCase()] = false;
            gameState.keys[dirKey.toLowerCase()] = false;
            
            upBtn.classList.remove('active');
            dirBtn.classList.remove('active');
        });
    };
    
    // Setup diagonal touch areas for both players
    setupDiagonalTouch('p1', 'left');
    setupDiagonalTouch('p1', 'right');
    setupDiagonalTouch('p2', 'left');
    setupDiagonalTouch('p2', 'right');
}

// Initialize Web Audio API and Speech Synthesis
function initAudio() {
    try {
        // Initialize Web Audio API
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
        
        // Create a test oscillator to check if audio is working
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
        
        // Create gain node (volume control)
        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // Set volume to 10%
        
        // Connect oscillator to gain node and gain node to audio context destination
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Start and stop the oscillator quickly (just to test)
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
        
        console.log('Audio initialized successfully');
    } catch (e) {
        console.error('Web Audio API is not supported in this browser', e);
    }
    
    // Initialize Speech Synthesis
    if ('speechSynthesis' in window) {
        speechSynthesis = window.speechSynthesis;
        console.log('Speech Synthesis initialized successfully');
        
        // Try to preload voices
        speechSynthesis.onvoiceschanged = function() {
            console.log('Speech Synthesis voices loaded:', speechSynthesis.getVoices().length);
        };
    } else {
        console.error('Speech Synthesis is not supported in this browser');
    }
}

// Initialize background music
function initBackgroundMusic() {
    // Create audio element
    backgroundMusic = new Audio('sprites/wheeliepoppers.mp3');
    backgroundMusic.loop = true;
    backgroundMusic.volume = MUSIC_VOLUME;
    
    // Add music toggle button
    addMusicControls();
    
    // We can't autoplay due to browser restrictions
    // Music will start on first user interaction
    document.addEventListener('click', startBackgroundMusic, { once: true });
    document.addEventListener('keydown', startBackgroundMusic, { once: true });
    document.addEventListener('touchstart', startBackgroundMusic, { once: true });
}

// Start playing background music
function startBackgroundMusic() {
    if (gameState.musicEnabled && backgroundMusic) {
        // Use promise to handle playback
        const playPromise = backgroundMusic.play();
        
        // Handle autoplay restrictions
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("Autoplay prevented by browser:", error);
                // We'll try again on next user interaction
                document.addEventListener('click', startBackgroundMusic, { once: true });
            });
        }
    }
}

// Add music toggle controls
function addMusicControls() {
    // Create a music toggle button
    const musicToggle = document.createElement('button');
    musicToggle.id = 'music-toggle';
    musicToggle.innerHTML = '🔊';
    musicToggle.title = 'Toggle Music';
    
    // Style the button
    musicToggle.style.position = 'absolute';
    musicToggle.style.top = '10px';
    musicToggle.style.right = '10px';
    musicToggle.style.zIndex = '100';
    musicToggle.style.background = 'rgba(0, 0, 0, 0.5)';
    musicToggle.style.color = '#FFD700';
    musicToggle.style.border = '2px solid #FFD700';
    musicToggle.style.borderRadius = '50%';
    musicToggle.style.width = '40px';
    musicToggle.style.height = '40px';
    musicToggle.style.fontSize = '20px';
    musicToggle.style.cursor = 'pointer';
    musicToggle.style.display = 'flex';
    musicToggle.style.justifyContent = 'center';
    musicToggle.style.alignItems = 'center';
    
    // Add click event
    musicToggle.addEventListener('click', toggleMusic);
    
    // Add to game container
    const gameContainer = document.querySelector('.game-container');
    if (gameContainer) {
        gameContainer.appendChild(musicToggle);
    }
}

// Toggle music on/off
function toggleMusic() {
    const musicToggle = document.getElementById('music-toggle');
    
    if (gameState.musicEnabled) {
        // Turn music off
        if (backgroundMusic) {
            backgroundMusic.pause();
        }
        gameState.musicEnabled = false;
        if (musicToggle) {
            musicToggle.innerHTML = '🔇';
        }
    } else {
        // Turn music on
        if (backgroundMusic) {
            backgroundMusic.play();
        }
        gameState.musicEnabled = true;
        if (musicToggle) {
            musicToggle.innerHTML = '🔊';
        }
    }
}

// Start creating background explosions
function startBackgroundExplosions() {
    // Create an initial explosion
    createBackgroundExplosion();
    
    // Set up interval for continuous explosions
    bgExplosionInterval = setInterval(() => {
        if (gameState.running) {
            createBackgroundExplosion();
        }
    }, BG_EXPLOSION_INTERVAL);
}

// Create a background explosion effect
function createBackgroundExplosion() {
    // Create explosion element
    const explosion = document.createElement('div');
    explosion.className = 'bg-explosion';
    
    // Position randomly in the game area
    const gameAreaRect = gameState.gameArea.getBoundingClientRect();
    const posX = Math.random() * (gameAreaRect.width - 100);
    const posY = Math.random() * (gameAreaRect.height * 0.6); // Upper 60% of the screen
    
    explosion.style.left = `${posX}px`;
    explosion.style.bottom = `${gameAreaRect.height - posY}px`;
    
    // Random size (50-100px)
    const size = 50 + Math.random() * 50;
    explosion.style.width = `${size}px`;
    explosion.style.height = `${size}px`;
    
    // Random color
    const colorIndex = Math.floor(Math.random() * BG_EXPLOSION_COLORS.length);
    const color = BG_EXPLOSION_COLORS[colorIndex];
    explosion.style.background = `radial-gradient(circle, ${color} 0%, rgba(255,87,34,0.6) 50%, rgba(0,0,0,0) 70%)`;
    
    // Add to game area
    gameState.gameArea.appendChild(explosion);
    
    // Remove after animation completes
    setTimeout(() => {
        if (explosion.parentNode) {
            explosion.parentNode.removeChild(explosion);
        }
    }, 1500); // matches animation duration
}

// Update game boundaries based on game area
function updateBoundaries() {
    const gameAreaRect = gameState.gameArea.getBoundingClientRect();
    gameState.boundaries = {
        left: 0,
        right: gameAreaRect.width,
        bottom: gameAreaRect.height * 0.8 // 80% of height to account for the ground
    };
}

// Handle key down events
function handleKeyDown(e) {
    gameState.keys[e.key.toLowerCase()] = true;
}

// Handle key up events
function handleKeyUp(e) {
    gameState.keys[e.key.toLowerCase()] = false;
}

// Main game loop
function gameLoop() {
    if (!gameState.running) return;

    // Handle player 1 controls
    handlePlayerControls('p1');
    
    // Handle player 2 controls
    handlePlayerControls('p2');

    // Apply physics
    applyPhysics('p1');
    applyPhysics('p2');

    // Check collisions
    checkCollisions();

    // Update positions
    updatePlayerPosition('p1');
    updatePlayerPosition('p2');

    // Check game end condition
    checkGameEnd();
}

// Handle player controls
function handlePlayerControls(player) {
    const p = gameState.players[player];
    
    // Reset x velocity
    p.velocity.x = 0;

    // Movement
    if (gameState.keys[p.controls.left.toLowerCase()]) {
        p.velocity.x = -MOVEMENT_SPEED;
        p.facingRight = false;
        p.element.classList.add('flip');
    }
    
    if (gameState.keys[p.controls.right.toLowerCase()]) {
        p.velocity.x = MOVEMENT_SPEED;
        p.facingRight = true;
        p.element.classList.remove('flip');
    }
    
    // Jump - only if on the ground
    if (gameState.keys[p.controls.up.toLowerCase()] && !p.isJumping) {
        p.velocity.y = -JUMP_POWER;
        p.isJumping = true;
        
        // No animation classes - just physics-driven movement
        
        // Play jump sound
        playSound('jump');
    }
}

// Apply physics (gravity, boundaries)
function applyPhysics(player) {
    const p = gameState.players[player];
    
    // Simple, consistent gravity for a classic platformer feel
    p.velocity.y += GRAVITY;
    
    // Update position
    p.position.x += p.velocity.x;
    p.position.y += p.velocity.y;
    
    // Check boundaries
    // Left boundary
    if (p.position.x < gameState.boundaries.left) {
        p.position.x = gameState.boundaries.left;
    }
    
    // Right boundary (accounting for element width)
    const width = p.element.getBoundingClientRect().width;
    if (p.position.x + width > gameState.boundaries.right) {
        p.position.x = gameState.boundaries.right - width;
    }
    
    // Bottom boundary (ground)
    if (p.position.y > gameState.boundaries.bottom) {
        p.position.y = gameState.boundaries.bottom;
        p.velocity.y = 0;
        p.isJumping = false;
    }
    
    // Top boundary to prevent going off screen
    const gameAreaHeight = gameState.gameArea.clientHeight;
    const characterHeight = p.element.clientHeight;
    const maxJumpHeight = gameAreaHeight - characterHeight * 0.6; // Allow character to be partly visible at top
    
    if (p.position.y < gameState.boundaries.bottom - maxJumpHeight) {
        p.position.y = gameState.boundaries.bottom - maxJumpHeight;
        p.velocity.y = 0; // Stop upward movement instead of bouncing
    }
}

// Update player position in the DOM
function updatePlayerPosition(player) {
    const p = gameState.players[player];
    
    // Set position with straightforward style updates - no transforms
    p.element.style.left = p.position.x + 'px';
    p.element.style.bottom = (gameState.boundaries.bottom - p.position.y) + 'px';
}

// Check for collisions between players
function checkCollisions() {
    const p1 = gameState.players.p1;
    const p2 = gameState.players.p2;
    
    // Get character dimensions
    const p1Width = p1.element.getBoundingClientRect().width;
    const p1Height = p1.element.getBoundingClientRect().height;
    const p2Width = p2.element.getBoundingClientRect().width;
    const p2Height = p2.element.getBoundingClientRect().height;
    
    // Check horizontal overlap - use a smaller collision box (75% of width) for more precise collisions
    const p1Left = p1.position.x + (p1Width * 0.125);
    const p1Right = p1.position.x + (p1Width * 0.875);
    const p2Left = p2.position.x + (p2Width * 0.125);
    const p2Right = p2.position.x + (p2Width * 0.875);
    
    // Reduce height collision area for more precise stomping (70% of height)
    const p1Top = p1.position.y;
    const p1Bottom = p1.position.y + (p1Height * 0.7);
    const p2Top = p2.position.y;
    const p2Bottom = p2.position.y + (p2Height * 0.7);
    
    // Check if characters are horizontally overlapping
    const horizontalOverlap = !(p1Right < p2Left || p1Left > p2Right);
    
    // Check if characters are vertically overlapping
    const verticalOverlap = !(p1Bottom < p2Top || p1Top > p2Bottom);
    
    // Collision detected
    if (horizontalOverlap && verticalOverlap) {
        const now = Date.now();
        
        // Check who is higher and if they're airborne
        if (p1.isJumping && p1.position.y < p2.position.y && now - p1.lastStompTime > STOMP_COOLDOWN && !p2.isInvincible) {
            // Player 1 is airborne and higher - they deal damage
            handleStomp('p1', 'p2');
            
            // Repel players away from each other
            repelPlayers(p1, p2);
        } 
        else if (p2.isJumping && p2.position.y < p1.position.y && now - p2.lastStompTime > STOMP_COOLDOWN && !p1.isInvincible) {
            // Player 2 is airborne and higher - they deal damage
            handleStomp('p2', 'p1');
            
            // Repel players away from each other
            repelPlayers(p2, p1);
        }
        else {
            // Just a horizontal collision - repel without damage
            // Only apply if one of them is moving
            if (Math.abs(p1.velocity.x) > 0 || Math.abs(p2.velocity.x) > 0) {
                repelPlayers(p1, p2);
            }
        }
    }
}

// Repel players away from each other
function repelPlayers(player1, player2) {
    // Determine the direction to push based on relative positions
    // Positive means push player1 right and player2 left
    // Negative means push player1 left and player2 right
    const pushDirection = player1.position.x < player2.position.x ? -1 : 1;
    
    // Apply horizontal repulsion
    player1.velocity.x = pushDirection * -REPULSION_FORCE;
    player2.velocity.x = pushDirection * REPULSION_FORCE;
    
    // Ensure boundaries are respected after repulsion
    updatePlayerPosition('p1');
    updatePlayerPosition('p2');
}

// Handle stomp damage and effects
function handleStomp(stomper, target) {
    const s = gameState.players[stomper];
    const t = gameState.players[target];
    
    // If target is already invincible, do nothing
    if (t.isInvincible) return;
    
    // Make target invincible temporarily
    t.isInvincible = true;
    
    // Apply hit effect (shake animation)
    t.element.classList.add('hit');
    
    // Reduce health
    t.health -= STOMP_DAMAGE;
    updateHealthBar(target, t.health);
    
    // Create blood splatter effect immediately
    createBloodSplatter(t.element);
    // Create a second blood splatter for more emphasis
    setTimeout(() => createBloodSplatter(t.element), 100);

    setTimeout(() => {
        t.isInvincible = false;
        t.element.classList.remove('hit');
    }, INVINCIBILITY_TIME);

    // Show hit effect with plain text instead of dialogue bubbles
    createHitText(t.element, stomper === 'p1' ? 'nerd' : 'punk');
    
    // Bounce the stomper up
    s.velocity.y = -JUMP_POWER * 0.7;
    
    // Play stomp sound
    playSound('stomp');
}

// Update health bar display
function updateHealthBar(player, health) {
    const healthBar = document.getElementById(`${player}-health`);
    if (healthBar) {
        healthBar.style.width = `${health}%`;
        
        // Add visual cues based on health level
        if (health < 30) {
            healthBar.style.backgroundColor = '#ff0000'; // Red for low health
        } else if (health < 60) {
            healthBar.style.backgroundColor = '#ffaa00'; // Orange for medium health
        } else {
            healthBar.style.backgroundColor = '#00cc00'; // Green for high health
        }
    }
}

// Create blood splatter effect
function createBloodSplatter(targetElement) {
    const targetRect = targetElement.getBoundingClientRect();
    const gameAreaRect = gameState.gameArea.getBoundingClientRect();
    
    // Create multiple blood splatters for more effect
    const numSplatters = Math.floor(Math.random() * 5) + 5; // 5-10 splatters for more blood
    
    for (let i = 0; i < numSplatters; i++) {
        const splatter = document.createElement('div');
        splatter.className = 'blood-splatter';
        
        // Calculate random position near the hit point
        const offsetX = (Math.random() - 0.5) * 120; // Random offset -60px to 60px
        const offsetY = (Math.random() - 0.5) * 120;
        
        // Position relative to center of character
        const centerX = targetRect.left - gameAreaRect.left + (targetRect.width / 2);
        const centerY = targetRect.top - gameAreaRect.top + (targetRect.height / 2);
        
        // Set position
        splatter.style.left = `${centerX + offsetX}px`;
        splatter.style.top = `${centerY + offsetY}px`;
        
        // Random size variation
        const size = 30 + Math.random() * 40; // 30-70px for larger splatters
        splatter.style.width = `${size}px`;
        splatter.style.height = `${size}px`;
        
        // Random rotation
        splatter.style.transform = `rotate(${Math.random() * 360}deg)`;
        
        // Add to game area
        gameState.gameArea.appendChild(splatter);
        
        // Remove after animation completes
        setTimeout(() => {
            if (splatter.parentNode) {
                splatter.parentNode.removeChild(splatter);
            }
        }, 500);
    }
}

// Create a simple text display for hit reactions (replacing dialogue bubbles)
function createHitText(targetElement, characterType) {
    // Get a random phrase from the character's phrase list
    const phrases = characterType === 'nerd' ? NERD_PHRASES : PUNK_PHRASES;
    const text = phrases[Math.floor(Math.random() * phrases.length)];
    
    // Create text element with simple styling
    const textElement = document.createElement('div');
    textElement.className = `explosion ${characterType}`;
    textElement.textContent = text;
    
    // Position the element in the center of the screen for more visibility
    const gameAreaRect = gameState.gameArea.getBoundingClientRect();
    
    textElement.style.left = '50%'; // Center horizontally
    textElement.style.top = '50%'; // Center vertically
    textElement.style.transform = 'translate(-50%, -50%)'; // Center precisely
    
    // Add to game area
    gameState.gameArea.appendChild(textElement);
    
    // Speak the phrase using speech synthesis
    speakPhrase(text, characterType);
    
    // Remove after animation completes - shorter duration for quick flash
    setTimeout(() => {
        if (textElement.parentNode) {
            textElement.parentNode.removeChild(textElement);
        }
    }, 1000); // 1 second to match animation
}

// Function to speak phrases with character-specific voice settings
function speakPhrase(text, characterType) {
    if (!('speechSynthesis' in window)) {
        console.error('Speech synthesis not available');
        return;
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Create a new speech utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure speech properties based on character type
    if (characterType === 'nerd') {
        // Nerd/Rotten Ronnie - lower voice
        utterance.pitch = 0.7; // Lower pitch
        utterance.rate = 0.9; // Slightly slower
    } else {
        // Punk/Luigi - higher voice
        utterance.pitch = 1.5; // Higher pitch
        utterance.rate = 1.2; // Faster speech
    }
    
    // Set volume for both
    utterance.volume = 0.9;
    
    // Speak the phrase
    window.speechSynthesis.speak(utterance);
    
    console.log(`Speaking phrase as ${characterType}:`, text);
}

// Play sound effects using Web Audio API
function playSound(type) {
    if (!audioContext) return;
    
    // Resume audio context if it was suspended (browsers require user interaction)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    // Create oscillator and gain node
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Connect oscillator to gain and gain to output
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configure sound based on type
    switch (type) {
        case 'jump':
            // Jump sound: Rising tone
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator.frequency.linearRampToValueAtTime(600, audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
            break;
            
        case 'stomp':
            // Stomp sound: Harsh impact
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
            oscillator.frequency.linearRampToValueAtTime(40, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
            
            // Add some noise for impact
            const noiseNode = createNoiseNode(0.2);
            noiseNode.connect(gainNode);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
            break;
            
        case 'win':
            // Victory fanfare
            oscillator.type = 'triangle';
            
            // Play a little melody
            const notes = [261.63, 329.63, 392, 523.25]; // C4, E4, G4, C5
            const times = [0, 0.1, 0.2, 0.3];
            const durations = [0.1, 0.1, 0.1, 0.5];
            
            for (let i = 0; i < notes.length; i++) {
                setTimeout(() => {
                    const noteOsc = audioContext.createOscillator();
                    const noteGain = audioContext.createGain();
                    
                    noteOsc.connect(noteGain);
                    noteGain.connect(audioContext.destination);
                    
                    noteOsc.type = 'triangle';
                    noteOsc.frequency.setValueAtTime(notes[i], audioContext.currentTime);
                    
                    noteGain.gain.setValueAtTime(0.15, audioContext.currentTime);
                    noteGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + durations[i]);
                    
                    noteOsc.start();
                    noteOsc.stop(audioContext.currentTime + durations[i]);
                }, times[i] * 1000);
            }
            break;
    }
}

// Create a noise node for more complex sounds
function createNoiseNode(duration) {
    const bufferSize = audioContext.sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Fill buffer with noise
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    // Create source from buffer
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    noise.start();
    noise.stop(audioContext.currentTime + duration);
    
    return noise;
}

// Check if game has ended
function checkGameEnd() {
    if (gameState.players.p1.health <= 0 || gameState.players.p2.health <= 0) {
        gameState.running = false;
        
        // Clear background explosion interval
        clearInterval(bgExplosionInterval);
        
        // Announce winner
        const winner = gameState.players.p1.health <= 0 ? 'LUIGI' : 'ROTTEN RONNIE';
        
        // Play win sound
        playSound('win');
        
        // Create game over message
        const gameOver = document.createElement('div');
        gameOver.className = 'game-over';
        gameOver.innerHTML = `
            <h2>${winner} WINS!</h2>
            <button id="restart">PLAY AGAIN!</button>
        `;
        gameOver.style.position = 'absolute';
        gameOver.style.top = '50%';
        gameOver.style.left = '50%';
        gameOver.style.transform = 'translate(-50%, -50%)';
        gameOver.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        gameOver.style.color = '#FFD700';
        gameOver.style.padding = '30px';
        gameOver.style.borderRadius = '10px';
        gameOver.style.textAlign = 'center';
        gameOver.style.zIndex = '10';
        gameOver.style.fontFamily = "'Press Start 2P', cursive";
        gameOver.style.border = '5px solid #FFD700';
        gameOver.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.5)';
        
        // Style button
        const button = document.createElement('style');
        button.textContent = `
            #restart {
                background-color: #FF5722;
                color: white;
                border: none;
                padding: 15px;
                margin-top: 20px;
                border-radius: 5px;
                cursor: pointer;
                font-family: 'Press Start 2P', cursive;
                font-size: 14px;
                border: 3px solid #FFD700;
                box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
                transition: all 0.3s;
            }
            #restart:hover {
                transform: scale(1.1);
                background-color: #FF9800;
            }
        `;
        document.head.appendChild(button);
        
        gameState.gameArea.appendChild(gameOver);
        
        // Add restart event listener
        document.getElementById('restart').addEventListener('click', restartGame);
    }
}

// Restart the game
function restartGame() {
    // Remove game over message
    const gameOver = document.querySelector('.game-over');
    if (gameOver) {
        gameOver.remove();
    }
    
    // Reset game state
    gameState.running = true;
    gameState.players.p1.health = 100;
    gameState.players.p2.health = 100;
    
    // Reset health bars
    gameState.players.p1.healthBar.style.width = '100%';
    gameState.players.p2.healthBar.style.width = '100%';
    
    // Reset positions
    gameState.players.p1.position = {
        x: gameState.boundaries.right - 150,
        y: gameState.boundaries.bottom
    };
    
    gameState.players.p2.position = {
        x: gameState.boundaries.left + 150,
        y: gameState.boundaries.bottom
    };
    
    // Reset velocities
    gameState.players.p1.velocity = { x: 0, y: 0 };
    gameState.players.p2.velocity = { x: 0, y: 0 };
    
    // Reset invincibility
    gameState.players.p1.isInvincible = false;
    gameState.players.p2.isInvincible = false;
    
    // Update positions
    updatePlayerPosition('p1');
    updatePlayerPosition('p2');
    
    // Reset music if it stopped
    if (gameState.musicEnabled && backgroundMusic && backgroundMusic.paused) {
        backgroundMusic.play().catch(error => {
            console.log("Couldn't restart music:", error);
        });
    }
    
    // Restart background explosions
    startBackgroundExplosions();
}

// Wait for DOM to load then initialize game
document.addEventListener('DOMContentLoaded', initGame); 