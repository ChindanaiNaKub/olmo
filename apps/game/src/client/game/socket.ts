import { ServerMessageSchema } from "@olmo/game/model";
import type { ServerMessage } from "@olmo/game/model";
import type { Cause } from "effect";
import { Effect, Option, Queue, Schema, Stream } from "effect";
import { ManagedResource } from "foldkit";

import { GameMessage } from "./message.js";
import type { Message } from "./message.js";
import { worldFromLocation } from "./model.js";
import type { Model } from "./model.js";

export const GameSocket = ManagedResource.tag<WebSocket>()("GameSocket");

export type GameSocketService = ManagedResource.ServiceOf<typeof GameSocket>;

class SocketConnectionFailed extends Schema.TaggedError<SocketConnectionFailed>()(
  "SocketConnectionFailed",
  { message: Schema.String }
) {}

const apiUrl = (
  import.meta.env.VITE_API_URL ?? "http://localhost:1337"
).replace(/\/+$/u, "");

export const socketUrl = (world: string): string => {
  const url = new URL(`${apiUrl}/ws`);

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("world", world);

  return url.toString();
};

const decodeServerMessage = Schema.decodeUnknownOption(ServerMessageSchema);

const decodeErrorDetails = Schema.decodeUnknownOption(
  Schema.Struct({ message: Schema.String })
);

const parseServerMessage = (data: string): ServerMessage | undefined => {
  try {
    const parsed: unknown = JSON.parse(data);

    return Option.getOrUndefined(decodeServerMessage(parsed));
  } catch {
    return undefined;
  }
};

const offerMessage = (
  queue: Queue.Queue<Message, Cause.Done>,
  data: string
): void => {
  const message = parseServerMessage(data);

  if (message !== undefined) {
    Queue.offerUnsafe(queue, GameMessage.ReceivedServerMessage({ message }));
  }
};

const offerClose = (queue: Queue.Queue<Message, Cause.Done>): void => {
  Queue.offerUnsafe(queue, GameMessage.SocketClosed());
  Queue.endUnsafe(queue);
};

const offerError = (queue: Queue.Queue<Message, Cause.Done>): void => {
  Queue.offerUnsafe(
    queue,
    GameMessage.SocketFailed({ error: "Connection error" })
  );
  Queue.endUnsafe(queue);
};

export const managedResources = ManagedResource.make<Model, Message>()(
  (entry) => ({
    gameSocket: entry(Schema.Option(Schema.Null), {
      acquire: () =>
        Effect.callback<WebSocket, SocketConnectionFailed>((resume) => {
          const socket = new WebSocket(socketUrl(worldFromLocation()));
          const controller = new AbortController();
          const { signal } = controller;

          socket.addEventListener(
            "open",
            () => {
              controller.abort();
              resume(Effect.succeed(socket));
            },
            { signal }
          );
          socket.addEventListener(
            "error",
            () => {
              controller.abort();
              resume(
                Effect.fail(
                  new SocketConnectionFailed({
                    message: "Could not reach the game server",
                  })
                )
              );
            },
            { signal }
          );

          return Effect.sync(() => {
            controller.abort();
          });
        }),
      modelToMaybeRequirements: (model) =>
        model.started ? Option.some(null) : Option.none(),
      onAcquireError: (error) =>
        GameMessage.SocketFailed({
          error: Option.match(decodeErrorDetails(error), {
            onNone: () => "Could not reach the game server",
            onSome: ({ message }) => message,
          }),
        }),
      onAcquired: () => GameMessage.SocketOpened(),
      onReleased: () => GameMessage.SocketClosed(),
      release: (socket) =>
        Effect.sync(() => {
          socket.close();
        }),
      resource: GameSocket,
    }),
  })
);

export const streamSocketMessages = (
  socket: WebSocket
): Stream.Stream<Message> =>
  Stream.callback<Message>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const controller = new AbortController();
        const { signal } = controller;

        socket.addEventListener(
          "message",
          (event: MessageEvent<string>) => {
            offerMessage(queue, event.data);
          },
          { signal }
        );
        socket.addEventListener(
          "close",
          () => {
            offerClose(queue);
          },
          { signal }
        );
        socket.addEventListener(
          "error",
          () => {
            offerError(queue);
          },
          { signal }
        );

        return controller;
      }),
      (controller) =>
        Effect.sync(() => {
          controller.abort();
        })
    ).pipe(Effect.flatMap(() => Effect.never))
  );
