import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ZONES,
  buildSyllableSet,
  assignZones,
  pickFallingSyllable,
  LETTER_ENABLE_ORDER,
  topNLetters,
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

test('assignZones fills all 5 zones when at least 5 syllables are enabled', () => {
  const enabled = ['па', 'по', 'пу', 'ма', 'мо', 'му', 'ба', 'бо', 'бу'];
  const assignment = assignZones(enabled);

  assert.deepEqual(Object.keys(assignment).sort(), [...ZONES].sort());
  const values = Object.values(assignment);
  assert.equal(values.filter((v) => v !== null).length, 5);
  for (const v of values) {
    assert.ok(enabled.includes(v));
  }
  assert.equal(new Set(values).size, 5, 'no zone repeats a syllable');
});

test('assignZones hides zones it cannot fill when fewer than 5 syllables are enabled', () => {
  const enabled = ['па', 'по', 'пу'];
  const assignment = assignZones(enabled);

  const filled = Object.values(assignment).filter((v) => v !== null);
  assert.equal(filled.length, 3);
  assert.deepEqual(filled.sort(), [...enabled].sort());
  const empty = Object.values(assignment).filter((v) => v === null);
  assert.equal(empty.length, 2);
});

test('assignZones leaves every zone empty when nothing is enabled', () => {
  const assignment = assignZones([]);
  assert.ok(Object.values(assignment).every((v) => v === null));
});

test('assignZones is deterministic given an injected rng', () => {
  const enabled = ['па', 'по', 'пу'];
  const rng = fakeRng([0, 0, 0, 0, 0, 0]);
  const a = assignZones(enabled, { rng: fakeRng([0, 0, 0, 0, 0, 0]) });
  const b = assignZones(enabled, { rng: fakeRng([0, 0, 0, 0, 0, 0]) });
  assert.deepEqual(a, b);
});

test('pickFallingSyllable returns one of the currently assigned zone syllables', () => {
  const assignment = { up: 'ма', down: null, left: 'па', right: null, center: 'бу' };
  for (let i = 0; i < 20; i++) {
    const picked = pickFallingSyllable(assignment);
    assert.ok(['ма', 'па', 'бу'].includes(picked));
  }
});

test('pickFallingSyllable returns null when every zone is empty', () => {
  const assignment = { up: null, down: null, left: null, right: null, center: null };
  assert.equal(pickFallingSyllable(assignment), null);
});

test('pickFallingSyllable is deterministic given an injected rng', () => {
  const assignment = { up: 'ма', down: 'па', left: null, right: null, center: null };
  const picked = pickFallingSyllable(assignment, fakeRng([0]));
  assert.equal(picked, 'ма');
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
