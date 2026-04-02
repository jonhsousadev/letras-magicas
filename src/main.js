import './style.css';
import libraryData from './assets/data.json';

const library = libraryData;

const classicLibrary = library.map(({ letter, correct, options, name, color, gender }) => ({
    letter,
    correct,
    options,
    name,
    color,
    gender
}));

const getDefiniteArticle = (gender) => (gender === 'feminino' ? 'a' : 'o');

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
let deferredInstallPrompt = null;

const INSTALL_BANNER_DISMISSED_AT_KEY = 'letras_magicas_install_banner_dismissed_at';
const INSTALL_BANNER_COOLDOWN_DAYS = 7;

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
const elInstallBanner = document.getElementById('install-banner');
const elInstallBannerText = document.getElementById('install-banner-text');
const elBtnInstallApp = document.getElementById('btn-install-app');
const elBtnDismissInstall = document.getElementById('btn-dismiss-install');

let audioCtx = null;

const getAudioContext = () => {
    if (audioCtx) return audioCtx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioCtx = new AudioCtx();
    return audioCtx;
};

const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
    }
};

const playTone = (ctx, { type = 'sine', from = 440, to = 440, duration = 0.18, volume = 0.1 }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    if (to !== from) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
};

const playSound = (type) => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            // Browsers bloqueiam áudio até interação do usuário.
            ctx.resume().catch(() => {});
        }

        if (type === 'start') {
            playTone(ctx, { type: 'sine', from: 440, to: 880, duration: 0.25, volume: 0.08 });
            return;
        }

        if (type === 'syllable') {
            playTone(ctx, { type: 'triangle', from: 620, to: 820, duration: 0.12, volume: 0.07 });
            return;
        }

        if (type === 'success' || type === 'win') {
            playTone(ctx, { type: 'triangle', from: 523.25, to: 659.25, duration: 0.14, volume: 0.09 });
            setTimeout(() => playTone(ctx, { type: 'triangle', from: 659.25, to: 783.99, duration: 0.16, volume: 0.09 }), 80);
            return;
        }

        if (type === 'lose') {
            playTone(ctx, { type: 'sawtooth', from: 220, to: 130, duration: 0.24, volume: 0.08 });
            return;
        }

        if (type === 'error') {
            playTone(ctx, { type: 'sawtooth', from: 180, to: 120, duration: 0.16, volume: 0.07 });
        }
    } catch (e) {
        console.error('Áudio não suportado');
    }
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

const isStandaloneMode = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const isMobileDevice = () => {
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const hasTouch = navigator.maxTouchPoints > 0;
    const mobileUA = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return coarsePointer || hasTouch || mobileUA;
};

const isIOS = () => {
    const isClassicIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return isClassicIOS || isIPadOS;
};

const isInstallBannerCooldownActive = () => {
    const dismissedAt = Number(localStorage.getItem(INSTALL_BANNER_DISMISSED_AT_KEY) || 0);
    if (!dismissedAt) return false;

    const cooldownMs = INSTALL_BANNER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    return (Date.now() - dismissedAt) < cooldownMs;
};

const shouldHideInstallBanner = () => {
    const dismissed = isInstallBannerCooldownActive();
    return dismissed || isStandaloneMode() || !isMobileDevice();
};

const showInstallBanner = (message, isActionableInstall) => {
    if (!elInstallBanner) return;
    elInstallBanner.classList.remove('hidden');
    if (message && elInstallBannerText) {
        elInstallBannerText.innerText = message;
    }
    if (elBtnInstallApp) {
        elBtnInstallApp.style.display = 'inline-flex';
        elBtnInstallApp.innerText = isActionableInstall ? 'Instalar' : 'Como instalar';
    }
};

const setupInstallBanner = () => {
    if (!elInstallBanner || shouldHideInstallBanner()) {
        return;
    }

    if (isIOS()) {
        showInstallBanner('No Safari, toca em Partilhar e depois em "Adicionar ao ecrã principal".', false);
        return;
    }

    showInstallBanner('Fica mais rápido de abrir e funciona melhor em ecrã cheio.', false);
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
    const article = getDefiniteArticle(level.gender);
    elFeedback.innerText = firstAttempt ? `Muito bem! É ${article} ${level.name}! ✨` : `Boa! É ${article} ${level.name}! 🎉`;
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
        btn.className = "syllable-btn bg-white border-4 border-purple-200 hover:border-purple-400 rounded-2xl p-3 text-2xl font-black text-purple-700 shadow-sm transition-all active:scale-95";
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
    playSound('win');
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
    attemptsLeft--;
    if (attemptsLeft <= 0) {
        playSound('lose');
    } else {
        playSound('error');
    }
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
    elModalQuit.classList.add('hidden');
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

document.getElementById('btn-start-classic').onclick = () => {
    unlockAudio();
    startGame('classic');
};
document.getElementById('btn-start-syllables').onclick = () => {
    unlockAudio();
    startGame('syllables');
};

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

elModalQuit.onclick = (event) => {
    if (event.target === elModalQuit) {
        elModalQuit.classList.add('hidden');
    }
};

window.addEventListener('keydown', (event) => {
    unlockAudio();
    if (event.key === 'Escape') {
        elModalQuit.classList.add('hidden');
    }
});

window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('touchstart', unlockAudio, { passive: true });

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;

    if (!shouldHideInstallBanner()) {
        showInstallBanner('Fica mais rápido de abrir e funciona melhor em ecrã cheio.', true);
    }
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    localStorage.setItem(INSTALL_BANNER_DISMISSED_AT_KEY, Date.now().toString());
    if (elInstallBanner) {
        elInstallBanner.classList.add('hidden');
    }
});

if (elBtnInstallApp) {
    elBtnInstallApp.onclick = async () => {
        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            const choice = await deferredInstallPrompt.userChoice;
            if (choice && choice.outcome !== 'accepted') {
                showInstallBanner('Quando quiseres, podes instalar por este botão.', true);
            }
            deferredInstallPrompt = null;
            return;
        }

        if (isIOS()) {
            showInstallBanner('No Safari: toca em Partilhar e depois em "Adicionar ao ecrã principal".', false);
            return;
        }

        showInstallBanner('Abre o menu do navegador e procura por "Instalar app" ou "Adicionar ao ecrã inicial".', false);
    };
}

if (elBtnDismissInstall) {
    elBtnDismissInstall.onclick = () => {
        localStorage.setItem(INSTALL_BANNER_DISMISSED_AT_KEY, Date.now().toString());
        if (elInstallBanner) {
            elInstallBanner.classList.add('hidden');
        }
    };
}

const initializeApp = () => {
    updateHighScores();
    setupInstallBanner();
};

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
