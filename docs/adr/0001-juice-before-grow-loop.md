# 0001 — Juice before the grow loop

- Status: accepted
- Date: 2026-10-23

## Context

The goal is to make Olmo feel closer to Growtopia. Growtopia's identity has four separable layers: moment-to-moment juice (break rhythm, sound, animation, lighting), the grow loop (seeds, real-time growth, splicing), the world system (signs, doors, world lists, `/go`), and the economy (gems, trading, shops, cosmetics).

`VISION.md` already excludes the economy and world discovery, and has no accounts to hang identity on. That removes two of the four layers from v1, not by accident but by design.

The cheapest layer is also the one that decides first impressions. A player's first sixty seconds are spent moving and punching. Nothing in the grow loop is visible in those seconds.

## Decision

Ship juice first, then a deliberately small slice of the grow loop, and treat the world system and economy as a different product.

Juice means: per-block hardness with crack stages, punch and break audio, break particles, a `+1` when a block is collected, a punch arm animation, tile outlines and face detail, a banded sky, and two parallax hill layers. It changes how the existing game reads. It adds no new nouns to the domain.

The grow-loop slice, when it comes, is one growable that needs only a stored timestamp. No seed catalog, no splice table, no item inventory.

## Consequences

- No new domain entities, no durable state beyond the tile array, no new capabilities.
- The deferred layers stay deferred. If juice is done well, players will ask for the economy and world list next; that is the correct time to reopen `VISION.md`, not now.
- The exit criterion is still the one in `VISION.md`: two browsers, one URL, see each other, build, reload, same tiles. Juice must not delay that.

## Reversal

If the deployed two-browser proof lands and the feel still misses, the grow loop is the next lever, not more polish on the same surfaces.
