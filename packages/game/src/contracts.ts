import { defineContract } from "@rat-stack/capability/contract";
import { Schema } from "effect";

import {
  BlockIdSchema,
  TileChangeSchema,
  WorldNameSchema,
  WorldSnapshotSchema,
  WorldSummarySchema,
} from "./model.js";
import { TileRejected } from "./tile-rejected.js";
import { WorldNotFound } from "./world-not-found.js";

export { TileRejected } from "./tile-rejected.js";

export { WorldNotFound } from "./world-not-found.js";

export class PlayerNotFound extends Schema.TaggedError<PlayerNotFound>()(
  "PlayerNotFound",
  {
    id: Schema.String,
    message: Schema.String,
  }
) {}

export const GameFailureSchema = Schema.Union([
  WorldNotFound,
  PlayerNotFound,
  TileRejected,
]);

export const createWorldContract = defineContract("createWorld", {
  annotations: { idempotent: true },
  description: "Create a named world or return the existing one",
  failure: WorldNotFound,
  input: Schema.Struct({ name: WorldNameSchema }),
  output: WorldSummarySchema,
});

export const getWorldContract = defineContract("getWorld", {
  annotations: { idempotent: true, readOnly: true },
  description: "Read a world's tiles and players",
  failure: WorldNotFound,
  input: Schema.Struct({ name: WorldNameSchema }),
  output: WorldSnapshotSchema,
});

export const punchBlockContract = defineContract("punchBlock", {
  annotations: { destructive: true },
  description: "Remove one block within a player's reach and collect it",
  failure: GameFailureSchema,
  input: Schema.Struct({
    name: WorldNameSchema,
    playerId: Schema.String,
    token: Schema.String,
    tx: Schema.Finite,
    ty: Schema.Finite,
  }),
  output: TileChangeSchema,
});

export const placeBlockContract = defineContract("placeBlock", {
  annotations: {},
  description: "Place one held block within a player's reach",
  failure: GameFailureSchema,
  input: Schema.Struct({
    block: BlockIdSchema,
    name: WorldNameSchema,
    playerId: Schema.String,
    token: Schema.String,
    tx: Schema.Finite,
    ty: Schema.Finite,
  }),
  output: TileChangeSchema,
});
