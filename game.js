const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const gameOverElement = document.getElementById('game-over');
const startScreenElement = document.getElementById('start-screen');

// Audio Context for sound effects
let audioCtx;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playExplosionSound() {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const duration = 0.3;
    const gainNode = audioCtx.createGain();
    const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * duration, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < audioCtx.sampleRate * duration; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + duration);

    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    noiseSource.start();
    noiseSource.stop(audioCtx.currentTime + duration);
}

// Game constants
const WIDTH = 320;
const HEIGHT = 480;
canvas.width = WIDTH;
canvas.height = HEIGHT;

const scale = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT) * 0.9;
canvas.style.width = `${WIDTH * scale}px`;
canvas.style.height = `${HEIGHT * scale}px`;

// Difficulty Settings
const difficulties = {
    easy: { spawnRate: 90, speedMin: 1, speedMax: 2 },
    medium: { spawnRate: 60, speedMin: 1.5, speedMax: 3 },
    hard: { spawnRate: 30, speedMin: 2.5, speedMax: 5 }
};
let currentDifficulty = difficulties.medium;

// Game State
let score = 0;
let isGameOver = false;
let isStarted = false;
let frames = 0;

// Inputs
const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// Touch Controls
let isTouching = false;
let touchX = 0;

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    isTouching = true;
    touchX = e.touches[0].clientX;
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    touchX = e.touches[0].clientX;
}, { passive: false });

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    isTouching = false;
}, { passive: false });

class Player {
    constructor() {
        this.width = 20;
        this.height = 20;
        this.x = WIDTH / 2 - this.width / 2;
        this.y = HEIGHT - 40;
        this.speed = 4;
        this.color = '#00ff00';
        this.bullets = [];
        this.shootTimer = 0;
    }

    update() {
        // Keyboard movement
        if (keys['ArrowLeft'] || keys['KeyA']) this.x -= this.speed;
        if (keys['ArrowRight'] || keys['KeyD']) this.x += this.speed;

        // Touch movement
        if (isTouching) {
            const canvasRect = canvas.getBoundingClientRect();
            const relativeTouchX = (touchX - canvasRect.left) / scale;
            
            if (relativeTouchX < this.x + this.width / 2) {
                this.x -= this.speed;
            } else {
                this.x += this.speed;
            }
        }

        if (this.x < 0) this.x = 0;
        if (this.x > WIDTH - this.width) this.x = WIDTH - this.width;

        // Shooting (Auto-shoot on touch or Spacebar)
        if ((keys['Space'] || isTouching) && this.shootTimer <= 0) {
            this.bullets.push(new Bullet(this.x + this.width / 2 - 2, this.y));
            this.shootTimer = 15;
        }
        if (this.shootTimer > 0) this.shootTimer--;

        this.bullets.forEach((bullet) => bullet.update());
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x + 8, this.y, 4, 4);
        ctx.fillRect(this.x + 4, this.y + 4, 12, 4);
        ctx.fillRect(this.x, this.y + 8, 20, 8);
        ctx.fillRect(this.x + 4, this.y + 16, 4, 4);
        ctx.fillRect(this.x + 12, this.y + 16, 4, 4);
        this.bullets.forEach(bullet => bullet.draw());
    }
}

class Bullet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 10;
        this.height = 12;
        this.speed = 6;
        this.color = '#ffff00';
        this.toRemove = false;
    }
    update() { this.y -= this.speed; }
    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Enemy {
    constructor() {
        this.width = 24;
        this.height = 20;
        this.x = Math.random() * (WIDTH - this.width);
        this.y = -this.height;
        this.speed = currentDifficulty.speedMin + Math.random() * (currentDifficulty.speedMax - currentDifficulty.speedMin);
        this.color = '#ff0044';
        this.toRemove = false;
    }
    update() { this.y += this.speed; }
    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x + 4, this.y, 16, 4);
        ctx.fillRect(this.x, this.y + 4, 24, 8);
        ctx.fillRect(this.x + 4, this.y + 12, 4, 4);
        ctx.fillRect(this.x + 16, this.y + 12, 4, 4);
        ctx.fillRect(this.x, this.y + 16, 4, 4);
        ctx.fillRect(this.x + 20, this.y + 16, 4, 4);
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x + 6, this.y + 6, 4, 4);
        ctx.fillRect(this.x + 14, this.y + 6, 4, 4);
    }
}

let player = new Player();
let enemies = [];

function spawnEnemy() {
    if (frames % currentDifficulty.spawnRate === 0) {
        enemies.push(new Enemy());
    }
}

function checkCollisions() {
    player.bullets.forEach((bullet) => {
        enemies.forEach((enemy) => {
            if (!bullet.toRemove && !enemy.toRemove &&
                bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y) {
                bullet.toRemove = true;
                enemy.toRemove = true;
                score += 10;
                scoreElement.innerText = `Score: ${score}`;
                playExplosionSound();
            }
        });
    });

    enemies.forEach((enemy) => {
        if (!enemy.toRemove &&
            player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y) {
            isGameOver = true;
            gameOverElement.style.display = 'block';
        }
    });

    player.bullets = player.bullets.filter(b => !b.toRemove && b.y > 0);
    enemies = enemies.filter(e => !e.toRemove && e.y < HEIGHT);
}

function update() {
    if (!isStarted || isGameOver) return;
    frames++;
    player.update();
    enemies.forEach(enemy => enemy.update());
    spawnEnemy();
    checkCollisions();
}

function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#fff';
    for(let i=0; i<20; i++) {
        let x = (Math.sin(i + frames * 0.01) * WIDTH + WIDTH) % WIDTH;
        let y = (i * 30 + frames) % HEIGHT;
        ctx.fillRect(x, y, 2, 2);
    }
    if (isStarted) {
        player.draw();
        enemies.forEach(enemy => enemy.draw());
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

window.startGame = function(diff) {
    currentDifficulty = difficulties[diff];
    isStarted = true;
    isGameOver = false;
    startScreenElement.style.display = 'none';
    gameOverElement.style.display = 'none';
    resetGameData();
    initAudio();
};

window.showStartScreen = function() {
    isStarted = false;
    isGameOver = false;
    startScreenElement.style.display = 'block';
    gameOverElement.style.display = 'none';
};

function resetGameData() {
    score = 0;
    scoreElement.innerText = `Score: 0`;
    player = new Player();
    enemies = [];
    frames = 0;
}

gameLoop();
