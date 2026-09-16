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

export const CONSONANTS = ['б', 'в', 'г', 'д', 'ж', 'з', 'й', 'к', 'л', 'м', 'н', 'п', 'р', 'с', 'т', 'ф', 'х', 'ц', 'ч', 'ш', 'щ'];
export const VOWELS = ['а', 'е', 'ё', 'и', 'о', 'у', 'ы', 'э', 'ю', 'я'];
export const SIGNS = ['ъ', 'ь'];

// A Level is defined purely by enabled-letter-count: this is the highest-priority
// letter not yet enabled, so leveling up always grows the set by exactly one.
export function nextLetterToEnable(enabledLetters, order = LETTER_ENABLE_ORDER) {
  return order.find((letter) => !enabledLetters.includes(letter)) ?? null;
}

export function splitLettersByType(letters) {
  return {
    consonants: letters.filter((letter) => CONSONANTS.includes(letter)),
    vowels: letters.filter((letter) => VOWELS.includes(letter)),
    signs: letters.filter((letter) => SIGNS.includes(letter)),
  };
}

// Every letter has a checkbox as of #7's full 33-letter toggle list, so this
// reduces to "match checked state" in practice; the checkboxLetters param and
// its untouched-if-absent branch stay in case some future set of enabled
// letters isn't fully checkbox-backed again.
export function reconcileEnabledLetters(enabledLetters, checkboxLetters, checkedLetters) {
  const kept = enabledLetters.filter((letter) => !checkboxLetters.includes(letter) || checkedLetters.includes(letter));
  const added = checkedLetters.filter((letter) => !kept.includes(letter));
  return [...kept, ...added];
}

export const BATCH_SIZE = 15;
export const LEVEL_UP_THRESHOLD = 13;

export function advanceBatch(batch, correct) {
  const next = { correct: batch.correct + (correct ? 1 : 0), total: batch.total + 1 };
  if (next.total < BATCH_SIZE) {
    return { batch: next, leveledUp: false };
  }
  return { batch: { correct: 0, total: 0 }, leveledUp: next.correct >= LEVEL_UP_THRESHOLD };
}

// A syllable is a consonant plus either a vowel or a sign (ъ/ь).
export function buildEnabledSyllables(enabledLetters) {
  const { consonants, vowels, signs } = splitLettersByType(enabledLetters);
  return buildSyllableSet(consonants, [...vowels, ...signs]);
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

// A syllable that has never been wrong still needs some chance of
// resurfacing, so weight is never allowed to bottom out at zero.
const FLOOR_WEIGHT = 0.15;

function statsFor(stats, syllable) {
  return stats[syllable] ?? { attempts: 0, correct: 0 };
}

export function weightForSyllable(stats, syllable) {
  const { attempts, correct } = statsFor(stats, syllable);
  const errorRate = attempts > 0 ? (attempts - correct) / attempts : 1;
  return FLOOR_WEIGHT + errorRate;
}

export function pickWeightedTarget(enabledSyllables, stats, rng = Math.random) {
  if (enabledSyllables.length === 0) return null;

  const weights = enabledSyllables.map((syllable) => weightForSyllable(stats, syllable));
  const total = weights.reduce((sum, w) => sum + w, 0);

  let threshold = rng() * total;
  for (let i = 0; i < enabledSyllables.length; i++) {
    threshold -= weights[i];
    if (threshold < 0) return enabledSyllables[i];
  }
  return enabledSyllables[enabledSyllables.length - 1];
}

export function recordAttempt(stats, syllable, correct) {
  const entry = statsFor(stats, syllable);
  return {
    ...stats,
    [syllable]: {
      attempts: entry.attempts + 1,
      correct: entry.correct + (correct ? 1 : 0),
    },
  };
}

// speechSynthesis.getVoices() lists every installed voice regardless of
// language; TTS stays silent when none of them is Russian.
export function pickRussianVoice(voices) {
  return voices.find((voice) => voice.lang.toLowerCase().startsWith('ru')) ?? null;
}

function shuffle(array, rng) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
