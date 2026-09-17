# Russian Kids Games

Small browser games for a kid learning Cyrillic letters and syllables. No
build step, no framework — plain HTML, CSS, and JavaScript, published as a
static site on GitHub Pages.

## Games

- **[Учим буквы](typing/index.html)** — a Cyrillic letter shows on screen,
  the kid presses the matching key on a keyboard set to Russian.
- **[Прыгающие слоги](falling-syllables/index.html)** — a Russian syllable
  falls down the screen, and the kid clicks the matching answer among 4
  buttons. The game reads syllables aloud on click, tracks accuracy per
  syllable, and unlocks more letters as the kid improves.

## Running locally

No build step. Open `index.html` directly in a browser, or serve the folder
with any static file server, e.g. `npx serve`.

## Tests

Unit tests cover the falling-syllables game's round logic: which syllables
are in play, and how the game picks the target syllable and the wrong-answer
choices. The tests use Node's built-in test runner:

```
npm test
```

## Glossary

See [`CONTEXT.md`](CONTEXT.md) for the domain glossary and the retired
terms from the falling-syllables v1 design.
