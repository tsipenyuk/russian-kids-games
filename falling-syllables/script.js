import { buildSyllableSet, pickWeightedTarget, pickDistractors, buildRoundSlots, recordAttempt, advanceBatch, nextLetterToEnable, splitLettersByType, reconcileEnabledLetters, SLOT_COUNT } from './logic.js';

const consonantInputs = [...document.querySelectorAll('[data-consonant]')];
const vowelInputs = [...document.querySelectorAll('[data-vowel]')];
const letterCheckboxes = [...consonantInputs, ...vowelInputs];
const speedInput = document.getElementById('speed');
const emptyWarning = document.getElementById('emptyWarning');
const fallingEl = document.getElementById('fallingSyllable');
const previewEl = document.getElementById('nextPreview');
const slotEls = [...document.querySelectorAll('.slot')];
const starEl = document.getElementById('star');
const levelNumberEl = document.getElementById('levelNumber');

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
    // First run: seed persisted state from whatever the checkboxes start out checked with.
    enabledLetters = letterCheckboxes.filter((el) => el.checked).map(letterOf);
    saveEnabledLetters();
} else {
    // Later runs: persisted state is authoritative, including for the checkbox-backed letters.
    applyEnabledLettersToCheckboxes();
}

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

// A checkbox's letter is whichever of the two data attributes it carries.
function letterOf(el) {
    return el.dataset.consonant ?? el.dataset.vowel;
}

function applyEnabledLettersToCheckboxes() {
    for (const el of letterCheckboxes) {
        el.checked = enabledLetters.includes(letterOf(el));
    }
}

function syncEnabledLettersFromCheckboxes() {
    const checkboxLetters = letterCheckboxes.map(letterOf);
    const checkedLetters = letterCheckboxes.filter((el) => el.checked).map(letterOf);
    enabledLetters = reconcileEnabledLetters(enabledLetters, checkboxLetters, checkedLetters);
    saveEnabledLetters();
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

function enabledSyllables() {
    const { consonants, vowels } = splitLettersByType(enabledLetters);
    return buildSyllableSet(consonants, vowels);
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
            enabledLetters = [...enabledLetters, letter];
            saveEnabledLetters();
            applyEnabledLettersToCheckboxes();
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

slotEls.forEach((slotEl, index) => {
    slotEl.addEventListener('click', () => {
        resolveRound(index);
    });
});

for (const el of letterCheckboxes) {
    el.addEventListener('change', () => {
        syncEnabledLettersFromCheckboxes();
        if (!running) {
            if (advanceTimer) {
                clearTimeout(advanceTimer);
                advanceTimer = null;
            }
            resetQueue();
            startRound();
        }
    });
}

starEl.addEventListener('click', () => {
    starEl.classList.remove('pop');
    // Force reflow so the animation restarts even on a rapid repeat click.
    void starEl.offsetWidth;
    starEl.classList.add('pop');
});

starEl.addEventListener('animationend', () => {
    starEl.classList.remove('pop');
});

renderLevel();
startRound();
