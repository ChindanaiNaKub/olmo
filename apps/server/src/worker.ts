import {
  PlayerNotFound,
  TileRejected,
  createWorldContract,
  getWorldContract,
  placeBlockContract,
  punchBlockContract,
} from "@olmo/game/contracts";
import { WorldNameSchema } from "@olmo/game/model";
import type { TileChange } from "@olmo/game/model";
import { implement } from "@rat-stack/capability/implement";
import { toRpc } from "@rat-stack/capability/rpc";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect, Layer, Option, Schema } from "effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import { RpcSerialization, RpcServer } from "effect/rpc";

import { privateObservability } from "./observability.js";
// oxlint-disable-next-line unicorn/prefer-export-from -- Wrangler needs the Durable Object class exported from the Worker entry that also imports it.
import World from "./world-object.js";
import type { TileOutcome } from "./world-object.js";

const resolveOutcome = (
  action: "place" | "punch",
  playerId: string,
  outcome: TileOutcome
): Effect.Effect<TileChange, PlayerNotFound | TileRejected> => {
  if (outcome.ok) {
    return Effect.succeed(outcome.change);
  }

  if (outcome.reason === "player-not-found") {
    return Effect.fail(
      new PlayerNotFound({
        id: playerId,
        message: "That player is not in this world",
      })
    );
  }

  return Effect.fail(
    new TileRejected({
      message: `Cannot ${action}: ${outcome.reason}`,
      reason: outcome.reason,
    })
  );
};

export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  {
    dev: { port: 1337 },
    main: import.meta.url,
    observability: privateObservability,
  },
  Effect.gen(function* makeApi() {
    const worlds = yield* World;

    const capabilities = [
      implement(createWorldContract, ({ name }) =>
        worlds.getByName(name).ensure(name)
      ),
      implement(
        getWorldContract,
        ({ name }) => worlds.getByName(name).snapshot
      ),
      implement(punchBlockContract, ({ name, playerId, token, tx, ty }) =>
        worlds
          .getByName(name)
          .punch(playerId, token, tx, ty)
          .pipe(
            Effect.flatMap((outcome) =>
              resolveOutcome("punch", playerId, outcome)
            )
          )
      ),
      implement(
        placeBlockContract,
        ({ block, name, playerId, token, tx, ty }) =>
          worlds
            .getByName(name)
            .place(playerId, token, tx, ty, block)
            .pipe(
              Effect.flatMap((outcome) =>
                resolveOutcome("place", playerId, outcome)
              )
            )
      ),
    ] as const;

    const projection = toRpc(capabilities);

    const rpc = RpcServer.toHttpEffect(projection.group).pipe(
      Effect.provide(Layer.merge(projection.layer, RpcSerialization.layerJson))
    );

    return {
      fetch: Effect.gen(function* handleRequest() {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const url = new URL(request.url, "http://localhost");

        if (url.pathname === "/ws") {
          const raw = url.searchParams.get("world") ?? "lobby";

          const name = yield* Schema.decodeEffect(WorldNameSchema)(raw).pipe(
            Effect.option
          );

          if (Option.isNone(name)) {
            return HttpServerResponse.text("Invalid world name", {
              status: 400,
            });
          }

          return yield* worlds.getByName(name.value).fetch(request);
        }

        if (url.pathname === "/rpc") {
          const handler = yield* rpc;

          return yield* handler;
        }

        return HttpServerResponse.text("Not found", { status: 404 });
      }),
    };
  })
) {}

// oxlint-disable-next-line unicorn/prefer-export-from -- Wrangler needs the Durable Object class exported from the Worker entry that also imports it.
export { World };
