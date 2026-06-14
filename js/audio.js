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
        
        // Wind chimes loop tracker
        this.chimesTimeout = null;
        this.isChimesRunning = false;
        
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
}

// Global initialization hook
let audioSynth;
window.addEventListener('DOMContentLoaded', () => {
    audioSynth = new AmbientSynthesizer();
});
