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
            
            if (Math.random() < 0.45 && !this.isWarping) {
                this.addTrailSpark(e.clientX, e.clientY);
            }
        });
        
        window.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
            this.isMouseDown = false;
        });

        window.addEventListener('mousedown', (e) => {
            this.isMouseDown = true;
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mouseup', () => {
            this.isMouseDown = false;
        });

        window.addEventListener('touchstart', (e) => {
            this.isMouseDown = true;
            if (e.touches.length > 0) {
                this.mouse.x = e.touches[0].clientX;
                this.mouse.y = e.touches[0].clientY;
                
                if (this.currentScene === 'space' && e.target === this.canvas) {
                    if (e.cancelable) e.preventDefault();
                } else if (Math.random() < 0.6 && !this.isWarping) {
                    this.addTrailSpark(e.touches[0].clientX, e.touches[0].clientY);
                }
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (this.currentScene === 'space' && e.target === this.canvas) {
                if (e.cancelable) e.preventDefault();
            }
            if (e.touches.length > 0) {
                this.mouse.x = e.touches[0].clientX;
                this.mouse.y = e.touches[0].clientY;
                
                if (Math.random() < 0.35 && !this.isWarping) {
                    this.addTrailSpark(e.touches[0].clientX, e.touches[0].clientY);
                }
            }
        }, { passive: false });

        window.addEventListener('touchend', () => {
            this.isMouseDown = false;
            this.mouse.x = null;
            this.mouse.y = null;
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
        
        const isMobile = window.innerWidth < 768;
        
        if (sceneName === 'tokyo') {
            this.maxParticles = isMobile ? 75 : 180;
            this.maxWindowDrops = isMobile ? 20 : 45;
            
            // mist in some initial static window droplets on scene load
            const initialCount = Math.floor(this.maxWindowDrops * 0.6);
            for (let i = 0; i < initialCount; i++) {
                this.windowDrops.push(this.generateWindowDrop(true));
            }
        } else if (sceneName === 'fireplace') {
            this.maxParticles = isMobile ? 35 : 80;
        } else {
            this.maxParticles = isMobile ? 45 : 100;
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
        } else {
            return {
                type: 'star',
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
        if (this.currentScene === 'tokyo') {
            this.ctx.fillStyle = this.isWarping ? 'rgba(6, 5, 11, 0.5)' : 'rgba(6, 5, 11, 0.35)';
        } else if (this.currentScene === 'fireplace') {
            this.ctx.fillStyle = this.isWarping ? 'rgba(15, 7, 4, 0.5)' : 'rgba(15, 7, 4, 0.4)';
        } else {
            this.ctx.fillStyle = this.isWarping ? 'rgba(2, 2, 10, 0.5)' : 'rgba(2, 2, 10, 0.3)';
        }
        
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
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
        
        const speedMult = 1.0 + (this.warpProgress * 7.0);
        
        // Dynamic max particles for fireplace flare
        let activeMaxParticles = this.maxParticles;
        if (this.currentScene === 'fireplace' && this.fireFlare > 0) {
            activeMaxParticles = Math.floor(this.maxParticles * (1.0 + this.fireFlare));
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

        // 2. NEW: Update, Check Collisions, and Render Window Raindrops (Only in Tokyo rain scene)
        if (this.currentScene === 'tokyo') {
            // Spawn new droplets slowly if limit isn't reached
            if (this.windowDrops.length < this.maxWindowDrops && Math.random() < 0.025) {
                this.windowDrops.push(this.generateWindowDrop(false));
            }
            
            this.updateWindowDrops(speedMult);
            this.checkDropletCollisions();
            this.drawWindowDrops();
        }
        
        // 3. Update & Render mouse/touch particle trail
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
    drawWindowDrops() {
        for (let i = 0; i < this.windowDrops.length; i++) {
            const p = this.windowDrops[i];
            
            // Create a radial gradient offset to top-left to simulate light highlights
            const grad = this.ctx.createRadialGradient(
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
            
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = grad;
            this.ctx.fill();
            
            // Add a thin, sharp outline to give the lens structure definition
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            this.ctx.lineWidth = 0.65;
            this.ctx.stroke();
        }
    }
    
    isDead(p) {
        if (p.type === 'rain') {
            return p.y > this.canvas.height + 20 || p.x < -20 || p.x > this.canvas.width + 20;
        } else if (p.type === 'ember') {
            return p.life <= 0 || p.y < -20 || p.x < -20 || p.x > this.canvas.width + 20;
        } else if (p.type === 'star') {
            return p.x < 0 || p.x > this.canvas.width || p.y < 0 || p.y > this.canvas.height;
        }
        return false;
    }
    
    /* ==========================================
       Tokyo Rain Particle Logic
       ========================================== */
    updateRain(p, speedMult) {
        p.y += p.speed * speedMult;
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
        
        // Increase opacity and glow in vortex mode
        if (this.isMouseDown && this.currentScene === 'space' && !this.isWarping) {
            currentOpacity = Math.min(1.0, currentOpacity * 1.5);
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
            if (this.isMouseDown && this.currentScene === 'space') {
                blurSize = p.size * 10;
            }
            this.ctx.shadowBlur = blurSize;
            this.ctx.shadowColor = `rgba(67, 97, 238, ${currentOpacity})`;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        }
    }
}

// Global initialization hook
let canvasApp;
window.addEventListener('DOMContentLoaded', () => {
    canvasApp = new AmbientCanvas();
});
