# 0004 — Art stays procedural

- Status: accepted
- Date: 2026-10-23

## Context

Growtopia's look is hand-drawn pixel art. Olmo draws with Foldkit's `Canvas`, which exposes exactly four shapes: `Rect`, `Circle`, `Path`, `Text`. There is no image shape, so bitmaps require either an absolutely positioned `<img>` layer over the canvas or dropping Foldkit's renderer.

Both were considered and rejected for v1. A second renderer means two coordinate systems to keep aligned for pointer-to-tile input, plus six block sprites and idle, walk, jump, and punch sheets that no one on this project is drawing. Replacing the renderer contradicts the thin-view rule in `AGENTS.md`.

## Decision

Art is procedural. Every visual is composed from canvas primitives in `view.ts`:

- 2 px near-black outlines on solid tiles, saturated palette, per-block face detail (grass blades, stone speckle, wood grain).
- A player built from five rectangles on a 3 px grid with a swinging punch arm, replacing the current rect-plus-circle.
- Sky as horizontal gradient bands, two parallax hill layers, and a sun.
- Crack stages drawn as two, four, then six short dark lines across the tile.

Animation state is derived from the existing animation-frame subscription (`Ticked`). No image assets, no new dependency, no new renderer.

## Consequences

- The ceiling is chunky-and-clean, not painted. Accepted: readability and rhythm carry the feel, not fidelity.
- Per-frame shape count grows. The scene is 48×27 tiles with a subset solid; drawing stays within a single canvas pass. If it ever stutters, caching static tiles into an offscreen canvas is the next step, not a sprite pipeline.
- Block face detail must keep the tile readable at 24 px. Detail that muddies the silhouette gets cut.

## Reversal

If the game later needs real sprites, that is a renderer decision, not a juice decision. Reopen this ADR rather than adding one `<img>` at a time.
