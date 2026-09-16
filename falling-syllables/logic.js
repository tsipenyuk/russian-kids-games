export const ZONES = ['up', 'down', 'left', 'right', 'center'];

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
