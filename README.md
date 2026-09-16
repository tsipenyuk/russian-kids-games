# Russian Kids Games

Small browser games for a kid learning Cyrillic letters and syllables. No
build step, no framework — plain HTML, CSS, and JavaScript, published as a
static site on GitHub Pages.

## Games

- **[Учим буквы](typing/index.html)** — a Cyrillic letter shows on screen,
  the kid presses the matching key on a keyboard set to Russian.
- **[Прыгающие слоги](falling-syllables/index.html)** — a Russian syllable
  falls down the screen; the kid reads it and jumps onto the matching zone
  drawn on the floor (up/down/left/right/center, dance-mat style).

## Running locally

No build step. Open `index.html` directly in a browser, or serve the folder
with any static file server, e.g. `npx serve`.

## Tests

The falling-syllables game's round logic (which syllables are in play, and
how they're assigned to zones) is covered by unit tests using Node's built-in
test runner:

```
npm test
```

## Glossary (falling-syllables game)

- **Zone** — one of the 5 positions (up, down, left, right, center) a
  syllable can be assigned to, mirrored both on screen and as physical
  markings on the floor. Arranged in a dance-mat-style plus shape.
- **Round** — one cycle of the game: a syllable appears at the top, falls for
  a fixed duration, and the game auto-advances to the next round when it
  reaches the bottom.
- **Enabled syllable set** — the syllables currently available for play,
  built from the consonants and vowels a parent has checked in the picker
  (default: п/б/м × а/е/и/о/у, 15 syllables).
- **Zone assignment** — the mapping, re-rolled at the start of every round,
  of up to 5 syllables from the enabled set onto the 5 zones. If fewer than 5
  syllables are enabled, the remaining zones are hidden for that round rather
  than repeating a label.
