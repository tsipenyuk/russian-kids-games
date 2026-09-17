# Context: russian-kids-games

This repo is a single context: small browser games for a kid learning
Cyrillic letters and syllables. The terms below belong to the
falling-syllables game.

## Glossary

- **Slot** — one of the 4 on-screen answer buttons in a round. A Slot has
  no direction. It is only a button in a row.
- **Round** — one cycle of the game. A syllable falls, the kid answers or
  the syllable lands with no click, and the game scores the result and
  starts the next round.
- **Target syllable** — the syllable a round tests. It is the syllable
  that falls, and it fills the correct Slot.
- **Distractor** — a wrong-answer syllable. It fills a Slot that is not
  the target.
- **Enabled letter set** — the individual letters (consonants, vowels,
  and signs) a parent has turned on. The game builds syllables from a
  consonant plus either a vowel or a sign.
- **Level** — a number tied to the count of enabled letters. The count
  grows by one letter each time the kid levels up.
- **Batch** — a fixed window of 15 rounds. The game uses a Batch to
  decide when the kid levels up.
- **Weighted target selection** — the method the game uses to pick the
  target syllable. The method favors syllables with a higher rate of
  wrong answers, but every syllable keeps some chance to appear.

## Retired terms

- **Zone** and **Zone assignment** — from the falling-syllables v1
  physical dance-mat design. Replaced by **Slot**. See
  `docs/adr/0001-drop-dance-mat-design.md`.
- **Enabled syllable set** — replaced by **Enabled letter set**, since a
  syllable is now built from separate letters rather than picked from a
  pre-combined list.
