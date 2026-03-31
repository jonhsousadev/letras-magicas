import './style.css';
import libraryData from './assets/data.json';

const library = libraryData;

let currentLevelIndex = 0;
let score = 0;
let sessionLevels = [];
let isProcessing = false;

const screens = {
    start: document.getElementById('screen-start'),
    playing: document.getElementById('screen-playing'),
    success: document.getElementById('screen-success')
};
const elLetter = document.getElementById('display-letter');
const elOptionsGrid = document.getElementById('options-grid');
const elFeedback = document.getElementById('feedback-text');
const elScore = document.getElementById('current-score');
const elProgress = document.getElementById('progress-bar');
const elPhase = document.getElementById('phase-counter');
const elFinalScore = document.getElementById('final-score-display');
const elHighScoresList = document.getElementById('high-scores-list');

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
        }
        
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.5);
    } catch (e) { console.error("Áudio não suportado"); }
};

const showScreen = (name) => {
    Object.keys(screens).forEach(key => {
        screens[key].classList.toggle('hidden-screen', key !== name);
    });
};

const updateHighScores = () => {
    const saved = JSON.parse(localStorage.getItem('letras_magicas_recordes') || '[]');
    elHighScoresList.innerHTML = saved.length > 0 
        ? saved.sort((a,b) => b-a).slice(0,5).map((s, i) => `
            <div class="flex justify-between bg-white/50 px-4 py-1 rounded-full mb-1 border border-sky-200">
                <span>${i+1}º Lugar</span>
                <span>⭐ ${s}</span>
            </div>`).join('')
        : '<p class="text-sky-400 font-normal">Ainda não tens recordes. Começa a jogar!</p>';
};

const initLevel = () => {
    if (currentLevelIndex >= sessionLevels.length) {
        finishGame();
        return;
    }
    
    isProcessing = false;
    const level = sessionLevels[currentLevelIndex];
    
    elLetter.innerText = level.letter;
    elLetter.className = `text-9xl font-black drop-shadow-lg animate-bounce ${level.color}`;
    
    elPhase.innerText = `Fase ${currentLevelIndex + 1} de ${sessionLevels.length}`;
    elProgress.style.width = `${(currentLevelIndex / sessionLevels.length) * 100}%`;
    
    elFeedback.className = "text-xl font-black transition-all scale-90 opacity-0";

    const options = [...level.options].sort(() => Math.random() - 0.5);
    elOptionsGrid.innerHTML = '';
    
    options.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = "btn-emoji bg-white border-4 border-gray-100 hover:border-sky-300 rounded-3xl p-4 text-6xl shadow-sm transition-all";
        btn.innerText = emoji;
        btn.onclick = () => {
            if (isProcessing) return;
            
            if (emoji === level.correct) {
                handleCorrect(level);
            } else {
                handleWrong();
            }
        };
        elOptionsGrid.appendChild(btn);
    });
};

const handleCorrect = (level) => {
    isProcessing = true;
    playSound('success');
    score += 10;
    elScore.innerText = score;
    elFeedback.innerText = `Boa! ${level.letter} de ${level.name}! ✨`;
    elFeedback.className = "text-xl font-black scale-110 opacity-100 text-green-500 animate-pop";
    
    setTimeout(() => {
        currentLevelIndex++;
        initLevel();
    }, 1500);
};

const handleWrong = () => {
    playSound('error');
    elFeedback.innerText = "Tenta outra vez! 😊";
    elFeedback.className = "text-xl font-black scale-110 opacity-100 text-orange-400 shake";
    setTimeout(() => {
        elFeedback.className = "text-xl font-black scale-90 opacity-0";
    }, 1000);
};

const finishGame = () => {
    playSound('success');
    const bonus = score > 0 ? 50 : 0;
    const final = score + bonus;
    elFinalScore.innerText = `⭐ ${final}`;
    
    let saved = JSON.parse(localStorage.getItem('letras_magicas_recordes') || '[]');
    saved.push(final);
    localStorage.setItem('letras_magicas_recordes', JSON.stringify([...new Set(saved)].sort((a,b)=>b-a).slice(0,5)));
    
    showScreen('success');
};

document.getElementById('btn-start').onclick = () => {
    playSound('start');
    score = 0;
    currentLevelIndex = 0;
    elScore.innerText = "0";
    sessionLevels = [...library].sort(() => Math.random() - 0.5).slice(0, 20);
    showScreen('playing');
    initLevel();
};

document.getElementById('btn-restart').onclick = () => {
    updateHighScores();
    showScreen('start');
};

window.onload = updateHighScores;
