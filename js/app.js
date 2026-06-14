/* ==========================================================================
   CHRONOSCAPES MAIN APP COORDINATOR (V1.3 MULTI-THEME VISUALIZERS)
   ========================================================================== */

class ChronoscapesApp {
    constructor() {
        this.currentScene = 'tokyo';
        
        // DOM bindings
        this.entranceScreen = document.getElementById('entrance-screen');
        this.enterBtn = document.getElementById('enter-btn');
        this.workspaceContainer = document.getElementById('workspace');
        
        this.clockDisplay = document.getElementById('digital-clock');
        this.activeSceneBadge = document.getElementById('active-scene-badge');
        
        this.sceneCards = document.querySelectorAll('.scene-card');
        this.sceneActionBtn = document.getElementById('scene-action-btn');
        
        // CRT Retro Filter
        this.crtOverlay = document.getElementById('crt-overlay');
        this.crtToggleBtn = document.getElementById('crt-toggle-btn');
        this.isCrtActive = false;
        
        // Visualizer Theme state and Canvas
        this.visCanvas = document.getElementById('visualizer-canvas');
        this.visCtx = this.visCanvas.getContext('2d');
        this.visMode = 'wave'; // default mode
        
        // Visualizer peak trackers (for Equalizer Bars)
        this.peaks = [];
        this.ringRotation = 0.0; // rotation accumulator for Ring mode
        
        // Mixer bindings
        this.droneSlider = document.getElementById('slider-drone');
        this.envSlider = document.getElementById('slider-env');
        this.pulseSlider = document.getElementById('slider-pulse');
        this.chimesSlider = document.getElementById('slider-chimes');
        
        this.droneVal = document.getElementById('vol-drone-val');
        this.envVal = document.getElementById('vol-env-val');
        this.pulseVal = document.getElementById('vol-pulse-val');
        this.chimesVal = document.getElementById('vol-chimes-val');
        this.envLabel = document.getElementById('vol-env-label');
        
        // Master Controls
        this.playBtn = document.getElementById('master-play-btn');
        this.playIcon = document.getElementById('play-svg');
        
        this.muteBtn = document.getElementById('master-mute-btn');
        this.muteIcon = document.getElementById('mute-svg');
        
        // Ambient Keyboard
        this.keyboardToggle = document.getElementById('keyboard-toggle');
        
        this.init();
    }
    
    init() {
        this.startClock();
        
        // Entrance triggers
        this.enterBtn.addEventListener('click', () => this.enterWorkspace());
        
        // Setup slider listeners
        this.setupMixerSliders();
        
        // Setup scene selectors
        this.setupSceneSelectors();
        
        // Setup scene action button
        this.setupSceneActionBtn();
        
        // CRT filter
        this.setupCrtToggle();
        
        // Play/Pause toggler
        this.setupPlayPauseToggle();
        
        // Ambient Keyboard trigger listener
        this.setupKeyboardInstrument();

        // Setup Visualizer Mode Switchers
        this.setupVisualizerModes();
        
        // Resize events
        this.resizeVisualizer();
        window.addEventListener('resize', () => this.resizeVisualizer());
        
        // Initial theme style overrides
        document.body.className = 'theme-tokyo';
    }
    
    /* ==========================================
       Entrance Screen Handlers
       ========================================== */
    enterWorkspace() {
        if (typeof audioSynth !== 'undefined') {
            audioSynth.init();
        }
        
        this.entranceScreen.classList.add('hidden');
        this.workspaceContainer.classList.remove('hidden');
        
        // Launch Visualizer loop
        this.animateVisualizer();
        
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
    
    /* ==========================================
       Digital Clock ticking loop
       ========================================== */
    startClock() {
        const tick = () => {
            const now = new Date();
            const hrs = now.getHours().toString().padStart(2, '0');
            const mins = now.getMinutes().toString().padStart(2, '0');
            const secs = now.getSeconds().toString().padStart(2, '0');
            this.clockDisplay.textContent = `${hrs}:${mins}:${secs}`;
        };
        
        tick();
        setInterval(tick, 1000);
    }

    /* ==========================================
       CRT Screen retro toggle filter
       ========================================== */
    setupCrtToggle() {
        this.crtToggleBtn.addEventListener('click', () => {
            this.isCrtActive = !this.isCrtActive;
            if (this.isCrtActive) {
                this.crtOverlay.classList.remove('hidden');
                this.crtToggleBtn.querySelector('span').textContent = 'CRT ON';
                this.crtToggleBtn.style.color = 'var(--accent-secondary)';
                this.crtToggleBtn.style.borderColor = 'var(--accent-secondary)';
            } else {
                this.crtOverlay.classList.add('hidden');
                this.crtToggleBtn.querySelector('span').textContent = 'CRT OFF';
                this.crtToggleBtn.style.color = 'var(--text-secondary)';
                this.crtToggleBtn.style.borderColor = 'rgba(255, 255, 255, 0.05)';
            }
        });
    }

    /* ==========================================
       Master Play/Pause Controls
       ========================================== */
    setupPlayPauseToggle() {
        this.playBtn.addEventListener('click', () => {
            if (typeof audioSynth !== 'undefined') {
                const isPlaying = audioSynth.togglePlay();
                this.updatePlayUI(isPlaying);
            }
        });
    }

    updatePlayUI(isPlaying) {
        if (isPlaying) {
            this.playBtn.classList.add('playing');
            this.playIcon.innerHTML = `
                <rect x="6" y="4" width="4" height="16" fill="currentColor"></rect>
                <rect x="14" y="4" width="4" height="16" fill="currentColor"></rect>
            `;
        } else {
            this.playBtn.classList.remove('playing');
            this.playIcon.innerHTML = `
                <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"></polygon>
            `;
        }
    }
    
    /* ==========================================
       Sliders / Volume controls
       ========================================== */
    setupMixerSliders() {
        this.droneSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            this.droneVal.textContent = `${val}%`;
            if (typeof audioSynth !== 'undefined') {
                audioSynth.setVolume('drone', val);
            }
        });
        
        this.envSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            this.envVal.textContent = `${val}%`;
            if (typeof audioSynth !== 'undefined') {
                audioSynth.setVolume('env', val);
            }
        });
        
        this.pulseSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            this.pulseVal.textContent = `${val}%`;
            if (typeof audioSynth !== 'undefined') {
                audioSynth.setVolume('pulse', val);
            }
        });

        this.chimesSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            this.chimesVal.textContent = `${val}%`;
            if (typeof audioSynth !== 'undefined') {
                audioSynth.setVolume('chimes', val);
            }
        });
        
        this.muteBtn.addEventListener('click', () => {
            if (typeof audioSynth !== 'undefined') {
                const muted = audioSynth.toggleMute();
                this.updateMuteUI(muted);
            }
        });
    }
    
    updateMuteUI(isMuted) {
        const waves = document.getElementById('mute-waves');
        const cross = document.getElementById('mute-cross');
        if (isMuted) {
            this.muteBtn.classList.add('muted');
            this.muteBtn.style.color = '#ff5400';
            if (waves) waves.classList.add('hidden');
            if (cross) cross.classList.remove('hidden');
        } else {
            this.muteBtn.classList.remove('muted');
            this.muteBtn.style.color = 'var(--text-secondary)';
            if (waves) waves.classList.remove('hidden');
            if (cross) cross.classList.add('hidden');
        }
    }
    
    /* ==========================================
       Timeline Theme Card Selectors
       ========================================== */
    setupSceneSelectors() {
        this.sceneCards.forEach(card => {
            card.addEventListener('click', () => {
                const scene = card.getAttribute('data-scene');
                if (scene === this.currentScene) return;
                
                this.sceneCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                
                this.currentScene = scene;
                this.applyScene(scene);
            });
        });
    }

    setupSceneActionBtn() {
        this.sceneActionBtn.addEventListener('click', () => {
            if (this.currentScene === 'fireplace') {
                if (typeof canvasApp !== 'undefined') {
                    canvasApp.fireFlare = 1.0;
                }
                if (typeof audioSynth !== 'undefined') {
                    audioSynth.triggerFirewoodCrackle();
                }
            }
        });
    }
    
    applyScene(scene) {
        document.body.className = `theme-${scene}`;
        
        let displayTitle = '';
        let envSoundLabel = '';
        
        if (scene === 'tokyo') {
            displayTitle = 'NEO-TOKYO 2099';
            envSoundLabel = 'Tokyo Rain';
        } else if (scene === 'fireplace') {
            displayTitle = 'COZY HEARTH 1994';
            envSoundLabel = 'Wood Crackle';
        } else if (scene === 'space') {
            displayTitle = 'DEEP SPACE 3050';
            envSoundLabel = 'Solar Storm';
        }
        
        this.activeSceneBadge.textContent = displayTitle;
        this.envLabel.textContent = envSoundLabel;
        
        // Show/hide action button depending on scene
        if (scene === 'fireplace') {
            this.sceneActionBtn.classList.remove('hidden');
            this.sceneActionBtn.textContent = '🪵 FEED FIREWOOD';
        } else {
            this.sceneActionBtn.classList.add('hidden');
            this.sceneActionBtn.textContent = '';
        }
        
        if (typeof canvasApp !== 'undefined') {
            canvasApp.setScene(scene);
        }
        
        if (typeof audioSynth !== 'undefined') {
            audioSynth.setScene(scene);
        }
    }

    /* ==========================================
       KEYBOARD & MOBILE TAP TYPING SYNTH INSTRUMENT
       ========================================== */
    setupKeyboardInstrument() {
        window.addEventListener('keydown', (e) => {
            if (!this.keyboardToggle.checked) return;
            if (e.key.length > 1) return;
            
            this.triggerAmbientTone(e.keyCode);
        });

        const handleTap = (clientX, clientY, target) => {
            if (!this.keyboardToggle.checked) return;
            
            const isBackdrop = target.id === 'workspace' || target.id === 'ambient-canvas' || target.tagName === 'MAIN';
            if (!isBackdrop) return;
            
            const pseudoKeyCode = Math.floor(Math.random() * 26) + 65;
            this.triggerAmbientTone(pseudoKeyCode, clientX, clientY);
        };

        window.addEventListener('click', (e) => {
            handleTap(e.clientX, e.clientY, e.target);
        });

        window.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                handleTap(e.touches[0].clientX, e.touches[0].clientY, e.target);
            }
        });
    }

    triggerAmbientTone(keyCode, customX, customY) {
        if (typeof audioSynth !== 'undefined') {
            audioSynth.playKeyboardTone(keyCode);
        }
        
        if (typeof canvasApp !== 'undefined') {
            canvasApp.triggerKeypressRipple(customX, customY);
        }
    }

    /* ==========================================
       VISUALIZER THEMES SWITCHER INTERFACE
       ========================================== */
    setupVisualizerModes() {
        const modes = ['wave', 'bars', 'ring'];
        modes.forEach(mode => {
            const btn = document.getElementById(`vis-mode-${mode}`);
            btn.addEventListener('click', () => {
                // Clear active classes
                modes.forEach(m => document.getElementById(`vis-mode-${m}`).classList.remove('active'));
                btn.classList.add('active');
                
                this.visMode = mode;
            });
        });
    }

    resizeVisualizer() {
        this.visCanvas.width = this.visCanvas.parentElement.clientWidth;
        this.visCanvas.height = this.visCanvas.parentElement.clientHeight;
    }

    animateVisualizer() {
        const draw = () => {
            requestAnimationFrame(draw);
            
            // Clear visualization frame
            this.visCtx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            this.visCtx.fillRect(0, 0, this.visCanvas.width, this.visCanvas.height);
            
            if (typeof audioSynth === 'undefined') return;
            
            // Fetch smoothed frequency data
            const dataArray = audioSynth.getByteFrequencyData();
            if (!dataArray) return;
            
            const w = this.visCanvas.width;
            const h = this.visCanvas.height;
            const bufferLength = dataArray.length;
            
            // Core scene color codes
            let accentColor = '';
            let secondColor = '';
            
            if (this.currentScene === 'tokyo') {
                accentColor = '#9d4edd';
                secondColor = '#00f5d4';
            } else if (this.currentScene === 'fireplace') {
                accentColor = '#ff5400';
                secondColor = '#ffbe0b';
            } else {
                accentColor = '#3a0ca3';
                secondColor = '#4361ee';
            }
            
            this.visCtx.shadowBlur = 8;
            this.visCtx.shadowColor = secondColor;
            
            const grad = this.visCtx.createLinearGradient(0, 0, w, 0);
            grad.addColorStop(0, accentColor);
            grad.addColorStop(0.5, secondColor);
            grad.addColorStop(1, accentColor);
            this.visCtx.strokeStyle = grad;
            this.visCtx.fillStyle = grad;
            
            // Route drawing based on visualizer settings
            if (this.visMode === 'wave') {
                this.drawWaveVisualizer(dataArray, w, h, bufferLength);
            } else if (this.visMode === 'bars') {
                this.drawBarsVisualizer(dataArray, w, h, bufferLength, secondColor);
            } else if (this.visMode === 'ring') {
                this.drawRingVisualizer(dataArray, w, h, bufferLength, secondColor);
            }
            
            this.visCtx.shadowBlur = 0; // reset
        };
        
        draw();
    }

    /* ==========================================
       Visualizer Mode 1: Smooth Symmetrical Layered Frequency Wave (Siri Vibe)
       ========================================== */
    drawWaveVisualizer(dataArray, w, h, bufferLength) {
        // Calculate average energy in Bass, Mid, and Treble ranges
        let bassSum = 0;
        let midSum = 0;
        let trebleSum = 0;
        
        // Sum low frequencies (bass: bins 0 to 5)
        for (let i = 0; i < 6; i++) bassSum += dataArray[i] || 0;
        const bass = bassSum / 6 / 255.0;
        
        // Sum mid frequencies (mids: bins 6 to 18)
        for (let i = 6; i < 19; i++) midSum += dataArray[i] || 0;
        const mid = midSum / 13 / 255.0;
        
        // Sum high frequencies (treble: bins 19 to 40)
        for (let i = 19; i < 41; i++) trebleSum += dataArray[i] || 0;
        const treble = trebleSum / 22 / 255.0;
        
        // Accumulate phase to make waves flow horizontally over time
        this.wavePhase = (this.wavePhase || 0) + 0.035;
        
        // Temporarily clear general glow for overlapping wave color fidelity
        this.visCtx.shadowBlur = 0;
        
        // Core colors
        let accentColor = '';
        let secondColor = '';
        
        if (this.currentScene === 'tokyo') {
            accentColor = 'rgba(157, 78, 221, 0.7)';
            secondColor = 'rgba(0, 245, 212, 0.75)';
        } else if (this.currentScene === 'fireplace') {
            accentColor = 'rgba(255, 84, 0, 0.75)';
            secondColor = 'rgba(255, 190, 11, 0.7)';
        } else {
            accentColor = 'rgba(58, 12, 163, 0.7)';
            secondColor = 'rgba(67, 97, 238, 0.75)';
        }
        
        // Wave definitions: [frequency, amplitudeMultiplier, phaseShift, color, lineWidth]
        const waves = [
            [0.010, h * 0.40 * (bass + 0.05), this.wavePhase, secondColor, 2.5],
            [0.018, h * 0.28 * (mid + 0.05), -this.wavePhase * 1.4, accentColor, 1.8],
            [0.026, h * 0.18 * (treble + 0.05), this.wavePhase * 0.8, 'rgba(255, 255, 255, 0.9)', 1.0]
        ];
        
        waves.forEach(([freq, amp, phase, color, lineWidth]) => {
            this.visCtx.beginPath();
            this.visCtx.strokeStyle = color;
            this.visCtx.lineWidth = lineWidth;
            
            for (let x = 0; x < w; x += 3) {
                // Pinch envelope so the wave ends meet at the baseline (0 amplitude at edges)
                const pinch = Math.sin((x / w) * Math.PI);
                const y = h / 2 + Math.sin(x * freq + phase) * amp * pinch;
                
                if (x === 0) {
                    this.visCtx.moveTo(x, y);
                } else {
                    this.visCtx.lineTo(x, y);
                }
            }
            this.visCtx.stroke();
        });
        
        // Draw soft glowing baseline in background
        this.visCtx.beginPath();
        this.visCtx.moveTo(0, h / 2);
        this.visCtx.lineTo(w, h / 2);
        this.visCtx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        this.visCtx.lineWidth = 0.8;
        this.visCtx.stroke();
    }

    /* ==========================================
       Visualizer Mode 2: Symmetrical Equalizer Columns with Peaks & Lerp
       ========================================== */
    drawBarsVisualizer(dataArray, w, h, bufferLength, secondColor) {
        // Limit rendering bins to 32 for cleaner block spacing
        const numBars = 32;
        const barWidth = (w / numBars) * 0.72;
        const gap = (w / numBars) * 0.28;
        
        // Initialize peak and smoothed height trackers if uninitialized
        if (this.peaks.length < numBars) {
            this.peaks = new Array(numBars).fill(0);
        }
        if (!this.smoothedHeights || this.smoothedHeights.length !== numBars) {
            this.smoothedHeights = new Array(numBars).fill(0);
        }
        
        for (let i = 0; i < numBars; i++) {
            // Compress values (average two bins)
            const rawVal = (dataArray[i * 2] + dataArray[i * 2 + 1]) / 2;
            
            // Boost high frequencies dynamically since high bins are naturally quiet
            const boost = 1.0 + (i / numBars) * 2.5;
            const targetHeight = Math.max(2, (rawVal / 255.0) * (h * 0.85) * boost);
            
            // Lerp smoothing to make columns move organically
            this.smoothedHeights[i] += (targetHeight - this.smoothedHeights[i]) * 0.28;
            const barHeight = this.smoothedHeights[i];
            
            const x = i * (barWidth + gap) + gap / 2;
            
            // Draw standard equalizer bar with rounded top corners
            this.visCtx.beginPath();
            if (this.visCtx.roundRect) {
                this.visCtx.roundRect(x, h - barHeight, barWidth, barHeight, [4, 4, 0, 0]);
            } else {
                this.visCtx.rect(x, h - barHeight, barWidth, barHeight);
            }
            this.visCtx.fill();
            
            // Gravity physics update on peaks
            if (barHeight > this.peaks[i]) {
                this.peaks[i] = barHeight;
            } else {
                this.peaks[i] = Math.max(0, this.peaks[i] - 0.7); // slowly fall due to gravity
            }
            
            // Draw glowing peak indicator dot
            this.visCtx.fillStyle = '#ffffff';
            this.visCtx.fillRect(x, h - this.peaks[i] - 3, barWidth, 2.2);
            
            // Restore gradient fill for next columns
            this.visCtx.fillStyle = this.visCtx.strokeStyle;
        }
    }

    /* ==========================================
       Visualizer Mode 3: Symmetrical Double Concentric Halo Ring
       ========================================== */
    drawRingVisualizer(dataArray, w, h, bufferLength, secondColor) {
        const centerX = w / 2;
        const centerY = h / 2;
        
        // Auto-rotate the rings
        this.ringRotation += 0.005;
        
        const baseRadius = Math.min(w, h) * 0.22;
        const segments = 48;
        
        if (!this.smoothedRing || this.smoothedRing.length !== segments) {
            this.smoothedRing = new Array(segments).fill(0);
        }
        
        // 1. Calculate smoothed amplitudes symmetrically
        for (let i = 0; i < segments; i++) {
            let mapIndex = i;
            if (i > segments / 2) {
                mapIndex = segments - i;
            }
            
            // Map index to first 65% of frequencies (active bass/mids)
            const bin = Math.floor((mapIndex / (segments / 2)) * (bufferLength * 0.65));
            const dataVal = dataArray[bin] || 0;
            
            // High frequency boost
            const boost = 1.0 + (mapIndex / (segments / 2)) * 1.8;
            const targetAmp = (dataVal / 255.0) * (h * 0.22) * boost;
            
            // Lerp radius amplitude
            this.smoothedRing[i] += (targetAmp - this.smoothedRing[i]) * 0.22;
        }
        
        // 2. Draw Outer Ring (Clockwise, Thicker)
        this.visCtx.lineWidth = 2.5;
        this.visCtx.beginPath();
        for (let i = 0; i <= segments; i++) {
            const index = i % segments;
            const angle = (index / segments) * Math.PI * 2 + this.ringRotation;
            const r = baseRadius + this.smoothedRing[index];
            
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            
            if (i === 0) {
                this.visCtx.moveTo(x, y);
            } else {
                this.visCtx.lineTo(x, y);
            }
        }
        this.visCtx.closePath();
        this.visCtx.stroke();
        
        // 3. Draw Inner Ring (Counter-Clockwise, Detuned, Semi-Transparent)
        this.visCtx.lineWidth = 1.5;
        this.visCtx.beginPath();
        this.visCtx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        for (let i = 0; i <= segments; i++) {
            const index = i % segments;
            const angle = (index / segments) * Math.PI * 2 - this.ringRotation * 1.5;
            const r = baseRadius * 0.82 + this.smoothedRing[index] * 0.7;
            
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            
            if (i === 0) {
                this.visCtx.moveTo(x, y);
            } else {
                this.visCtx.lineTo(x, y);
            }
        }
        this.visCtx.closePath();
        this.visCtx.stroke();
        
        // Add soft inner glow fill
        this.visCtx.fillStyle = `rgba(255, 255, 255, 0.012)`;
        this.visCtx.fill();
    }
}

// Global initialization hook
let chronoscapesApp;
window.addEventListener('DOMContentLoaded', () => {
    chronoscapesApp = new ChronoscapesApp();
});
