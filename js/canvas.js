/* ==========================================================================
   CHRONOSCAPES CANVAS ENGINE: PHYSICS PARTICLE SIMULATOR (V1.3 GLASS OVERLAYS)
   ========================================================================== */

class AmbientCanvas {
    constructor() {
        this.canvas = document.getElementById('ambient-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentScene = 'tokyo';
        this.fireFlare = 0.0;
        this.isMouseDown = false;
        this.supernovaFlare = 0.0;
        this.shootingStars = [];
        this.ripples = [];
        this.lastTapTime = 0;
        this.neonOverload = 0.0;
        this.gravityCollapse = 0.0;
        this.weatherLevel = 0.3; // Default 30%
        this.lightningFlash = 0.0;
        
        // Zen Garden states
        this.rakeLines = [];
        this.bambooWater = 0.0;
        this.bambooAngle = 0.0;
        this.bambooTipState = 'filling';
        this.bambooTipProgress = 0.0;
        
        // Rain Piano states
        this.isRainPianoActive = false;
        this.pianoNotes = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99];
        this.keyPulses = new Array(this.pianoNotes.length).fill(0.0);
        
        // Space Constellation states
        this.constellationLinks = [];
        this.activeDrawingNode = null;
        this.nebulaLoops = [];
        
        // Background particle fields
        this.particles = [];
        this.maxParticles = 120;
        
        // Dynamic cursor particle trail
        this.trail = [];
        this.maxTrail = 80;
        
        // NEW: Screen Glass Condensation droplets
        this.windowDrops = [];
        this.maxWindowDrops = 45; // reduced on mobile automatically
        
        // Scene Transition Warp state
        this.isWarping = false;
        this.warpProgress = 0.0;
        
        // NEW: Sky Time scrubbing and Frosted window wipe
        this.skyTime = 720;
        this.wipedTrails = [];
        this.isWipingActive = false;
        this.lastWipeTime = Date.now();
        
        // Mouse/Touch coordinates
        this.mouse = {
            x: null,
            y: null,
            radius: 120
        };
        
        this.init();
        this.setupEventListeners();
        this.animate();
    }
    
    init() {
        this.resize();
        this.createParticles();
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        if (!this.fogCanvas) {
            this.fogCanvas = document.createElement('canvas');
            this.trailCanvas = document.createElement('canvas');
        }
        this.fogCanvas.width = this.canvas.width;
        this.fogCanvas.height = this.canvas.height;
        this.trailCanvas.width = this.canvas.width;
        this.trailCanvas.height = this.canvas.height;
        
        this.fogCtx = this.fogCanvas.getContext('2d');
        this.trailCtx = this.trailCanvas.getContext('2d');
    }
    
    isBackgroundClick(e) {
        if (!e.target) return false;
        return !e.target.closest('.glass-panel') && !e.target.closest('#entrance-screen');
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.resize();
            this.createParticles();
            this.windowDrops = []; // reset window drops on resize to avoid coordinate drift
        });
        
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
            
            if (this.isMouseDown && this.isWipingActive) {
                this.addWipePoint(e.clientX, e.clientY);
            }
            if (this.currentScene === 'zengarden' && this.isMouseDown) {
                this.addRakePoint(e.clientX, e.clientY);
            }
            if (this.currentScene === 'space' && this.isMouseDown) {
                this.updateConstellationDrawing(e.clientX, e.clientY);
            }
            
            if (Math.random() < 0.45 && !this.isWarping) {
                this.addTrailSpark(e.clientX, e.clientY);
            }
        });
        
        window.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
            this.isMouseDown = false;
            this.isWipingActive = false;
            this.activeDrawingNode = null;
        });

        window.addEventListener('mousedown', (e) => {
            this.isMouseDown = true;
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
            this.isWipingActive = this.isBackgroundClick(e);
            
            if (this.isWipingActive) {
                this.addWipePoint(e.clientX, e.clientY);
            }
            
            if (this.isBackgroundClick(e)) {
                if (this.currentScene === 'space') {
                    this.checkMeteorClick(e.clientX, e.clientY);
                    
                    const star = this.particles.find(p => p.type === 'star' && Math.hypot(p.x - e.clientX, p.y - e.clientY) < 55);
                    if (star) this.activeDrawingNode = star;
                } else if (this.currentScene === 'tokyo') {
                    this.addPuddleRipple(e.clientX, e.clientY);
                } else if (this.currentScene === 'zengarden') {
                    this.addRakePoint(e.clientX, e.clientY);
                }
            }
        });

        window.addEventListener('mouseup', () => {
            this.isMouseDown = false;
            this.isWipingActive = false;
            this.activeDrawingNode = null;
        });

        window.addEventListener('dblclick', (e) => {
            if (this.currentScene === 'space' && this.isBackgroundClick(e)) {
                this.triggerSupernova(e.clientX, e.clientY);
            }
        });

        window.addEventListener('touchstart', (e) => {
            this.isMouseDown = true;
            if (e.touches.length > 0) {
                const tx = e.touches[0].clientX;
                const ty = e.touches[0].clientY;
                this.mouse.x = tx;
                this.mouse.y = ty;
                
                this.isWipingActive = this.isBackgroundClick(e);
                if (this.isWipingActive) {
                    this.addWipePoint(tx, ty);
                }
                
                // Track double tap on mobile for space supernova
                const now = Date.now();
                const tapDelay = 280;
                if (now - this.lastTapTime < tapDelay && this.isBackgroundClick(e)) {
                    if (this.currentScene === 'space') {
                        this.triggerSupernova(tx, ty);
                    }
                } else {
                    // Check single touch actions
                    if (this.isBackgroundClick(e)) {
                        if (this.currentScene === 'space') {
                            this.checkMeteorClick(tx, ty);
                            const star = this.particles.find(p => p.type === 'star' && Math.hypot(p.x - tx, p.y - ty) < 55);
                            if (star) this.activeDrawingNode = star;
                        } else if (this.currentScene === 'tokyo') {
                            this.addPuddleRipple(tx, ty);
                        } else if (this.currentScene === 'zengarden') {
                            this.addRakePoint(tx, ty);
                        }
                    }
                }
                this.lastTapTime = now;
                
                if (this.currentScene === 'space' && this.isBackgroundClick(e)) {
                    if (e.cancelable) e.preventDefault();
                } else if (Math.random() < 0.6 && !this.isWarping) {
                    this.addTrailSpark(tx, ty);
                }
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (this.currentScene === 'space' && this.isBackgroundClick(e)) {
                if (e.cancelable) e.preventDefault();
            }
            if (e.touches.length > 0) {
                const tx = e.touches[0].clientX;
                const ty = e.touches[0].clientY;
                this.mouse.x = tx;
                this.mouse.y = ty;
                
                if (this.isMouseDown && this.isWipingActive) {
                    this.addWipePoint(tx, ty);
                }
                if (this.currentScene === 'zengarden' && this.isMouseDown) {
                    this.addRakePoint(tx, ty);
                }
                if (this.currentScene === 'space' && this.isMouseDown) {
                    this.updateConstellationDrawing(tx, ty);
                }
                
                if (Math.random() < 0.35 && !this.isWarping) {
                    this.addTrailSpark(tx, ty);
                }
            }
        }, { passive: false });

        window.addEventListener('touchend', () => {
            this.isMouseDown = false;
            this.isWipingActive = false;
            this.mouse.x = null;
            this.mouse.y = null;
            this.activeDrawingNode = null;
        });
    }
    
    addTrailSpark(x, y) {
        this.trail.push({
            x: x,
            y: y,
            size: Math.random() * 4 + 1.5,
            speedX: Math.random() * 1.6 - 0.8,
            speedY: Math.random() * 1.6 - 0.8,
            life: 1.0,
            decay: Math.random() * 0.025 + 0.015
        });
    }

    triggerWarpEffect() {
        this.isWarping = true;
        this.warpProgress = 1.0;
    }

    triggerKeypressRipple(customX, customY) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        let px = w / 2;
        let py = h / 2;
        
        if (customX !== undefined && customY !== undefined) {
            px = customX;
            py = customY;
        } else if (this.mouse.x !== null && this.mouse.y !== null) {
            px = this.mouse.x + (Math.random() * 60 - 30);
            py = this.mouse.y + (Math.random() * 60 - 30);
        }
        
        const numSparks = Math.floor(Math.random() * 4) + 8;
        for (let i = 0; i < numSparks; i++) {
            const angle = (i / numSparks) * Math.PI * 2;
            const speed = Math.random() * 3.5 + 1.5;
            this.trail.push({
                x: px,
                y: py,
                size: Math.random() * 5 + 2,
                speedX: Math.cos(angle) * speed,
                speedY: Math.sin(angle) * speed,
                life: 1.0,
                decay: Math.random() * 0.02 + 0.015
            });
        }
    }
    
    setScene(sceneName) {
        this.currentScene = sceneName;
        this.windowDrops = []; // reset window drops
        this.shootingStars = [];
        this.ripples = [];
        this.supernovaFlare = 0.0;
        this.neonOverload = 0.0;
        this.gravityCollapse = 0.0;
        this.lightningFlash = 0.0;
        
        if (typeof audioSynth !== 'undefined') {
            audioSynth.triggerTimeWarp();
        }
        
        // Reset new states
        this.rakeLines = [];
        this.bambooWater = 0.0;
        this.bambooAngle = 0.0;
        this.bambooTipState = 'filling';
        this.bambooTipProgress = 0.0;
        this.constellationLinks = [];
        this.activeDrawingNode = null;
        this.nebulaLoops = [];
        
        const isMobile = window.innerWidth < 768;
        
        if (sceneName === 'tokyo') {
            this.maxParticles = isMobile ? 75 : 180;
            this.maxWindowDrops = isMobile ? 20 : 45;
        } else if (sceneName === 'fireplace') {
            this.maxParticles = isMobile ? 35 : 80;
            this.maxWindowDrops = isMobile ? 15 : 35;
        } else if (sceneName === 'zengarden') {
            this.maxParticles = isMobile ? 25 : 55;
            this.maxWindowDrops = isMobile ? 12 : 30;
        } else {
            this.maxParticles = isMobile ? 45 : 100;
            this.maxWindowDrops = isMobile ? 15 : 35;
        }
        
        // mist in some initial static window droplets on scene load
        const initialCount = Math.floor(this.maxWindowDrops * 0.6);
        for (let i = 0; i < initialCount; i++) {
            this.windowDrops.push(this.generateWindowDrop(true));
        }
        
        this.triggerWarpEffect();
        this.createParticles();
    }
    
    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push(this.generateParticle(true));
        }
    }
    
    generateParticle(randomY = false) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        if (this.currentScene === 'tokyo') {
            return {
                type: 'rain',
                x: Math.random() * w,
                y: randomY ? Math.random() * h : -20,
                length: Math.random() * 25 + 15,
                speed: Math.random() * 12 + 10,
                weight: Math.random() * 1.5 + 0.8,
                wind: -1.5,
                opacity: Math.random() * 0.4 + 0.15
            };
        } else if (this.currentScene === 'fireplace') {
            if (this.weatherLevel > 0 && Math.random() < 0.45) {
                return {
                    type: 'snow',
                    x: Math.random() * w,
                    y: randomY ? Math.random() * h : -20,
                    size: Math.random() * 2.5 + 1.0,
                    speedY: Math.random() * 1.4 + 0.8,
                    speedX: Math.random() * 1.0 + 0.4, // diagonal wind drift to the right
                    opacity: Math.random() * 0.35 + 0.25,
                    wobbleAge: Math.random() * 100,
                    wobbleSpeed: Math.random() * 0.03 + 0.01
                };
            }
            return {
                type: 'ember',
                x: Math.random() * w,
                y: randomY ? Math.random() * h : h + 20,
                size: Math.random() * 3 + 1,
                speedY: Math.random() * 1.8 + 0.7,
                speedX: Math.random() * 1.2 - 0.6,
                life: Math.random() * 0.8 + 0.2,
                decay: Math.random() * 0.005 + 0.003,
                wobbleSpeed: Math.random() * 0.05 + 0.02,
                wobbleAge: Math.random() * 100
            };
        } else if (this.currentScene === 'zengarden') {
            return {
                type: 'leaf',
                x: Math.random() * w,
                y: randomY ? Math.random() * h : -20,
                size: Math.random() * 5 + 3,
                speedY: Math.random() * 0.8 + 0.5,
                speedX: Math.random() * 0.6 - 0.2,
                opacity: Math.random() * 0.4 + 0.2,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: Math.random() * 0.02 - 0.01,
                wobbleAge: Math.random() * 100,
                wobbleSpeed: Math.random() * 0.02 + 0.01
            };
        } else {
            return {
                type: 'star',
                id: Math.random().toString(36).substr(2, 9),
                x: Math.random() * w,
                y: Math.random() * h,
                size: Math.random() * 2 + 0.5,
                speedX: Math.random() * 0.2 - 0.1,
                speedY: Math.random() * 0.2 - 0.1,
                pulseSpeed: Math.random() * 0.03 + 0.01,
                pulsePhase: Math.random() * Math.PI * 2,
                opacity: Math.random() * 0.8 + 0.2
            };
        }
    }

    // Spawn window pane droplets
    generateWindowDrop(randomY = false) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        return {
            x: Math.random() * w,
            y: randomY ? Math.random() * h : -15,
            radius: Math.random() * 4.5 + 2.0, // size radius (2px to 6.5px)
            speedY: 0,
            slideHold: Math.random() * 140 + 60, // frames to wait stationary
            isSliding: false,
            slideTimer: 0,
            wobbleOffset: Math.random() * Math.PI
        };
    }
    
    animate() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const mainCtx = this.ctx;
        this.ctx = this.trailCtx;



        // Handle Tokyo lightning strike trigger
        if (this.currentScene === 'tokyo' && this.weatherLevel > 0 && !this.isWarping) {
            if (Math.random() < 0.0006 * this.weatherLevel) {
                this.lightningFlash = 1.0;
                if (typeof audioSynth !== 'undefined') {
                    audioSynth.playThunder(this.weatherLevel);
                }
            }
        }

        this.ctx.fillStyle = this.getSkyGradient();
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Space supernova flare background overlay
        if (this.currentScene === 'space' && this.supernovaFlare > 0) {
            this.ctx.fillStyle = `rgba(255, 120, 200, ${this.supernovaFlare * 0.22})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Draw lightning flash overlay if active
        if (this.lightningFlash > 0) {
            this.lightningFlash -= 0.07;
            if (this.lightningFlash < 0) this.lightningFlash = 0;
            
            this.ctx.fillStyle = `rgba(225, 242, 255, ${this.lightningFlash * 0.38})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        if (this.isWarping) {
            this.warpProgress -= 0.028;
            if (this.warpProgress <= 0) {
                this.isWarping = false;
                this.warpProgress = 0;
            }
        }
        
        // Decay fire flare over time
        if (this.currentScene === 'fireplace' && this.fireFlare > 0) {
            this.fireFlare -= 0.015;
            if (this.fireFlare < 0) this.fireFlare = 0;
        } else if (this.currentScene !== 'fireplace') {
            this.fireFlare = 0;
        }

        // Decay supernova flare over time
        if (this.currentScene === 'space' && this.supernovaFlare > 0) {
            this.supernovaFlare -= 0.012; // lasts ~1.4 seconds
            if (this.supernovaFlare < 0) this.supernovaFlare = 0;
        }

        // Decay neon overload over time
        if (this.currentScene === 'tokyo' && this.neonOverload > 0) {
            this.neonOverload -= 0.014; // lasts ~1.2 seconds
            if (this.neonOverload < 0) this.neonOverload = 0;
        } else if (this.currentScene !== 'tokyo') {
            this.neonOverload = 0;
        }

        // Decay gravity collapse over time
        if (this.currentScene === 'space' && this.gravityCollapse > 0) {
            this.gravityCollapse -= 0.018; // lasts ~0.9 seconds
            if (this.gravityCollapse < 0) this.gravityCollapse = 0;
        } else if (this.currentScene !== 'space') {
            this.gravityCollapse = 0;
        }
        
        const speedMult = 1.0 + (this.warpProgress * 7.0);
        
        // Draw Tokyo Neon reflections and puddle ripples
        if (this.currentScene === 'tokyo') {
            this.drawTokyoNeonReflections();
            this.updateAndDrawPuddleRipples();
            this.drawTokyoGlitchOverload();
            if (this.isRainPianoActive) {
                this.drawRainPianoKeys();
            }
        }
        
        // Draw Zen Garden raked sand and Shishi-odoshi
        if (this.currentScene === 'zengarden') {
            this.updateAndDrawRakeLines();
            this.updateAndDrawShishiOdoshi(speedMult);
        }
        
        // Draw Space Constellations
        if (this.currentScene === 'space') {
            this.updateAndDrawConstellations();
            this.drawSpaceEventHorizon();
        }

        // Draw Space shooting stars
        if (this.currentScene === 'space') {
            // Spawn shooting stars randomly
            if (Math.random() < 0.002) { // roughly every 8 seconds
                this.spawnShootingStar();
            }
            this.updateAndDrawShootingStars();
        }
        
        // Dynamic max particles for fireplace flare and neon overload
        let activeMaxParticles = this.maxParticles;
        if (this.currentScene === 'fireplace' && this.fireFlare > 0) {
            activeMaxParticles = Math.floor(this.maxParticles * (1.0 + this.fireFlare));
        } else if (this.currentScene === 'tokyo' && this.neonOverload > 0) {
            activeMaxParticles = Math.floor(this.maxParticles * (1.0 + this.neonOverload * 1.5));
        }
        
        // Spawn additional particles immediately if needed
        while (this.particles.length < activeMaxParticles) {
            this.particles.push(this.generateParticle(false));
        }
        
        // 1. Update & Render background particle fields
        for (let i = 0; i < this.particles.length; i++) {
            let p = this.particles[i];
            
            if (p.type === 'rain') {
                this.updateRain(p, speedMult);
                this.drawRain(p, speedMult);
            } else if (p.type === 'ember') {
                this.updateEmber(p, speedMult);
                this.drawEmber(p, speedMult);
            } else if (p.type === 'star') {
                this.updateStar(p, speedMult);
                this.drawStar(p, speedMult);
            } else if (p.type === 'leaf') {
                this.updateLeaf(p, speedMult);
                this.drawLeaf(p, speedMult);
            } else if (p.type === 'snow') {
                this.updateSnow(p, speedMult);
                this.drawSnow(p, speedMult);
            }
            
            if (this.isDead(p)) {
                if (this.particles.length <= activeMaxParticles) {
                    this.particles[i] = this.generateParticle(false);
                } else {
                    this.particles.splice(i, 1);
                    i--;
                }
            }
        }

        // Restore the main canvas context
        this.ctx = mainCtx;

        // Draw the sharp background and particles onto the main canvas (fully cleared)
        this.ctx.clearRect(0, 0, w, h);
        this.ctx.drawImage(this.trailCanvas, 0, 0);

        // 2. Draw Frosted Glass Window Overlay (blurs background, reveals sharp areas under wiped paths)
        this.drawFrostedGlassOverlay();

        // 3. Update & Check Collisions for Window condensation droplets (rendered inside drawFrostedGlassOverlay)
        if (this.windowDrops.length < this.maxWindowDrops && Math.random() < 0.025) {
            this.windowDrops.push(this.generateWindowDrop(false));
        }
        
        this.updateWindowDrops(speedMult);
        this.checkDropletCollisions();
        
        // 4. Update & Render mouse/touch particle trail (rendered sharp on top of glass)
        this.drawCursorTrail();
        
        requestAnimationFrame(() => this.animate());
    }
    
    drawCursorTrail() {
        for (let i = this.trail.length - 1; i >= 0; i--) {
            let spark = this.trail[i];
            
            spark.x += spark.speedX;
            spark.y += spark.speedY;
            spark.life -= spark.decay;
            
            if (spark.life <= 0) {
                this.trail.splice(i, 1);
                continue;
            }
            
            this.ctx.beginPath();
            this.ctx.arc(spark.x, spark.y, spark.size * spark.life, 0, Math.PI * 2);
            
            let color = '';
            let shadowColor = '';
            
            if (this.currentScene === 'tokyo') {
                color = `rgba(0, 245, 212, ${spark.life * 0.75})`;
                shadowColor = 'rgba(0, 245, 212, 0.5)';
            } else if (this.currentScene === 'fireplace') {
                color = `rgba(255, 190, 11, ${spark.life * 0.75})`;
                shadowColor = 'rgba(255, 190, 11, 0.5)';
            } else {
                color = `rgba(67, 97, 238, ${spark.life * 0.8})`;
                shadowColor = 'rgba(67, 97, 238, 0.6)';
            }
            
            this.ctx.fillStyle = color;
            this.ctx.shadowBlur = spark.size * 3;
            this.ctx.shadowColor = shadowColor;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        }
    }

    /* ==========================================================================
       Glass Condensation Raindrop Physics
       ========================================================================== */
    updateWindowDrops(speedMult) {
        const h = this.canvas.height;
        for (let i = this.windowDrops.length - 1; i >= 0; i--) {
            const p = this.windowDrops[i];
            
            // Check if drop intersects with any active wiped trail point
            let isWiped = false;
            for (let j = 0; j < this.wipedTrails.length; j++) {
                const trail = this.wipedTrails[j];
                const dist = Math.hypot(p.x - trail.x, p.y - trail.y);
                if (dist < (trail.radius + p.radius) * 0.95) {
                    isWiped = true;
                    break;
                }
            }
            if (isWiped) {
                p.radius -= 0.55;
                if (p.radius <= 0.8) {
                    this.windowDrops.splice(i, 1);
                    continue;
                }
            }
            
            if (!p.isSliding) {
                p.slideTimer++;
                // Decide to slide when hold duration expires
                if (p.slideTimer >= p.slideHold) {
                    p.isSliding = true;
                    p.speedY = Math.random() * 1.5 + 0.6; // random descent speed
                    p.slideTimer = 0;
                    p.slideHold = Math.random() * 120 + 80;
                }
            } else {
                // Descend with a slight wind wiggle sine oscillation
                p.y += p.speedY * speedMult;
                p.x += Math.sin(p.y * 0.05 + p.wobbleOffset) * 0.18 * speedMult;
                
                // Slide decay check (drops sit still again after sliding a bit)
                if (Math.random() < 0.02) {
                    p.isSliding = false;
                    p.speedY = 0;
                }
            }
            
            // Delete drops that slide off screen bottom
            if (p.y > h + 15) {
                this.windowDrops.splice(i, 1);
            }
        }
    }

    /* ==========================================================================
       Raindrop collision physics (Absorb & Merge)
       ========================================================================== */
    checkDropletCollisions() {
        for (let i = 0; i < this.windowDrops.length; i++) {
            const p1 = this.windowDrops[i];
            for (let j = i + 1; j < this.windowDrops.length; j++) {
                const p2 = this.windowDrops[j];
                
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                // If droplets intersect
                if (dist < p1.radius + p2.radius) {
                    // Larger absorbs smaller
                    if (p1.radius >= p2.radius) {
                        // Conserve mass: new area = area1 + area2 (r_new = sqrt(r1^2 + r2^2))
                        p1.radius = Math.min(10.0, Math.sqrt(p1.radius * p1.radius + p2.radius * p2.radius));
                        // The absorbing drop gains downward acceleration and starts sliding immediately
                        p1.isSliding = true;
                        p1.speedY = Math.min(3.5, p1.speedY + p2.radius * 0.45);
                        // Delete smaller drop
                        this.windowDrops.splice(j, 1);
                        j--;
                    } else {
                        p2.radius = Math.min(10.0, Math.sqrt(p2.radius * p2.radius + p1.radius * p1.radius));
                        p2.isSliding = true;
                        p2.speedY = Math.min(3.5, p2.speedY + p1.radius * 0.45);
                        this.windowDrops.splice(i, 1);
                        i--;
                        break; // exit inner loop since p1 is deleted
                    }
                }
            }
        }
    }

    /* ==========================================================================
       Raindrop 2.5D Lens Refraction Gradients Draws
       ========================================================================== */
    drawWindowDrops(targetCtx) {
        const ctx = targetCtx || this.ctx;
        for (let i = 0; i < this.windowDrops.length; i++) {
            const p = this.windowDrops[i];
            
            // Create a radial gradient offset to top-left to simulate light highlights
            const grad = ctx.createRadialGradient(
                p.x - p.radius * 0.28, p.y - p.radius * 0.28, p.radius * 0.05,
                p.x, p.y, p.radius
            );
            
            // Highlight reflection glint
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.48)');
            // Outer droplet highlight outline ring
            grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.09)');
            grad.addColorStop(0.68, 'rgba(0, 0, 0, 0.05)');
            // Droplet drop shadow refraction
            grad.addColorStop(0.92, 'rgba(0, 0, 0, 0.48)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            
            // Add a thin, sharp outline to give the lens structure definition
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 0.65;
            ctx.stroke();
        }
    }
    
    isDead(p) {
        if (p.type === 'rain') {
            return p.y > this.canvas.height + 20 || p.x < -20 || p.x > this.canvas.width + 20;
        } else if (p.type === 'ember') {
            return p.life <= 0 || p.y < -20 || p.x < -20 || p.x > this.canvas.width + 20;
        } else if (p.type === 'star') {
            return p.x < 0 || p.x > this.canvas.width || p.y < 0 || p.y > this.canvas.height;
        } else if (p.type === 'leaf') {
            return p.y > this.canvas.height + 20 || p.x < -20 || p.x > this.canvas.width + 20;
        } else if (p.type === 'snow') {
            return p.y > this.canvas.height + 20 || p.x > this.canvas.width + 20;
        }
        return false;
    }
    
    /* ==========================================
       Tokyo Rain Particle Logic
       ========================================== */
    updateRain(p, speedMult) {
        const h = this.canvas.height;
        const w = this.canvas.width;
        const keyY = h - 60;
        
        let rainSpeed = p.speed;
        if (this.neonOverload > 0) {
            rainSpeed = p.speed * (1.0 + this.neonOverload * 2.2); // up to 3.2x speed
        }
        const nextY = p.y + rainSpeed * speedMult;
        
        if (this.isRainPianoActive && p.y < keyY && nextY >= keyY) {
            const numKeys = this.pianoNotes.length;
            const keyIdx = Math.max(0, Math.min(numKeys - 1, Math.floor((p.x / w) * numKeys)));
            
            if (Math.random() < 0.22) {
                if (typeof audioSynth !== 'undefined') {
                    audioSynth.playRhodesPianoNote(this.pianoNotes[keyIdx]);
                }
                this.keyPulses[keyIdx] = 1.0;
                this.addPuddleRipple(p.x, keyY);
            }
            
            p.y = h + 100;
            return;
        }
        
        p.y = nextY;
        p.x += p.wind * speedMult;
        
        // Mouse/Touch displacement
        if (this.mouse.x !== null && this.mouse.y !== null && !this.isWarping) {
            let dx = p.x - this.mouse.x;
            let dy = p.y - this.mouse.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < this.mouse.radius) {
                let force = (this.mouse.radius - dist) / this.mouse.radius;
                p.x += (dx / dist) * force * 5;
            }
        }
    }
    
    drawRain(p, speedMult) {
        this.ctx.beginPath();
        this.ctx.moveTo(p.x, p.y);
        
        const activeLength = p.length * speedMult;
        this.ctx.lineTo(p.x + p.wind * speedMult, p.y + activeLength);
        
        this.ctx.strokeStyle = `rgba(0, 245, 212, ${this.isWarping ? p.opacity * 1.5 : p.opacity})`;
        this.ctx.lineWidth = p.weight;
        this.ctx.stroke();
    }
    
    /* ==========================================
       Fireplace Ember Particle Logic
       ========================================== */
    updateEmber(p, speedMult) {
        let flareSpeed = 1.0;
        if (this.fireFlare > 0) {
            flareSpeed = 1.0 + this.fireFlare; // doubles speed at peak (1.0 + 1.0 = 2.0)
        }
        
        p.y -= p.speedY * speedMult * flareSpeed;
        p.wobbleAge += p.wobbleSpeed * flareSpeed;
        p.x += (p.speedX + Math.sin(p.wobbleAge) * 0.4) * speedMult * flareSpeed;
        
        p.life -= this.isWarping ? p.decay * 2 : p.decay;
        
        if (this.mouse.x !== null && this.mouse.y !== null && !this.isWarping) {
            let dx = p.x - this.mouse.x;
            let dy = p.y - this.mouse.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.mouse.radius) {
                let force = (this.mouse.radius - dist) / this.mouse.radius;
                p.x += (dx / dist) * force * 3;
                p.y -= force * 1.5;
            }
        }
    }
    
    drawEmber(p, speedMult) {
        this.ctx.beginPath();
        
        let flareSizeMult = 1.0;
        if (this.fireFlare > 0) {
            flareSizeMult = 1.0 + this.fireFlare * 0.5; // up to 1.5x size
        }
        const activeSize = p.size * flareSizeMult;
        
        if (this.isWarping) {
            this.ctx.moveTo(p.x, p.y);
            this.ctx.lineTo(p.x, p.y + activeSize * 5 * speedMult);
            this.ctx.strokeStyle = `rgba(255, 84, 0, ${p.life})`;
            this.ctx.lineWidth = activeSize;
            this.ctx.stroke();
        } else {
            this.ctx.arc(p.x, p.y, activeSize, 0, Math.PI * 2);
            let red = 255;
            let green = Math.floor(Math.max(0, p.life * 180 + (this.fireFlare * 50)));
            let blue = Math.floor(Math.max(0, p.life * 50 - 20 + (this.fireFlare * 30)));
            
            green = Math.min(255, green);
            blue = Math.min(255, blue);
            
            this.ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${p.life})`;
            this.ctx.shadowBlur = activeSize * (3 + this.fireFlare * 2);
            this.ctx.shadowColor = `rgba(255, 84, 0, ${p.life})`;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        }
    }
    
    /* ==========================================
       Space Cosmic Stardust Logic
       ========================================== */
    updateStar(p, speedMult) {
        p.x += p.speedX * speedMult;
        p.y += p.speedY * speedMult;
        p.pulsePhase += p.pulseSpeed;
        
        if (this.gravityCollapse > 0) {
            // Gravity Collapse: pull all stars to center
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;
            const dx = cx - p.x;
            const dy = cy - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            const suctionStrength = 0.28 * this.gravityCollapse;
            const orbitStrength = 0.35 * this.gravityCollapse;
            
            const pullX = dx / dist;
            const pullY = dy / dist;
            const tangentX = -dy / dist;
            const tangentY = dx / dist;
            
            p.speedX += (pullX * suctionStrength + tangentX * orbitStrength) * speedMult;
            p.speedY += (pullY * suctionStrength + tangentY * orbitStrength) * speedMult;
            
            p.speedX *= 0.88;
            p.speedY *= 0.88;
            return;
        }
        
        if (this.mouse.x !== null && this.mouse.y !== null && !this.isWarping) {
            let dx = this.mouse.x - p.x;
            let dy = this.mouse.y - p.y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            if (this.isMouseDown) {
                // Gravity vortex attraction and orbit
                let pullStrength = 0.08;
                let orbitStrength = 0.22;
                
                // Repel slightly if too close to make orbit ring stable and aesthetic
                if (dist < 45) {
                    pullStrength = -0.05;
                }
                
                let pullX = dx / dist;
                let pullY = dy / dist;
                
                let tangentX = -dy / dist;
                let tangentY = dx / dist;
                
                p.speedX += (pullX * pullStrength + tangentX * orbitStrength) * speedMult;
                p.speedY += (pullY * pullStrength + tangentY * orbitStrength) * speedMult;
                
                // Damping force so particles spiral into stable orbits instead of slingshotting away
                p.speedX *= 0.94;
                p.speedY *= 0.94;
            } else {
                // Normal hover displacement logic
                if (dist < this.mouse.radius + 150) {
                    let force = (this.mouse.radius + 150 - dist) / (this.mouse.radius + 150);
                    p.x += (dx / dist) * force * 0.15;
                    p.y += (dy / dist) * force * 0.15;
                }
                
                // Slowly damp back to base cosmic speeds
                let speed = Math.sqrt(p.speedX * p.speedX + p.speedY * p.speedY);
                if (speed > 0.4) {
                    p.speedX *= 0.95;
                    p.speedY *= 0.95;
                }
            }
        }
    }
    
    drawStar(p, speedMult) {
        this.ctx.beginPath();
        let currentOpacity = p.opacity * (0.4 + 0.6 * Math.sin(p.pulsePhase));
        
        // Increase opacity and glow in vortex or collapse modes
        if ((this.isMouseDown || this.gravityCollapse > 0) && this.currentScene === 'space' && !this.isWarping) {
            currentOpacity = Math.min(1.0, currentOpacity * 1.6);
        }
        
        if (this.isWarping) {
            this.ctx.moveTo(p.x, p.y);
            this.ctx.lineTo(p.x - p.speedX * 20 * speedMult, p.y - p.speedY * 20 * speedMult);
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${currentOpacity})`;
            this.ctx.lineWidth = p.size;
            this.ctx.stroke();
        } else {
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity})`;
            
            let blurSize = p.size * 5;
            if ((this.isMouseDown || this.gravityCollapse > 0) && this.currentScene === 'space') {
                blurSize = p.size * 10;
            }
            this.ctx.shadowBlur = blurSize;
            this.ctx.shadowColor = `rgba(67, 97, 238, ${currentOpacity})`;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        }
    }

    /* ==========================================================================
       🌆 NEON WET ROAD REFLECTIONS (TOKYO MODE)
       ========================================================================== */
    drawTokyoNeonReflections() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.refOffset = (this.refOffset || 0) + 0.002;
        
        // Neon cyan reflection (left side)
        const cx1 = w * 0.25 + Math.sin(this.refOffset) * 60;
        const cy1 = h * 0.85 + Math.cos(this.refOffset * 0.7) * 30;
        const rad1 = Math.min(w, h) * 0.35;
        
        let grad1 = this.ctx.createRadialGradient(cx1, cy1, 10, cx1, cy1, rad1);
        grad1.addColorStop(0, 'rgba(0, 245, 212, 0.045)');
        grad1.addColorStop(1, 'rgba(0, 245, 212, 0)');
        this.ctx.fillStyle = grad1;
        this.ctx.beginPath();
        this.ctx.arc(cx1, cy1, rad1, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Neon magenta reflection (right side)
        const cx2 = w * 0.75 - Math.cos(this.refOffset * 1.2) * 50;
        const cy2 = h * 0.90 + Math.sin(this.refOffset * 0.9) * 20;
        const rad2 = Math.min(w, h) * 0.40;
        
        let grad2 = this.ctx.createRadialGradient(cx2, cy2, 10, cx2, cy2, rad2);
        grad2.addColorStop(0, 'rgba(255, 0, 128, 0.04)');
        grad2.addColorStop(1, 'rgba(255, 0, 128, 0)');
        this.ctx.fillStyle = grad2;
        this.ctx.beginPath();
        this.ctx.arc(cx2, cy2, rad2, 0, Math.PI * 2);
        this.ctx.fill();
    }

    /* ==========================================================================
       🌧️ PUDDLE SPLASH RIPPLES (TOKYO MODE)
       ========================================================================== */
    addPuddleRipple(x, y) {
        this.ripples.push({
            x: x,
            y: y,
            radius: 2,
            maxRadius: Math.random() * 40 + 35,
            opacity: 1.0,
            decay: Math.random() * 0.015 + 0.012,
            speed: Math.random() * 0.6 + 0.9
        });
    }

    updateAndDrawPuddleRipples() {
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.radius += r.speed;
            r.opacity -= r.decay;
            
            if (r.opacity <= 0) {
                this.ripples.splice(i, 1);
                continue;
            }
            
            // Draw concentric rings
            this.ctx.strokeStyle = `rgba(0, 245, 212, ${r.opacity * 0.25})`;
            this.ctx.lineWidth = 1.0;
            
            this.ctx.beginPath();
            this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            this.ctx.stroke();
            
            if (r.radius > 12) {
                this.ctx.strokeStyle = `rgba(255, 0, 128, ${r.opacity * 0.12})`;
                this.ctx.beginPath();
                this.ctx.arc(r.x, r.y, r.radius * 0.68, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        }
    }

    /* ==========================================================================
       ☄️ COSMIC SHOOTING STARS (SPACE MODE)
       ========================================================================== */
    spawnShootingStar() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        const startX = Math.random() * w * 0.7;
        const startY = -20;
        
        const speedX = Math.random() * 4 + 6;
        const speedY = Math.random() * 2 + 3.5;
        
        this.shootingStars.push({
            x: startX,
            y: startY,
            speedX: speedX,
            speedY: speedY,
            size: Math.random() * 1.5 + 1.5,
            trail: [],
            maxTrail: 15
        });
    }

    updateAndDrawShootingStars() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        for (let i = this.shootingStars.length - 1; i >= 0; i--) {
            const s = this.shootingStars[i];
            
            s.trail.push({ x: s.x, y: s.y });
            if (s.trail.length > s.maxTrail) {
                s.trail.shift();
            }
            
            s.x += s.speedX;
            s.y += s.speedY;
            
            if (s.x > w + 20 || s.y > h + 20) {
                this.shootingStars.splice(i, 1);
                continue;
            }
            
            if (s.trail.length > 1) {
                this.ctx.beginPath();
                this.ctx.moveTo(s.trail[0].x, s.trail[0].y);
                for (let t = 1; t < s.trail.length; t++) {
                    this.ctx.lineTo(s.trail[t].x, s.trail[t].y);
                }
                this.ctx.strokeStyle = 'rgba(67, 97, 238, 0.45)';
                this.ctx.lineWidth = s.size * 0.8;
                this.ctx.stroke();
            }
            
            this.ctx.beginPath();
            this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#4361ee';
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        }
    }

    checkMeteorClick(mx, my) {
        for (let i = this.shootingStars.length - 1; i >= 0; i--) {
            const s = this.shootingStars[i];
            const dx = s.x - mx;
            const dy = s.y - my;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 35) {
                this.shatterMeteor(s.x, s.y);
                this.shootingStars.splice(i, 1);
                
                if (typeof audioSynth !== 'undefined') {
                    audioSynth.playChimeTone();
                }
                break;
            }
        }
    }

    shatterMeteor(x, y) {
        const numDebris = 12;
        for (let i = 0; i < numDebris; i++) {
            const angle = (i / numDebris) * Math.PI * 2 + Math.random() * 0.5;
            const speed = Math.random() * 4.0 + 2.0;
            
            this.trail.push({
                x: x,
                y: y,
                size: Math.random() * 3 + 1.5,
                speedX: Math.cos(angle) * speed,
                speedY: Math.sin(angle) * speed,
                life: 1.0,
                decay: Math.random() * 0.03 + 0.02
            });
        }
    }

    /* ==========================================================================
       🌌 SUPERNOVA EXPLOSION (SPACE MODE)
       ========================================================================== */
    triggerSupernova(cx, cy) {
        if (this.currentScene !== 'space') return;
        
        this.supernovaFlare = 1.0;
        
        if (typeof audioSynth !== 'undefined') {
            audioSynth.triggerSpaceSupernova();
        }
        
        this.particles.forEach(p => {
            if (p.type === 'star') {
                const dx = p.x - cx;
                const dy = p.y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                
                const pushForce = Math.min(18.0, 1500 / dist + 4.5);
                
                p.speedX = (dx / dist) * pushForce;
                p.speedY = (dy / dist) * pushForce;
                
                p.pulseSpeed = 0.08 + Math.random() * 0.05;
            }
        });
        
        const numSparks = 36;
        for (let i = 0; i < numSparks; i++) {
            const angle = (i / numSparks) * Math.PI * 2;
            const speed = Math.random() * 8.0 + 6.0;
            
            this.trail.push({
                x: cx,
                y: cy,
                size: Math.random() * 6 + 3,
                speedX: Math.cos(angle) * speed,
                speedY: Math.sin(angle) * speed,
                life: 1.0,
                decay: Math.random() * 0.015 + 0.01
            });
        }
    }

    /* ==========================================================================
       ZEN GARDEN: LEAF PARTICLES LOGIC
       ========================================================================== */
    updateLeaf(p, speedMult) {
        p.y += p.speedY * speedMult;
        p.wobbleAge += p.wobbleSpeed;
        p.x += (p.speedX + Math.sin(p.wobbleAge) * 0.35) * speedMult;
        p.rotation += p.rotationSpeed * speedMult;
    }

    drawLeaf(p, speedMult) {
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rotation);
        this.ctx.beginPath();
        
        // Draw leaf silhouette using two bezier curves
        this.ctx.moveTo(0, -p.size);
        this.ctx.quadraticCurveTo(p.size * 0.65, -p.size * 0.25, 0, p.size);
        this.ctx.quadraticCurveTo(-p.size * 0.65, -p.size * 0.25, 0, -p.size);
        
        const greenVal = Math.floor(100 + p.opacity * 60);
        this.ctx.fillStyle = `rgba(85, ${greenVal}, 47, ${p.opacity})`;
        this.ctx.fill();
        
        // Add a thin stem line
        this.ctx.beginPath();
        this.ctx.moveTo(0, -p.size);
        this.ctx.lineTo(0, p.size * 1.25);
        this.ctx.strokeStyle = `rgba(34, 43, 19, ${p.opacity * 0.5})`;
        this.ctx.lineWidth = 0.8;
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    /* ==========================================================================
       ZEN GARDEN: GRAVEL MOSS-SAND RAKING LINES
       ========================================================================= */
    addRakePoint(x, y) {
        if (this.rakeLines.length > 0) {
            const last = this.rakeLines[this.rakeLines.length - 1];
            const dist = Math.hypot(last.x - x, last.y - y);
            if (dist < 8) return; // avoid crowding points
        }
        this.rakeLines.push({
            x: x,
            y: y,
            life: 1.0,
            decay: 0.001 // lasts ~16 seconds
        });
    }

    updateAndDrawRakeLines() {
        if (this.rakeLines.length < 2) return;
        
        // Update point life
        for (let i = 0; i < this.rakeLines.length; i++) {
            const pt = this.rakeLines[i];
            pt.life -= pt.decay;
            if (pt.life <= 0) {
                this.rakeLines.splice(i, 1);
                i--;
            }
        }
        
        if (this.rakeLines.length < 2) return;
        
        // Draw wide outer groove
        this.ctx.beginPath();
        this.ctx.lineWidth = 14;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.ctx.moveTo(this.rakeLines[0].x, this.rakeLines[0].y);
        for (let i = 1; i < this.rakeLines.length; i++) {
            this.ctx.lineTo(this.rakeLines[i].x, this.rakeLines[i].y);
        }
        this.ctx.strokeStyle = `rgba(143, 188, 143, 0.08)`;
        this.ctx.stroke();
        
        // Draw primary inner groove
        this.ctx.beginPath();
        this.ctx.lineWidth = 1.6;
        this.ctx.moveTo(this.rakeLines[0].x, this.rakeLines[0].y);
        for (let i = 1; i < this.rakeLines.length; i++) {
            const pt = this.rakeLines[i];
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${pt.life * 0.08})`;
            this.ctx.lineTo(pt.x, pt.y);
        }
        this.ctx.stroke();
    }

    /* ==========================================================================
       ZEN GARDEN: SHISHI-ODOSHI BAMBOO FOUNTAIN PHYSICS
       ========================================================================== */
    updateAndDrawShishiOdoshi(speedMult) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const pivotX = w - 150;
        const pivotY = h - 140;
        
        const restingAngle = -Math.PI / 18;
        const tippedAngle = Math.PI / 12;

        // 1. Update bamboo tip logic
        if (this.bambooTipState === 'filling') {
            this.bambooAngle = restingAngle;
            this.bambooWater += 0.0012 * speedMult;
            if (this.bambooWater >= 1.0) {
                this.bambooTipState = 'tipping';
                this.bambooTipProgress = 0.0;
                if (typeof audioSynth !== 'undefined') {
                    audioSynth.triggerShishiOdoshi();
                }
            }
        } else if (this.bambooTipState === 'tipping') {
            this.bambooTipProgress += 0.03 * speedMult;
            this.bambooAngle = restingAngle + (tippedAngle - restingAngle) * this.bambooTipProgress;
            if (this.bambooTipProgress >= 1.0) {
                this.bambooTipState = 'returning';
                this.bambooTipProgress = 0.0;
                this.bambooWater = 0.0;
            }
        } else if (this.bambooTipState === 'returning') {
            this.bambooTipProgress += 0.035 * speedMult;
            this.bambooAngle = tippedAngle + (restingAngle - tippedAngle) * this.bambooTipProgress;
            if (this.bambooTipProgress >= 1.0) {
                this.bambooTipState = 'filling';
                this.bambooAngle = restingAngle;
                this.bambooTipProgress = 0.0;
                this.addPuddleRipple(pivotX - 70, h - 85);
            }
        }
        
        // 2. Draw support stand
        this.ctx.fillStyle = 'rgba(64, 79, 43, 0.85)'; // Bamboo dark olive
        this.ctx.fillRect(pivotX - 6, pivotY - 10, 12, h - pivotY - 40);
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        this.ctx.lineWidth = 1.0;
        this.ctx.strokeRect(pivotX - 6, pivotY - 10, 12, h - pivotY - 40);
        
        // Draw pivot pin
        this.ctx.beginPath();
        this.ctx.arc(pivotX, pivotY, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ffbe0b';
        this.ctx.fill();
        
        // 3. Draw water stream from source pipe
        this.ctx.strokeStyle = 'rgba(0, 245, 212, 0.4)';
        this.ctx.lineWidth = 3.5;
        this.ctx.beginPath();
        this.ctx.moveTo(pivotX - 37, pivotY - 60);
        this.ctx.lineTo(pivotX - 50, pivotY - 20);
        this.ctx.stroke();
        
        // Draw static source pipe
        this.ctx.save();
        this.ctx.translate(pivotX + 50, pivotY - 110);
        this.ctx.rotate(5 * Math.PI / 6); // angled down-left
        this.ctx.fillStyle = 'rgba(85, 107, 47, 0.9)';
        this.ctx.fillRect(0, -8, 100, 16);
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.strokeRect(0, -8, 100, 16);
        this.ctx.restore();
        
        // 4. Draw tilting bamboo pipe
        this.ctx.save();
        this.ctx.translate(pivotX, pivotY);
        this.ctx.rotate(this.bambooAngle);
        
        // Bamboo colors: gradient of green to yellow-green
        const bambooGrad = this.ctx.createLinearGradient(-90, 0, 40, 0);
        bambooGrad.addColorStop(0, 'rgba(85, 107, 47, 0.95)');
        bambooGrad.addColorStop(0.7, 'rgba(107, 142, 35, 0.95)');
        bambooGrad.addColorStop(1, 'rgba(143, 188, 143, 0.95)');
        
        this.ctx.fillStyle = bambooGrad;
        
        this.ctx.beginPath();
        this.ctx.moveTo(-90, -8);
        this.ctx.lineTo(40, -8);
        this.ctx.lineTo(40, 8);
        this.ctx.lineTo(-90, 8);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.lineWidth = 1.0;
        this.ctx.stroke();
        
        // Hollow cut representation
        this.ctx.beginPath();
        this.ctx.ellipse(-90, 0, 4, 8, 0, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(34, 43, 19, 0.95)';
        this.ctx.fill();
        this.ctx.stroke();
        
        // Draw node lines in the bamboo stalk
        this.ctx.strokeStyle = 'rgba(34, 43, 19, 0.4)';
        this.ctx.lineWidth = 2.0;
        this.ctx.beginPath();
        this.ctx.moveTo(-20, -8);
        this.ctx.lineTo(-20, 8);
        this.ctx.stroke();
        
        // 5. Draw filling water inside the bamboo hollow tip (if filling)
        if (this.bambooWater > 0 && this.bambooTipState === 'filling') {
            this.ctx.beginPath();
            this.ctx.arc(-65, 0, 8 * this.bambooWater, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(0, 245, 212, 0.6)';
            this.ctx.fill();
        }
        this.ctx.restore();
        
        // 6. Draw water pouring out if tipping
        if (this.bambooTipState === 'tipping') {
            const tipX = pivotX - 90 * Math.cos(this.bambooAngle);
            const tipY = pivotY + 90 * Math.sin(this.bambooAngle);
            
            this.ctx.strokeStyle = 'rgba(0, 245, 212, 0.48)';
            this.ctx.lineWidth = 4.0;
            this.ctx.beginPath();
            this.ctx.moveTo(tipX);
            this.ctx.lineTo(pivotX - 70, h - 85);
            this.ctx.stroke();
        }
        
        // 7. Draw stone basin base
        this.ctx.fillStyle = 'rgba(80, 80, 80, 0.9)';
        this.ctx.beginPath();
        this.ctx.ellipse(pivotX - 70, h - 75, 30, 12, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        this.ctx.stroke();
    }

    /* ==========================================================================
       TOKYO: RAIN PIANO HUD KEYS DRAWING
       ========================================================================== */
    drawRainPianoKeys() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const keyY = h - 60;
        const numKeys = this.pianoNotes.length;
        const keyWidth = w / numKeys;
        
        this.ctx.save();
        for (let i = 0; i < numKeys; i++) {
            const x = i * keyWidth;
            
            // Grid partition line
            this.ctx.strokeStyle = 'rgba(0, 245, 212, 0.08)';
            this.ctx.lineWidth = 1.0;
            this.ctx.beginPath();
            this.ctx.moveTo(x, keyY);
            this.ctx.lineTo(x, h);
            this.ctx.stroke();
            
            // Visual key hit feedback
            if (this.keyPulses[i] > 0) {
                const pulse = this.keyPulses[i];
                
                const grad = this.ctx.createLinearGradient(x, keyY, x, h);
                grad.addColorStop(0, `rgba(0, 245, 212, ${pulse * 0.16})`);
                grad.addColorStop(0.5, `rgba(255, 0, 128, ${pulse * 0.08})`);
                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                this.ctx.fillStyle = grad;
                this.ctx.fillRect(x, keyY, keyWidth, h - keyY);
                
                this.ctx.strokeStyle = `rgba(0, 245, 212, ${pulse * 0.85})`;
                this.ctx.lineWidth = 2.2;
                this.ctx.shadowBlur = 12;
                this.ctx.shadowColor = '#00f5d4';
                this.ctx.beginPath();
                this.ctx.moveTo(x, keyY);
                this.ctx.lineTo(x + keyWidth, keyY);
                this.ctx.stroke();
                this.ctx.shadowBlur = 0;
                
                this.keyPulses[i] -= 0.035;
                if (this.keyPulses[i] < 0) this.keyPulses[i] = 0;
            }
        }
        
        this.ctx.strokeStyle = 'rgba(0, 245, 212, 0.15)';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(0, keyY);
        this.ctx.lineTo(w, keyY);
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    /* ==========================================================================
       SPACE: STAR CONSTELLATIONS VECTOR CONNECTIONS & CYCLES
       ========================================================================== */
    updateConstellationDrawing(mx, my) {
        const star = this.particles.find(p => p.type === 'star' && Math.hypot(p.x - mx, p.y - my) < 55);
        if (star) {
            if (!this.activeDrawingNode) {
                this.activeDrawingNode = star;
            } else if (this.activeDrawingNode.id !== star.id) {
                const exists = this.constellationLinks.some(link => 
                    (link.s1.id === this.activeDrawingNode.id && link.s2.id === star.id) ||
                    (link.s2.id === this.activeDrawingNode.id && link.s1.id === star.id)
                );
                
                if (!exists) {
                    this.constellationLinks.push({ s1: this.activeDrawingNode, s2: star });
                    if (typeof audioSynth !== 'undefined') {
                        audioSynth.playChimeTone();
                    }
                    this.checkConstellationCycles();
                }
                this.activeDrawingNode = star; // cascade link
            }
        }
    }

    checkConstellationCycles() {
        const adj = {};
        this.constellationLinks.forEach(link => {
            if (!adj[link.s1.id]) adj[link.s1.id] = [];
            if (!adj[link.s2.id]) adj[link.s2.id] = [];
            adj[link.s1.id].push(link.s2);
            adj[link.s2.id].push(link.s1);
        });
        
        const visited = {};
        const path = [];
        let foundCycle = null;
        
        const dfs = (node, parent) => {
            visited[node.id] = true;
            path.push(node);
            
            const neighbors = adj[node.id] || [];
            for (let i = 0; i < neighbors.length; i++) {
                const neighbor = neighbors[i];
                if (!visited[neighbor.id]) {
                    if (dfs(neighbor, node)) return true;
                } else if (parent && neighbor.id !== parent.id) {
                    const idx = path.findIndex(n => n.id === neighbor.id);
                    if (idx !== -1) {
                        foundCycle = path.slice(idx);
                        return true;
                    }
                }
            }
            path.pop();
            return false;
        };
        
        for (const link of this.constellationLinks) {
            if (!visited[link.s1.id]) {
                if (dfs(link.s1, null)) break;
            }
        }
        
        if (foundCycle && foundCycle.length >= 3) {
            if (typeof audioSynth !== 'undefined') {
                const chords = [
                    [220.00, 261.63, 329.63, 392.00], // Am7
                    [261.63, 329.63, 392.00, 493.88], // Cmaj7
                    [293.66, 349.23, 440.00, 523.25]  // Dm7
                ];
                const chordIdx = Math.min(chords.length - 1, foundCycle.length - 3);
                audioSynth.playSynthPadChord(chords[chordIdx]);
            }
            
            this.nebulaLoops.push({
                stars: foundCycle,
                life: 1.0,
                decay: 0.00012, // extremely slow decay (~9 minutes)
                color: `hsla(${Math.random() * 360}, 85%, 65%, 0.12)`
            });

            if (this.nebulaLoops.length > 5) {
                this.nebulaLoops.shift(); // remove oldest to prevent performance lag
            }
            
            // clear links to allow new shapes
            this.constellationLinks = [];
        }
    }

    updateAndDrawConstellations() {
        // 1. Draw proximity faint connections
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(67, 97, 238, 0.04)';
        this.ctx.lineWidth = 0.6;
        for (let i = 0; i < this.particles.length; i++) {
            const p1 = this.particles[i];
            if (p1.type !== 'star') continue;
            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                if (p2.type !== 'star') continue;
                
                const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                if (dist < 100) {
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                }
            }
        }
        this.ctx.stroke();
        
        // 2. Draw user-constructed links
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(0, 245, 212, 0.5)';
        this.ctx.lineWidth = 1.2;
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = '#00f5d4';
        
        this.constellationLinks.forEach(link => {
            this.ctx.moveTo(link.s1.x, link.s1.y);
            this.ctx.lineTo(link.s2.x, link.s2.y);
        });
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        
        // 3. Draw active drawing link to mouse
        if (this.activeDrawingNode && this.mouse.x && this.mouse.y) {
            this.ctx.beginPath();
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            this.ctx.lineWidth = 1.0;
            this.ctx.setLineDash([4, 4]);
            this.ctx.moveTo(this.activeDrawingNode.x, this.activeDrawingNode.y);
            this.ctx.lineTo(this.mouse.x, this.mouse.y);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
        
        // 4. Update and Draw completed nebula loops
        for (let i = this.nebulaLoops.length - 1; i >= 0; i--) {
            const loop = this.nebulaLoops[i];
            loop.life -= loop.decay;
            if (loop.life <= 0) {
                this.nebulaLoops.splice(i, 1);
                continue;
            }
            
            // Calculate loop center centroid and bounding size
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            let sumX = 0, sumY = 0;
            loop.stars.forEach(s => {
                if (s.x < minX) minX = s.x;
                if (s.x > maxX) maxX = s.x;
                if (s.y < minY) minY = s.y;
                if (s.y > maxY) maxY = s.y;
                sumX += s.x;
                sumY += s.y;
            });
            const cx = sumX / loop.stars.length;
            const cy = sumY / loop.stars.length;
            const size = Math.max(maxX - minX, maxY - minY, 30);
            
            // Draw HTML5 Canvas radial gradient inside the path to form a soft nebula cloud
            const grad = this.ctx.createRadialGradient(cx, cy, 4, cx, cy, size * 0.72);
            grad.addColorStop(0, loop.color.replace('0.12', (loop.life * 0.28).toString()));
            grad.addColorStop(0.5, loop.color.replace('0.12', (loop.life * 0.10).toString()));
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            
            this.ctx.beginPath();
            this.ctx.moveTo(loop.stars[0].x, loop.stars[0].y);
            for (let s = 1; s < loop.stars.length; s++) {
                this.ctx.lineTo(loop.stars[s].x, loop.stars[s].y);
            }
            this.ctx.closePath();
            
            this.ctx.fillStyle = grad;
            this.ctx.shadowBlur = loop.life * 32;
            this.ctx.shadowColor = loop.color;
            this.ctx.fill();
            
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${loop.life * 0.68})`;
            this.ctx.lineWidth = 1.6;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        }
    }

    drawTokyoGlitchOverload() {
        if (this.neonOverload <= 0) return;
        
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Draw horizontal glitch bars
        const numGlitches = Math.floor(Math.random() * 3) + 1;
        for (let g = 0; g < numGlitches; g++) {
            if (Math.random() < this.neonOverload) {
                const gy = Math.random() * h;
                const gh = Math.random() * 45 + 10;
                
                // Neon cyan or magenta glitch fill
                this.ctx.fillStyle = Math.random() > 0.5 ? `rgba(0, 245, 212, ${this.neonOverload * 0.16})` : `rgba(255, 0, 128, ${this.neonOverload * 0.16})`;
                this.ctx.fillRect(0, gy, w, gh);
                
                // White scanline highlight
                this.ctx.strokeStyle = `rgba(255, 255, 255, ${this.neonOverload * 0.35})`;
                this.ctx.lineWidth = Math.random() * 2.5 + 0.5;
                this.ctx.beginPath();
                this.ctx.moveTo(0, gy + gh/2);
                this.ctx.lineTo(w, gy + gh/2);
                this.ctx.stroke();
            }
        }
        
        // Screen color tint flash
        if (Math.random() < 0.22) {
            this.ctx.fillStyle = `rgba(157, 78, 221, ${this.neonOverload * 0.08})`;
            this.ctx.fillRect(0, 0, w, h);
        }
    }

    drawSpaceEventHorizon() {
        if (this.gravityCollapse <= 0) return;
        
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const radius = 70 * this.gravityCollapse;
        
        // Outer glowing indigo gravity field
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius + 30, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(67, 97, 238, ${this.gravityCollapse * 0.25})`;
        this.ctx.shadowBlur = 45;
        this.ctx.shadowColor = '#4361ee';
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
        
        // Inner black event horizon core
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = '#02020a';
        this.ctx.strokeStyle = `rgba(0, 245, 212, ${this.gravityCollapse * 0.8})`;
        this.ctx.lineWidth = 2.2;
        this.ctx.fill();
        this.ctx.stroke();
    }

    triggerNeonOverload() {
        if (this.currentScene !== 'tokyo') return;
        this.neonOverload = 1.0;
    }

    triggerGravityCollapse() {
        if (this.currentScene !== 'space') return;
        this.gravityCollapse = 1.0;
        
        // Schedule supernova center blast after 850ms
        setTimeout(() => {
            if (this.currentScene === 'space') {
                this.triggerSupernova(this.canvas.width / 2, this.canvas.height / 2);
            }
        }, 850);
    }

    updateSnow(p, speedMult) {
        const weatherSpeed = 1.0 + this.weatherLevel * 1.5;
        p.y += p.speedY * speedMult * weatherSpeed;
        p.wobbleAge += p.wobbleSpeed;
        p.x += (p.speedX + Math.sin(p.wobbleAge) * 0.25) * speedMult * weatherSpeed;
    }

    drawSnow(p, speedMult) {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        const activeOpacity = p.size > 2.0 ? p.opacity * 0.5 : p.opacity;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${activeOpacity})`;
        this.ctx.shadowBlur = p.size * 2.2;
        this.ctx.shadowColor = '#ffffff';
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
    }

    setSkyTime(mins) {
        this.skyTime = mins;
    }

    lerpColor(c1, c2, p) {
        return [
            Math.round(c1[0] + (c2[0] - c1[0]) * p),
            Math.round(c1[1] + (c2[1] - c1[1]) * p),
            Math.round(c1[2] + (c2[2] - c1[2]) * p)
        ];
    }

    getSkyGradient() {
        const h = this.canvas.height;
        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        
        const time = this.skyTime;
        
        // Define keyframe colors [R, G, B]
        const keyframes = [
            { mins: 360, top: [12, 24, 48], bottom: [243, 143, 104] },   // 6:00 AM (Sunrise peach/navy)
            { mins: 720, top: [20, 90, 160], bottom: [110, 190, 220] },  // 12:00 PM (Noon bright cyan/blue)
            { mins: 1110, top: [55, 20, 85], bottom: [235, 95, 30] },    // 6:30 PM (Golden-hour sunset orange/purple)
            { mins: 1440, top: [5, 4, 18], bottom: [50, 12, 90] }         // 12:00 AM (Deep midnight neon purple/black)
        ];
        
        // Find adjacent keyframes
        let k1 = keyframes[0];
        let k2 = keyframes[keyframes.length - 1];
        
        for (let i = 0; i < keyframes.length - 1; i++) {
            if (time >= keyframes[i].mins && time <= keyframes[i+1].mins) {
                k1 = keyframes[i];
                k2 = keyframes[i+1];
                break;
            }
        }
        
        const range = k2.mins - k1.mins;
        const pct = range === 0 ? 0 : (time - k1.mins) / range;
        
        // Lerp top and bottom arrays
        const topRGB = this.lerpColor(k1.top, k2.top, pct);
        const bottomRGB = this.lerpColor(k1.bottom, k2.bottom, pct);
        
        // Apply subtle scene-specific coloring overlay
        if (this.currentScene === 'fireplace') {
            // Warm up: shift red up, blue down
            topRGB[0] = Math.min(255, topRGB[0] + 35);
            topRGB[2] = Math.max(0, topRGB[2] - 15);
            bottomRGB[0] = Math.min(255, bottomRGB[0] + 45);
            bottomRGB[2] = Math.max(0, bottomRGB[2] - 25);
        } else if (this.currentScene === 'zengarden') {
            // Organic earthy green shift
            topRGB[1] = Math.min(255, topRGB[1] + 25);
            topRGB[0] = Math.max(0, topRGB[0] - 15);
            bottomRGB[1] = Math.min(255, bottomRGB[1] + 30);
            bottomRGB[0] = Math.max(0, bottomRGB[0] - 15);
        } else if (this.currentScene === 'space') {
            // Deeper dark space styling
            topRGB[0] = Math.max(0, topRGB[0] - 20);
            topRGB[1] = Math.max(0, topRGB[1] - 20);
            topRGB[2] = Math.min(255, topRGB[2] + 10);
            bottomRGB[0] = Math.max(0, bottomRGB[0] - 15);
            bottomRGB[1] = Math.max(0, bottomRGB[1] - 15);
        }
        
        const alpha = this.isWarping ? 0.5 : 0.35;


        
        grad.addColorStop(0, `rgba(${topRGB[0]}, ${topRGB[1]}, ${topRGB[2]}, ${alpha})`);
        grad.addColorStop(1, `rgba(${bottomRGB[0]}, ${bottomRGB[1]}, ${bottomRGB[2]}, ${alpha})`);
        
        return grad;
    }

    addWipePoint(x, y) {
        this.lastWipeTime = Date.now();
        
        if (this.wipedTrails.length > 0) {
            const last = this.wipedTrails[this.wipedTrails.length - 1];
            const dist = Math.hypot(last.x - x, last.y - y);
            if (dist < 4) return;
        }
        
        this.wipedTrails.push({
            x: x,
            y: y,
            radius: 52,
            opacity: 1.0
        });
        
        if (this.wipedTrails.length > 300) {
            this.wipedTrails.shift();
        }
    }

    drawFrostedGlassOverlay() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Clear fog canvas
        this.fogCtx.clearRect(0, 0, w, h);
        
        // 1. Draw the blurred background and particles onto the fog canvas
        this.fogCtx.filter = 'blur(2.8px) saturate(108%)';
        this.fogCtx.drawImage(this.trailCanvas, 0, 0);
        this.fogCtx.filter = 'none'; // reset filter
        
        // 2. Draw the frosted glass color overlay on top of the blurred layer (semi-transparent cool white fog)
        this.fogCtx.fillStyle = 'rgba(230, 235, 245, 0.16)';
        this.fogCtx.fillRect(0, 0, w, h);
        
        // 3. Draw condensation droplets directly onto the fog canvas
        this.drawWindowDrops(this.fogCtx);
        
        // 4. Clear/Wipe the fog canvas where active wiped trails exist
        if (this.wipedTrails.length > 0) {
            this.fogCtx.save();
            this.fogCtx.globalCompositeOperation = 'destination-out';
            
            this.wipedTrails.forEach(trail => {
                const grad = this.fogCtx.createRadialGradient(
                    trail.x, trail.y, trail.radius * 0.15,
                    trail.x, trail.y, trail.radius
                );
                grad.addColorStop(0, `rgba(0, 0, 0, ${trail.opacity})`);
                grad.addColorStop(0.5, `rgba(0, 0, 0, ${trail.opacity * 0.5})`);
                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                
                this.fogCtx.fillStyle = grad;
                this.fogCtx.beginPath();
                this.fogCtx.arc(trail.x, trail.y, trail.radius, 0, Math.PI * 2);
                this.fogCtx.fill();
            });
            
            this.fogCtx.restore();
        }
        
        // 5. Draw the fog canvas onto the main canvas (dimming everything behind it except inside the wiped trails)
        this.ctx.drawImage(this.fogCanvas, 0, 0);
        
        // 6. Decay wiped trails over time (mist mists back up slowly)
        for (let i = this.wipedTrails.length - 1; i >= 0; i--) {
            const trail = this.wipedTrails[i];
            trail.opacity -= 0.0016; // mist back up over 10–12 seconds
            if (trail.opacity <= 0) {
                this.wipedTrails.splice(i, 1);
            }
        }
    }

    setWeatherLevel(percent) {
        this.weatherLevel = percent / 100;
    }
}

// Global initialization hook
let canvasApp;
window.addEventListener('DOMContentLoaded', () => {
    canvasApp = new AmbientCanvas();
});
