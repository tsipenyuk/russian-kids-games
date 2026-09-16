export const ZONES = ['up', 'down', 'left', 'right', 'center'];

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

export function assignZones(enabledSyllables, { zones = ZONES, rng = Math.random } = {}) {
  const picked = shuffle([...enabledSyllables], rng).slice(0, zones.length);
  const shuffledZones = shuffle([...zones], rng);

  const assignment = Object.fromEntries(zones.map((zone) => [zone, null]));
  picked.forEach((syllable, i) => {
    assignment[shuffledZones[i]] = syllable;
  });
  return assignment;
}

export function pickFallingSyllable(zoneAssignment, rng = Math.random) {
  const active = Object.values(zoneAssignment).filter((v) => v !== null);
  if (active.length === 0) return null;
  return active[Math.floor(rng() * active.length)];
}

function shuffle(array, rng) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
