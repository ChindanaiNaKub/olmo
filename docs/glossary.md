# Glossary

The words Olmo uses about itself, and the Growtopia words it deliberately does not use.

## Nouns

- **World** — one named room, one Durable Object, one 48×27 tile array. Reached at `/w/<name>`.
- **Session** — one joined player in a world: socket attachment, player state, inventory counts, owner flag, last-seen time.
- **Contract** — a capability's name, input, output, failure, and metadata, defined with `defineContract` in `packages/game`.
- **Capability** — one contract bound to one method on the `World` Durable Object.
- **Tile** — one cell of the tile array. Identified by `(tx, ty)` and stored by `tileIndex`.
- **Reach** — the four-tile radius around the player where punch and place are legal.
- **Hotbar** — the six slots below the stage. The slot order is fixed; each slot is one block type and its count.
- **Claim** — minting an owner key for a non-lobby world. The key lives in one browser.
- **Lock** — an owner's switch that stops everyone else from punching and placing. Not a padlock item.

## Terms introduced by the juice work

- **Hardness** — the number of punches a block absorbs before it breaks. Air 0, dirt 1, grass 1, wood 2, stone 3, brick 3.
- **Hit** — one accepted punch against a solid tile that does not yet break it.
- **Strike** — the punch that lands a hit. Distinct from break, which is the punch that removes the tile.
- **Crack stage** — the visual state of a damaged tile: `hits / hardness`, drawn as 2, 4, then 6 short dark lines.
- **Optimistic hit** — a hit the client counts locally before the server confirms it.
- **Echo** — the server's `TileCracked` for a hit, which overwrites the optimistic count.
- **Juice** — feedback that changes how an action reads without changing what the action does.
- **Grow loop** — seeds, real-time growth, harvesting, splicing. Deferred; see ADR 0001.

## Growtopia words not adopted

These are named so they stop leaking into design notes:

- **Seed / splice** — no seeds drop and nothing grows in v1.
- **Gem** — no currency, no economy.
- **Trade window** — no player-to-player trading, no items to trade.
- **Vending machine** — no shops.
- **World list / `/go`** — worlds are reached by URL. `/w/lobby` is the only implicit destination.
- **Friend list** — presence is per-world and ends when the tab closes.
- **Admin / moderator** — the owner lock is the only permission model.
