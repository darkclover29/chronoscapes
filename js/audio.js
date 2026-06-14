/* ==========================================================================
   CHRONOSCAPES AUDIO SYNTHESIZER ENGINE (V1.2 UPDATED PLAY/PAUSE & SYNTH)
   ========================================================================== */

class AmbientSynthesizer {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.isPlaying = false; // Default: Paused (user request)
        
        // Master Audio Node and Analyser
        this.masterGain = null;
        this.analyser = null;
        
        // Mixer Gains (Volume ranges 0.0 to 1.0)
        this.channels = {
            drone: { node: null, vol: 0.4 },
            env: { node: null, vol: 0.5 },
            pulse: { node: null, vol: 0.2 },
            chimes: { node: null, vol: 0.0 }
        };
        
        // Active sound nodes tracking
        this.activeNodes = [];
        
        // Current scene state
        this.currentScene = 'tokyo';
        this.weatherLevel = 0.3; // Default 30%
        
        // Wind chimes loop tracker
        this.chimesTimeout = null;
        this.isChimesRunning = false;
        
        // Zen Garden stream loop tracker
        this.streamTimeout = null;
        
        // Pentatonic scale notes for chimes and keyboard synth
        this.chimeNotes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66];
        this.keyboardNotes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];
    }
    
    // Initialize Web Audio Context (resumed after user click)
    init() {
        if (this.ctx) return;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        
        // Create audio node pipeline: Channels -> Master Gain -> Analyser -> Output
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1.0, this.ctx.currentTime);
        
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 128;
        
        // Routing
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
        
        // Initialize channel gain nodes
        Object.keys(this.channels).forEach(key => {
            const gainNode = this.ctx.createGain();
            // Start at 0 volume if isPlaying is false (paused by default)
            const initialVolume = this.isPlaying ? this.channels[key].vol : 0.0;
            gainNode.gain.setValueAtTime(initialVolume, this.ctx.currentTime);
            gainNode.connect(this.masterGain);
            this.channels[key].node = gainNode;
        });
        
        this.startSceneSounds();
        this.startWindChimesScheduler();
    }
    
    // Fetch live frequency bytes for the FFT visualizer
    getByteFrequencyData() {
        if (!this.analyser) return null;
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);
        return dataArray;
    }
    
    // Fetch live time-domain samples for the oscilloscope visualizer
    getByteTimeDomainData() {
        if (!this.analyser) return null;
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteTimeDomainData(dataArray);
        return dataArray;
    }
    
    // Master Play/Pause control
    togglePlay(playState) {
        if (playState !== undefined) {
            this.isPlaying = playState;
        } else {
            this.isPlaying = !this.isPlaying;
        }
        
        if (!this.ctx) return this.isPlaying;
        
        // Smoothly ramp up or down all audio channels based on state
        const time = this.ctx.currentTime;
        Object.keys(this.channels).forEach(key => {
            const gainNode = this.channels[key].node;
            if (gainNode) {
                const targetVolume = this.isPlaying ? this.channels[key].vol : 0.0;
                gainNode.gain.setValueAtTime(gainNode.gain.value, time);
                gainNode.gain.linearRampToValueAtTime(targetVolume, time + 0.25);
            }
        });
        
        if (this.isPlaying && this.currentScene === 'zengarden') {
            if (this.streamTimeout) clearTimeout(this.streamTimeout);
            this.startZenStreamLoop();
        }
        
        return this.isPlaying;
    }
    
    // Set mixer volumes smoothly using linearRampToValueAtTime
    setVolume(channel, percent) {
        const val = percent / 100;
        this.channels[channel].vol = val;
        
        if (this.channels[channel].node && this.ctx) {
            const targetGain = this.channels[channel].node.gain;
            // Only update active gain node if we are currently playing
            const activeVal = this.isPlaying ? val : 0.0;
            targetGain.setValueAtTime(targetGain.value, this.ctx.currentTime);
            targetGain.linearRampToValueAtTime(activeVal, this.ctx.currentTime + 0.1);
        }
    }
    
    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.masterGain && this.ctx) {
            const targetVol = this.isMuted ? 0.0 : 1.0;
            this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
            this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
            this.masterGain.gain.linearRampToValueAtTime(targetVol, this.ctx.currentTime + 0.15);
        }
        return this.isMuted;
    }
    
    // Stop all active synthesizers
    stopActiveSounds() {
        this.activeNodes.forEach(node => {
            try {
                node.stop();
            } catch (e) {}
        });
        this.activeNodes = [];
        
        if (this.streamTimeout) {
            clearTimeout(this.streamTimeout);
            this.streamTimeout = null;
        }
    }
    
    // Switch soundscape scenes
    setScene(sceneName) {
        this.currentScene = sceneName;
        if (!this.ctx) return;
        
        this.stopActiveSounds();
        this.startSceneSounds();
        
        // If we are currently paused, keep the newly generated nodes silent
        if (!this.isPlaying) {
            Object.keys(this.channels).forEach(key => {
                if (this.channels[key].node) {
                    this.channels[key].node.gain.setValueAtTime(0, this.ctx.currentTime);
                }
            });
        }
    }
    
    // Triggers generation logic for each scene
    startSceneSounds() {
        if (!this.ctx) return;
        
        // Always maintain the focus pulse running in background
        this.synthesizeBinauralPulse();
        
        if (this.currentScene === 'tokyo') {
            this.synthesizeRain();
            this.synthesizeCyberDrone();
        } else if (this.currentScene === 'fireplace') {
            this.synthesizeFireCrackle();
            this.synthesizeWarmHum();
        } else if (this.currentScene === 'space') {
            this.synthesizeSolarWind();
            this.synthesizeSpaceDrone();
        } else if (this.currentScene === 'zengarden') {
            this.synthesizeZenDrone();
            this.startZenStreamLoop();
        }
    }
    
    // White Noise Buffer Builder
    createWhiteNoiseBuffer() {
        const bufferSize = 2 * this.ctx.sampleRate;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        return noiseBuffer;
    }
    
    /* ==========================================================================
       SOUND GENERATOR: TOKYO RAIN & DETUNED NEON DRONE
       ========================================================================== */
    
    // Dynamic rain synthesis
    synthesizeRain() {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createWhiteNoiseBuffer();
        noise.loop = true;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(850, this.ctx.currentTime);
        filter.Q.setValueAtTime(0.7, this.ctx.currentTime);
        
        const lfo = this.ctx.createOscillator();
        lfo.frequency.setValueAtTime(0.15, this.ctx.currentTime);
        
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(120, this.ctx.currentTime);
        
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        
        noise.connect(filter);
        filter.connect(this.channels.env.node);
        
        lfo.start();
        noise.start();
        
        this.activeNodes.push(noise, lfo);
    }
    
    // Deep Sci-fi Synth Hum
    synthesizeCyberDrone() {
        const osc1 = this.ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(55.0, this.ctx.currentTime);
        
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(55.3, this.ctx.currentTime);
        
        const lowpass = this.ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(180, this.ctx.currentTime);
        
        osc1.connect(lowpass);
        osc2.connect(lowpass);
        lowpass.connect(this.channels.drone.node);
        
        osc1.start();
        osc2.start();
        
        this.activeNodes.push(osc1, osc2);
    }
    
    /* ==========================================================================
       SOUND GENERATOR: COZY FIREPLACE, RECORD CRACKLE & HEARTH HUM
       ========================================================================== */
    
    // Warm fire crackles and vinyl record static pop layers
    synthesizeFireCrackle() {
        const bufferSize = this.ctx.sampleRate * 4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate random spark clicks + record crackles
        for (let i = 0; i < bufferSize; i++) {
            data[i] = 0;
            
            // Standard sparks
            if (Math.random() < 0.00012) {
                let clickLength = Math.floor(Math.random() * 40) + 10;
                for (let j = 0; j < clickLength; j++) {
                    if (i + j < bufferSize) {
                        data[i + j] = (Math.random() * 2 - 1) * Math.exp(-j / 10);
                    }
                }
                i += clickLength;
            }
            // Continuous soft micro-pops (Lo-fi vinyl crackle feel)
            else if (Math.random() < 0.0008) {
                data[i] = (Math.random() * 0.15 - 0.075);
            }
        }
        
        const clickSource = this.ctx.createBufferSource();
        clickSource.buffer = buffer;
        clickSource.loop = true;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1400, this.ctx.currentTime);
        
        // Soft background white static noise filter
        const staticSource = this.ctx.createBufferSource();
        staticSource.buffer = this.createWhiteNoiseBuffer();
        staticSource.loop = true;
        
        const staticFilter = this.ctx.createBiquadFilter();
        staticFilter.type = 'bandpass';
        staticFilter.frequency.setValueAtTime(1000, this.ctx.currentTime);
        staticFilter.Q.setValueAtTime(0.8, this.ctx.currentTime);
        
        const staticGain = this.ctx.createGain();
        staticGain.gain.setValueAtTime(0.04, this.ctx.currentTime); // very quiet static hiss
        
        staticSource.connect(staticFilter);
        staticFilter.connect(staticGain);
        staticGain.connect(this.channels.env.node);
        
        clickSource.connect(filter);
        filter.connect(this.channels.env.node);
        
        clickSource.start();
        staticSource.start();
        
        this.activeNodes.push(clickSource, staticSource);
    }
    
    // Soft fireplace base drone
    synthesizeWarmHum() {
        const oscFlame = this.ctx.createOscillator();
        oscFlame.type = 'triangle';
        oscFlame.frequency.setValueAtTime(65.0, this.ctx.currentTime);
        
        const lowpass = this.ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(110, this.ctx.currentTime);
        
        const flickerLfo = this.ctx.createOscillator();
        flickerLfo.type = 'sine';
        flickerLfo.frequency.setValueAtTime(1.5, this.ctx.currentTime);
        
        const flickerGain = this.ctx.createGain();
        flickerGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        
        flickerLfo.connect(flickerGain);
        
        const modGain = this.ctx.createGain();
        modGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        
        flickerGain.connect(modGain.gain);
        
        oscFlame.connect(modGain);
        modGain.connect(lowpass);
        lowpass.connect(this.channels.drone.node);
        
        flickerLfo.start();
        oscFlame.start();
        
        this.activeNodes.push(flickerLfo, oscFlame);
    }
    
    /* ==========================================================================
       SOUND GENERATOR: DEEP SPACE STATION SOLAR WIND & BASE HUM
       ========================================================================== */
    
    // Wind sweeps representing solar storms
    synthesizeSolarWind() {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createWhiteNoiseBuffer();
        noise.loop = true;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, this.ctx.currentTime);
        filter.Q.setValueAtTime(1.5, this.ctx.currentTime);
        
        const sweepLfo = this.ctx.createOscillator();
        sweepLfo.type = 'sine';
        sweepLfo.frequency.setValueAtTime(0.05, this.ctx.currentTime); // 20-second sweeps
        
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(280, this.ctx.currentTime);
        
        sweepLfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        
        noise.connect(filter);
        filter.connect(this.channels.env.node);
        
        sweepLfo.start();
        noise.start();
        
        this.activeNodes.push(noise, sweepLfo);
    }
    
    // Deep space station base resonance
    synthesizeSpaceDrone() {
        const baseOsc = this.ctx.createOscillator();
        baseOsc.type = 'sine';
        baseOsc.frequency.setValueAtTime(73.42, this.ctx.currentTime);
        
        const phaseOsc = this.ctx.createOscillator();
        phaseOsc.type = 'sine';
        phaseOsc.frequency.setValueAtTime(73.82, this.ctx.currentTime);
        
        const lowpass = this.ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(130, this.ctx.currentTime);
        
        baseOsc.connect(lowpass);
        phaseOsc.connect(lowpass);
        lowpass.connect(this.channels.drone.node);
        
        baseOsc.start();
        phaseOsc.start();
        
        this.activeNodes.push(baseOsc, phaseOsc);
    }
    
    /* ==========================================================================
       FOCUS ELEMENT: BINAURAL PULSE
       ========================================================================== */
    
    synthesizeBinauralPulse() {
        const leftOsc = this.ctx.createOscillator();
        leftOsc.type = 'sine';
        leftOsc.frequency.setValueAtTime(120.0, this.ctx.currentTime);
        
        const rightOsc = this.ctx.createOscillator();
        rightOsc.type = 'sine';
        rightOsc.frequency.setValueAtTime(126.0, this.ctx.currentTime);
        
        const leftPanner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        const rightPanner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        
        if (leftPanner && rightPanner) {
            leftPanner.pan.setValueAtTime(-1, this.ctx.currentTime);
            rightPanner.pan.setValueAtTime(1, this.ctx.currentTime);
            
            leftOsc.connect(leftPanner);
            leftPanner.connect(this.channels.pulse.node);
            
            rightOsc.connect(rightPanner);
            rightPanner.connect(this.channels.pulse.node);
        } else {
            leftOsc.connect(this.channels.pulse.node);
            rightOsc.connect(this.channels.pulse.node);
        }
        
        leftOsc.start();
        rightOsc.start();
        
        this.activeNodes.push(leftOsc, rightOsc);
    }

    /* ==========================================================================
       AESTHETIC UPGRADE: PROCEDURAL WIND CHIMES
       ========================================================================== */
    startWindChimesScheduler() {
        this.isChimesRunning = true;
        this.scheduleWindChime();
    }
    
    scheduleWindChime() {
        if (!this.isChimesRunning) return;
        
        const delay = Math.random() * 8000 + 5000;
        
        this.chimesTimeout = setTimeout(() => {
            this.playSingleChime();
            this.scheduleWindChime();
        }, delay);
    }
    
    playSingleChime() {
        if (!this.ctx || this.isMuted || !this.isPlaying || this.channels.chimes.vol <= 0) return;
        
        const time = this.ctx.currentTime;
        const baseFreq = this.chimeNotes[Math.floor(Math.random() * this.chimeNotes.length)];
        const partials = [1.0, 1.414, 1.98, 2.44, 3.0];
        
        const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        const panValue = Math.random() * 1.6 - 0.8;
        
        if (panner) {
            panner.pan.setValueAtTime(panValue, time);
            panner.connect(this.channels.chimes.node);
        }
        
        partials.forEach((ratio, index) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(baseFreq * ratio, time);
            
            const envelope = this.ctx.createGain();
            const decay = 2.5 / (index * 0.8 + 1.0);
            
            envelope.gain.setValueAtTime(0, time);
            envelope.gain.linearRampToValueAtTime(0.04 - (index * 0.006), time + 0.005);
            envelope.gain.exponentialRampToValueAtTime(0.0001, time + decay);
            
            osc.connect(envelope);
            
            if (panner) {
                envelope.connect(panner);
            } else {
                envelope.connect(this.channels.chimes.node);
            }
            
            osc.start(time);
            osc.stop(time + decay + 0.1);
        });
    }

    /* ==========================================================================
       NEW FEATURE: KEYBOARD TYPING INSTRUMENT SYNTHESIS
       ========================================================================== */
    playKeyboardTone(charCode) {
        if (!this.ctx || this.isMuted) return; // Works even if background music is paused!
        
        const time = this.ctx.currentTime;
        
        // Select pentatonic chord note mapping based on character key code
        const baseFreq = this.keyboardNotes[charCode % this.keyboardNotes.length];
        
        // Soft panning
        const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        const panVal = Math.sin(charCode) * 0.6; // distributes left/right depending on keys
        
        if (panner) {
            panner.pan.setValueAtTime(panVal, time);
            panner.connect(this.masterGain);
        }
        
        // Smooth sine bell note
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, time);
        
        // Soft detuned overtone to make it sound premium (rhodes bell vibe)
        const overtone = this.ctx.createOscillator();
        overtone.type = 'sine';
        overtone.frequency.setValueAtTime(baseFreq * 2.002, time);
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0, time);
        gain.gain.linearRampToValueAtTime(0.12, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.2);
        
        osc.connect(gain);
        overtone.connect(gain);
        
        if (panner) {
            gain.connect(panner);
        } else {
            gain.connect(this.masterGain);
        }
        
        osc.start(time);
        overtone.start(time);
        
        osc.stop(time + 1.3);
        overtone.stop(time + 1.3);
    }

    /* ==========================================================================
       TACTILE SOUND: FIREWOOD CRACKLE BURST & HUM SWELL
       ========================================================================== */
    triggerFirewoodCrackle() {
        if (!this.ctx || this.isMuted) return;
        
        const time = this.ctx.currentTime;
        const numPops = Math.floor(Math.random() * 4) + 6; // 6 to 9 pops
        
        for (let i = 0; i < numPops; i++) {
            const delay = Math.random() * 1.2;
            const popTime = time + delay;
            
            // Short noise burst buffer
            const bufferSize = Math.floor(this.ctx.sampleRate * (Math.random() * 0.08 + 0.02)); // 20ms to 100ms
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const channelData = buffer.getChannelData(0);
            
            for (let j = 0; j < bufferSize; j++) {
                channelData[j] = (Math.random() * 2 - 1) * Math.exp(-j / (this.ctx.sampleRate * 0.005));
            }
            
            const popSource = this.ctx.createBufferSource();
            popSource.buffer = buffer;
            
            const highpass = this.ctx.createBiquadFilter();
            highpass.type = 'highpass';
            highpass.frequency.setValueAtTime(Math.random() * 800 + 400, popTime);
            
            const lowpass = this.ctx.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.frequency.setValueAtTime(Math.random() * 4000 + 2000, popTime);
            
            const popGain = this.ctx.createGain();
            const maxGain = Math.random() * 0.45 + 0.35; // loud snap
            popGain.gain.setValueAtTime(0, popTime);
            popGain.gain.linearRampToValueAtTime(maxGain, popTime + 0.002);
            popGain.gain.exponentialRampToValueAtTime(0.0001, popTime + (bufferSize / this.ctx.sampleRate) - 0.002);
            
            const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
            if (panner) {
                panner.pan.setValueAtTime(Math.random() * 1.2 - 0.6, popTime);
                popSource.connect(highpass);
                highpass.connect(lowpass);
                lowpass.connect(popGain);
                popGain.connect(panner);
                panner.connect(this.masterGain);
            } else {
                popSource.connect(highpass);
                highpass.connect(lowpass);
                lowpass.connect(popGain);
                popGain.connect(this.masterGain);
            }
            
            popSource.start(popTime);
            popSource.stop(popTime + (bufferSize / this.ctx.sampleRate) + 0.1);
        }
        
        // Deep warm hum swell representing the fireplace roaring
        const roarOsc = this.ctx.createOscillator();
        roarOsc.type = 'triangle';
        roarOsc.frequency.setValueAtTime(58.0, time);
        roarOsc.frequency.linearRampToValueAtTime(75.0, time + 1.0);
        
        const roarFilter = this.ctx.createBiquadFilter();
        roarFilter.type = 'lowpass';
        roarFilter.frequency.setValueAtTime(120, time);
        roarFilter.frequency.exponentialRampToValueAtTime(60, time + 1.5);
        
        const roarGain = this.ctx.createGain();
        roarGain.gain.setValueAtTime(0, time);
        roarGain.gain.linearRampToValueAtTime(0.35, time + 0.15);
        roarGain.gain.exponentialRampToValueAtTime(0.0001, time + 1.6);
        
        roarOsc.connect(roarFilter);
        roarFilter.connect(roarGain);
        roarGain.connect(this.masterGain);
        
        roarOsc.start(time);
        roarOsc.stop(time + 1.7);
    }

    /* ==========================================================================
       TACTILE SOUND: SPACE SUPERNOVA SUB-BASS SHOCKWAVE
       ========================================================================== */
    triggerSpaceSupernova() {
        if (!this.ctx || this.isMuted) return;
        
        const time = this.ctx.currentTime;
        
        // 1. Sub-bass shockwave sweep
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(60, time);
        osc.frequency.exponentialRampToValueAtTime(30, time + 2.0); // drop below audible
        
        // High-Q lowpass filter to create a sweep resonance
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(250, time);
        filter.frequency.exponentialRampToValueAtTime(45, time + 1.8);
        filter.Q.setValueAtTime(8, time);
        
        // Swell gain envelope
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(0.55, time + 0.15); // quick explosion attack
        gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 2.5); // long rumble decay
        
        // 2. Cosmic feedback delay loop
        const delay = this.ctx.createDelay();
        delay.delayTime.setValueAtTime(0.35, time); // 350ms echo
        
        const delayGain = this.ctx.createGain();
        delayGain.gain.setValueAtTime(0.35, time); // echo volume
        
        // Routing: Osc -> Filter -> GainNode -> Master (dry)
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        // GainNode -> Delay -> DelayGain -> Delay (feedback) and Master (wet)
        gainNode.connect(delay);
        delay.connect(delayGain);
        delayGain.connect(delay);
        delayGain.connect(this.masterGain);
        
        osc.start(time);
        osc.stop(time + 2.6);
    }

    /* ==========================================================================
       TACTILE SOUND: CRYSTALLINE BELL CHIME (METEOR SHATTER)
       ========================================================================== */
    playChimeTone() {
        if (!this.ctx || this.isMuted) return;
        
        const time = this.ctx.currentTime;
        const baseFreq = 1100 + Math.random() * 400; // 1100Hz to 1500Hz chime
        
        // Dual sine oscillators for high-pitched crystalline timbre
        const osc1 = this.ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(baseFreq, time);
        
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(baseFreq * 2.01, time); // slight detuning
        
        const gain1 = this.ctx.createGain();
        const gain2 = this.ctx.createGain();
        
        gain1.gain.setValueAtTime(0, time);
        gain1.gain.linearRampToValueAtTime(0.15, time + 0.005);
        gain1.gain.exponentialRampToValueAtTime(0.0001, time + 1.2);
        
        gain2.gain.setValueAtTime(0, time);
        gain2.gain.linearRampToValueAtTime(0.06, time + 0.005);
        gain2.gain.exponentialRampToValueAtTime(0.0001, time + 0.6);
        
        // Echo delay line
        const delay = this.ctx.createDelay();
        delay.delayTime.setValueAtTime(0.24, time); // 240ms delay
        
        const delayGain = this.ctx.createGain();
        delayGain.gain.setValueAtTime(0.4, time);
        
        // Random stereo panning
        const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        const panVal = Math.random() * 1.4 - 0.7;
        
        osc1.connect(gain1);
        osc2.connect(gain2);
        
        const chimeMix = this.ctx.createGain();
        gain1.connect(chimeMix);
        gain2.connect(chimeMix);
        
        if (panner) {
            panner.pan.setValueAtTime(panVal, time);
            chimeMix.connect(panner);
            panner.connect(this.masterGain);
            panner.connect(delay);
        } else {
            chimeMix.connect(this.masterGain);
            chimeMix.connect(delay);
        }
        
        delay.connect(delayGain);
        delayGain.connect(delay);
        delayGain.connect(this.masterGain);
        
        osc1.start(time);
        osc2.start(time);
        
        osc1.stop(time + 1.3);
        osc2.stop(time + 0.7);
    }

    /* ==========================================================================
       NEW FEATURE: COZY ZEN GARDEN GENERATORS & INTERACTIVES
       ========================================================================== */
    synthesizeZenDrone() {
        // Soft sine wave drone at 65.4Hz + 65.7Hz (detuned)
        const osc1 = this.ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(65.4, this.ctx.currentTime); // C2
        
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(65.7, this.ctx.currentTime);
        
        const lowpass = this.ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(90, this.ctx.currentTime);
        
        osc1.connect(lowpass);
        osc2.connect(lowpass);
        lowpass.connect(this.channels.drone.node);
        
        osc1.start();
        osc2.start();
        
        // Add soft wind sweeps through bandpass filter on white noise
        const wind = this.ctx.createBufferSource();
        wind.buffer = this.createWhiteNoiseBuffer();
        wind.loop = true;
        
        const windFilter = this.ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.setValueAtTime(350, this.ctx.currentTime); // low rustle
        windFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);
        
        const windLfo = this.ctx.createOscillator();
        windLfo.type = 'sine';
        windLfo.frequency.setValueAtTime(0.04, this.ctx.currentTime); // 25 seconds loop
        
        const windLfoGain = this.ctx.createGain();
        windLfoGain.gain.setValueAtTime(150, this.ctx.currentTime); // sweeps 200Hz to 500Hz
        
        windLfo.connect(windLfoGain);
        windLfoGain.connect(windFilter.frequency);
        
        const windGain = this.ctx.createGain();
        windGain.gain.setValueAtTime(0.35, this.ctx.currentTime); // soft wind volume
        
        wind.connect(windFilter);
        windFilter.connect(windGain);
        windGain.connect(this.channels.env.node);
        
        windLfo.start();
        wind.start();
        
        this.activeNodes.push(osc1, osc2, windLfo, wind);
    }

    startZenStreamLoop() {
        if (this.currentScene !== 'zengarden' || !this.isPlaying) return;
        this.playWaterDrop();
        
        const nextDelay = Math.random() * 180 + 70; // 70ms to 250ms
        this.streamTimeout = setTimeout(() => this.startZenStreamLoop(), nextDelay);
    }

    playWaterDrop() {
        if (!this.ctx || this.isMuted || !this.isPlaying || this.channels.env.vol <= 0 || this.currentScene !== 'zengarden') return;
        
        const time = this.ctx.currentTime;
        const baseFreq = 800 + Math.random() * 800; // 800Hz to 1600Hz
        
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        
        // Pitch drop curve to simulate water drip
        osc.frequency.setValueAtTime(baseFreq, time);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, time + 0.08);
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(Math.random() * 0.03 + 0.015, time + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
        
        const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        const panValue = Math.random() * 1.0 - 0.5;
        
        osc.connect(gain);
        
        if (panner) {
            panner.pan.setValueAtTime(panValue, time);
            gain.connect(panner);
            panner.connect(this.channels.env.node);
        } else {
            gain.connect(this.channels.env.node);
        }
        
        osc.start(time);
        osc.stop(time + 0.15);
    }

    triggerShishiOdoshi() {
        if (!this.ctx || this.isMuted) return;
        
        const time = this.ctx.currentTime;
        
        // 1. Splash sound (water dumping)
        const splashBuffer = this.createWhiteNoiseBuffer();
        const splashSource = this.ctx.createBufferSource();
        splashSource.buffer = splashBuffer;
        
        const splashFilter = this.ctx.createBiquadFilter();
        splashFilter.type = 'lowpass';
        splashFilter.frequency.setValueAtTime(1200, time);
        splashFilter.frequency.exponentialRampToValueAtTime(300, time + 0.4);
        
        const splashGain = this.ctx.createGain();
        splashGain.gain.setValueAtTime(0.0, time);
        splashGain.gain.linearRampToValueAtTime(0.28, time + 0.05);
        splashGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.55);
        
        splashSource.connect(splashFilter);
        splashFilter.connect(splashGain);
        splashGain.connect(this.masterGain);
        
        splashSource.start(time);
        splashSource.stop(time + 0.6);
        
        // 2. Wooden clack impact (delayed by 0.35 seconds after start of tip)
        const clackTime = time + 0.35;
        
        // High click (contact impact)
        const clickOsc = this.ctx.createOscillator();
        clickOsc.type = 'square';
        clickOsc.frequency.setValueAtTime(680, clackTime);
        clickOsc.frequency.exponentialRampToValueAtTime(180, clackTime + 0.015);
        
        const clickGain = this.ctx.createGain();
        clickGain.gain.setValueAtTime(0.0, clackTime);
        clickGain.gain.linearRampToValueAtTime(0.24, clackTime + 0.001);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, clackTime + 0.018);
        
        clickOsc.connect(clickGain);
        clickGain.connect(this.masterGain);
        
        clickOsc.start(clackTime);
        clickOsc.stop(clackTime + 0.03);
        
        // Main wooden body resonance
        const bodyOsc = this.ctx.createOscillator();
        bodyOsc.type = 'triangle';
        bodyOsc.frequency.setValueAtTime(145, clackTime);
        
        const bodyGain = this.ctx.createGain();
        bodyGain.gain.setValueAtTime(0.0, clackTime);
        bodyGain.gain.linearRampToValueAtTime(0.48, clackTime + 0.002);
        bodyGain.gain.exponentialRampToValueAtTime(0.0001, clackTime + 0.11);
        
        const bodyFilter = this.ctx.createBiquadFilter();
        bodyFilter.type = 'bandpass';
        bodyFilter.frequency.setValueAtTime(175, clackTime);
        bodyFilter.Q.setValueAtTime(1.5, clackTime);
        
        bodyOsc.connect(bodyFilter);
        bodyFilter.connect(bodyGain);
        bodyGain.connect(this.masterGain);
        
        bodyOsc.start(clackTime);
        bodyOsc.stop(clackTime + 0.15);
    }

    /* ==========================================================================
       NEW FEATURE: TOKYO RAIN PIANO PENTATONIC SYNTHESIS
       ========================================================================== */
    playRhodesPianoNote(freq) {
        if (!this.ctx || this.isMuted) return;
        
        const time = this.ctx.currentTime;
        
        // Fundamental (warm sine wave)
        const fundamental = this.ctx.createOscillator();
        fundamental.type = 'sine';
        fundamental.frequency.setValueAtTime(freq, time);
        
        // Soft triangle overtone (creates warm electric keyboard growl)
        const overtone1 = this.ctx.createOscillator();
        overtone1.type = 'triangle';
        overtone1.frequency.setValueAtTime(freq * 2.0, time);
        
        // Crystalline metal tine click (high frequency decaying instantly)
        const tine = this.ctx.createOscillator();
        tine.type = 'sine';
        tine.frequency.setValueAtTime(freq * 6.004, time);
        
        // Volume envelopes
        const fundGain = this.ctx.createGain();
        fundGain.gain.setValueAtTime(0, time);
        fundGain.gain.linearRampToValueAtTime(0.18, time + 0.012);
        fundGain.gain.exponentialRampToValueAtTime(0.0001, time + 1.8);
        
        const overGain = this.ctx.createGain();
        overGain.gain.setValueAtTime(0, time);
        overGain.gain.linearRampToValueAtTime(0.04, time + 0.015);
        overGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.7);
        
        const tineGain = this.ctx.createGain();
        tineGain.gain.setValueAtTime(0, time);
        tineGain.gain.linearRampToValueAtTime(0.15, time + 0.002);
        tineGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
        
        // Stereo panning based on frequency
        const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        let panVal = (freq - 400) / 400; // maps roughly between -0.8 and 0.8
        panVal = Math.max(-0.85, Math.min(0.85, panVal));
        
        fundamental.connect(fundGain);
        overtone1.connect(overGain);
        tine.connect(tineGain);
        
        const pianoMix = this.ctx.createGain();
        fundGain.connect(pianoMix);
        overGain.connect(pianoMix);
        tineGain.connect(pianoMix);
        
        if (panner) {
            panner.pan.setValueAtTime(panVal, time);
            pianoMix.connect(panner);
            panner.connect(this.masterGain);
        } else {
            pianoMix.connect(this.masterGain);
        }
        
        fundamental.start(time);
        overtone1.start(time);
        tine.start(time);
        
        fundamental.stop(time + 2.0);
        overtone1.stop(time + 0.9);
        tine.stop(time + 0.1);
    }

    /* ==========================================================================
       NEW FEATURE: COSMIC CONSTELLATION WARM SYNTH PAD
       ========================================================================== */
    playSynthPadChord(freqs) {
        if (!this.ctx || this.isMuted) return;
        
        const time = this.ctx.currentTime;
        const duration = 4.5; // long, slow release pad
        
        const padMix = this.ctx.createGain();
        padMix.gain.setValueAtTime(0, time);
        padMix.gain.linearRampToValueAtTime(0.22, time + 1.2); // 1.2s attack
        padMix.gain.setValueAtTime(0.22, time + 2.0);
        padMix.gain.exponentialRampToValueAtTime(0.0001, time + duration); // slow release
        
        // Lowpass filter sweep
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(180, time);
        filter.frequency.exponentialRampToValueAtTime(950, time + 1.5);
        filter.frequency.exponentialRampToValueAtTime(120, time + duration - 0.2);
        filter.Q.setValueAtTime(2.2, time);
        
        padMix.connect(filter);
        filter.connect(this.masterGain);
        
        // Start oscillators for each note in the chord
        freqs.forEach(freq => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, time);
            
            const sub = this.ctx.createOscillator();
            sub.type = 'triangle';
            sub.frequency.setValueAtTime(freq / 2, time); // one octave lower
            
            const oscGain = this.ctx.createGain();
            oscGain.gain.setValueAtTime(0.06, time);
            
            const subGain = this.ctx.createGain();
            subGain.gain.setValueAtTime(0.08, time);
            
            osc.connect(oscGain);
            sub.connect(subGain);
            
            oscGain.connect(padMix);
            subGain.connect(padMix);
            
            osc.start(time);
            sub.start(time);
            
            osc.stop(time + duration + 0.1);
            sub.stop(time + duration + 0.1);
        });
    }

    triggerNeonOverload() {
        if (!this.ctx || this.isMuted) return;
        
        const time = this.ctx.currentTime;
        
        // Screaming resonant analog sweep
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, time);
        osc.frequency.exponentialRampToValueAtTime(880, time + 0.45);
        osc.frequency.exponentialRampToValueAtTime(110, time + 0.9);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.setValueAtTime(300, time);
        filter.frequency.exponentialRampToValueAtTime(3200, time + 0.45);
        filter.frequency.exponentialRampToValueAtTime(220, time + 0.95);
        filter.Q.setValueAtTime(12.0, time);
        
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(0.38, time + 0.08);
        gainNode.gain.linearRampToValueAtTime(0.28, time + 0.45);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 1.3);
        
        // Glitch echo delay lines
        const delay = this.ctx.createDelay();
        delay.delayTime.setValueAtTime(0.08, time); // 80ms fast metallic feedback delay
        
        const delayGain = this.ctx.createGain();
        delayGain.gain.setValueAtTime(0.55, time); // metallic resonance feedback
        
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        // Setup feedback delay path
        gainNode.connect(delay);
        delay.connect(delayGain);
        delayGain.connect(delay);
        delayGain.connect(this.masterGain);
        
        osc.start(time);
        osc.stop(time + 1.4);
    }

    triggerGravityCollapse() {
        if (!this.ctx || this.isMuted) return;
        
        const time = this.ctx.currentTime;
        
        // Vacuum suction lowpass sweep noise
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createWhiteNoiseBuffer();
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, time);
        filter.frequency.exponentialRampToValueAtTime(80, time + 0.8);
        filter.Q.setValueAtTime(7.0, time);
        
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(0.32, time + 0.12);
        gainNode.gain.linearRampToValueAtTime(0.42, time + 0.6);
        gainNode.gain.linearRampToValueAtTime(0.001, time + 0.8); // drops to silent right before supernova
        
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        noise.start(time);
        noise.stop(time + 0.85);
        
        // Schedule supernova sound after 850ms
        setTimeout(() => {
            if (this.currentScene === 'space' && this.isPlaying) {
                this.triggerSpaceSupernova();
            }
        }, 850);
    }

    setWeatherLevel(percent) {
        this.weatherLevel = percent / 100;
    }

    triggerTimeWarp() {
        if (!this.ctx || this.isMuted) return;
        
        const time = this.ctx.currentTime;
        const duration = 1.2; // whoosh duration
        
        // 1. Pitch-rising sweeps
        const osc1 = this.ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(120, time);
        osc1.frequency.exponentialRampToValueAtTime(1200, time + duration - 0.2);
        
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(80, time);
        osc2.frequency.exponentialRampToValueAtTime(800, time + duration - 0.1);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150, time);
        filter.frequency.exponentialRampToValueAtTime(4000, time + duration - 0.3);
        filter.Q.setValueAtTime(4.0, time);
        
        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0, time);
        oscGain.gain.linearRampToValueAtTime(0.18, time + 0.15); // rise quickly
        oscGain.gain.exponentialRampToValueAtTime(0.0001, time + duration); // decay down
        
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(oscGain);
        
        // 2. Filtered noise sweep for atmospheric "whoosh" suction
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createWhiteNoiseBuffer();
        
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(300, time);
        noiseFilter.frequency.exponentialRampToValueAtTime(2500, time + duration - 0.25);
        noiseFilter.Q.setValueAtTime(2.5, time);
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0, time);
        noiseGain.gain.linearRampToValueAtTime(0.24, time + 0.2);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        
        // 3. Stereo panning (Whoosh moves from left to right)
        const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        if (panner) {
            panner.pan.setValueAtTime(-0.85, time);
            panner.pan.linearRampToValueAtTime(0.85, time + duration);
            
            oscGain.connect(panner);
            noiseGain.connect(panner);
            panner.connect(this.masterGain);
        } else {
            oscGain.connect(this.masterGain);
            noiseGain.connect(this.masterGain);
        }
        
        osc1.start(time);
        osc2.start(time);
        noise.start(time);
        
        osc1.stop(time + duration + 0.1);
        osc2.stop(time + duration + 0.1);
        noise.stop(time + duration + 0.1);
    }

    playThunder(level) {
        if (!this.ctx || this.isMuted || !this.isPlaying) return;
        
        const time = this.ctx.currentTime;
        const duration = 2.8 + Math.random() * 0.6;
        
        // 1. Low rumble (modulated sub-bass)
        const rumble = this.ctx.createOscillator();
        rumble.type = 'sine';
        rumble.frequency.setValueAtTime(48, time);
        
        // Vibrato LFO for rolling thunder sound
        const lfo = this.ctx.createOscillator();
        lfo.frequency.setValueAtTime(8 + Math.random() * 4, time);
        
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(14, time);
        
        lfo.connect(lfoGain);
        lfoGain.connect(rumble.frequency);
        
        const rumbleFilter = this.ctx.createBiquadFilter();
        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.setValueAtTime(100, time);
        
        const rumbleGain = this.ctx.createGain();
        rumbleGain.gain.setValueAtTime(0, time);
        rumbleGain.gain.linearRampToValueAtTime(0.24 * level, time + 0.15); // fade in quickly
        rumbleGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        
        rumble.connect(rumbleFilter);
        rumbleFilter.connect(rumbleGain);
        rumbleGain.connect(this.masterGain);
        
        // 2. Filtered crackle (higher frequency rumble crackles)
        const crackleNoise = this.ctx.createBufferSource();
        crackleNoise.buffer = this.createWhiteNoiseBuffer();
        
        const crackleFilter = this.ctx.createBiquadFilter();
        crackleFilter.type = 'bandpass';
        crackleFilter.frequency.setValueAtTime(70, time);
        crackleFilter.frequency.exponentialRampToValueAtTime(32, time + duration - 0.4);
        crackleFilter.Q.setValueAtTime(1.5, time);
        
        const crackleGain = this.ctx.createGain();
        crackleGain.gain.setValueAtTime(0, time);
        crackleGain.gain.linearRampToValueAtTime(0.12 * level, time + 0.08);
        crackleGain.gain.exponentialRampToValueAtTime(0.0001, time + duration - 0.2);
        
        crackleNoise.connect(crackleFilter);
        crackleFilter.connect(crackleGain);
        crackleGain.connect(this.masterGain);
        
        // Start nodes
        rumble.start(time);
        lfo.start(time);
        crackleNoise.start(time);
        
        rumble.stop(time + duration + 0.1);
        lfo.stop(time + duration + 0.1);
        crackleNoise.stop(time + duration + 0.1);
    }
}

// Global initialization hook
let audioSynth;
window.addEventListener('DOMContentLoaded', () => {
    audioSynth = new AmbientSynthesizer();
});
