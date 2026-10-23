# 0005 — Audio is CC0 files played through WebAudio

- Status: accepted
- Date: 2026-10-23

## Context

Sound is most of what makes a punch land. A synthesized punch through an oscillator always sounds like a synthesizer. Olmo currently ships no audio.

The repository already carries binary assets (`assets/fonts`, `assets/emoji`), so a small audio directory is not a new kind of file for the project.

## Decision

Six one-shot sounds and one quiet loop, all CC0, stored in `assets/audio/`: hit, break, place, jump, join, error, and ambient. They are decoded with `AudioContext.decodeAudioData` and played from a Command, not from the view.

Audio starts only after the first user gesture, because browsers block autoplay. The join screen's "Enter world" click is that gesture.

A missing or failed decode must not break the game: sound is best-effort, and the failure is silent.

## Consequences

- New binary assets. Each file needs its CC0 provenance recorded in `PROVENANCE.md` and its license note next to it.
- No new dependency; WebAudio is platform.
- Sounds must tolerate overlapping triggers. Breaking a tile while jumping plays both; no mixer is needed for seven sounds, just a gain node per play.

## Reversal

If licensing becomes a burden, drop to three sounds (hit, break, place) or synthesize. The call site does not change.
