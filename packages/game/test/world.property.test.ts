import { describe, expect, it } from "@effect/vitest";
import { Arbitrary, Schema } from "effect";

import {
  Dirt,
  Grass,
  TILE_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "../src/model.js";
import {
  createPlayer,
  overlapsSolid,
  stepPlayer,
  tileIndex,
} from "../src/physics.js";
import { breakTile, createWorldTiles, placeTile } from "../src/world.js";

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
      const broken = breakTile(tiles, player, tx, ty);

      if (!broken.ok) {
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
