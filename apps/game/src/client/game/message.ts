import { BlockIdSchema, ServerMessageSchema } from "@olmo/game/model";
import { Schema } from "effect";
import { defineMessageUnion } from "foldkit/message";

export const GameMessage = defineMessageUnion({
  ClaimedWorld: {},
  ClickedTile: { x: Schema.Finite, y: Schema.Finite },
  ClosedChat: {},
  HoveredTile: { x: Schema.Finite, y: Schema.Finite },
  LeftCanvas: {},
  OpenedChat: {},
  PressedKey: { key: Schema.String },
  ReceivedServerMessage: { message: ServerMessageSchema },
  ReleasedKey: { key: Schema.String },
  SelectedBlock: { block: BlockIdSchema },
  SentClientMessage: {},
  SocketClosed: {},
  SocketFailed: { error: Schema.String },
  SocketOpened: {},
  SubmittedChat: {},
  SubmittedName: {},
  Ticked: { deltaTime: Schema.Finite },
  ToggledWorldLock: {},
  UpdatedChatDraft: { value: Schema.String },
  UpdatedNameDraft: { value: Schema.String },
});

export type Message = typeof GameMessage.Type;
