import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SLOT_COUNT,
  buildSyllableSet,
  pickDistractors,
  buildRoundSlots,
  LETTER_ENABLE_ORDER,
  topNLetters,
  weightForSyllable,
  pickWeightedTarget,
  recordAttempt,
  CONSONANTS,
  VOWELS,
  SIGNS,
  BATCH_SIZE,
  LEVEL_UP_THRESHOLD,
  advanceBatch,
  nextLetterToEnable,
  splitLettersByType,
  reconcileEnabledLetters,
} from './logic.js';

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

test('advanceBatch increments total and correct without completing the batch', () => {
  const { batch, leveledUp } = advanceBatch({ correct: 3, total: 5 }, true);
  assert.deepEqual(batch, { correct: 4, total: 6 });
  assert.equal(leveledUp, false);
});

test('advanceBatch increments only total on a wrong round', () => {
  const { batch, leveledUp } = advanceBatch({ correct: 3, total: 5 }, false);
  assert.deepEqual(batch, { correct: 3, total: 6 });
  assert.equal(leveledUp, false);
});

test('advanceBatch resets to 0/BATCH_SIZE once the batch completes, regardless of outcome', () => {
  const passing = advanceBatch({ correct: 12, total: BATCH_SIZE - 1 }, true);
  assert.deepEqual(passing.batch, { correct: 0, total: 0 });

  const failing = advanceBatch({ correct: 5, total: BATCH_SIZE - 1 }, false);
  assert.deepEqual(failing.batch, { correct: 0, total: 0 });
});

test('advanceBatch levels up at exactly the LEVEL_UP_THRESHOLD', () => {
  const atThreshold = advanceBatch({ correct: LEVEL_UP_THRESHOLD - 1, total: BATCH_SIZE - 1 }, true);
  assert.equal(atThreshold.leveledUp, true);

  const belowThreshold = advanceBatch({ correct: LEVEL_UP_THRESHOLD - 1, total: BATCH_SIZE - 1 }, false);
  assert.equal(belowThreshold.leveledUp, false);
});

test('advanceBatch does not mutate the input batch', () => {
  const batch = { correct: 3, total: 5 };
  advanceBatch(batch, true);
  assert.deepEqual(batch, { correct: 3, total: 5 });
});

test('nextLetterToEnable returns the highest-priority letter not already enabled', () => {
  const enabled = ['а', 'о']; // first two of LETTER_ENABLE_ORDER
  assert.equal(nextLetterToEnable(enabled), 'в');
});

test('nextLetterToEnable ignores enabled-set ordering and hand-customization', () => {
  const enabled = ['ъ', 'ф', 'а']; // out-of-order, includes the lowest-priority letter
  assert.equal(nextLetterToEnable(enabled), 'о');
});

test('nextLetterToEnable returns null once every letter is enabled', () => {
  assert.equal(nextLetterToEnable(LETTER_ENABLE_ORDER), null);
});

test('nextLetterToEnable accepts a custom order', () => {
  assert.equal(nextLetterToEnable(['x'], ['x', 'y', 'z']), 'y');
});

test('splitLettersByType separates consonants from vowels and drops signs', () => {
  assert.deepEqual(
    splitLettersByType(['п', 'а', 'в', 'о', 'ь']),
    { consonants: ['п', 'в'], vowels: ['а', 'о'] }
  );
});

test('splitLettersByType preserves input order within each group', () => {
  assert.deepEqual(
    splitLettersByType(['о', 'в', 'а', 'п']),
    { consonants: ['в', 'п'], vowels: ['о', 'а'] }
  );
});

test('reconcileEnabledLetters drops a checkbox-backed letter once it is unchecked', () => {
  const result = reconcileEnabledLetters(['п', 'б', 'м'], ['п', 'б', 'м'], ['п', 'б']);
  assert.deepEqual(result, ['п', 'б']);
});

test('reconcileEnabledLetters adds a newly-checked letter', () => {
  const result = reconcileEnabledLetters(['п'], ['п', 'б'], ['п', 'б']);
  assert.deepEqual(result, ['п', 'б']);
});

test('reconcileEnabledLetters leaves letters with no checkbox untouched (e.g. leveled-up letters)', () => {
  const result = reconcileEnabledLetters(['п', 'б', 'в'], ['п', 'б'], ['п']);
  assert.deepEqual(result, ['п', 'в']);
});
