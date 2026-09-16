import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SLOT_COUNT,
  buildSyllableSet,
  pickTarget,
  pickDistractors,
  buildRoundSlots,
  LETTER_ENABLE_ORDER,
  topNLetters,
  weightForSyllable,
  pickWeightedTarget,
  recordAttempt,
} from './logic.js';

const CONSONANTS = ['б', 'в', 'г', 'д', 'ж', 'з', 'й', 'к', 'л', 'м', 'н', 'п', 'р', 'с', 'т', 'ф', 'х', 'ц', 'ч', 'ш', 'щ'];
const VOWELS = ['а', 'е', 'ё', 'и', 'о', 'у', 'ы', 'э', 'ю', 'я'];
const SIGNS = ['ъ', 'ь'];

function fakeRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

test('buildSyllableSet combines each consonant with each vowel, consonant-major order', () => {
  assert.deepEqual(
    buildSyllableSet(['п', 'м', 'б'], ['а', 'о', 'у']),
    ['па', 'по', 'пу', 'ма', 'мо', 'му', 'ба', 'бо', 'бу']
  );
});

test('buildSyllableSet works with a single consonant or vowel', () => {
  assert.deepEqual(buildSyllableSet(['п'], ['а', 'о']), ['па', 'по']);
  assert.deepEqual(buildSyllableSet([], ['а']), []);
});

test('pickTarget returns a member of the enabled syllables', () => {
  const enabled = ['па', 'по', 'пу'];
  for (let i = 0; i < 20; i++) {
    assert.ok(enabled.includes(pickTarget(enabled)));
  }
});

test('pickTarget returns null when nothing is enabled', () => {
  assert.equal(pickTarget([]), null);
});

test('pickTarget is deterministic given an injected rng', () => {
  const enabled = ['па', 'по', 'пу'];
  const a = pickTarget(enabled, fakeRng([0.5]));
  const b = pickTarget(enabled, fakeRng([0.5]));
  assert.equal(a, b);
});

test('pickDistractors excludes the target and returns distinct syllables', () => {
  const enabled = ['па', 'по', 'пу', 'ма', 'мо'];
  const distractors = pickDistractors(enabled, 'па', 3);

  assert.equal(distractors.length, 3);
  assert.ok(!distractors.includes('па'));
  assert.equal(new Set(distractors).size, 3);
  for (const d of distractors) {
    assert.ok(enabled.includes(d));
  }
});

test('pickDistractors returns fewer than requested when the pool is too small', () => {
  const enabled = ['па', 'по'];
  const distractors = pickDistractors(enabled, 'па', 3);
  assert.deepEqual(distractors, ['по']);
});

test('pickDistractors is deterministic given an injected rng', () => {
  const enabled = ['па', 'по', 'пу', 'ма'];
  const a = pickDistractors(enabled, 'па', 2, fakeRng([0.1, 0.4, 0.7]));
  const b = pickDistractors(enabled, 'па', 2, fakeRng([0.1, 0.4, 0.7]));
  assert.deepEqual(a, b);
});

test('buildRoundSlots fills all 4 slots when target plus 3 distractors are given', () => {
  const { slots, correctSlotIndex } = buildRoundSlots('па', ['по', 'пу', 'ма']);

  assert.equal(slots.length, SLOT_COUNT);
  assert.deepEqual([...slots].sort(), ['ма', 'по', 'пу', 'па'].sort());
  assert.equal(slots[correctSlotIndex], 'па');
});

test('buildRoundSlots hides unused slots when fewer than 4 syllables are given', () => {
  const { slots, correctSlotIndex } = buildRoundSlots('па', ['по']);

  assert.equal(slots.length, SLOT_COUNT);
  const filled = slots.filter((s) => s !== null);
  assert.equal(filled.length, 2);
  assert.equal(slots.filter((s) => s === null).length, 2);
  assert.equal(slots[correctSlotIndex], 'па');
});

test('buildRoundSlots is deterministic given an injected rng', () => {
  const a = buildRoundSlots('па', ['по', 'пу', 'ма'], { rng: fakeRng([0.9, 0.1, 0.5, 0.2]) });
  const b = buildRoundSlots('па', ['по', 'пу', 'ма'], { rng: fakeRng([0.9, 0.1, 0.5, 0.2]) });
  assert.deepEqual(a, b);
});

test('LETTER_ENABLE_ORDER covers all 33 Cyrillic letters exactly once', () => {
  assert.equal(LETTER_ENABLE_ORDER.length, 33);
  assert.equal(new Set(LETTER_ENABLE_ORDER).size, 33);
  const expected = [...CONSONANTS, ...VOWELS, ...SIGNS].sort();
  assert.deepEqual([...LETTER_ENABLE_ORDER].sort(), expected);
});

test('LETTER_ENABLE_ORDER contains 21 consonants, 10 vowels, and 2 signs', () => {
  assert.equal(LETTER_ENABLE_ORDER.filter((l) => CONSONANTS.includes(l)).length, 21);
  assert.equal(LETTER_ENABLE_ORDER.filter((l) => VOWELS.includes(l)).length, 10);
  assert.equal(LETTER_ENABLE_ORDER.filter((l) => SIGNS.includes(l)).length, 2);
});

test('LETTER_ENABLE_ORDER forces ъ to the very last position', () => {
  assert.equal(LETTER_ENABLE_ORDER[LETTER_ENABLE_ORDER.length - 1], 'ъ');
});

test('topNLetters returns the first N letters of the enable order', () => {
  assert.deepEqual(topNLetters(3), LETTER_ENABLE_ORDER.slice(0, 3));
  assert.deepEqual(topNLetters(8), LETTER_ENABLE_ORDER.slice(0, 8));
  assert.deepEqual(topNLetters(33), LETTER_ENABLE_ORDER);
});

test('topNLetters(33) includes ъ only as the last letter', () => {
  const top32 = topNLetters(32);
  assert.ok(!top32.includes('ъ'));
  const top33 = topNLetters(33);
  assert.equal(top33[32], 'ъ');
});

test('topNLetters never repeats a letter for any N from 3 to 33', () => {
  for (let n = 3; n <= 33; n++) {
    const letters = topNLetters(n);
    assert.equal(letters.length, n);
    assert.equal(new Set(letters).size, n);
  }
});

test('weightForSyllable gives a fully-wrong syllable more weight than a fully-correct one', () => {
  const wrong = weightForSyllable({ 'па': { attempts: 10, correct: 0 } }, 'па');
  const mastered = weightForSyllable({ 'па': { attempts: 10, correct: 10 } }, 'па');
  assert.ok(wrong > mastered);
});

test('weightForSyllable never returns zero, even for a fully mastered syllable', () => {
  assert.ok(weightForSyllable({ 'па': { attempts: 100, correct: 100 } }, 'па') > 0);
});

test('weightForSyllable treats an unseen syllable the same as a fully-wrong one', () => {
  const unseen = weightForSyllable({}, 'па');
  const fullyWrong = weightForSyllable({ 'па': { attempts: 5, correct: 0 } }, 'па');
  assert.equal(unseen, fullyWrong);
});

test('pickWeightedTarget returns a member of the enabled syllables', () => {
  const enabled = ['па', 'по', 'пу'];
  const stats = { 'по': { attempts: 4, correct: 1 } };
  for (let i = 0; i < 20; i++) {
    assert.ok(enabled.includes(pickWeightedTarget(enabled, stats)));
  }
});

test('pickWeightedTarget returns null when nothing is enabled', () => {
  assert.equal(pickWeightedTarget([], {}), null);
});

test('pickWeightedTarget is deterministic given an injected rng', () => {
  const enabled = ['па', 'по', 'пу'];
  const stats = { 'по': { attempts: 4, correct: 1 } };
  const a = pickWeightedTarget(enabled, stats, fakeRng([0.5]));
  const b = pickWeightedTarget(enabled, stats, fakeRng([0.5]));
  assert.equal(a, b);
});

test('pickWeightedTarget favors the higher-error syllable proportionally to its computed weight', () => {
  const enabled = ['па', 'по'];
  const stats = {
    'па': { attempts: 10, correct: 0 },  // fully wrong
    'по': { attempts: 10, correct: 10 }, // fully mastered
  };
  const wWrong = weightForSyllable(stats, 'па');
  const wMastered = weightForSyllable(stats, 'по');
  const total = wWrong + wMastered;

  assert.equal(pickWeightedTarget(enabled, stats, fakeRng([(wWrong - 0.001) / total])), 'па');
  assert.equal(pickWeightedTarget(enabled, stats, fakeRng([(wWrong + 0.001) / total])), 'по');
});

test('pickWeightedTarget still gives a fully mastered syllable a nonzero chance', () => {
  const enabled = ['по'];
  const stats = { 'по': { attempts: 50, correct: 50 } };
  assert.equal(pickWeightedTarget(enabled, stats, fakeRng([0.999])), 'по');
});

test('recordAttempt starts a new syllable at one attempt', () => {
  assert.deepEqual(recordAttempt({}, 'па', true), { 'па': { attempts: 1, correct: 1 } });
  assert.deepEqual(recordAttempt({}, 'па', false), { 'па': { attempts: 1, correct: 0 } });
});

test('recordAttempt increments existing stats without mutating the input', () => {
  const stats = { 'па': { attempts: 2, correct: 1 } };
  const next = recordAttempt(stats, 'па', true);
  assert.deepEqual(next, { 'па': { attempts: 3, correct: 2 } });
  assert.deepEqual(stats, { 'па': { attempts: 2, correct: 1 } });
});

test('recordAttempt leaves other syllables\' stats untouched', () => {
  const stats = { 'по': { attempts: 5, correct: 5 } };
  const next = recordAttempt(stats, 'па', false);
  assert.deepEqual(next, { 'по': { attempts: 5, correct: 5 }, 'па': { attempts: 1, correct: 0 } });
});
