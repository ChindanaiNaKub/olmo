import { ClientMessageSchema } from "@olmo/game/model";
import { Effect } from "effect";
import { Command } from "foldkit";

import { GameMessage } from "./message.js";
import { GameSocket } from "./socket.js";

export const SendClientMessage = Command.define("SendClientMessage", {
  args: { message: ClientMessageSchema },
  execute: ({ message }) =>
    GameSocket.get.pipe(
      Effect.flatMap((socket) =>
        Effect.sync(() => {
          socket.send(JSON.stringify(message));
        })
      ),
      Effect.catchTag("ResourceNotAvailable", () => Effect.void),
      Effect.map(() => GameMessage.SentClientMessage())
    ),
  messages: [GameMessage.SentClientMessage],
});
