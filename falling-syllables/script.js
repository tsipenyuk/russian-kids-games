import { buildEnabledSyllables, pickWeightedTarget, pickDistractors, buildRoundSlots, recordAttempt, advanceBatch, nextLetterToEnable, reconcileEnabledLetters, pickRussianVoice, topNLetters, SLOT_COUNT } from './logic.js';

const letterCheckboxes = [...document.querySelectorAll('[data-letter]')];
const speedInput = document.getElementById('speed');
const emptyWarning = document.getElementById('emptyWarning');
const fallingEl = document.getElementById('fallingSyllable');
const previewEl = document.getElementById('nextPreview');
const slotEls = [...document.querySelectorAll('.slot')];
const starEl = document.getElementById('star');
const levelNumberEl = document.getElementById('levelNumber');
const openLettersBtn = document.getElementById('openLettersBtn');
const closeLettersBtn = document.getElementById('closeLettersBtn');
const lettersModal = document.getElementById('lettersModal');
const letterCountBadge = document.getElementById('letterCountBadge');
const letterCountInput = document.getElementById('letterCount');
const letterCountValueEl = document.getElementById('letterCountValue');

const MIN_DURATION_S = 1.5;
const MAX_DURATION_S = 6;
const DISTRACTOR_COUNT = SLOT_COUNT - 1;
const FEEDBACK_DELAY_MS = 1000;
const STATS_STORAGE_KEY = 'fallingSyllables.syllableStats';
const LEVEL_STORAGE_KEY = 'fallingSyllables.level';
const BATCH_STORAGE_KEY = 'fallingSyllables.batch';
const ENABLED_LETTERS_STORAGE_KEY = 'fallingSyllables.enabledLetters';

let running = false;
let resolved = false;
let correctSlotIndex = -1;
let queue = [];
let currentTarget = null;
let advanceTimer = null;
let stats = loadStats();
let level = loadLevel();
let batch = loadBatch();
let enabledLetters = loadEnabledLetters();

if (enabledLetters === null) {
    // First run: seed persisted state to the letter-count slider's own default.
    enabledLetters = topNLetters(Number(letterCountInput.value));
    saveEnabledLetters();
}
applyEnabledLettersToCheckboxes();

function loadStats() {
    try {
        const raw = localStorage.getItem(STATS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function saveStats() {
    try {
        localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
        // localStorage unavailable (e.g. private browsing quota) — stats just won't persist.
    }
}

function loadLevel() {
    try {
        const raw = localStorage.getItem(LEVEL_STORAGE_KEY);
        return raw ? Number(raw) : 1;
    } catch (e) {
        return 1;
    }
}

function saveLevel() {
    try {
        localStorage.setItem(LEVEL_STORAGE_KEY, String(level));
    } catch (e) {
        // localStorage unavailable — level just won't persist.
    }
}

function loadBatch() {
    try {
        const raw = localStorage.getItem(BATCH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : { correct: 0, total: 0 };
    } catch (e) {
        return { correct: 0, total: 0 };
    }
}

function saveBatch() {
    try {
        localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(batch));
    } catch (e) {
        // localStorage unavailable — batch progress just won't persist.
    }
}

function loadEnabledLetters() {
    try {
        const raw = localStorage.getItem(ENABLED_LETTERS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function saveEnabledLetters() {
    try {
        localStorage.setItem(ENABLED_LETTERS_STORAGE_KEY, JSON.stringify(enabledLetters));
    } catch (e) {
        // localStorage unavailable — the enabled letter set just won't persist.
    }
}

function letterOf(el) {
    return el.dataset.letter;
}

function applyEnabledLettersToCheckboxes() {
    for (const el of letterCheckboxes) {
        el.checked = enabledLetters.includes(letterOf(el));
    }
}

function renderLetterCount() {
    letterCountBadge.textContent = String(enabledLetters.length);
}

function renderLetterCountValue() {
    letterCountValueEl.textContent = letterCountInput.value;
}

// Single point of mutation for the enabled letter set, so every source
// (checkbox toggles, the slider's bulk-set, leveling up) stays consistent.
function setEnabledLetters(next) {
    enabledLetters = next;
    saveEnabledLetters();
    applyEnabledLettersToCheckboxes();
    renderLetterCount();
}

function syncEnabledLettersFromCheckboxes() {
    const checkboxLetters = letterCheckboxes.map(letterOf);
    const checkedLetters = letterCheckboxes.filter((el) => el.checked).map(letterOf);
    setEnabledLetters(reconcileEnabledLetters(enabledLetters, checkboxLetters, checkedLetters));
}

// Restart the current round immediately if idle, so a letter-set change is
// reflected right away instead of waiting out a round already in flight.
function restartIfIdle() {
    if (running) return;
    if (advanceTimer) {
        clearTimeout(advanceTimer);
        advanceTimer = null;
    }
    resetQueue();
    startRound();
}

let audioContext = null;

function getAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            audioContext = null;
        }
    }
    return audioContext;
}

function playTone(frequency, type, durationS) {
    const ctx = getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationS);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + durationS);
}

function playDing() {
    playTone(880, 'sine', 0.2);
}

function playBong() {
    playTone(180, 'sawtooth', 0.4);
}

function speak(text) {
    if (typeof speechSynthesis === 'undefined') return;
    const voice = pickRussianVoice(speechSynthesis.getVoices());
    if (!voice) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    speechSynthesis.speak(utterance);
}

function enabledSyllables() {
    return buildEnabledSyllables(enabledLetters);
}

function fallDurationSeconds() {
    const value = Number(speedInput.value);
    const span = MAX_DURATION_S - MIN_DURATION_S;
    const steps = Number(speedInput.max) - Number(speedInput.min);
    return MAX_DURATION_S - ((value - Number(speedInput.min)) / steps) * span;
}

function renderSlots(slots) {
    slotEls.forEach((slotEl, i) => {
        const syllable = slots[i] ?? null;
        slotEl.querySelector('span').textContent = syllable ?? '';
        slotEl.classList.remove('correct', 'wrong', 'reveal');
        slotEl.classList.toggle('empty', syllable === null);
        slotEl.disabled = syllable === null;
    });
}

function renderPreview() {
    previewEl.textContent = queue[1] ?? '';
}

function renderLevel() {
    levelNumberEl.textContent = String(level);
}

function resetQueue() {
    queue = [];
}

function ensureQueue(enabled) {
    if (queue.length < 2) {
        queue = [pickWeightedTarget(enabled, stats), pickWeightedTarget(enabled, stats)];
    }
}

function startRound() {
    const enabled = enabledSyllables();

    if (enabled.length === 0) {
        running = false;
        resetQueue();
        emptyWarning.hidden = false;
        fallingEl.textContent = '';
        fallingEl.classList.remove('falling', 'correct');
        renderSlots(new Array(SLOT_COUNT).fill(null));
        previewEl.textContent = '';
        return;
    }

    emptyWarning.hidden = true;
    ensureQueue(enabled);

    const target = queue[0];
    currentTarget = target;
    const distractors = pickDistractors(enabled, target, DISTRACTOR_COUNT);
    const built = buildRoundSlots(target, distractors);
    correctSlotIndex = built.correctSlotIndex;

    renderSlots(built.slots);
    renderPreview();

    running = true;
    resolved = false;

    fallingEl.textContent = target;
    fallingEl.classList.remove('falling', 'correct');
    // Force reflow so the animation restarts from the top each round.
    void fallingEl.offsetWidth;
    fallingEl.style.animationDuration = `${fallDurationSeconds()}s`;
    fallingEl.classList.add('falling');
}

function advanceQueue() {
    const enabled = enabledSyllables();
    // queue[1] was picked from whatever set was enabled when it was queued as a
    // preview; the enabled set can change mid-round (checkbox edits are deferred
    // while a round is running), so re-validate it before promoting it to target.
    const carried = enabled.includes(queue[1]) ? queue[1] : pickWeightedTarget(enabled, stats);
    queue = [carried, pickWeightedTarget(enabled, stats)];
}

function revealCorrectSlot() {
    const el = slotEls[correctSlotIndex];
    if (el) el.classList.add('reveal');
}

function resolveRound(clickedIndex) {
    if (!running || resolved) return;
    resolved = true;
    running = false;

    fallingEl.classList.remove('falling');

    const wasCorrect = clickedIndex !== null && clickedIndex === correctSlotIndex;
    stats = recordAttempt(stats, currentTarget, wasCorrect);
    saveStats();

    const { batch: nextBatch, leveledUp } = advanceBatch(batch, wasCorrect);
    batch = nextBatch;
    saveBatch();
    if (leveledUp) {
        const letter = nextLetterToEnable(enabledLetters);
        // No letter left to enable once all 33 are already on — Level stays
        // tied to enabled-letter-count, so there's nothing to level up to.
        if (letter) {
            setEnabledLetters([...enabledLetters, letter]);
            level += 1;
            saveLevel();
            renderLevel();
        }
    }

    if (wasCorrect) {
        playDing();
        slotEls[clickedIndex].classList.add('correct');
        fallingEl.classList.add('correct');
    } else {
        if (clickedIndex !== null) {
            playBong();
            slotEls[clickedIndex].classList.add('wrong');
        }
        revealCorrectSlot();
    }

    advanceTimer = setTimeout(() => {
        advanceTimer = null;
        advanceQueue();
        startRound();
    }, FEEDBACK_DELAY_MS);
}

fallingEl.addEventListener('animationend', () => {
    resolveRound(null);
});

fallingEl.addEventListener('click', () => {
    speak(fallingEl.textContent);
});

slotEls.forEach((slotEl, index) => {
    slotEl.addEventListener('click', () => {
        speak(slotEl.querySelector('span').textContent);
        resolveRound(index);
    });
});

for (const el of letterCheckboxes) {
    el.addEventListener('change', () => {
        syncEnabledLettersFromCheckboxes();
        restartIfIdle();
    });
}

openLettersBtn.addEventListener('click', () => {
    lettersModal.showModal();
});

closeLettersBtn.addEventListener('click', () => {
    lettersModal.close();
});

letterCountInput.addEventListener('input', renderLetterCountValue);

// Only the slider's release (not every drag tick) bulk-sets the toggle
// list; it stays a one-shot action, not a live sync with the toggles.
letterCountInput.addEventListener('change', () => {
    setEnabledLetters(topNLetters(Number(letterCountInput.value)));
    restartIfIdle();
});

starEl.addEventListener('click', () => {
    starEl.classList.remove('pop');
    // Force reflow so the animation restarts even on a rapid repeat click.
    void starEl.offsetWidth;
    starEl.classList.add('pop');
});

starEl.addEventListener('animationend', () => {
    starEl.classList.remove('pop');
});

renderLetterCountValue();
renderLetterCount();
renderLevel();
startRound();
