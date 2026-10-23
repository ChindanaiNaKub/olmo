import {
  Air,
  ClientMessageSchema,
  MAX_CHAT_LENGTH,
  MAX_NAME_LENGTH,
  REACH_TILES,
  ServerMessageSchema,
  TILE_SIZE,
  inventorySlots,
} from "@olmo/game/model";
import type { PlayerState, ServerMessage } from "@olmo/game/model";
import {
  insideWorld,
  stepPlayer,
  tileAt,
  tileIndex,
  withinReachTiles,
} from "@olmo/game/physics";
import type { Update } from "foldkit";
import { modifyFields } from "foldkit/struct";

import { SendClientMessage } from "./command.js";
import { GameMessage } from "./message.js";
import type { Message } from "./message.js";
import type { ChatEntry, Model } from "./model.js";
import { rememberName } from "./model.js";
import type { GameSocketService } from "./socket.js";

type UpdateReturn = Update.Return<Model, Message, GameSocketService>;

const leftKeys = new Set(["a", "A", "ArrowLeft"]);

const rightKeys = new Set(["d", "D", "ArrowRight"]);

const jumpKeys = new Set([" ", "Spacebar", "w", "W", "ArrowUp"]);

const idle = { jump: false, left: false, right: false };

const upsertPlayer = (
  players: readonly PlayerState[],
  player: PlayerState
): readonly PlayerState[] =>
  players.some((candidate) => candidate.id === player.id)
    ? players.map((candidate) =>
        candidate.id === player.id ? player : candidate
      )
    : [...players, player];

const systemLine = (text: string): ChatEntry => ({
  color: "#cbd5e1",
  name: "system",
  text,
});

const setPressed = (model: Model, patch: Partial<Model["pressed"]>): Model =>
  modifyFields(model, { pressed: (pressed) => ({ ...pressed, ...patch }) });

const handleServerMessage = (
  model: Model,
  message: ServerMessage
): UpdateReturn =>
  ServerMessageSchema.match(message, {
    ChatLine: ({ color, name, text }) => ({
      model: modifyFields(model, {
        chat: (chat) => [...chat, { color, name, text }].slice(-40),
      }),
    }),

    Corrected: (corrected) => {
      if (model.self === null) {
        return { model };
      }

      return {
        model: modifyFields(model, {
          self: (self) =>
            self === null
              ? null
              : {
                  ...self,
                  vx: corrected.vx,
                  vy: corrected.vy,
                  x: corrected.x,
                  y: corrected.y,
                },
        }),
      };
    },

    Inventory: ({ counts }) => ({
      model: modifyFields(model, { counts: () => counts }),
    }),

    PlayerJoined: ({ player }) => ({
      model: modifyFields(model, {
        players: (players) => upsertPlayer(players, player),
      }),
    }),

    PlayerLeft: ({ id }) => ({
      model: modifyFields(model, {
        players: (players) => players.filter((player) => player.id !== id),
      }),
    }),

    PlayerMoved: ({ player }) => {
      if (player.id === model.selfId) {
        return { model };
      }

      return {
        model: modifyFields(model, {
          players: (players) => upsertPlayer(players, player),
        }),
      };
    },

    Rejected: ({ reason }) => ({
      model: modifyFields(model, {
        chat: (chat) => [...chat, systemLine(reason)].slice(-40),
      }),
    }),

    Snapshot: ({ snapshot, you }) => {
      const self = snapshot.players.find((player) => player.id === you) ?? null;

      return {
        model: modifyFields(model, {
          connection: () => "live",
          error: () => null,
          joined: () => true,
          players: () => snapshot.players,
          self: () => self,
          selfId: () => you,
          tiles: () => snapshot.tiles,
        }),
      };
    },

    TileChanged: ({ block, tx, ty }) => {
      const x = Math.floor(tx);
      const y = Math.floor(ty);

      if (!insideWorld(x, y)) {
        return { model };
      }

      const tiles = [...model.tiles];

      tiles[tileIndex(x, y)] = block;

      return { model: modifyFields(model, { tiles: () => tiles }) };
    },
  });

export const update = (model: Model, message: Message): UpdateReturn =>
  GameMessage.match<UpdateReturn>(message, {
    ClickedTile: ({ x, y }) => {
      const { self } = model;

      if (self === null || !model.joined) {
        return { model };
      }

      const tx = Math.floor(x / TILE_SIZE);
      const ty = Math.floor(y / TILE_SIZE);

      if (
        !insideWorld(tx, ty) ||
        !withinReachTiles(REACH_TILES, self, tx, ty)
      ) {
        return { model };
      }

      const existing = tileAt(model.tiles, tx, ty);

      if (existing === Air && model.selected === Air) {
        return { model };
      }

      const outbound =
        existing === Air
          ? ClientMessageSchema.cases.Place.make({
              block: model.selected,
              tx,
              ty,
            })
          : ClientMessageSchema.cases.Punch.make({ tx, ty });

      return {
        commands: [SendClientMessage({ message: outbound })],
        model,
      };
    },

    ClosedChat: () => ({
      model: modifyFields(model, {
        chatDraft: () => "",
        chatOpen: () => false,
        pressed: () => idle,
      }),
    }),

    HoveredTile: ({ x, y }) => {
      const tx = Math.floor(x / TILE_SIZE);
      const ty = Math.floor(y / TILE_SIZE);

      return {
        model: modifyFields(model, {
          hover: () => (insideWorld(tx, ty) ? { x: tx, y: ty } : null),
        }),
      };
    },

    LeftCanvas: () => ({ model: modifyFields(model, { hover: () => null }) }),

    OpenedChat: () => ({
      model: modifyFields(model, {
        chatOpen: () => true,
        pressed: () => idle,
      }),
    }),

    PressedKey: ({ key }) => {
      if (key === "Enter" && !model.chatOpen && model.started) {
        return {
          model: modifyFields(model, {
            chatOpen: () => true,
            pressed: () => idle,
          }),
        };
      }

      if (key === "Escape" && model.chatOpen) {
        return {
          model: modifyFields(model, {
            chatDraft: () => "",
            chatOpen: () => false,
          }),
        };
      }

      if (model.chatOpen || !model.started) {
        return { model };
      }

      const slot = inventorySlots.findIndex(
        (_block, index) => String(index + 1) === key
      );

      if (slot !== -1) {
        return {
          model: modifyFields(model, {
            selected: () => inventorySlots[slot] ?? Air,
          }),
        };
      }

      if (leftKeys.has(key)) {
        return { model: setPressed(model, { left: true }) };
      }

      if (rightKeys.has(key)) {
        return { model: setPressed(model, { right: true }) };
      }

      if (jumpKeys.has(key)) {
        return { model: setPressed(model, { jump: true }) };
      }

      return { model };
    },

    ReceivedServerMessage: ({ message: serverMessage }) =>
      handleServerMessage(model, serverMessage),

    ReleasedKey: ({ key }) => {
      if (key === "Enter" || key === "Escape") {
        return { model };
      }

      if (leftKeys.has(key)) {
        return { model: setPressed(model, { left: false }) };
      }

      if (rightKeys.has(key)) {
        return { model: setPressed(model, { right: false }) };
      }

      if (jumpKeys.has(key)) {
        return { model: setPressed(model, { jump: false }) };
      }

      return { model };
    },

    SelectedBlock: ({ block }) => ({
      model: modifyFields(model, { selected: () => block }),
    }),

    SentClientMessage: () => ({ model }),

    SocketClosed: () => ({
      model: modifyFields(model, {
        connection: () => "offline",
        error: () => "Connection closed. Reload to reconnect.",
        joined: () => false,
      }),
    }),

    SocketFailed: ({ error }) => ({
      model: modifyFields(model, {
        connection: () => "offline",
        error: () => error,
        joined: () => false,
      }),
    }),

    SocketOpened: () => {
      if (!model.started || model.name.length === 0 || model.joined) {
        return {
          model: modifyFields(model, { connection: () => "connecting" }),
        };
      }

      return {
        commands: [
          SendClientMessage({
            message: ClientMessageSchema.cases.Join.make({ name: model.name }),
          }),
        ],
        model: modifyFields(model, {
          connection: () => "connecting",
          joined: () => true,
        }),
      };
    },

    SubmittedChat: () => {
      const text = model.chatDraft.trim().slice(0, MAX_CHAT_LENGTH);

      if (text.length === 0) {
        return {
          model: modifyFields(model, {
            chatDraft: () => "",
            chatOpen: () => false,
          }),
        };
      }

      return {
        commands: [
          SendClientMessage({
            message: ClientMessageSchema.cases.Chat.make({ text }),
          }),
        ],
        model: modifyFields(model, {
          chatDraft: () => "",
          chatOpen: () => false,
        }),
      };
    },

    SubmittedName: () => {
      const name = model.nameDraft.trim().slice(0, MAX_NAME_LENGTH);

      if (name.length === 0) {
        return {
          model: modifyFields(model, {
            error: () => "Pick a name to enter the world",
          }),
        };
      }

      rememberName(name);

      return {
        model: modifyFields(model, {
          connection: () => "connecting",
          error: () => null,
          joined: () => false,
          name: () => name,
          nameDraft: () => name,
          started: () => true,
        }),
      };
    },

    Ticked: ({ deltaTime }) => {
      if (
        !model.started ||
        !model.joined ||
        model.connection !== "live" ||
        model.self === null
      ) {
        return { model };
      }

      const self = stepPlayer(
        model.tiles,
        model.self,
        model.pressed,
        Math.min(Math.max(deltaTime, 0), 50) / 1000
      );

      const now = performance.now();
      const shouldSend = now - model.lastSent >= 50;

      return {
        commands: shouldSend
          ? [
              SendClientMessage({
                message: ClientMessageSchema.cases.Move.make({
                  facing: self.facing,
                  vx: self.vx,
                  vy: self.vy,
                  x: self.x,
                  y: self.y,
                }),
              }),
            ]
          : [],
        model: modifyFields(model, {
          lastSent: () => (shouldSend ? now : model.lastSent),
          self: () => self,
        }),
      };
    },

    UpdatedChatDraft: ({ value }) => ({
      model: modifyFields(model, {
        chatDraft: () => value.slice(0, MAX_CHAT_LENGTH),
      }),
    }),

    UpdatedNameDraft: ({ value }) => ({
      model: modifyFields(model, {
        nameDraft: () => value.slice(0, MAX_NAME_LENGTH),
      }),
    }),
  });
