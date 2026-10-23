import { Effect, Option, Schema, Stream } from "effect";
import { Dom, Subscription } from "foldkit";

import { GameMessage } from "./message.js";
import type { Message } from "./message.js";
import type { Model } from "./model.js";
import { GameSocket, streamSocketMessages } from "./socket.js";
import type { GameSocketService } from "./socket.js";

const isTextTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

export const subscriptions = Subscription.make<
  Model,
  Message,
  GameSocketService
>()((entry) => ({
  frames: Subscription.animationFrameEntry({
    isActive: (model) =>
      model.started && model.joined && model.connection === "live",
    toMessage: (deltaTime) => GameMessage.Ticked({ deltaTime }),
  }),

  keys: Subscription.persistentEntry(
    Dom.streamFromEventFilterMapPreventDefault({
      filterMapEvent: (event) =>
        isTextTarget(event.target)
          ? Option.none()
          : Option.some(GameMessage.PressedKey({ key: event.key })),
      target: document,
      type: "keydown",
    })
  ),

  releasedKeys: Subscription.persistentEntry(
    Dom.streamFromEventFilterMap({
      filterMapEvent: (event) =>
        Option.some(GameMessage.ReleasedKey({ key: event.key })),
      target: document,
      type: "keyup",
    })
  ),

  serverMessages: entry(
    { listening: Schema.Boolean },
    {
      dependenciesToStream: ({ listening }) =>
        Stream.when(
          Stream.unwrap(
            GameSocket.get.pipe(
              Effect.map(streamSocketMessages),
              Effect.catchTag("ResourceNotAvailable", () =>
                Effect.succeed(Stream.empty)
              )
            )
          ),
          Effect.sync(() => listening)
        ),
      modelToDependencies: (model) => ({ listening: model.joined }),
    }
  ),
}));
