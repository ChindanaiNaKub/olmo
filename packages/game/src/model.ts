import { Schema } from "effect";

export const WORLD_WIDTH = 48;

export const WORLD_HEIGHT = 27;

export const TILE_SIZE = 24;

export const PLAYER_WIDTH = 18;

export const PLAYER_HEIGHT = 42;

export const GRAVITY = 1500;

export const MOVE_SPEED = 200;

export const JUMP_VELOCITY = -560;

export const MAX_FALL_SPEED = 900;

export const MAX_PLAYERS = 16;

export const REACH_TILES = 4;

export const MAX_CHAT_LENGTH = 120;

export const MAX_NAME_LENGTH = 16;

export const INVENTORY_SLOTS = 6;

export const Air = 0;

export const Dirt = 1;

export const Grass = 2;

export const Stone = 3;

export const Wood = 4;

export const Brick = 5;

export const BlockIdSchema = Schema.Literals([0, 1, 2, 3, 4, 5]);

export type BlockId = typeof BlockIdSchema.Type;

export const blockNames: Readonly<Record<BlockId, string>> = {
  0: "Air",
  1: "Dirt",
  2: "Grass",
  3: "Stone",
  4: "Wood",
  5: "Brick",
};

export const blockColors: Readonly<Record<BlockId, string>> = {
  0: "transparent",
  1: "#8a5a3b",
  2: "#4f9a42",
  3: "#7d8491",
  4: "#a9713f",
  5: "#b04a3c",
};

export const blockHardness: Readonly<Record<BlockId, number>> = {
  0: 0,
  1: 1,
  2: 1,
  3: 3,
  4: 2,
  5: 3,
};

export const inventorySlots: readonly BlockId[] = [
  Dirt,
  Grass,
  Stone,
  Wood,
  Brick,
  Air,
];

export const WorldNameSchema = Schema.String.check(
  Schema.isPattern(/^[a-z0-9][a-z0-9-]{0,31}$/u)
);

export type WorldName = typeof WorldNameSchema.Type;

export const PlayerNameSchema = Schema.String.check(
  Schema.isPattern(/^[^\n\r\t]{1,16}$/u)
);

export type PlayerName = typeof PlayerNameSchema.Type;

export const ChatTextSchema = Schema.String.check(
  Schema.isPattern(/^[^\n\r\t]{1,120}$/u)
);

export type ChatText = typeof ChatTextSchema.Type;

export const FacingSchema = Schema.Literals(["left", "right"]);

export type Facing = typeof FacingSchema.Type;

export const MoveIntentSchema = Schema.Struct({
  jump: Schema.Boolean,
  left: Schema.Boolean,
  right: Schema.Boolean,
});

export type MoveIntent = typeof MoveIntentSchema.Type;

export const PlayerStateSchema = Schema.Struct({
  color: Schema.String,
  facing: FacingSchema,
  grounded: Schema.Boolean,
  id: Schema.String,
  name: Schema.String,
  vx: Schema.Finite,
  vy: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
});

export type PlayerState = typeof PlayerStateSchema.Type;

export const WorldSnapshotSchema = Schema.Struct({
  height: Schema.Finite,
  name: Schema.String,
  players: Schema.Array(PlayerStateSchema),
  tiles: Schema.Array(BlockIdSchema),
  width: Schema.Finite,
});

export type WorldSnapshot = typeof WorldSnapshotSchema.Type;

export const WorldSummarySchema = Schema.Struct({
  height: Schema.Finite,
  name: Schema.String,
  width: Schema.Finite,
});

export type WorldSummary = typeof WorldSummarySchema.Type;

export const ClientMessageSchema = Schema.TaggedUnion({
  Chat: {
    text: ChatTextSchema,
  },
  Join: {
    name: PlayerNameSchema,
  },
  Move: {
    facing: FacingSchema,
    vx: Schema.Finite,
    vy: Schema.Finite,
    x: Schema.Finite,
    y: Schema.Finite,
  },
  Place: {
    block: BlockIdSchema,
    tx: Schema.Finite,
    ty: Schema.Finite,
  },
  Punch: {
    tx: Schema.Finite,
    ty: Schema.Finite,
  },
});

export type ClientMessage = typeof ClientMessageSchema.Type;

export const ServerMessageSchema = Schema.TaggedUnion({
  ChatLine: {
    color: Schema.String,
    name: Schema.String,
    text: Schema.String,
  },
  Corrected: {
    vx: Schema.Finite,
    vy: Schema.Finite,
    x: Schema.Finite,
    y: Schema.Finite,
  },
  Inventory: {
    counts: Schema.Array(Schema.Finite),
  },
  PlayerJoined: {
    player: PlayerStateSchema,
  },
  PlayerLeft: {
    id: Schema.String,
  },
  PlayerMoved: {
    player: PlayerStateSchema,
  },
  Rejected: {
    reason: Schema.String,
  },
  Snapshot: {
    snapshot: WorldSnapshotSchema,
    token: Schema.String,
    you: Schema.String,
  },
  TileChanged: {
    block: BlockIdSchema,
    tx: Schema.Finite,
    ty: Schema.Finite,
  },
  TileCracked: {
    hits: Schema.Finite,
    tx: Schema.Finite,
    ty: Schema.Finite,
  },
});

export type ServerMessage = typeof ServerMessageSchema.Type;

export const TileChangeSchema = Schema.Struct({
  block: BlockIdSchema,
  tx: Schema.Finite,
  ty: Schema.Finite,
});

export type TileChange = typeof TileChangeSchema.Type;

export const TileRejectionSchema = Schema.Literals([
  "out-of-bounds",
  "empty",
  "occupied",
  "out-of-reach",
  "no-inventory",
]);

export type TileRejection = typeof TileRejectionSchema.Type;
