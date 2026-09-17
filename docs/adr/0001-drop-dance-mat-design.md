# ADR 0001: Drop the physical dance-mat framing

## Status

Accepted.

## Context

Falling-syllables v1 modeled its 5 answer positions as floor zones (up,
down, left, right, center) in a dance-mat layout. A parent judged whether
the physical jump of the kid matched the correct zone.

This design needed a parent to watch every round, and a floor mat set up
before play. It also gave the game no way to score attempts, or to track
which syllables the kid found difficult.

## Decision

Issue #1 replaced the floor zones with 4 on-screen answer buttons, called
Slots. A Slot has no direction or physical position. It is a button in a
row, and the kid clicks it to answer.

The game scores each click immediately and no longer needs a parent to
judge the round. This design removes the need for a parent, a floor mat,
or physical space to play.

## Consequences

- The game needs only a screen and a mouse or a touch screen.
- The game can score each round, and can track accuracy per syllable.
- A parent can still map the 4 Slots to floor positions if they want, but
  the game does not assume or require this.
- The terms **Zone** and **Zone assignment** are retired. The new term is
  **Slot**.
