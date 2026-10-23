# 0003 — The client predicts the crack and the server corrects it

- Status: accepted
- Date: 2026-10-23

## Context

With authoritative hardness, a punch costs one round trip. On localhost that is invisible. Between two friends on a deployed URL it is 80–150 ms per punch, so a three-hit block shows three late crack stages. The result reads as lag, not as work.

The client already predicts its own movement and accepts `Corrected` when the server disagrees. That pattern is proven in this codebase and is the only prediction model in it.

## Decision

Reuse the movement pattern for punches.

The client keeps an optimistic hit count per tile and advances the crack on click, before the server answers. `TileCracked` from the server raises the local count to the server's value and never lowers it, because damage must not appear to heal while a prediction is still in flight. `Rejected` clears the local count for every tile, so an out-of-reach or no-inventory punch visibly undoes itself. `TileChanged` clears the count and marks the tile air, which is the same end state the server reached.

The optimistic count lives in the Foldkit Model as plain schema-validated data. It is view state, not authority: nothing reads it to decide whether a block is gone.

## Consequences

- A rejected punch is now visible as a crack that snaps back. That is the honest failure, and it is better than a delayed one.
- The client must not let optimistic hits cross the hardness boundary and remove a tile locally. The tile disappears only on `TileChanged`.
- One more map in the Model and one reconcile branch in `update`. No new Command and no new transport message.

## Reversal

If the reconcile branch grows conditionals for lag compensation, delete the optimistic count and accept pure authority. The server contract does not change either way.
