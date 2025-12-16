// Добавляем поддержку roundRect (без изменений)
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radius) {
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;

        this.beginPath();
        this.moveTo(x + radius, y);
        this.arcTo(x + width, y, x + width, y + height, radius);
        this.arcTo(x + width, y + height, x, y + height, radius);
        this.arcTo(x, y + height, x, y, radius);
        this.arcTo(x, y, x + width, y, radius);
        this.closePath();
        return this;
    };
}

class GeometryDash {
    constructor() {
        console.log('🎮 GeometryDash: Cyber Edition (v2.0)');

        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreElement = document.getElementById('score');
        this.highScoreElement = document.getElementById('highScore');
        window.game = this;

        if (!this.canvas) {
            console.error('❌ Canvas not found!');
            return;
        }

        this.setupMobile();
        this.setupAudio();
        this.setupCanvas();
        this.initGame();

        this.highScore = localStorage.getItem('geometryDashHighScore') || 0;
        if (this.highScoreElement) {
            this.highScoreElement.textContent = `🏆 ${this.highScore}`;
        }

        setTimeout(() => {
            this.setupEventListeners();
            this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }, 100);
    }

    jump() {
        if (this.gameState !== 'playing') return;

        if (!this.player.isJumping) {
            this.player.velocityY = this.jumpForce;
            this.player.isJumping = true;
            this.player.rotation = -20;

            // Цифровой эффект прыжка
            this.createParticleEffect(
                this.player.x + this.player.width / 2,
                this.player.y + this.player.height,
                12, '#00f0ff'
            );
            this.playSound('jump');

            this.player.mouthState = 'surprised';
            this.player.mouthAnimationTimer = 12;
        }
    }

    setupMobile() {
        document.addEventListener('touchmove', (e) => {
            if (e.scale !== 1) e.preventDefault();
        }, { passive: false });

        document.addEventListener('selectstart', (e) => e.preventDefault());

        const viewport = document.querySelector('meta[name=viewport]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, user-scalable=no');
        }
    }

    setupAudio() {
        this.audioContext = null;
        this.sounds = {
            jump: { freq: 400, type: 'sine', duration: 0.12, gain: 0.15 },
            score: { freq: 800, type: 'square', duration: 0.08, gain: 0.12 },
            crash: { freq: 120, type: 'sawtooth', duration: 0.4, gain: 0.25 },
            powerup: { freq: 900, type: 'sine', duration: 0.15, gain: 0.2 }
        };
        this.initAudioOnFirstTouch();
    }

    initAudioOnFirstTouch() {
        const init = () => {
            if (!this.audioContext) {
                try {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                } catch (e) {
                    console.warn('Audio not supported');
                }
            }
            document.removeEventListener('touchstart', init);
            document.removeEventListener('click', init);
        };
        document.addEventListener('touchstart', init, { once: true });
        document.addEventListener('click', init, { once: true });
    }

    playSound(name) {
        if (!this.audioContext || !this.sounds[name]) return;
        const { freq, type, duration, gain } = this.sounds[name];
        try {
            const osc = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            osc.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            osc.frequency.value = freq;
            osc.type = type;
            gainNode.gain.setValueAtTime(gain, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
            osc.start();
            osc.stop(this.audioContext.currentTime + duration);
        } catch (e) {
            console.warn('Audio error:', e);
        }
    }

    setupCanvas() {
        const resize = () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.ground.y = this.canvas.height - 100;
            this.createClouds();
            this.createGrass();
        };
        resize();
        window.addEventListener('resize', resize);
    }

    initGame() {
        this.gameState = 'menu';
        this.score = 0;
        this.gameSpeed = 7;
        this.gravity = 0.85;
        this.jumpForce = -17;
        this.combo = 0;
        this.multiplier = 1;
        this.screenShake = 0;

        this.sun = {
            x: this.canvas.width - 70,
            y: 70,
            radius: 30,
            baseY: 70,
            waveOffset: 0,
            speed: 0.025
        };

        this.clouds = [];
        this.createClouds();

        this.grassBlades = [];
        this.grassOffset = 0;
        this.createGrass();

        this.groundDetails = null;

        this.player = {
            x: 100,
            y: this.canvas.height - 150,
            width: 48,
            height: 48,
            velocityY: 0,
            isJumping: false,
            rotation: 0,
            scale: 1,
            mouthState: 'normal',
            mouthAnimationTimer: 0,
            mouthOpenness: 0,
            mouthCycle: 0,
            isTalking: false,
            talkTimer: 0
        };

        this.obstacles = [];
        this.obstacleTimer = 0;
        this.obstacleInterval = 80;
        this.particles = [];
        this.effects = [];
        this.collectibles = [];

        this.ground = {
            y: this.canvas.height - 100,
            height: 100
        };

        // НОВАЯ ПАЛИТРА: Кибер-тема
        this.colorThemes = [
            { primary: '#00f0ff', secondary: '#b040ff', bg: '#0a0e17' },
            { primary: '#00ffcc', secondary: '#7020ff', bg: '#0c0f1a' },
            { primary: '#40e0ff', secondary: '#ff30d0', bg: '#080b14' }
        ];
        this.currentTheme = 0;
    }

    createClouds() {
        this.clouds = [];
        const count = Math.floor(this.canvas.width / 200) + 4;
        for (let i = 0; i < count; i++) {
            this.clouds.push({
                x: Math.random() * this.canvas.width * 1.8,
                y: Math.random() * 120 + 40,
                width: Math.random() * 100 + 50,
                height: Math.random() * 30 + 20,
                speed: Math.random() * 0.4 + 0.1,
                opacity: Math.random() * 0.3 + 0.2
            });
        }
    }

    createGrass() {
        this.grassBlades = [];
        const count = Math.floor(this.canvas.width / 6);
        for (let i = 0; i < count; i++) {
            this.grassBlades.push({
                x: i * 6 + Math.random() * 3,
                baseHeight: Math.random() * 12 + 8,
                currentHeight: 0,
                waveOffset: Math.random() * Math.PI * 2,
                speed: Math.random() * 0.02 + 0.01,
                moveSpeed: Math.random() * 0.4 + 0.2,
                baseX: i * 6 + Math.random() * 3
            });
        }
    }

    setupEventListeners() {
        const startBtn = document.getElementById('startBtn');
        const restartBtn = document.getElementById('restartBtn');
        const shareBtn = document.getElementById('shareBtn');

        if (startBtn) startBtn.addEventListener('click', () => this.startGame());
        if (restartBtn) restartBtn.addEventListener('click', () => this.restartGame());
        if (shareBtn) shareBtn.addEventListener('click', () => this.shareScore());

        this.setupCanvasControls();

        document.addEventListener('keydown', (e) => {
            if (['Space', 'ArrowUp'].includes(e.code) || e.key === ' ') {
                e.preventDefault();
                this.jump();
            }
        });
    }

    setupCanvasControls() {
        const handle = (e) => {
            if (e.type === 'touchstart') e.preventDefault();
            if (this.gameState === 'playing') {
                this.jump();
                if (this.isMobile) this.createTapEffect(e);
            } else if (this.gameState === 'menu') {
                this.startGame();
            }
        };
        this.canvas.addEventListener('click', handle);
        this.canvas.addEventListener('touchstart', handle, { passive: false });
    }

    createTapEffect(e) {
        let x = e.clientX || (e.touches?.[0]?.clientX || 0);
        let y = e.clientY || (e.touches?.[0]?.clientY || 0);

        const effect = document.createElement('div');
        Object.assign(effect.style, {
            position: 'fixed',
            left: (x - 20) + 'px',
            top: (y - 20) + 'px',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,240,255,0.6), transparent)',
            border: '1px solid rgba(0,240,255,0.4)',
            zIndex: '9998',
            pointerEvents: 'none',
            animation: 'tapEffect 0.4s forwards'
        });
        document.body.appendChild(effect);
        setTimeout(() => document.body.removeChild(effect), 400);
    }

    startGame() {
        this.gameState = 'playing';
        document.getElementById('startScreen')?.classList.add('hidden');
        document.getElementById('gameOverScreen')?.classList.add('hidden');
        document.getElementById('menu')?.classList.add('hidden');
        document.getElementById('gameContainer')?.classList.add('playing');

        this.createParticleEffect(this.player.x, this.player.y, 20, '#00f0ff');
        this.playSound('powerup');
        this.gameLoop();
    }

    createParticleEffect(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                size: Math.random() * 3 + 1.5,
                speedX: (Math.random() - 0.5) * 6,
                speedY: (Math.random() - 0.5) * 6,
                color,
                life: 1,
                decay: Math.random() * 0.025 + 0.015
            });
        }
    }

    createTextEffect(text, x, y, color) {
        this.effects.push({ text, x, y, color, life: 1 });
    }

    update() {
        if (this.gameState !== 'playing') return;

        this.updateMouthAnimation();

        this.sun.waveOffset += this.sun.speed;
        this.sun.y = this.sun.baseY + Math.sin(this.sun.waveOffset) * 12;

        this.updateClouds();
        this.updateGrass();

        this.player.velocityY += this.gravity;
        this.player.y += this.player.velocityY;
        this.player.rotation += this.player.velocityY * 0.4;
        this.player.rotation = Math.max(-20, Math.min(20, this.player.rotation));

        if (this.player.y + this.player.height > this.ground.y) {
            this.player.y = this.ground.y - this.player.height;
            this.player.velocityY = 0;
            this.player.isJumping = false;
            this.player.rotation = 0;
        }

        this.obstacleTimer++;
        if (this.obstacleTimer > this.obstacleInterval) {
            this.createObstacle();
            this.obstacleTimer = 0;
            this.obstacleInterval = Math.max(35, this.obstacleInterval - 0.18);
        }

        if (Math.random() < 0.015) this.createCollectible();

        // Обновление препятствий
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.x -= this.gameSpeed;

            if (this.checkCollision(this.player, obs)) {
                this.gameOver();
                return;
            }

            if (obs.x + obs.width < 0) {
                this.obstacles.splice(i, 1);
                this.score += 10 * this.multiplier;
                this.combo++;

                if (this.combo % 5 === 0) {
                    this.multiplier++;
                    this.createTextEffect('x' + this.multiplier, obs.x, obs.y, '#00ffcc');
                    this.playSound('powerup');
                    this.player.mouthState = 'smiling';
                    this.player.mouthAnimationTimer = 18;
                }
                this.updateScore();
                this.createParticleEffect(obs.x, obs.y, 6, obs.color);
            }
        }

        // Сбор предметов
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const c = this.collectibles[i];
            c.x -= this.gameSpeed;
            c.rotation = (c.rotation || 0) + 0.15;

            if (this.checkCollision(this.player, c)) {
                this.collectibles.splice(i, 1);
                this.score += 50;
                this.createTextEffect('+50', c.x, c.y, '#00ffcc');
                this.createParticleEffect(c.x, c.y, 12, '#b040ff');
                this.playSound('score');
                this.player.mouthState = 'smiling';
                this.player.mouthAnimationTimer = 20;
                this.player.isTalking = true;
                this.player.talkTimer = 12;
                this.updateScore();
            } else if (c.x + c.width < 0) {
                this.collectibles.splice(i, 1);
            }
        }

        this.gameSpeed += 0.0012;
        this.updateParticles();
        this.updateEffects();

        if (this.screenShake > 0) {
            this.screenShake *= 0.92;
            if (this.screenShake < 0.1) this.screenShake = 0;
        }
    }

    updateClouds() {
        for (let i = this.clouds.length - 1; i >= 0; i--) {
            const c = this.clouds[i];
            c.x -= c.speed * 0.6;
            if (c.x + c.width < 0) {
                c.x = this.canvas.width + Math.random() * 200;
                c.y = Math.random() * 120 + 40;
            }
        }
    }

    updateGrass() {
        for (const blade of this.grassBlades) {
            if (blade.currentHeight < blade.baseHeight) {
                blade.currentHeight += 0.4;
            }
            blade.waveOffset += blade.speed;
            blade.x -= blade.moveSpeed * 0.6;
            if (blade.x < -10) {
                blade.x = this.canvas.width + 10;
                blade.currentHeight = 0;
            }
        }
    }

    updateMouthAnimation() {
        if (this.player.mouthAnimationTimer > 0) {
            this.player.mouthAnimationTimer--;
        } else if (this.player.mouthState !== 'normal') {
            this.player.mouthState = 'normal';
        }

        if (this.player.talkTimer > 0) {
            this.player.talkTimer--;
        } else {
            this.player.isTalking = false;
        }

        if (this.player.isTalking) {
            this.player.mouthCycle = (this.player.mouthCycle + 0.4) % Math.PI;
            this.player.mouthOpenness = Math.sin(this.player.mouthCycle) * 0.6 + 0.4;
        } else {
            this.player.mouthCycle = (this.player.mouthCycle + 0.06) % Math.PI;
            this.player.mouthOpenness = Math.sin(this.player.mouthCycle) * 0.2 + 0.2;
        }
    }

    createCollectible() {
        this.collectibles.push({
            x: this.canvas.width,
            y: this.ground.y - 70,
            width: 22,
            height: 22,
            color: '#00ffcc',
            type: 'data'
        });
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.speedX;
            p.y += p.speedY;
            p.life -= p.decay;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    updateEffects() {
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const e = this.effects[i];
            e.life -= 0.025;
            e.y -= 2.5;
            if (e.life <= 0) this.effects.splice(i, 1);
        }
    }

    createObstacle() {
        const types = [
            { width: 30, height: 55, type: 'spike' },
            { width: 70, height: 35, type: 'platform' }
        ];
        const type = types[Math.floor(Math.random() * types.length)];
        const theme = this.colorThemes[this.currentTheme];

        this.obstacles.push({
            x: this.canvas.width,
            y: type.type === 'platform' ? this.ground.y - type.height : this.ground.y - type.height,
            width: type.width,
            height: type.height,
            color: theme.secondary,
            type: type.type
        });
    }

    checkCollision(a, b) {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    }

    draw() {
        const shakeX = this.screenShake * (Math.random() - 0.5) * 8;
        const shakeY = this.screenShake * (Math.random() - 0.5) * 8;
        this.ctx.save();
        this.ctx.translate(shakeX, shakeY);

        const theme = this.colorThemes[this.currentTheme];

        // Фон
        this.ctx.fillStyle = theme.bg;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Градиент неба (очень тонкий)
        const skyGrad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height * 0.4);
        skyGrad.addColorStop(0, 'rgba(10, 20, 40, 0.2)');
        skyGrad.addColorStop(1, 'transparent');
        this.ctx.fillStyle = skyGrad;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height * 0.4);

        this.drawClouds();
        this.drawSun();

        // Земля
        this.ctx.fillStyle = '#0f1525';
        this.ctx.fillRect(0, this.ground.y, this.canvas.width, this.ground.height);

        this.drawGrass();

        // Сбор предметов
        this.collectibles.forEach(c => {
            this.ctx.save();
            this.ctx.translate(c.x + c.width/2, c.y + c.height/2);
            this.ctx.rotate(c.rotation || 0);
            this.ctx.fillStyle = c.color;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, c.width/2, 0, Math.PI*2);
            this.ctx.fill();

            // Светодиодный центр
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 3, 0, Math.PI*2);
            this.ctx.fill();
            this.ctx.restore();
        });

        // Препятствия
        this.obstacles.forEach(obs => {
            this.ctx.fillStyle = obs.color;
            if (obs.type === 'spike') {
                this.ctx.beginPath();
                this.ctx.moveTo(obs.x, obs.y + obs.height);
                this.ctx.lineTo(obs.x + obs.width/2, obs.y);
                this.ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
                this.ctx.closePath();
                this.ctx.fill();
            } else {
                this.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                // Неоновый контур
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
            }
        });

        // Персонаж
        this.ctx.save();
        this.ctx.translate(
            this.player.x + this.player.width / 2,
            this.player.y + this.player.height / 2
        );
        this.ctx.rotate(this.player.rotation * Math.PI / 180);
        this.drawCyberPlayer();
        this.ctx.restore();

        // Частицы
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;

        // Текстовые эффекты
        this.effects.forEach(e => {
            this.ctx.globalAlpha = e.life;
            this.ctx.fillStyle = e.color;
            this.ctx.font = 'bold 18px "Roboto Mono", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(e.text, e.x, e.y);
        });
        this.ctx.globalAlpha = 1;

        this.ctx.restore();
    }

    drawClouds() {
        this.clouds.forEach(cloud => {
            this.ctx.save();
            this.ctx.globalAlpha = cloud.opacity * 0.7;
            this.ctx.fillStyle = '#406080';

            // "Голографический" стиль: рваные формы
            this.ctx.beginPath();
            this.ctx.moveTo(cloud.x, cloud.y + cloud.height * 0.5);
            this.ctx.lineTo(cloud.x + cloud.width * 0.3, cloud.y);
            this.ctx.lineTo(cloud.x + cloud.width * 0.7, cloud.y + cloud.height * 0.2);
            this.ctx.lineTo(cloud.x + cloud.width, cloud.y + cloud.height * 0.5);
            this.ctx.lineTo(cloud.x + cloud.width * 0.8, cloud.y + cloud.height);
            this.ctx.lineTo(cloud.x + cloud.width * 0.2, cloud.y + cloud.height * 0.8);
            this.ctx.closePath();
            this.ctx.fill();

            this.ctx.restore();
        });
    }

    drawSun() {
        // Луна с кольцом данных
        this.ctx.save();
        this.ctx.translate(this.sun.x, this.sun.y);

        // Основной диск
        this.ctx.fillStyle = '#e0e0ff';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, this.sun.radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Кольцо данных
        this.ctx.strokeStyle = '#00f0ff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, this.sun.radius + 8, 0, Math.PI * 2);
        this.ctx.stroke();

        // Светодиоды на кольце
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + this.sun.waveOffset;
            const r = this.sun.radius + 8;
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            this.ctx.fillStyle = i % 2 === 0 ? '#00f0ff' : '#b040ff';
            this.ctx.beginPath();
            this.ctx.arc(x, y, 2.5, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    drawGrass() {
        // Цифровая земля
        this.ctx.fillStyle = '#121828';
        this.ctx.fillRect(0, this.ground.y - 8, this.canvas.width, 8);

        this.grassBlades.forEach(blade => {
            const x = blade.x;
            const baseY = this.ground.y - 8;
            const h = Math.max(0, blade.currentHeight + Math.sin(blade.waveOffset + x * 0.02) * 3);

            this.ctx.strokeStyle = '#00f0ff';
            this.ctx.lineWidth = 1.2;
            this.ctx.beginPath();
            this.ctx.moveTo(x, baseY);
            this.ctx.lineTo(x + Math.sin(blade.waveOffset) * 4, baseY - h);
            this.ctx.stroke();

            // Светодиод на кончике
            if (h > 5) {
                this.ctx.fillStyle = '#00ffcc';
                this.ctx.beginPath();
                this.ctx.arc(x + Math.sin(blade.waveOffset) * 4, baseY - h, 1.5, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });
    }

    drawCyberPlayer() {
        const w = this.player.width;
        const h = this.player.height;
        const theme = this.colorThemes[this.currentTheme];

        // Основной куб
        this.ctx.fillStyle = theme.primary;
        this.ctx.beginPath();
        this.ctx.roundRect(-w/2, -h/2, w, h, 8);
        this.ctx.fill();

        // Голубой градиент
        const grad = this.ctx.createLinearGradient(-w/2, -h/2, w/2, h/2);
        grad.addColorStop(0, 'rgba(0,240,255,0.3)');
        grad.addColorStop(1, 'transparent');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.roundRect(-w/2, -h/2, w, h, 8);
        this.ctx.fill();

        // Контур
        this.ctx.strokeStyle = 'rgba(0,240,255,0.6)';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.roundRect(-w/2, -h/2, w, h, 8);
        this.ctx.stroke();

        // Глаза (светодиоды)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(-w/3.5, -h/3.5, 4.5, 0, Math.PI * 2);
        this.ctx.arc(w/3.5, -h/3.5, 4.5, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(-w/3.5, -h/3.5, 2, 0, Math.PI * 2);
        this.ctx.arc(w/3.5, -h/3.5, 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Рот
        this.drawCyberMouth();
    }

    drawCyberMouth() {
        const y = this.player.height / 6;
        let w = 20, h = 4, curve = 0, isRound = false;

        switch (this.player.mouthState) {
            case 'normal':
                h = 3 + this.player.mouthOpenness * 3;
                curve = 0.5;
                break;
            case 'smiling':
                h = 5 + this.player.mouthOpenness * 4;
                curve = 1.5;
                break;
            case 'surprised':
                h = 12 + this.player.mouthOpenness * 4;
                isRound = true;
                break;
            case 'sad':
                h = 3 + this.player.mouthOpenness * 2;
                curve = -0.6;
                break;
        }

        if (this.player.isTalking && this.player.mouthOpenness > 0.8) {
            h = 14;
            isRound = true;
        }

        this.ctx.fillStyle = '#000000';
        if (isRound) {
            this.ctx.beginPath();
            this.ctx.ellipse(0, y, w/2, h/2, 0, 0, Math.PI*2);
            this.ctx.fill();

            if (this.player.isTalking) {
                this.ctx.fillStyle = '#b040ff';
                this.ctx.beginPath();
                this.ctx.ellipse(0, y + h/3, 4, 3, 0, 0, Math.PI*2);
                this.ctx.fill();
            }
        } else {
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            if (curve > 0) {
                this.ctx.ellipse(0, y + h/3, w/2, h/2, 0, Math.PI*0.15, Math.PI*0.85);
            } else {
                this.ctx.ellipse(0, y - h/3, w/2, h/2, 0, Math.PI*1.15, Math.PI*1.85);
            }
            this.ctx.stroke();
        }
    }

    darkenColor(color, percent) {
        const num = parseInt(color.slice(1), 16);
        const amt = Math.round(2.55 * percent);
        const r = Math.max(0, (num >> 16) - amt);
        const g = Math.max(0, ((num >> 8) & 0xFF) - amt);
        const b = Math.max(0, (num & 0xFF) - amt);
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    updateScore() {
        if (this.scoreElement) this.scoreElement.textContent = `⭐ ${this.score}`;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('geometryDashHighScore', this.highScore);
            if (this.highScoreElement) this.highScoreElement.textContent = `🏆 ${this.highScore}`;
        }
    }

    gameOver() {
        this.gameState = 'gameover';
        this.player.mouthState = 'sad';
        this.player.mouthAnimationTimer = 30;

        document.getElementById('gameOverScreen')?.classList.remove('hidden');
        document.getElementById('finalScore')?.textContent = `⭐ ${this.score}`;
        document.getElementById('menu')?.classList.remove('hidden');
        document.getElementById('gameContainer')?.classList.remove('playing');

        this.screenShake = 2.5;
        this.createParticleEffect(this.player.x + 24, this.player.y + 24, 35, '#b040ff');
        this.playSound('crash');
    }

    restartGame() {
        this.currentTheme = (this.currentTheme + 1) % this.colorThemes.length;
        this.initGame();
        this.startGame();
    }

    shareScore() {
        const text = `Я набрал ${this.score} очков в GeometryDash Cyber!`;
        if (navigator.share) {
            navigator.share({ title: 'GeometryDash Cyber', text });
        } else {
            alert(text);
        }
    }

    gameLoop() {
        this.update();
        this.draw();
        if (this.gameState === 'playing') {
            requestAnimationFrame(() => this.gameLoop());
        }
    }
}

// Инициализация
window.addEventListener('DOMContentLoaded', () => new GeometryDash());