import {
  Air,
  Brick,
  Dirt,
  Grass,
  INVENTORY_SLOTS,
  REACH_TILES,
  Stone,
  Wood,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./model.js";
import type {
  BlockId,
  PlayerState,
  TileChange,
  TileRejection,
} from "./model.js";
import {
  insideWorld,
  isSolid,
  tileAt,
  tileIndex,
  withinReachTiles,
} from "./physics.js";

export type TileResult =
  | Readonly<{
      ok: true;
      tiles: readonly BlockId[];
      change: TileChange;
      collected: BlockId;
    }>
  | Readonly<{ ok: false; reason: TileRejection }>;

export const createWorldTiles = (): readonly BlockId[] => {
  const tiles: BlockId[] = Array.from(
    { length: WORLD_WIDTH * WORLD_HEIGHT },
    () => Air
  );

  const groundRow = WORLD_HEIGHT - 2;

  for (let ty = groundRow; ty < WORLD_HEIGHT; ty += 1) {
    for (let tx = 0; tx < WORLD_WIDTH; tx += 1) {
      tiles[tileIndex(tx, ty)] = ty === groundRow ? Grass : Dirt;
    }
  }

  for (let tx = 8; tx <= 13; tx += 1) {
    tiles[tileIndex(tx, groundRow - 4)] = Stone;
  }

  for (let tx = 30; tx <= 33; tx += 1) {
    tiles[tileIndex(tx, groundRow - 6)] = Wood;
  }

  for (let ty = groundRow - 6; ty <= groundRow - 1; ty += 1) {
    tiles[tileIndex(33, ty)] = Wood;
  }

  tiles[tileIndex(20, groundRow - 1)] = Brick;
  tiles[tileIndex(21, groundRow - 1)] = Brick;

  return tiles;
};

export const emptyInventory = (): readonly number[] =>
  Array.from({ length: INVENTORY_SLOTS }, () => 0);

export const inventoryCount = (
  counts: readonly number[],
  block: BlockId
): number => counts[block] ?? 0;

export const addToInventory = (
  counts: readonly number[],
  block: BlockId,
  quantity: number
): readonly number[] => {
  const next = [...counts];

  next[block] = inventoryCount(next, block) + quantity;

  return next;
};

export const takeFromInventory = (
  counts: readonly number[],
  block: BlockId
): readonly number[] | undefined => {
  const held = inventoryCount(counts, block);

  if (held < 1) {
    return undefined;
  }

  const next = [...counts];

  next[block] = held - 1;

  return next;
};

export const canBreak = (
  tiles: readonly BlockId[],
  player: Readonly<Pick<PlayerState, "x" | "y">>,
  tx: number,
  ty: number
): TileRejection | undefined => {
  if (!insideWorld(tx, ty)) {
    return "out-of-bounds";
  }

  if (!isSolid(tileAt(tiles, tx, ty))) {
    return "empty";
  }

  if (!withinReachTiles(REACH_TILES, player, tx, ty)) {
    return "out-of-reach";
  }

  return undefined;
};

export const canPlace = (
  tiles: readonly BlockId[],
  player: Readonly<Pick<PlayerState, "x" | "y">>,
  tx: number,
  ty: number
): TileRejection | undefined => {
  if (!insideWorld(tx, ty)) {
    return "out-of-bounds";
  }

  if (isSolid(tileAt(tiles, tx, ty))) {
    return "occupied";
  }

  if (!withinReachTiles(REACH_TILES, player, tx, ty)) {
    return "out-of-reach";
  }

  return undefined;
};

export const breakTile = (
  tiles: readonly BlockId[],
  player: Readonly<Pick<PlayerState, "x" | "y">>,
  tx: number,
  ty: number
): TileResult => {
  const rejection = canBreak(tiles, player, tx, ty);

  if (rejection !== undefined) {
    return { ok: false, reason: rejection };
  }

  const next = [...tiles];
  const collected = tileAt(tiles, tx, ty);

  next[tileIndex(tx, ty)] = Air;

  return {
    change: { block: Air, tx, ty },
    collected,
    ok: true,
    tiles: next,
  };
};

export const placeTile = (
  tiles: readonly BlockId[],
  player: Readonly<Pick<PlayerState, "x" | "y">>,
  tx: number,
  ty: number,
  block: BlockId
): TileResult => {
  const rejection = block === Air ? "empty" : canPlace(tiles, player, tx, ty);

  if (rejection !== undefined) {
    return { ok: false, reason: rejection };
  }

  const next = [...tiles];

  next[tileIndex(tx, ty)] = block;

  return {
    change: { block, tx, ty },
    collected: Air,
    ok: true,
    tiles: next,
  };
};
