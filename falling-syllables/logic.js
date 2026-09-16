export const SLOT_COUNT = 4;

// Extends the typing game's hand-curated keyboard-row enable order
// (typing/script.js's russianLetters) to the full 33-letter alphabet:
// dedupes its accidental repeat of н, inserts the letter it was missing (э)
// near the other rare vowels, and forces ъ to the very last position.
export const LETTER_ENABLE_ORDER = [
  'а', 'о', 'в', 'л', 'д', 'ж', 'ы', 'ф',
  'т', 'с', 'н', 'и', 'м', 'ь', 'б', 'я', 'ч', 'ю',
  'е', 'р', 'к', 'у', 'п', 'г', 'ш', 'щ', 'з', 'х', 'ц', 'й',
  'ё', 'э', 'ъ',
];

export function topNLetters(count) {
  return LETTER_ENABLE_ORDER.slice(0, count);
}

export function buildSyllableSet(consonants, vowels) {
  const syllables = [];
  for (const consonant of consonants) {
    for (const vowel of vowels) {
      syllables.push(consonant + vowel);
    }
  }
  return syllables;
}

export function pickTarget(enabledSyllables, rng = Math.random) {
  if (enabledSyllables.length === 0) return null;
  return enabledSyllables[Math.floor(rng() * enabledSyllables.length)];
}

export function pickDistractors(enabledSyllables, target, count, rng = Math.random) {
  const pool = enabledSyllables.filter((syllable) => syllable !== target);
  return shuffle(pool, rng).slice(0, count);
}

export function buildRoundSlots(target, distractors, { slotCount = SLOT_COUNT, rng = Math.random } = {}) {
  const filled = [target, ...distractors].slice(0, slotCount);
  const padded = filled.concat(new Array(Math.max(0, slotCount - filled.length)).fill(null));
  const slots = shuffle(padded, rng);
  return { slots, correctSlotIndex: slots.indexOf(target) };
}

function shuffle(array, rng) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
