import './style.css';
import libraryData from './assets/data.json';

const library = libraryData;

const classicLibrary = [
    { letter: 'A', correct: '🌈', options: ['🌈', '⭐', '☁️'], name: 'Arco-íris', color: 'text-pink-500' },
    { letter: 'B', correct: '🐋', options: ['🐋', '🐻', '🦈'], name: 'Baleia', color: 'text-blue-500' },
    { letter: 'C', correct: '🏠', options: ['🏠', '🏫', '🏥'], name: 'Casa', color: 'text-yellow-600' },
    { letter: 'D', correct: '🦷', options: ['🦷', '🦴', '🦦'], name: 'Dente', color: 'text-gray-500' },
    { letter: 'E', correct: '⭐', options: ['⭐', '☀️', '🌙'], name: 'Estrela', color: 'text-yellow-500' },
    { letter: 'F', correct: '🔥', options: ['🔥', '💧', '🧊'], name: 'Fogo', color: 'text-orange-500' },
    { letter: 'G', correct: '🐈', options: ['🐈', '🐕', '🐇'], name: 'Gato', color: 'text-orange-400' },
    { letter: 'H', correct: '🏥', options: ['🏥', '🏠', '🏫'], name: 'Hospital', color: 'text-red-500' },
    { letter: 'L', correct: '🦁', options: ['🦁', '🐯', '🐻'], name: 'Leão', color: 'text-yellow-600' },
    { letter: 'M', correct: '🍎', options: ['🍎', '🍌', '🍊'], name: 'Maçã', color: 'text-red-600' },
    { letter: 'N', correct: '☁️', options: ['☁️', '⚡', '🌈'], name: 'Nuvem', color: 'text-sky-400' },
    { letter: 'O', correct: '🥚', options: ['🥚', '🍕', '🧀'], name: 'Ovo', color: 'text-yellow-300' },
    { letter: 'P', correct: '🐷', options: ['🐷', '🐮', '🐑'], name: 'Porco', color: 'text-pink-400' },
    { letter: 'Q', correct: '🧀', options: ['🧀', '🥚', '🍕'], name: 'Queijo', color: 'text-yellow-400' },
    { letter: 'R', correct: '⚡', options: ['⚡', '☁️', '🌈'], name: 'Relâmpago', color: 'text-yellow-500' },
    { letter: 'S', correct: '🐸', options: ['🐸', '🐢', '🦎'], name: 'Sapo', color: 'text-green-500' },
    { letter: 'T', correct: '🐢', options: ['🐢', '🐇', '🦔'], name: 'Tartaruga', color: 'text-emerald-600' },
    { letter: 'U', correct: '🐻', options: ['🐻', '🐼', '🐰'], name: 'Urso', color: 'text-amber-700' },
    { letter: 'V', correct: '🎻', options: ['🎻', '🎸', '🎺'], name: 'Violino', color: 'text-amber-600' },
    { letter: 'Z', correct: '🦓', options: ['🦓', '🦒', '🐘'], name: 'Zebra', color: 'text-gray-800' }
];

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered'))
      .catch(err => console.log('SW registration failed:', err));
  });
}

let currentLevelIndex = 0;
let score = 0;
let sessionLevels = [];
let isProcessing = false;
let currentMode = 'classic';
let attemptsLeft = 2;
let currentSyllables = [];
let selectedSyllables = [];

const screens = {
    start: document.getElementById('screen-start'),
    playing: document.getElementById('screen-playing'),
    success: document.getElementById('screen-success')
};

const elLetter = document.getElementById('display-letter');
const elLetterContainer = document.getElementById('display-letter-container');
const elEmojiContainer = document.getElementById('display-emoji-container');
const elEmoji = document.getElementById('display-emoji');
const elSyllablesContainer = document.getElementById('display-syllables-container');
const elWordPreview = document.getElementById('display-word-preview');
const elOptionsGrid = document.getElementById('options-grid');
const elSyllablesGrid = document.getElementById('syllables-grid');
const elFeedback = document.getElementById('feedback-text');
const elScore = document.getElementById('current-score');
const elProgress = document.getElementById('progress-bar');
const elPhase = document.getElementById('phase-counter');
const elAttempts = document.getElementById('attempts-display');
const elFinalScore = document.getElementById('final-score-display');
const elGameQuestion = document.getElementById('game-question');
const elHighScoresClassic = document.getElementById('high-scores-classic');
const elHighScoresSyllables = document.getElementById('high-scores-syllables');
const elModalQuit = document.getElementById('modal-quit');

const playSound = (type) => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        if (type === 'start') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.5);
        } else if (type === 'success') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
        } else if (type === 'error') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, ctx.currentTime);
        } else if (type === 'syllable') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
        }
        
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
    } catch (e) { console.error("Áudio não suportado"); }
};

const showScreen = (name) => {
    Object.keys(screens).forEach(key => {
        const screen = screens[key];
        const isActive = key === name;

        screen.classList.toggle('hidden-screen', !isActive);
        screen.style.display = isActive ? 'flex' : 'none';
    });
};

const updateHighScores = () => {
    const savedClassic = JSON.parse(localStorage.getItem('letras_magicas_recordes_classic') || '[]');
    const savedSyllables = JSON.parse(localStorage.getItem('letras_magicas_recordes_syllables') || '[]');
    
    elHighScoresClassic.innerHTML = savedClassic.length > 0 
        ? savedClassic.sort((a,b) => b-a).slice(0,3).map((s, i) => `
            <div class="flex justify-between bg-white/50 px-2 py-1 rounded-full border border-sky-200">
                <span>${i+1}º</span>
                <span>⭐ ${s}</span>
            </div>`).join('')
        : '<p class="text-sky-400 text-xs">Sem recordes</p>';
    
    elHighScoresSyllables.innerHTML = savedSyllables.length > 0 
        ? savedSyllables.sort((a,b) => b-a).slice(0,3).map((s, i) => `
            <div class="flex justify-between bg-white/50 px-2 py-1 rounded-full border border-purple-200">
                <span>${i+1}º</span>
                <span>⭐ ${s}</span>
            </div>`).join('')
        : '<p class="text-purple-400 text-xs">Sem recordes</p>';
};

const updateAttemptsDisplay = () => {
    elAttempts.innerHTML = '';
    for (let i = 0; i < 2; i++) {
        const heart = document.createElement('span');
        heart.className = 'text-lg';
        heart.innerText = i < attemptsLeft ? '❤️' : '🖤';
        elAttempts.appendChild(heart);
    }
};

const shuffleArray = (arr) => [...arr].sort(() => Math.random() - 0.5);

const initClassicLevel = () => {
    if (currentLevelIndex >= sessionLevels.length) {
        finishGame();
        return;
    }
    
    isProcessing = false;
    attemptsLeft = 2;
    updateAttemptsDisplay();
    
    const level = sessionLevels[currentLevelIndex];
    
    elLetterContainer.style.display = 'block';
    elEmojiContainer.style.display = 'none';
    elSyllablesContainer.style.display = 'none';
    elSyllablesGrid.style.display = 'none';
    elOptionsGrid.style.display = 'grid';
    
    elLetter.innerText = level.letter;
    elLetter.className = `text-5xl md:text-9xl font-black drop-shadow-lg animate-bounce ${level.color}`;
    
    elGameQuestion.innerText = 'Qual começa com esta letra?';
    elPhase.innerText = `Fase ${currentLevelIndex + 1} de ${sessionLevels.length}`;
    elProgress.style.width = `${(currentLevelIndex / sessionLevels.length) * 100}%`;
    
    elFeedback.className = "text-xl font-black transition-all scale-90 opacity-0";

    let options = [...level.options];
    if (!options.includes(level.correct)) {
        options[0] = level.correct;
    }
    options = shuffleArray(options);
    elOptionsGrid.innerHTML = '';
    
    options.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = "btn-emoji bg-white border-4 border-gray-100 hover:border-sky-300 rounded-3xl p-4 text-6xl shadow-sm transition-all";
        btn.innerText = emoji;
        btn.onclick = () => {
            if (isProcessing) return;
            
            if (emoji === level.correct) {
                handleClassicCorrect(level, attemptsLeft === 2);
            } else {
                handleClassicWrong();
            }
        };
        elOptionsGrid.appendChild(btn);
    });
};

const handleClassicCorrect = (level, firstAttempt) => {
    isProcessing = true;
    playSound('success');
    score += firstAttempt ? 10 : 5;
    elScore.innerText = score;
    elFeedback.innerText = firstAttempt ? `Muito bem! É o ${level.name}! ✨` : `Boa! É o ${level.name}! 🎉`;
    elFeedback.className = "text-xl font-black scale-110 opacity-100 text-green-500 animate-pop";
    
    setTimeout(() => {
        currentLevelIndex++;
        initClassicLevel();
    }, 1500);
};

const handleClassicWrong = () => {
    playSound('error');
    attemptsLeft--;
    updateAttemptsDisplay();
    
    if (attemptsLeft <= 0) {
        const level = sessionLevels[currentLevelIndex];
        elFeedback.innerText = "Quase! A resposta era...";
        elFeedback.className = "text-xl font-black scale-110 opacity-100 text-orange-400";
        
        Array.from(elOptionsGrid.querySelectorAll('button')).forEach(btn => {
            if (btn.innerText === level.correct) {
                btn.classList.add('border-green-500', 'bg-green-100');
            } else {
                btn.disabled = true;
                btn.classList.add('opacity-40');
            }
        });
        
        setTimeout(() => {
            currentLevelIndex++;
            initClassicLevel();
        }, 1500);
    } else {
        elFeedback.innerText = `Tenta outra vez! (${attemptsLeft} tentativa${attemptsLeft > 1 ? 's' : ''}) 😊`;
        elFeedback.className = "text-xl font-black scale-110 opacity-100 text-orange-400 shake";
        setTimeout(() => {
            elFeedback.className = "text-xl font-black scale-90 opacity-0";
        }, 1000);
    }
};

const initSyllablesLevel = () => {
    if (currentLevelIndex >= sessionLevels.length) {
        finishGame();
        return;
    }
    
    isProcessing = false;
    attemptsLeft = 2;
    selectedSyllables = [];
    updateAttemptsDisplay();
    
    const level = sessionLevels[currentLevelIndex];
    currentSyllables = [...level.syllables];
    
    elLetterContainer.style.display = 'none';
    elEmojiContainer.style.display = 'block';
    elSyllablesContainer.style.display = 'block';
    elSyllablesGrid.style.display = 'grid';
    elOptionsGrid.style.display = 'none';
    
    elEmoji.innerText = level.correct;
    elGameQuestion.innerText = `Forma a palavra: ${level.name}`;
    elPhase.innerText = `Fase ${currentLevelIndex + 1} de ${sessionLevels.length}`;
    elProgress.style.width = `${(currentLevelIndex / sessionLevels.length) * 100}%`;
    
    elFeedback.className = "text-xl font-black transition-all scale-90 opacity-0";
    updateWordPreview();

    const allSyllables = shuffleArray([...level.syllables, ...level.distractors.slice(0, 3)]);
    elSyllablesGrid.innerHTML = '';
    
    allSyllables.forEach(syllable => {
        const btn = document.createElement('button');
        btn.className = "bg-white border-4 border-purple-200 hover:border-purple-400 rounded-2xl p-3 text-2xl font-black text-purple-700 shadow-sm transition-all active:scale-95";
        btn.innerText = syllable;
        btn.onclick = () => handleSyllableClick(syllable, btn);
        elSyllablesGrid.appendChild(btn);
    });
};

const updateWordPreview = () => {
    elWordPreview.innerHTML = selectedSyllables.map((s, i) => `
        <span class="inline-block bg-purple-100 border-2 border-purple-300 rounded-xl px-3 py-2 text-3xl font-black text-purple-700 animate-pop">
            ${s}
        </span>
    `).join('');
};

const handleSyllableClick = (syllable, btn) => {
    if (isProcessing) return;
    const level = sessionLevels[currentLevelIndex];
    const nextIndex = selectedSyllables.length;
    if (nextIndex >= currentSyllables.length) return;
    playSound('syllable');
    // Só aceita a sílaba correta na ordem correta
    if (syllable === currentSyllables[nextIndex]) {
        selectedSyllables.push(syllable);
        btn.disabled = true;
        btn.classList.add('opacity-30', 'cursor-not-allowed');
        updateWordPreview();
        if (selectedSyllables.length === currentSyllables.length) {
            // Só considera correto se a palavra formada for igual à correta
            if (selectedSyllables.join('') === currentSyllables.join('')) {
                handleSyllablesCorrect(level);
            } else {
                handleSyllablesWrong();
            }
        }
    } else {
        handleSyllablesWrong();
    }
};

const handleSyllablesCorrect = (level) => {
    isProcessing = true;
    playSound('success');
    score += 10;
    elScore.innerText = score;
    elFeedback.innerText = `Excelente! ${level.name}! ✨`;
    elFeedback.className = "text-xl font-black scale-110 opacity-100 text-green-500 animate-pop";
    
    setTimeout(() => {
        currentLevelIndex++;
        initSyllablesLevel();
    }, 1500);
};

const handleSyllablesWrong = () => {
    playSound('error');
    attemptsLeft--;
    updateAttemptsDisplay();
    
    if (attemptsLeft <= 0) {
        const level = sessionLevels[currentLevelIndex];
        elFeedback.innerText = `A palavra era: ${level.name}`;
        elFeedback.className = "text-xl font-black scale-110 opacity-100 text-orange-400";
        
        setTimeout(() => {
            selectedSyllables = [...currentSyllables];
            updateWordPreview();
            
            setTimeout(() => {
                currentLevelIndex++;
                initSyllablesLevel();
            }, 1500);
        }, 1000);
    } else {
        elFeedback.innerText = `Não é bem assim... tenta outra vez! (${attemptsLeft}) 😊`;
        elFeedback.className = "text-xl font-black scale-110 opacity-100 text-orange-400 shake";
        setTimeout(() => {
            elFeedback.className = "text-xl font-black scale-90 opacity-0";
        }, 1000);
    }
};

const finishGame = () => {
    playSound('success');
    const bonus = score > 0 ? 50 : 0;
    const final = score + bonus;
    elFinalScore.innerText = `⭐ ${final}`;
    
    const storageKey = currentMode === 'classic' 
        ? 'letras_magicas_recordes_classic' 
        : 'letras_magicas_recordes_syllables';
    
    let saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    saved.push(final);
    localStorage.setItem(storageKey, JSON.stringify([...new Set(saved)].sort((a,b)=>b-a).slice(0,5)));
    
    showScreen('success');
};

const startGame = (mode) => {
    playSound('start');
    score = 0;
    currentLevelIndex = 0;
    currentMode = mode;
    elScore.innerText = "0";
    if (mode === 'classic') {
        sessionLevels = shuffleArray([...classicLibrary]);
        showScreen('playing');
        initClassicLevel();
    } else {
        sessionLevels = shuffleArray([...library]).slice(0, 20);
        showScreen('playing');
        initSyllablesLevel();
    }
};

document.getElementById('btn-start-classic').onclick = () => startGame('classic');
document.getElementById('btn-start-syllables').onclick = () => startGame('syllables');

document.getElementById('btn-restart').onclick = () => {
    updateHighScores();
    showScreen('start');
};

document.getElementById('btn-quit').onclick = () => {
    elModalQuit.classList.remove('hidden');
};

document.getElementById('btn-quit-cancel').onclick = () => {
    elModalQuit.classList.add('hidden');
};

document.getElementById('btn-quit-confirm').onclick = () => {
    elModalQuit.classList.add('hidden');
    updateHighScores();
    showScreen('start');
};

window.onload = updateHighScores;
