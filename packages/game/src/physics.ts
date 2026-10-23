import {
  Air,
  GRAVITY,
  JUMP_VELOCITY,
  MAX_FALL_SPEED,
  MOVE_SPEED,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  Stone,
  TILE_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./model.js";
import type { BlockId, Facing, MoveIntent, PlayerState } from "./model.js";

const worldPixelWidth = WORLD_WIDTH * TILE_SIZE;

const worldPixelHeight = WORLD_HEIGHT * TILE_SIZE;

export const tileIndex = (tx: number, ty: number): number =>
  ty * WORLD_WIDTH + tx;

export const insideWorld = (tx: number, ty: number): boolean =>
  Number.isInteger(tx) &&
  Number.isInteger(ty) &&
  tx >= 0 &&
  ty >= 0 &&
  tx < WORLD_WIDTH &&
  ty < WORLD_HEIGHT;

export const tileAt = (
  tiles: readonly BlockId[],
  tx: number,
  ty: number
): BlockId => {
  if (!insideWorld(tx, ty)) {
    return ty >= WORLD_HEIGHT ? Stone : Air;
  }

  return tiles[tileIndex(tx, ty)] ?? Air;
};

export const isSolid = (block: BlockId): boolean => block !== Air;

const solidOverlap = (
  tiles: readonly BlockId[],
  left: number,
  top: number,
  width: number,
  height: number
): boolean => {
  const firstColumn = Math.floor(left / TILE_SIZE);
  const lastColumn = Math.floor((left + width - 0.001) / TILE_SIZE);
  const firstRow = Math.floor(top / TILE_SIZE);
  const lastRow = Math.floor((top + height - 0.001) / TILE_SIZE);

  for (let ty = firstRow; ty <= lastRow; ty += 1) {
    for (let tx = firstColumn; tx <= lastColumn; tx += 1) {
      if (isSolid(tileAt(tiles, tx, ty))) {
        return true;
      }
    }
  }

  return false;
};

export const overlapsSolid = (
  tiles: readonly BlockId[],
  x: number,
  y: number
): boolean => solidOverlap(tiles, x, y, PLAYER_WIDTH, PLAYER_HEIGHT);

export const clampToWorld = (position: Readonly<{ x: number; y: number }>) => ({
  x: Math.min(Math.max(position.x, 0), worldPixelWidth - PLAYER_WIDTH),
  y: Math.min(Math.max(position.y, 0), worldPixelHeight - PLAYER_HEIGHT),
});

export const centerOf = (player: Readonly<Pick<PlayerState, "x" | "y">>) => ({
  x: player.x + PLAYER_WIDTH / 2,
  y: player.y + PLAYER_HEIGHT / 2,
});

export const tileCenter = (tx: number, ty: number) => ({
  x: (tx + 0.5) * TILE_SIZE,
  y: (ty + 0.5) * TILE_SIZE,
});

export const withinReachTiles = (
  tiles: number,
  player: Readonly<Pick<PlayerState, "x" | "y">>,
  tx: number,
  ty: number
): boolean => {
  const center = centerOf(player);
  const target = tileCenter(tx, ty);
  const reach = tiles * TILE_SIZE;

  return (
    Math.abs(center.x - target.x) <= reach &&
    Math.abs(center.y - target.y) <= reach
  );
};

const facingOf = (vx: number, previous: Facing): Facing => {
  if (vx < 0) {
    return "left";
  }

  if (vx > 0) {
    return "right";
  }

  return previous;
};

export const stepPlayer = (
  tiles: readonly BlockId[],
  player: PlayerState,
  intent: MoveIntent,
  deltaSeconds: number
): PlayerState => {
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);
  const direction = (intent.right ? 1 : 0) - (intent.left ? 1 : 0);
  const vx = direction * MOVE_SPEED;
  const groundedNow = overlapsSolid(tiles, player.x, player.y + 1);
  const jumping = intent.jump && groundedNow;

  const vy = jumping
    ? JUMP_VELOCITY
    : Math.min(player.vy + GRAVITY * dt, MAX_FALL_SPEED);

  const nextX = clampToWorld({
    x: player.x + vx * dt,
    y: player.y,
  }).x;

  const x = overlapsSolid(tiles, nextX, player.y) ? player.x : nextX;
  const movedY = player.y + vy * dt;
  const hitsVertically = overlapsSolid(tiles, x, movedY);
  const landedRow = Math.floor((movedY + PLAYER_HEIGHT) / TILE_SIZE);
  let y = movedY;

  if (hitsVertically) {
    y =
      vy > 0
        ? landedRow * TILE_SIZE - PLAYER_HEIGHT
        : Math.ceil(movedY / TILE_SIZE) * TILE_SIZE;
  }

  const clamped = clampToWorld({ x, y });
  const hitFloor = clamped.y + PLAYER_HEIGHT >= worldPixelHeight - 0.001;
  const correctedVy = hitsVertically || hitFloor ? 0 : vy;

  const grounded = hitFloor || overlapsSolid(tiles, clamped.x, clamped.y + 1);

  return {
    ...player,
    facing: facingOf(vx, player.facing),
    grounded,
    vx,
    vy: correctedVy,
    x: clamped.x,
    y: clamped.y,
  };
};

export const colorFor = (name: string): string => {
  let hash = 0;

  for (const character of name) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 360;
  }

  return `hsl(${hash} 68% 58%)`;
};

export const spawnPosition = (tiles: readonly BlockId[]) => {
  const preferredX = Math.floor(WORLD_WIDTH / 2) * TILE_SIZE;

  for (let ty = 0; ty < WORLD_HEIGHT; ty += 1) {
    if (
      isSolid(tileAt(tiles, Math.floor(preferredX / TILE_SIZE), ty)) &&
      !overlapsSolid(tiles, preferredX, (ty - 1) * TILE_SIZE)
    ) {
      return clampToWorld({ x: preferredX, y: (ty - 1) * TILE_SIZE });
    }
  }

  return clampToWorld({
    x: preferredX,
    y: Math.floor(WORLD_HEIGHT / 2) * TILE_SIZE,
  });
};

export const createPlayer = (
  id: string,
  name: string,
  tiles: readonly BlockId[]
): PlayerState => {
  const spawn = spawnPosition(tiles);

  return {
    color: colorFor(name),
    facing: "right",
    grounded: false,
    id,
    name,
    vx: 0,
    vy: 0,
    x: spawn.x,
    y: spawn.y,
  };
};

export const movedTooFar = (
  previous: Readonly<Pick<PlayerState, "x" | "y">>,
  next: Readonly<Pick<PlayerState, "x" | "y">>,
  elapsedMillis: number
): boolean => {
  const allowance = (MOVE_SPEED * Math.max(elapsedMillis, 16)) / 1000 + 96;
  const dx = next.x - previous.x;
  const dy = next.y - previous.y;

  return Math.hypot(dx, dy) > allowance;
};
