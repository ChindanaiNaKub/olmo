# 0002 — Block hardness is authoritative

- Status: accepted
- Date: 2026-10-23

## Context

`punch` currently removes a tile on the first call. Growtopia's blocks take repeated punches and show damage as they go. That rhythm, not the pixel art, is what makes breaking feel like work.

Three implementations were considered: keep one-punch break and add feedback only; track hits on the client; or track hits on the server.

A client-side hit counter desyncs whenever two players punch the same tile, and disagrees with the server after a rejected punch. It was rejected. Feedback-only fixes the read but not the rhythm.

## Decision

A block carries a hardness: air 0, dirt 1, grass 1, wood 2, stone 3, brick 3. `World` keeps transient per-tile hit progress, keyed by tile index, in memory only. Each accepted punch increments the progress and broadcasts `TileCracked { tx, ty, hits }`. The punch that reaches hardness removes the tile, adds one to the inventory, and broadcasts `TileChanged` as today.

Hit progress is not persisted and is not part of a snapshot. It resets lazily: a punch on a tile whose last hit is older than 1.5 seconds starts from zero. No timers, no cleanup pass.

The server stays authoritative. Hardness lives in `packages/game` so both sides agree on the number, and the client draws the crack stage from `hits` plus its local copy of the hardness table.

The RPC projection has no push channel, so `punchBlock` returns the tile as it now is: the unchanged solid block for a crack, air for a break. A caller who needs crack stages uses the socket.

## Consequences

- One new server message, one new domain table, one new field of transient Durable Object state.
- A property test is required: for every block type and every player position in reach, `hardness - 1` punches leave the tile unchanged and the inventory alone, and the `hardness`-th punch returns the tile to air and adds exactly one.
- Transient state is lost on Durable Object eviction. A half-cracked tile heals. That is acceptable: progress within 1.5 seconds is not worth persisting, and persisting it would write storage on every punch.
- Placing a block on a cracked tile is impossible while it is solid, so no reset path is needed for `place`.

## Reversal

If hardness turns out to be noise, set every block to 1. The contract, the message, and the tests stay; only the table changes.
