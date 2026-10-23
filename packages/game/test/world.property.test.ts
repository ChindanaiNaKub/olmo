import { describe, expect, it } from "@effect/vitest";
import { Arbitrary, Schema } from "effect";

import {
  Air,
  Brick,
  Dirt,
  Grass,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  Stone,
  TILE_SIZE,
  Wood,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  blockHardness,
} from "../src/model.js";
import type { BlockId } from "../src/model.js";
import {
  createPlayer,
  insideWorld,
  overlapsSolid,
  stepPlayer,
  tileAt,
  tileIndex,
} from "../src/physics.js";
import { createWorldTiles, placeTile, strikeTile } from "../src/world.js";

const offset = Arbitrary.schema(Schema.Int);

const flag = Arbitrary.schema(Schema.Boolean);

const finite = Arbitrary.schema(Schema.Finite);

const wrap = (value: number, size: number): number =>
  ((value % size) + size) % size;

describe("world rules", () => {
  it("starts every world with ground under the spawn", () => {
    const tiles = createWorldTiles();
    const player = createPlayer("spawn", "Tester", tiles);

    expect(tiles).toHaveLength(WORLD_WIDTH * WORLD_HEIGHT);
    expect(tiles[tileIndex(0, WORLD_HEIGHT - 2)]).toBe(Grass);
    expect(tiles[tileIndex(0, WORLD_HEIGHT - 1)]).toBe(Dirt);
    expect(overlapsSolid(tiles, player.x, player.y)).toBe(false);
  });

  it.prop(
    "breaking a reachable tile and placing the drop back restores the world",
    { dx: offset, dy: offset },
    ({ dx, dy }) => {
      const tiles = createWorldTiles();
      const player = createPlayer("roundtrip", "Tester", tiles);
      const baseTx = Math.floor(player.x / TILE_SIZE);
      const baseTy = Math.floor(player.y / TILE_SIZE);
      const tx = baseTx + wrap(dx, 5) - 2;
      const ty = baseTy + wrap(dy, 5) - 2;
      const block = tileAt(tiles, tx, ty);

      if (block === Air) {
        return;
      }

      const broken = strikeTile(
        tiles,
        player,
        tx,
        ty,
        blockHardness[block] - 1
      );

      if (broken.kind !== "broken") {
        return;
      }

      const restored = placeTile(
        broken.tiles,
        player,
        tx,
        ty,
        broken.collected
      );

      expect(restored.ok).toBe(true);

      if (restored.ok) {
        expect(restored.tiles).toStrictEqual(tiles);
      }
    }
  );

  it.prop(
    "one physics step from the spawn never enters a solid tile or leaves the world",
    { dt: finite, jump: flag, left: flag, right: flag },
    ({ dt, jump, left, right }) => {
      const tiles = createWorldTiles();
      const player = createPlayer("stepper", "Tester", tiles);

      const next = stepPlayer(
        tiles,
        player,
        { jump, left, right },
        Math.abs(dt) % 0.05
      );

      expect(overlapsSolid(tiles, next.x, next.y)).toBe(false);
      expect(next.x).toBeGreaterThanOrEqual(0);
      expect(next.y).toBeGreaterThanOrEqual(0);
      expect(next.x).toBeLessThanOrEqual(WORLD_WIDTH * TILE_SIZE);
      expect(next.y).toBeLessThanOrEqual(WORLD_HEIGHT * TILE_SIZE);
    }
  );
});

const reachableCell = () => {
  const tiles = createWorldTiles();
  const player = createPlayer("hardness", "Tester", tiles);
  const baseTx = Math.floor((player.x + PLAYER_WIDTH / 2) / TILE_SIZE);
  const baseTy = Math.floor((player.y + PLAYER_HEIGHT / 2) / TILE_SIZE);

  return { player, tx: baseTx + 2, ty: baseTy - 1 };
};

const withBlock = (block: BlockId) => {
  const { player, tx, ty } = reachableCell();
  const tiles = [...createWorldTiles()];

  tiles[tileIndex(tx, ty)] = block;

  return { player, tiles, tx, ty };
};

describe("block hardness", () => {
  it("breaks dirt and grass on the first punch", () => {
    for (const block of [Dirt, Grass] as const) {
      const { player, tiles, tx, ty } = withBlock(block);

      expect(insideWorld(tx, ty)).toBe(true);
      expect(strikeTile(tiles, player, tx, ty, 0).kind).toBe("broken");
    }
  });

  it("takes two punches for wood and three for stone and brick", () => {
    const tiers: readonly { block: BlockId; punches: number }[] = [
      { block: Wood, punches: 2 },
      { block: Stone, punches: 3 },
      { block: Brick, punches: 3 },
    ];

    for (const { block, punches } of tiers) {
      const { player, tiles, tx, ty } = withBlock(block);

      for (let hit = 0; hit < punches - 1; hit += 1) {
        expect(strikeTile(tiles, player, tx, ty, hit).kind).toBe("cracked");
        expect(tileAt(tiles, tx, ty)).toBe(block);
      }

      const last = strikeTile(tiles, player, tx, ty, punches - 1);

      expect(last.kind).toBe("broken");

      if (last.kind === "broken") {
        expect(last.collected).toBe(block);
        expect(tileAt(last.tiles, tx, ty)).toBe(Air);
      }
    }
  });

  it("breaks instead of underflowing when the hit count is stale", () => {
    const { player, tiles, tx, ty } = withBlock(Stone);

    expect(strikeTile(tiles, player, tx, ty, 99).kind).toBe("broken");
  });

  it.prop(
    "striking never mutates the world it was given",
    { dx: offset, dy: offset },
    ({ dx, dy }) => {
      const tiles = createWorldTiles();
      const before = [...tiles];
      const player = createPlayer("pure", "Tester", tiles);
      const tx = Math.floor(player.x / TILE_SIZE) + (wrap(dx, 5) - 2);
      const ty = Math.floor(player.y / TILE_SIZE) + (wrap(dy, 5) - 2);

      strikeTile(tiles, player, tx, ty, 0);
      strikeTile(tiles, player, tx, ty, 2);

      expect(tiles).toStrictEqual(before);
    }
  );
});
