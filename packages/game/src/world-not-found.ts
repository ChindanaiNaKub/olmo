import { Schema } from "effect";

export class WorldNotFound extends Schema.TaggedError<WorldNotFound>()(
  "WorldNotFound",
  {
    message: Schema.String,
    world: Schema.String,
  }
) {}
