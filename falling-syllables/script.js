import { buildSyllableSet, pickTarget, pickDistractors, buildRoundSlots, SLOT_COUNT } from './logic.js';

const consonantInputs = [...document.querySelectorAll('[data-consonant]')];
const vowelInputs = [...document.querySelectorAll('[data-vowel]')];
const speedInput = document.getElementById('speed');
const emptyWarning = document.getElementById('emptyWarning');
const fallingEl = document.getElementById('fallingSyllable');
const previewEl = document.getElementById('nextPreview');
const slotEls = [...document.querySelectorAll('.slot')];

const MIN_DURATION_S = 1.5;
const MAX_DURATION_S = 6;
const DISTRACTOR_COUNT = SLOT_COUNT - 1;
const FEEDBACK_DELAY_MS = 1000;

let running = false;
let resolved = false;
let correctSlotIndex = -1;
let queue = [];
let advanceTimer = null;

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

function enabledConsonants() {
    return consonantInputs.filter((el) => el.checked).map((el) => el.dataset.consonant);
}

function enabledVowels() {
    return vowelInputs.filter((el) => el.checked).map((el) => el.dataset.vowel);
}

function enabledSyllables() {
    return buildSyllableSet(enabledConsonants(), enabledVowels());
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

function resetQueue() {
    queue = [];
}

function ensureQueue(enabled) {
    if (queue.length < 2) {
        queue = [pickTarget(enabled), pickTarget(enabled)];
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
    const carried = enabled.includes(queue[1]) ? queue[1] : pickTarget(enabled);
    queue = [carried, pickTarget(enabled)];
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

    if (clickedIndex !== null && clickedIndex === correctSlotIndex) {
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

for (const el of [...consonantInputs, ...vowelInputs]) {
    el.addEventListener('change', () => {
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

startRound();
