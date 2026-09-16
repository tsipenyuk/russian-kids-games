import { buildSyllableSet, assignZones, pickFallingSyllable } from './logic.js';

const consonantInputs = [...document.querySelectorAll('[data-consonant]')];
const vowelInputs = [...document.querySelectorAll('[data-vowel]')];
const speedInput = document.getElementById('speed');
const emptyWarning = document.getElementById('emptyWarning');
const fallingEl = document.getElementById('fallingSyllable');
const zoneEls = [...document.querySelectorAll('.zone')];

const MIN_DURATION_S = 1.5;
const MAX_DURATION_S = 6;

let running = false;

function enabledConsonants() {
    return consonantInputs.filter((el) => el.checked).map((el) => el.dataset.consonant);
}

function enabledVowels() {
    return vowelInputs.filter((el) => el.checked).map((el) => el.dataset.vowel);
}

function fallDurationSeconds() {
    const value = Number(speedInput.value);
    const span = MAX_DURATION_S - MIN_DURATION_S;
    const steps = Number(speedInput.max) - Number(speedInput.min);
    return MAX_DURATION_S - ((value - Number(speedInput.min)) / steps) * span;
}

function renderZones(assignment) {
    for (const zoneEl of zoneEls) {
        const zone = zoneEl.dataset.zone;
        const syllable = assignment[zone];
        zoneEl.querySelector('span').textContent = syllable ?? '';
        zoneEl.classList.toggle('empty', syllable === null);
    }
}

function startRound() {
    const enabled = buildSyllableSet(enabledConsonants(), enabledVowels());

    if (enabled.length === 0) {
        running = false;
        emptyWarning.hidden = false;
        fallingEl.textContent = '';
        renderZones({ up: null, down: null, left: null, right: null, center: null });
        return;
    }

    running = true;
    emptyWarning.hidden = true;

    const assignment = assignZones(enabled);
    renderZones(assignment);

    const target = pickFallingSyllable(assignment);
    fallingEl.textContent = target;

    fallingEl.classList.remove('falling');
    // Force reflow so the animation restarts from the top each round.
    void fallingEl.offsetWidth;
    fallingEl.style.animationDuration = `${fallDurationSeconds()}s`;
    fallingEl.classList.add('falling');
}

fallingEl.addEventListener('animationend', startRound);

for (const el of [...consonantInputs, ...vowelInputs]) {
    el.addEventListener('change', () => {
        if (!running) startRound();
    });
}

startRound();
