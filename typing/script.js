class RussianTypingGame {
    constructor() {
        // Russian letters ordered by keyboard rows, then by frequency within each row
        // THIS IS THE ENABLE ORDER - you can modify this array to change letter priority
        // HOMEROW (ФЫВА ОЛДЖ): most common letters on home row
        // BOTTOM ROW (ЯЧСМ ИТЬБ): then bottom row letters  
        // TOP ROW (ЙЦУК ЕНГШ ЩЗХЪ): finally top row letters
        this.russianLetters = [
            // HOMEROW - ordered by frequency within home row
            'А', 'О', 'В', 'Л', 'Д', 'Ж', 'Ы', 'Ф',
            // BOTTOM ROW - ordered by frequency within bottom row  
            'Т', 'С', 'Н', 'И', 'М', 'Ь', 'Б', 'Я', 'Ч', 'Ю',
            // TOP ROW - ordered by frequency within top row
            'Е', 'Р', 'К', 'У', 'П', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х', 'Ц', 'Й', 'Ъ', 'Ё'
        ];
        
        // Game session settings
        this.maxPresses = 20;
        this.currentPress = 0;
        this.score = 0;
        this.enabledLetterCount = 5;
        this.enabledLetters = [];
        this.gameSequence = [];
        this.sequenceIndex = 0;
        
        this.currentLetterElement = document.getElementById('currentLetter');
        this.scoreElement = document.getElementById('score');
        this.remainingElement = document.getElementById('remaining');
        this.progressBarElement = document.getElementById('progressBar');
        this.successAnimationElement = document.getElementById('successAnimation');
        this.errorAnimationElement = document.getElementById('errorAnimation');
        this.animationAreaElement = document.getElementById('animationArea');
        this.letterCountSlider = document.getElementById('letterCount');
        this.letterCountValue = document.getElementById('letterCountValue');
        this.enabledLettersDisplay = document.getElementById('enabledLettersDisplay');
        
        // Sound elements
        this.successSound = document.getElementById('successSound');
        this.errorSound = document.getElementById('errorSound');
        
        // Create additional sound variations using Web Audio API
        this.audioContext = null;
        this.initializeAudio();
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateEnabledLetters();
        this.startNewGame();
    }
    
    startNewGame() {
        this.currentPress = 0;
        this.score = 0;
        this.sequenceIndex = 0;
        this.generateGameSequence();
        this.displayCurrentLetter();
        this.updateScore();
        this.updateProgress();
    }
    
    updateEnabledLetters() {
        this.enabledLetterCount = parseInt(this.letterCountSlider.value);
        this.enabledLetters = this.russianLetters.slice(0, this.enabledLetterCount);
        this.letterCountValue.textContent = this.enabledLetterCount;
        this.enabledLettersDisplay.textContent = this.enabledLetters.join(', ');
    }
    
    generateGameSequence() {
        this.gameSequence = [];
        for (let i = 0; i < this.maxPresses; i++) {
            const randomLetter = this.enabledLetters[Math.floor(Math.random() * this.enabledLetters.length)];
            this.gameSequence.push(randomLetter);
        }
    }
    
    initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }
    
    playSuccessSound() {
        // Play HTML audio element
        if (this.successSound) {
            this.successSound.currentTime = 0;
            this.successSound.play().catch(e => console.log('Audio play failed:', e));
        }
        
        // Generate additional cheerful beep using Web Audio API
        this.generateSuccessBeep();
    }
    
    playErrorSound() {
        // Play HTML audio element
        if (this.errorSound) {
            this.errorSound.currentTime = 0;
            this.errorSound.play().catch(e => console.log('Audio play failed:', e));
        }
        
        // Generate additional sad beep using Web Audio API
        this.generateErrorBeep();
    }
    
    generateSuccessBeep() {
        if (!this.audioContext) return;
        
        // Create a cheerful ascending melody
        const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
        
        frequencies.forEach((freq, index) => {
            setTimeout(() => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.2);
            }, index * 100);
        });
    }
    
    generateErrorBeep() {
        if (!this.audioContext) return;
        
        // Create a descending sad sound
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(150, this.audioContext.currentTime + 0.5);
        oscillator.type = 'sawtooth';
        
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.5);
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (event) => {
            this.handleKeyPress(event);
        });
        
        // Prevent default behavior for space and arrow keys
        document.addEventListener('keydown', (event) => {
            if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
                event.preventDefault();
            }
        });
        
        // Letter count slider listener
        this.letterCountSlider.addEventListener('input', () => {
            this.updateEnabledLetters();
            this.startNewGame();
        });
    }
    
    displayCurrentLetter() {
        if (this.sequenceIndex < this.gameSequence.length) {
            const letter = this.gameSequence[this.sequenceIndex];
            this.currentLetterElement.textContent = letter;
            this.currentLetterElement.className = 'current-letter';
        } else {
            this.gameComplete();
        }
    }
    
    handleKeyPress(event) {
        if (this.sequenceIndex >= this.gameSequence.length) return;
        
        const pressedKey = event.key.toUpperCase();
        const currentLetter = this.gameSequence[this.sequenceIndex];
        
        if (pressedKey === currentLetter) {
            this.correctAnswer();
        } else if (this.isRussianLetter(pressedKey)) {
            this.incorrectAnswer();
        }
        // Ignore non-Russian letters
    }
    
    isRussianLetter(key) {
        return this.enabledLetters.includes(key);
    }
    
    correctAnswer() {
        this.score++;
        this.currentPress++;
        
        // Play success sound
        this.playSuccessSound();
        
        // Add correct animation class
        this.currentLetterElement.classList.add('correct');
        
        // Show success animation
        this.showSuccessAnimation();
        
        // Create floating letter effect
        this.createFloatingLetter(this.gameSequence[this.sequenceIndex], '#38a169');
        
        // Move to next letter after animation
        setTimeout(() => {
            this.sequenceIndex++;
            this.displayCurrentLetter();
            this.updateScore();
            this.updateProgress();
            this.currentLetterElement.classList.remove('correct');
        }, 1000);
        
        // Create confetti effect
        this.createConfetti();
    }
    
    incorrectAnswer() {
        this.currentPress++;
        
        // Play error sound
        this.playErrorSound();
        
        // Add incorrect animation class
        this.currentLetterElement.classList.add('incorrect');
        
        // Show error animation
        this.showErrorAnimation();
        
        // Move to next letter after error animation (don't advance score)
        setTimeout(() => {
            this.sequenceIndex++;
            this.displayCurrentLetter();
            this.updateScore();
            this.updateProgress();
            this.currentLetterElement.classList.remove('incorrect');
        }, 1000);
    }
    
    showSuccessAnimation() {
        this.successAnimationElement.classList.add('show');
        setTimeout(() => {
            this.successAnimationElement.classList.remove('show');
        }, 1000);
    }
    
    showErrorAnimation() {
        this.errorAnimationElement.classList.add('show');
        setTimeout(() => {
            this.errorAnimationElement.classList.remove('show');
        }, 1000);
    }
    
    createFloatingLetter(letter, color) {
        const floatingLetter = document.createElement('div');
        floatingLetter.textContent = letter;
        floatingLetter.className = 'floating-letter';
        floatingLetter.style.color = color;
        floatingLetter.style.left = Math.random() * 80 + 10 + '%';
        floatingLetter.style.top = '50%';
        
        this.animationAreaElement.appendChild(floatingLetter);
        
        setTimeout(() => {
            floatingLetter.remove();
        }, 2000);
    }
    
    createConfetti() {
        const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24'];
        
        for (let i = 0; i < 10; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.animationDuration = Math.random() * 2 + 1 + 's';
                confetti.style.animationDelay = Math.random() * 0.5 + 's';
                
                document.body.appendChild(confetti);
                
                setTimeout(() => {
                    confetti.remove();
                }, 3000);
            }, i * 100);
        }
    }
    
    updateProgress() {
        const progress = (this.currentPress / this.maxPresses) * 100;
        this.progressBarElement.style.width = progress + '%';
    }
    
    updateScore() {
        this.scoreElement.textContent = this.score;
        this.remainingElement.textContent = this.maxPresses - this.currentPress;
    }
    
    gameComplete() {
        this.currentLetterElement.textContent = '🎉';
        this.currentLetterElement.style.fontSize = '6em';
        
        const instruction = document.querySelector('.instruction');
        const accuracy = Math.round((this.score / this.maxPresses) * 100);
        instruction.textContent = `Игра окончена! Счёт: ${this.score}/20 (${accuracy}%)`;
        
        // Play victory fanfare
        this.playVictoryFanfare();
        
        // Create massive confetti celebration
        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                this.createConfetti();
            }, i * 100);
        }
        
        // Show restart button
        setTimeout(() => {
            const restartBtn = document.createElement('button');
            restartBtn.textContent = 'Новая игра';
            restartBtn.style.cssText = `
                font-size: 1.2em;
                padding: 15px 30px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                margin-top: 20px;
                transition: transform 0.2s ease;
            `;
            
            restartBtn.addEventListener('click', () => {
                this.startNewGame();
                restartBtn.remove();
            });
            
            restartBtn.addEventListener('mouseenter', () => {
                restartBtn.style.transform = 'scale(1.05)';
            });
            
            restartBtn.addEventListener('mouseleave', () => {
                restartBtn.style.transform = 'scale(1)';
            });
            
            document.querySelector('.game-container').appendChild(restartBtn);
        }, 2000);
    }
    
    playVictoryFanfare() {
        if (!this.audioContext) return;
        
        // Play a triumphant fanfare melody
        const melody = [
            {freq: 523.25, time: 0},    // C5
            {freq: 659.25, time: 0.2},  // E5
            {freq: 783.99, time: 0.4},  // G5
            {freq: 1046.50, time: 0.6}, // C6
            {freq: 783.99, time: 0.8},  // G5
            {freq: 1046.50, time: 1.0}, // C6
        ];
        
        melody.forEach(note => {
            setTimeout(() => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.frequency.setValueAtTime(note.freq, this.audioContext.currentTime);
                oscillator.type = 'triangle';
                
                gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.3);
            }, note.time * 1000);
        });
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new RussianTypingGame();
});

// Add some fun easter eggs
document.addEventListener('keydown', (event) => {
    // Secret rainbow mode with Ctrl+R
    if (event.ctrlKey && event.key === 'r') {
        event.preventDefault();
        document.body.style.background = `
            linear-gradient(45deg, 
            #ff0000, #ff8000, #ffff00, #80ff00, 
            #00ff00, #00ff80, #00ffff, #0080ff,
            #0000ff, #8000ff, #ff00ff, #ff0080)
        `;
        document.body.style.backgroundSize = '400% 400%';
        document.body.style.animation = 'rainbow 3s ease infinite';
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes rainbow {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
        `;
        document.head.appendChild(style);
    }
});
