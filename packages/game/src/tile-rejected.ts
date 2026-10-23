import { Schema } from "effect";

import { TileRejectionSchema } from "./model.js";

export class TileRejected extends Schema.TaggedError<TileRejected>()(
  "TileRejected",
  {
    message: Schema.String,
    reason: TileRejectionSchema,
  }
) {}
