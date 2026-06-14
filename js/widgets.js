/* ==========================================================================
   CHRONOSCAPES WIDGETS ENGINE: POMODORO, LOCAL TODOS, AUTO-NOTES, BREATH PACER
   ========================================================================== */

class FocusWidgets {
    constructor() {
        // Pomodoro State
        this.pomoState = {
            timeLeft: 25 * 60,
            interval: null,
            isRunning: false,
            mode: 'work',
            durationWork: 25 * 60,
            durationBreak: 5 * 60
        };

        // Breathing State (Box Breathing cycle: Inhale 4s, Hold 4s, Exhale 4s, Hold 4s)
        this.breathingState = {
            isRunning: false,
            interval: null,
            stepIndex: 0,
            secondsLeft: 4,
            steps: [
                { text: 'INHALE', scale: 2.2, duration: 4 },
                { text: 'HOLD', scale: 2.2, duration: 4 },
                { text: 'EXHALE', scale: 1.0, duration: 4 },
                { text: 'HOLD', scale: 1.0, duration: 4 }
            ]
        };

        // DOM elements
        this.pomoDisplay = document.getElementById('pomo-time');
        this.pomoStartBtn = document.getElementById('pomo-start-btn');
        this.pomoResetBtn = document.getElementById('pomo-reset-btn');
        this.pomoWorkBtn = document.getElementById('pomo-work');
        this.pomoBreakBtn = document.getElementById('pomo-break');
        this.pomoSettingsToggle = document.getElementById('pomo-settings-toggle');
        this.pomoSettingsPanel = document.getElementById('pomo-settings-panel');
        this.pomoWorkInput = document.getElementById('pomo-work-input');
        this.pomoBreakInput = document.getElementById('pomo-break-input');

        // Breathing Elements
        this.breathBubble = document.getElementById('breathing-bubble');
        this.breathText = document.getElementById('breathing-text');
        this.breathToggleBtn = document.getElementById('breathing-toggle-btn');

        this.todoForm = document.getElementById('todo-form');
        this.todoInput = document.getElementById('todo-input');
        this.todoList = document.getElementById('todo-list');
        
        this.scratchpad = document.getElementById('scratchpad');

        this.init();
    }

    init() {
        this.setupPomodoro();
        this.setupBreathingPacer();
        this.setupTodoList();
        this.setupScratchpad();
    }

    /* ==========================================================================
       POMODORO TIMER WIDGET LOGIC
       ========================================================================== */
    setupPomodoro() {
        this.updatePomoDisplay();

        // Control click handlers
        this.pomoStartBtn.addEventListener('click', () => this.togglePomo());
        this.pomoResetBtn.addEventListener('click', () => this.resetPomo());
        
        this.pomoWorkBtn.addEventListener('click', () => this.setPomoMode('work'));
        this.pomoBreakBtn.addEventListener('click', () => this.setPomoMode('break'));

        // Settings toggle
        this.pomoSettingsToggle.addEventListener('click', () => {
            this.pomoSettingsPanel.classList.toggle('hidden');
        });

        // Time settings change handlers
        const handleTimeSettings = () => {
            const workVal = Math.max(1, parseInt(this.pomoWorkInput.value) || 25);
            const breakVal = Math.max(1, parseInt(this.pomoBreakInput.value) || 5);
            
            this.pomoState.durationWork = workVal * 60;
            this.pomoState.durationBreak = breakVal * 60;
            
            // If timer isn't active, apply immediately
            if (!this.pomoState.isRunning) {
                this.pomoState.timeLeft = this.pomoState.mode === 'work' ? this.pomoState.durationWork : this.pomoState.durationBreak;
                this.updatePomoDisplay();
            }
        };

        this.pomoWorkInput.addEventListener('change', handleTimeSettings);
        this.pomoBreakInput.addEventListener('change', handleTimeSettings);
    }

    updatePomoDisplay() {
        const minutes = Math.floor(this.pomoState.timeLeft / 60);
        const seconds = this.pomoState.timeLeft % 60;
        const dispMin = minutes.toString().padStart(2, '0');
        const dispSec = seconds.toString().padStart(2, '0');
        
        this.pomoDisplay.textContent = `${dispMin}:${dispSec}`;
        
        // Also update tab title to show timer status
        if (this.pomoState.isRunning) {
            document.title = `(${dispMin}:${dispSec}) Chronoscapes`;
        } else {
            document.title = `Chronoscapes — Immersive Audio-Visual Ambient Workspace`;
        }
    }

    togglePomo() {
        if (this.pomoState.isRunning) {
            clearInterval(this.pomoState.interval);
            this.pomoState.isRunning = false;
            this.pomoStartBtn.textContent = 'START';
            this.pomoStartBtn.style.background = 'var(--accent-color)';
            this.pomoStartBtn.style.boxShadow = '0 4px 12px var(--accent-glow)';
        } else {
            this.pomoState.isRunning = true;
            this.pomoStartBtn.textContent = 'PAUSE';
            this.pomoStartBtn.style.background = '#e63946';
            this.pomoStartBtn.style.boxShadow = '0 4px 12px rgba(230, 57, 70, 0.4)';
            
            // Hide settings panel when starting for cleaner view
            this.pomoSettingsPanel.classList.add('hidden');
            
            this.pomoState.interval = setInterval(() => {
                this.pomoState.timeLeft--;
                this.updatePomoDisplay();

                if (this.pomoState.timeLeft <= 0) {
                    this.onPomoComplete();
                }
            }, 1000);
        }
    }

    resetPomo() {
        clearInterval(this.pomoState.interval);
        this.pomoState.isRunning = false;
        this.pomoState.timeLeft = this.pomoState.mode === 'work' ? this.pomoState.durationWork : this.pomoState.durationBreak;
        this.pomoStartBtn.textContent = 'START';
        this.pomoStartBtn.style.background = 'var(--accent-color)';
        this.pomoStartBtn.style.boxShadow = '0 4px 12px var(--accent-glow)';
        this.updatePomoDisplay();
    }

    setPomoMode(mode) {
        if (this.pomoState.mode === mode) return;

        clearInterval(this.pomoState.interval);
        this.pomoState.isRunning = false;
        this.pomoState.mode = mode;
        this.pomoState.timeLeft = mode === 'work' ? this.pomoState.durationWork : this.pomoState.durationBreak;
        
        this.pomoWorkBtn.classList.toggle('active', mode === 'work');
        this.pomoBreakBtn.classList.toggle('active', mode === 'break');
        
        this.pomoStartBtn.textContent = 'START';
        this.pomoStartBtn.style.background = 'var(--accent-color)';
        this.pomoStartBtn.style.boxShadow = '0 4px 12px var(--accent-glow)';
        
        this.updatePomoDisplay();
    }

    onPomoComplete() {
        clearInterval(this.pomoState.interval);
        this.pomoState.isRunning = false;
        this.pomoStartBtn.textContent = 'START';
        this.pomoStartBtn.style.background = 'var(--accent-color)';
        
        this.playSynthesizedTone(587.33, 880.00, 0.35); // Completed bell note
        
        if (this.pomoState.mode === 'work') {
            alert('Focus Session Finished! Take a break.');
            this.setPomoMode('break');
        } else {
            alert('Break finished! Ready to focus.');
            this.setPomoMode('work');
        }
    }

    playSynthesizedTone(f1, f2, duration) {
        try {
            if (audioSynth && audioSynth.ctx) {
                const ctx = audioSynth.ctx;
                const time = ctx.currentTime;
                
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f1, time);
                if (f2) osc.frequency.setValueAtTime(f2, time + 0.12);
                
                gain.gain.setValueAtTime(0.0, time);
                gain.gain.linearRampToValueAtTime(0.25, time + 0.05);
                gain.gain.linearRampToValueAtTime(0.0, time + duration);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start(time);
                osc.stop(time + duration + 0.05);
            }
        } catch (e) {}
    }

    /* ==========================================================================
       BREATHING PACER WIDGET LOGIC
       ========================================================================== */
    setupBreathingPacer() {
        this.breathToggleBtn.addEventListener('click', () => this.toggleBreathingPacer());
    }

    toggleBreathingPacer() {
        if (this.breathingState.isRunning) {
            // Stop breathing pacer
            clearInterval(this.breathingState.interval);
            this.breathingState.isRunning = false;
            this.breathToggleBtn.textContent = 'START PACING';
            this.breathToggleBtn.style.background = 'rgba(255, 255, 255, 0.03)';
            this.breathToggleBtn.style.borderColor = 'rgba(255, 255, 255, 0.06)';
            
            // Reset Bubble
            this.breathBubble.style.transform = 'scale(1.0)';
            this.breathText.textContent = 'READY';
        } else {
            // Start breathing pacer
            this.breathingState.isRunning = true;
            this.breathingState.stepIndex = 0;
            this.breathToggleBtn.textContent = 'STOP PACING';
            this.breathToggleBtn.style.background = '#e63946'; // red active style
            this.breathToggleBtn.style.borderColor = 'transparent';
            
            this.runBreathingCycleStep();
            
            this.breathingState.interval = setInterval(() => {
                this.breathingState.secondsLeft--;
                
                if (this.breathingState.secondsLeft <= 0) {
                    // Next step in box cycle
                    this.breathingState.stepIndex = (this.breathingState.stepIndex + 1) % this.breathingState.steps.length;
                    this.runBreathingCycleStep();
                } else {
                    // Update remaining seconds display
                    const step = this.breathingState.steps[this.breathingState.stepIndex];
                    this.breathText.textContent = `${step.text} (${this.breathingState.secondsLeft}s)`;
                }
            }, 1000);
        }
    }

    runBreathingCycleStep() {
        const step = this.breathingState.steps[this.breathingState.stepIndex];
        this.breathingState.secondsLeft = step.duration;
        
        this.breathText.textContent = `${step.text} (${step.duration}s)`;
        
        // Dynamic scale transition
        this.breathBubble.style.transition = `transform ${step.duration}s cubic-bezier(0.4, 0, 0.2, 1)`;
        this.breathBubble.style.transform = `scale(${step.scale})`;
        
        // Trigger a soft sound tick on state transitions (inhale/exhale)
        if (step.text === 'INHALE') {
            this.playSynthesizedTone(330.00, null, 0.2); // soft chime
        } else if (step.text === 'EXHALE') {
            this.playSynthesizedTone(220.00, null, 0.2); // soft base chime
        }
    }

    /* ==========================================================================
       TODOS WIDGET LOGIC
       ========================================================================== */
    setupTodoList() {
        this.todos = JSON.parse(localStorage.getItem('chronoscapes_todos')) || [];
        this.renderTodos();

        this.todoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = this.todoInput.value.trim();
            if (text) {
                this.addTodo(text);
                this.todoInput.value = '';
            }
        });
    }

    addTodo(text) {
        const todo = {
            id: Date.now().toString(),
            text: text,
            completed: false
        };
        this.todos.push(todo);
        this.saveTodos();
        this.renderTodos();
    }

    toggleTodo(id) {
        this.todos = this.todos.map(todo => {
            if (todo.id === id) {
                return { ...todo, completed: !todo.completed };
            }
            return todo;
        });
        this.saveTodos();
        this.renderTodos();
    }

    deleteTodo(id) {
        this.todos = this.todos.filter(todo => todo.id !== id);
        this.saveTodos();
        this.renderTodos();
    }

    saveTodos() {
        localStorage.setItem('chronoscapes_todos', JSON.stringify(this.todos));
    }

    renderTodos() {
        this.todoList.innerHTML = '';
        
        if (this.todos.length === 0) {
            this.todoList.innerHTML = `<li class="todo-item" style="color: var(--text-muted); justify-content: center; font-size: 0.75rem;">No active tasks</li>`;
            return;
        }

        this.todos.forEach(todo => {
            const li = document.createElement('li');
            li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            
            const check = document.createElement('span');
            check.className = 'todo-item-check';
            if (todo.completed) {
                check.innerHTML = '✓';
                check.style.fontSize = '8px';
                check.style.color = '#fff';
            }
            check.addEventListener('click', () => this.toggleTodo(todo.id));
            
            const textSpan = document.createElement('span');
            textSpan.className = 'todo-item-text';
            textSpan.textContent = todo.text;
            
            const delBtn = document.createElement('button');
            delBtn.className = 'todo-delete-btn';
            delBtn.innerHTML = '×';
            delBtn.addEventListener('click', () => this.deleteTodo(todo.id));
            
            li.appendChild(check);
            li.appendChild(textSpan);
            li.appendChild(delBtn);
            
            this.todoList.appendChild(li);
        });
    }

    /* ==========================================================================
       SCRATCHPAD / QUICK NOTES WIDGET LOGIC
       ========================================================================== */
    setupScratchpad() {
        const savedNotes = localStorage.getItem('chronoscapes_scratchpad') || '';
        this.scratchpad.value = savedNotes;

        this.scratchpad.addEventListener('input', (e) => {
            localStorage.setItem('chronoscapes_scratchpad', e.target.value);
        });
    }
}

// Global initialization hook
let focusWidgets;
window.addEventListener('DOMContentLoaded', () => {
    focusWidgets = new FocusWidgets();
});
