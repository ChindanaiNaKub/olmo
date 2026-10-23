import {
  BlockIdSchema,
  Dirt,
  INVENTORY_SLOTS,
  PlayerStateSchema,
} from "@olmo/game/model";
import { createWorldTiles } from "@olmo/game/world";
import { Schema } from "effect";
import type { Runtime } from "foldkit";

import type { Message } from "./message.js";

export const ConnectionSchema = Schema.Literals([
  "connecting",
  "live",
  "offline",
]);

export type Connection = typeof ConnectionSchema.Type;

export const ChatEntrySchema = Schema.Struct({
  color: Schema.String,
  name: Schema.String,
  text: Schema.String,
});

export type ChatEntry = typeof ChatEntrySchema.Type;

export const HitSchema = Schema.Struct({
  hits: Schema.Finite,
  tx: Schema.Finite,
  ty: Schema.Finite,
});

export type Hit = typeof HitSchema.Type;

export const BurstSchema = Schema.Struct({
  at: Schema.Finite,
  block: BlockIdSchema,
  tx: Schema.Finite,
  ty: Schema.Finite,
});

export type Burst = typeof BurstSchema.Type;

export const BURST_MS = 420;

export const ModelSchema = Schema.Struct({
  bursts: Schema.Array(BurstSchema),
  chat: Schema.Array(ChatEntrySchema),
  chatDraft: Schema.String,
  chatOpen: Schema.Boolean,
  connection: ConnectionSchema,
  counts: Schema.Array(Schema.Finite),
  error: Schema.NullOr(Schema.String),
  hits: Schema.Array(HitSchema),
  hover: Schema.NullOr(Schema.Struct({ x: Schema.Finite, y: Schema.Finite })),
  joined: Schema.Boolean,
  lastSent: Schema.Finite,
  name: Schema.String,
  nameDraft: Schema.String,
  now: Schema.Finite,
  players: Schema.Array(PlayerStateSchema),
  pressed: Schema.Struct({
    jump: Schema.Boolean,
    left: Schema.Boolean,
    right: Schema.Boolean,
  }),
  punchAt: Schema.Finite,
  selected: BlockIdSchema,
  self: Schema.NullOr(PlayerStateSchema),
  selfId: Schema.String,
  started: Schema.Boolean,
  tiles: Schema.Array(BlockIdSchema),
  world: Schema.String,
});

export type Model = typeof ModelSchema.Type;

export const NAME_STORAGE_KEY = "olmo.name";

const readStoredName = (): string => {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};

export const rememberName = (name: string): boolean => {
  try {
    localStorage.setItem(NAME_STORAGE_KEY, name);

    return true;
  } catch {
    return false;
  }
};

export const sanitizeWorld = (value: string): string => {
  const cleaned = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]/gu, "-")
    .replace(/^-+/u, "")
    .slice(0, 32);

  return cleaned.length === 0 ? "lobby" : cleaned;
};

export const worldFromLocation = (): string => {
  const parts = window.location.pathname
    .split("/")
    .filter((part) => part !== "");

  const candidate = parts[0] === "w" ? parts[1] : undefined;

  return sanitizeWorld(candidate ?? "lobby");
};

const syncLocation = (world: string): void => {
  if (window.location.pathname !== `/w/${world}`) {
    window.history.replaceState(null, "", `/w/${world}`);
  }
};

export const init: Runtime.ApplicationInit<Model, Message> = () => {
  const world = worldFromLocation();
  const name = readStoredName();

  syncLocation(world);

  return {
    model: {
      bursts: [],
      chat: [],
      chatDraft: "",
      chatOpen: false,
      connection: name.length > 0 ? "connecting" : "offline",
      counts: Array.from({ length: INVENTORY_SLOTS }, () => 0),
      error: null,
      hits: [],
      hover: null,
      joined: false,
      lastSent: 0,
      name,
      nameDraft: name,
      now: 0,
      players: [],
      pressed: { jump: false, left: false, right: false },
      punchAt: 0,
      selected: Dirt,
      self: null,
      selfId: "",
      started: name.length > 0,
      tiles: createWorldTiles(),
      world,
    },
  };
};
