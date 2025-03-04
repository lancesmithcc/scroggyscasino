// Game constants
const GAME_SPEED = 60; // fps
const MOVEMENT_SPEED = 5;
const JUMP_POWER = 30; // Doubled the jump power
const GRAVITY = 0.8;
const STOMP_DAMAGE = 5; // reduced damage per hit
const STOMP_COOLDOWN = 800; // ms
const INVINCIBILITY_TIME = 1000; // ms
const BG_EXPLOSION_INTERVAL = 2000; // ms
const MUSIC_VOLUME = 0.5; // 50% volume for background music

// Replace explosion words with character dialogue phrases
const NERD_PHRASES = [
    "Oh my stars and garters!",
    "That was highly illogical!",
    "Well that's statistically improbable!",
    "Oh golly gee whiz!",
    "My calculations were off!",
    "Inconceivable!",
    "That defies the laws of physics!"
];

const PUNK_PHRASES = [
    "Oh man that smarts!",
    "What the heck dude!",
    "Not cool, bro!",
    "That's gonna leave a mark!",
    "Golly gee brother!",
    "Totally bogus!",
    "That was harsh, man!"
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
    
    // Add touch event listeners to each button
    dpadButtons.forEach(button => {
        const key = button.getAttribute('data-key');
        const player = button.parentElement.id.includes('p1') ? 'p1' : 'p2';
        
        // Touch start (press down)
        button.addEventListener('touchstart', function(e) {
            e.preventDefault(); // Prevent scrolling
            touchControls[player][key] = true;
            gameState.keys[key.toLowerCase()] = true;
            button.classList.add('active');
        });
        
        // Touch end (release)
        button.addEventListener('touchend', function(e) {
            e.preventDefault(); // Prevent scrolling
            touchControls[player][key] = false;
            gameState.keys[key.toLowerCase()] = false;
            button.classList.remove('active');
        });
        
        // Touch cancel (e.g. gesture interruption)
        button.addEventListener('touchcancel', function(e) {
            e.preventDefault(); // Prevent scrolling
            touchControls[player][key] = false;
            gameState.keys[key.toLowerCase()] = false;
            button.classList.remove('active');
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
    speechSynthesis = window.speechSynthesis;
    if (!speechSynthesis) {
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
    
    // Jump
    if (gameState.keys[p.controls.up.toLowerCase()] && !p.isJumping) {
        p.velocity.y = -JUMP_POWER;
        p.isJumping = true;
        
        // Remove jump class first
        p.element.classList.remove('jump');
        
        // Force reflow to ensure animation starts fresh
        void p.element.offsetWidth;
        
        // Apply jump class
        p.element.classList.add('jump');
        
        // Play jump sound
        playSound('jump');
        
        // Remove jump animation class after animation completes
        setTimeout(() => {
            p.element.classList.remove('jump');
        }, 800); // Match with CSS animation duration
    }
}

// Apply physics (gravity, boundaries)
function applyPhysics(player) {
    const p = gameState.players[player];
    
    // Apply gravity with a smoother curve for natural jump physics
    if (p.isJumping) {
        // Gradual gravity curve that increases as jump progresses
        const jumpProgress = Math.min(1, (p.position.y - gameState.boundaries.bottom) / (-JUMP_POWER * 10));
        const gravityMultiplier = 0.7 + (0.3 * (1 - jumpProgress));
        p.velocity.y += GRAVITY * gravityMultiplier;
    } else {
        // Normal gravity otherwise
        p.velocity.y += GRAVITY;
    }
    
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
}

// Update player position in the DOM
function updatePlayerPosition(player) {
    const p = gameState.players[player];
    
    // Set position
    p.element.style.left = p.position.x + 'px';
    p.element.style.bottom = (gameState.boundaries.bottom - p.position.y) + 'px';
}

// Check for collisions between players
function checkCollisions() {
    const p1 = gameState.players.p1;
    const p2 = gameState.players.p2;
    
    const p1Rect = p1.element.getBoundingClientRect();
    const p2Rect = p2.element.getBoundingClientRect();
    
    // Check if players are colliding
    if (
        p1Rect.right > p2Rect.left &&
        p1Rect.left < p2Rect.right &&
        p1Rect.bottom > p2Rect.top &&
        p1Rect.top < p2Rect.bottom
    ) {
        // Check for stomps (player 1 stomping player 2)
        if (p1.velocity.y > 0 && p1Rect.bottom < p2Rect.top + p2Rect.height * 0.4 && !p2.isInvincible) {
            handleStomp('p1', 'p2');
        }
        
        // Check for stomps (player 2 stomping player 1)
        if (p2.velocity.y > 0 && p2Rect.bottom < p1Rect.top + p1Rect.height * 0.4 && !p1.isInvincible) {
            handleStomp('p2', 'p1');
        }
        
        // Push players apart to prevent clipping
        if (p1.position.x < p2.position.x) {
            p1.position.x -= MOVEMENT_SPEED / 2;
            p2.position.x += MOVEMENT_SPEED / 2;
        } else {
            p1.position.x += MOVEMENT_SPEED / 2;
            p2.position.x -= MOVEMENT_SPEED / 2;
        }
    }
}

// Handle stomp between two players
function handleStomp(stomper, stompee) {
    const s = gameState.players[stomper];
    const t = gameState.players[stompee];
    
    const now = Date.now();
    if (now - s.lastStompTime > STOMP_COOLDOWN) {
        s.lastStompTime = now;
        
        // Reduce health
        t.health = Math.max(0, t.health - STOMP_DAMAGE);
        
        // Update health bar
        t.healthBar.style.width = t.health + '%';
        
        // Add hit animation
        t.element.classList.add('hit');
        
        // Create character dialogue bubble
        createDialogueBubble(t.element, stompee === 'p1' ? 'nerd' : 'punk');
        
        // Create additional background explosions for dramatic effect
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                createBackgroundExplosion();
            }, i * 200);
        }
        
        // Make stompee invincible briefly
        t.isInvincible = true;
        setTimeout(() => {
            t.isInvincible = false;
            t.element.classList.remove('hit');
        }, INVINCIBILITY_TIME);
        
        // Bounce the stomper up
        s.velocity.y = -JUMP_POWER * 0.7;
        
        // Play stomp sound
        playSound('stomp');
    }
}

// Create a dialogue bubble for character reactions
function createDialogueBubble(targetElement, characterType) {
    // Get a random phrase based on character type
    const phrases = characterType === 'nerd' ? NERD_PHRASES : PUNK_PHRASES;
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    
    // Create text element with simple styling
    const textElement = document.createElement('div');
    textElement.className = `explosion ${characterType}`;
    textElement.textContent = phrase;
    
    // Position the element near the target
    const targetRect = targetElement.getBoundingClientRect();
    const gameAreaRect = gameState.gameArea.getBoundingClientRect();
    
    // Calculate position relative to game area - position near the hit point
    // Use midpoint of character for horizontal positioning
    const posX = targetRect.left - gameAreaRect.left + (targetRect.width / 2) - (textElement.offsetWidth / 2 || 50);
    // Position just above character's head
    const posY = gameAreaRect.bottom - targetRect.top - (targetRect.height / 2);
    
    textElement.style.left = `${posX}px`;
    textElement.style.top = `${posY}px`;
    
    // Add to game area
    gameState.gameArea.appendChild(textElement);
    
    // Speak the phrase using speech synthesis with character voice
    speakPhrase(phrase, characterType);
    
    // Remove after animation completes
    setTimeout(() => {
        if (textElement.parentNode) {
            textElement.parentNode.removeChild(textElement);
        }
    }, 1500);
}

// Speak a phrase using Speech Synthesis with character-specific voice
function speakPhrase(phrase, characterType) {
    if (!speechSynthesis) return;
    
    // Cancel any ongoing speech
    speechSynthesis.cancel();
    
    // Create utterance
    const utterance = new SpeechSynthesisUtterance(phrase);
    
    // Get available voices
    const voices = speechSynthesis.getVoices();
    
    // Configure voice based on character type
    if (characterType === 'nerd') {
        // Nerd voice: higher pitch, slightly slower, more proper
        utterance.volume = 0.9;
        utterance.rate = 1.1;
        utterance.pitch = 1.4; // Higher pitch
    } else {
        // Punk voice: lower pitch, faster, more casual
        utterance.volume = 1.0;
        utterance.rate = 1.3;
        utterance.pitch = 0.8; // Lower pitch
    }
    
    // Try to find an appropriate voice if available
    if (voices.length > 0) {
        // Look for voices in English
        const englishVoices = voices.filter(voice => voice.lang.includes('en-'));
        
        if (englishVoices.length > 0) {
            if (characterType === 'nerd') {
                // Prefer a younger or female voice for the nerd
                const nerdVoice = englishVoices.find(voice => 
                    voice.name.includes('Female') || voice.name.includes('Google UK English Female'));
                utterance.voice = nerdVoice || englishVoices[0];
            } else {
                // Prefer a deeper or male voice for the punk
                const punkVoice = englishVoices.find(voice => 
                    voice.name.includes('Male') || voice.name.includes('Google UK English Male'));
                utterance.voice = punkVoice || englishVoices[englishVoices.length - 1];
            }
        } else {
            utterance.voice = voices[0];
        }
    }
    
    // Speak the phrase
    speechSynthesis.speak(utterance);
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
        const winner = gameState.players.p1.health <= 0 ? 'PUNK' : 'NERD';
        
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