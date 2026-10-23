import {
  ClientMessageSchema,
  MAX_PLAYERS,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  ServerMessageSchema,
  TILE_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@olmo/game/model";
import type {
  BlockId,
  ClientMessage,
  PlayerState,
  ServerMessage,
  TileChange,
  TileRejection,
  WorldSnapshot,
  WorldSummary,
} from "@olmo/game/model";
import {
  clampToWorld,
  createPlayer,
  movedTooFar,
  overlapsSolid,
} from "@olmo/game/physics";
import {
  addToInventory,
  breakTile,
  createWorldTiles,
  emptyInventory,
  inventoryCount,
  placeTile,
} from "@olmo/game/world";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect, Option, Schema } from "effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";

interface Session {
  readonly color: string;
  readonly counts: readonly number[];
  readonly id: string;
  readonly lastSeen: number;
  readonly name: string;
  readonly player: PlayerState;
  readonly token: string;
}

interface Attachment {
  readonly id: string;
  readonly ordinal: number;
  readonly session?: Session;
}

export type TileOutcome =
  | Readonly<{ ok: true; change: TileChange }>
  | Readonly<{ ok: false; reason: TileRejection | "player-not-found" }>;

const accepted = (change: TileChange): TileOutcome => ({ change, ok: true });

const rejected = (reason: TileRejection | "player-not-found"): TileOutcome => ({
  ok: false,
  reason,
});

const TILES_KEY = "tiles";

const NAME_KEY = "name";

const encode = (message: ServerMessage): string =>
  JSON.stringify(Schema.encodeSync(ServerMessageSchema)(message));

const decodeClientMessage = (raw: string): Option.Option<ClientMessage> => {
  try {
    const parsed: unknown = JSON.parse(raw);

    return Schema.decodeUnknownOption(ClientMessageSchema)(parsed);
  } catch {
    return Option.none();
  }
};

const playerCoversTile = (
  player: Readonly<Pick<PlayerState, "x" | "y">>,
  tx: number,
  ty: number
): boolean =>
  player.x < (tx + 1) * TILE_SIZE &&
  player.x + PLAYER_WIDTH > tx * TILE_SIZE &&
  player.y < (ty + 1) * TILE_SIZE &&
  player.y + PLAYER_HEIGHT > ty * TILE_SIZE;

export default class World extends Cloudflare.DurableObject<World>()(
  "World",
  Effect.gen(function* makeWorld() {
    const state = yield* Cloudflare.DurableObjectState;

    // @effect-diagnostics-next-line returnEffectInGen:off -- Alchemy's DurableObject contract returns the per-instance Effect.
    return Effect.gen(function* makeInstance() {
      const storedTiles =
        yield* state.storage.get<readonly BlockId[]>(TILES_KEY);

      const storedName = yield* state.storage.get<string>(NAME_KEY);

      let tiles = storedTiles ?? createWorldTiles();
      let worldName = storedName ?? "lobby";
      let nextOrdinal = 1;
      let nameLocked = storedName !== undefined;
      const sessions = new Map<string, Session>();

      if (storedTiles === undefined) {
        yield* state.storage.put(TILES_KEY, tiles);
      }

      if (storedName === undefined) {
        yield* state.storage.put(NAME_KEY, worldName);
      }

      for (const socket of yield* state.getWebSockets()) {
        const attachment = socket.deserializeAttachment<Attachment>();

        if (attachment !== null) {
          nextOrdinal = Math.max(nextOrdinal, attachment.ordinal + 1);

          if (attachment.session !== undefined) {
            sessions.set(attachment.id, attachment.session);
          }
        }
      }

      const listSockets = Effect.fn("World.listSockets")(
        function* listSockets() {
          return yield* state.getWebSockets();
        }
      );

      const sendTo = Effect.fn("World.sendTo")(function* sendTo(
        socket: Cloudflare.WebSocket,
        message: ServerMessage
      ) {
        yield* socket.send(encode(message));
      });

      const broadcast = Effect.fn("World.broadcast")(function* broadcast(
        message: ServerMessage
      ) {
        const payload = encode(message);

        for (const socket of yield* listSockets()) {
          yield* socket.send(payload);
        }
      });

      const saveSession = Effect.fn("World.saveSession")(function* saveSession(
        session: Session
      ) {
        sessions.set(session.id, session);

        for (const socket of yield* listSockets()) {
          const attachment = socket.deserializeAttachment<Attachment>();

          if (attachment?.id === session.id) {
            socket.serializeAttachment({
              id: attachment.id,
              ordinal: attachment.ordinal,
              session,
            });
          }
        }
      });

      const socketFor = Effect.fn("World.socketFor")(function* socketFor(
        id: string
      ) {
        for (const socket of yield* listSockets()) {
          if (socket.deserializeAttachment<Attachment>()?.id === id) {
            return Option.some(socket);
          }
        }

        return Option.none<Cloudflare.WebSocket>();
      });

      const snapshot = (): WorldSnapshot => ({
        height: WORLD_HEIGHT,
        name: worldName,
        players: [...sessions.values()].map((session) => session.player),
        tiles,
        width: WORLD_WIDTH,
      });

      const summary = (): WorldSummary => ({
        height: WORLD_HEIGHT,
        name: worldName,
        width: WORLD_WIDTH,
      });

      const join = Effect.fn("World.join")(function* join(
        socket: Cloudflare.WebSocket,
        name: string
      ) {
        const attachment = socket.deserializeAttachment<Attachment>();

        if (attachment === null || sessions.has(attachment.id)) {
          return;
        }

        if (sessions.size >= MAX_PLAYERS) {
          yield* sendTo(
            socket,
            ServerMessageSchema.cases.Rejected.make({
              reason: "This world is full",
            })
          );

          return;
        }

        const player = createPlayer(attachment.id, name, tiles);
        // @effect-diagnostics-next-line cryptoRandomUUIDInEffect:off -- Workers ship Web Crypto and the Effect Crypto service needs a platform layer this Durable Object does not provide.
        const token = crypto.randomUUID();

        const session: Session = {
          color: player.color,
          counts: emptyInventory(),
          id: attachment.id,
          lastSeen: performance.now(),
          name,
          player,
          token,
        };

        yield* saveSession(session);
        yield* broadcast(
          ServerMessageSchema.cases.PlayerJoined.make({ player })
        );
        yield* sendTo(
          socket,
          ServerMessageSchema.cases.Snapshot.make({
            snapshot: snapshot(),
            token,
            you: attachment.id,
          })
        );
        yield* sendTo(
          socket,
          ServerMessageSchema.cases.Inventory.make({
            counts: session.counts,
          })
        );
      });

      const move = Effect.fn("World.move")(function* move(
        socket: Cloudflare.WebSocket,
        playerId: string,
        message: Extract<ClientMessage, { _tag: "Move" }>
      ) {
        const session = sessions.get(playerId);

        if (session === undefined) {
          return;
        }

        const now = performance.now();
        const elapsed = Math.max(16, now - session.lastSeen);
        const clamped = clampToWorld({ x: message.x, y: message.y });

        if (
          clamped.x !== message.x ||
          clamped.y !== message.y ||
          movedTooFar(
            session.player,
            { x: message.x, y: message.y },
            elapsed
          ) ||
          overlapsSolid(tiles, message.x, message.y)
        ) {
          yield* sendTo(
            socket,
            ServerMessageSchema.cases.Corrected.make({
              vx: session.player.vx,
              vy: session.player.vy,
              x: session.player.x,
              y: session.player.y,
            })
          );

          return;
        }

        const player: PlayerState = {
          ...session.player,
          facing: message.facing,
          vx: message.vx,
          vy: message.vy,
          x: message.x,
          y: message.y,
        };

        yield* saveSession({ ...session, lastSeen: now, player });
        yield* broadcast(
          ServerMessageSchema.cases.PlayerMoved.make({ player })
        );
      });

      const punch = Effect.fn("World.punch")(function* punch(
        playerId: string,
        token: string,
        tx: number,
        ty: number
      ) {
        const session = sessions.get(playerId);

        if (session === undefined || session.token !== token) {
          return rejected("player-not-found");
        }

        const result = breakTile(tiles, session.player, tx, ty);

        if (!result.ok) {
          return rejected(result.reason);
        }

        const { tiles: nextTiles } = result;

        tiles = nextTiles;

        const { counts: previousCounts } = session;
        const counts = addToInventory(previousCounts, result.collected, 1);

        yield* state.storage.put(TILES_KEY, tiles);
        yield* saveSession({ ...session, counts });
        yield* broadcast(
          ServerMessageSchema.cases.TileChanged.make(result.change)
        );

        const socket = yield* socketFor(playerId);

        if (Option.isSome(socket)) {
          yield* sendTo(
            socket.value,
            ServerMessageSchema.cases.Inventory.make({ counts })
          );
        }

        return accepted(result.change);
      });

      const place = Effect.fn("World.place")(function* place(
        playerId: string,
        token: string,
        tx: number,
        ty: number,
        block: BlockId
      ) {
        const session = sessions.get(playerId);

        if (session === undefined || session.token !== token) {
          return rejected("player-not-found");
        }

        const { counts: previousCounts } = session;

        if (inventoryCount(previousCounts, block) < 1) {
          return rejected("no-inventory");
        }

        for (const other of sessions.values()) {
          if (playerCoversTile(other.player, tx, ty)) {
            return rejected("occupied");
          }
        }

        const result = placeTile(tiles, session.player, tx, ty, block);

        if (!result.ok) {
          return rejected(result.reason);
        }

        const { tiles: nextTiles } = result;

        tiles = nextTiles;

        const counts = [...previousCounts];

        counts[block] = inventoryCount(previousCounts, block) - 1;

        yield* state.storage.put(TILES_KEY, tiles);
        yield* saveSession({ ...session, counts });
        yield* broadcast(
          ServerMessageSchema.cases.TileChanged.make(result.change)
        );

        const socket = yield* socketFor(playerId);

        if (Option.isSome(socket)) {
          yield* sendTo(
            socket.value,
            ServerMessageSchema.cases.Inventory.make({ counts })
          );
        }

        return accepted(result.change);
      });

      const chat = Effect.fn("World.chat")(function* chat(
        playerId: string,
        text: string
      ) {
        const session = sessions.get(playerId);

        if (session === undefined) {
          return;
        }

        yield* broadcast(
          ServerMessageSchema.cases.ChatLine.make({
            color: session.color,
            name: session.name,
            text,
          })
        );
      });

      const handlePunch = Effect.fn("World.handlePunch")(function* handlePunch(
        socket: Cloudflare.WebSocket,
        playerId: string,
        message: Extract<ClientMessage, { _tag: "Punch" }>
      ) {
        const outcome = yield* punch(
          playerId,
          sessions.get(playerId)?.token ?? "",
          Math.floor(message.tx),
          Math.floor(message.ty)
        );

        if (!outcome.ok) {
          yield* sendTo(
            socket,
            ServerMessageSchema.cases.Rejected.make({
              reason: `Cannot punch: ${outcome.reason}`,
            })
          );
        }
      });

      const handlePlace = Effect.fn("World.handlePlace")(function* handlePlace(
        socket: Cloudflare.WebSocket,
        playerId: string,
        message: Extract<ClientMessage, { _tag: "Place" }>
      ) {
        const outcome = yield* place(
          playerId,
          sessions.get(playerId)?.token ?? "",
          Math.floor(message.tx),
          Math.floor(message.ty),
          message.block
        );

        if (!outcome.ok) {
          yield* sendTo(
            socket,
            ServerMessageSchema.cases.Rejected.make({
              reason: `Cannot place: ${outcome.reason}`,
            })
          );
        }
      });

      const handleSocketMessage = Effect.fn("World.handleSocketMessage")(
        function* handleSocketMessage(
          socket: Cloudflare.WebSocket,
          raw: string
        ) {
          const attachment = socket.deserializeAttachment<Attachment>();
          const decoded = decodeClientMessage(raw);

          if (attachment === null || Option.isNone(decoded)) {
            yield* sendTo(
              socket,
              ServerMessageSchema.cases.Rejected.make({
                reason: "Unknown message",
              })
            );

            return;
          }

          yield* ClientMessageSchema.match(decoded.value, {
            Chat: (message) => chat(attachment.id, message.text),
            Join: (message) => join(socket, message.name),
            Move: (message) => move(socket, attachment.id, message),
            Place: (message) => handlePlace(socket, attachment.id, message),
            Punch: (message) => handlePunch(socket, attachment.id, message),
          });
        }
      );

      return {
        ensure: Effect.fn("World.ensure")(function* ensure(name: string) {
          if (!nameLocked) {
            worldName = name;
            nameLocked = true;
            yield* state.storage.put(NAME_KEY, name);
          }

          return summary();
        }),
        fetch: Effect.gen(function* fetch() {
          const request = yield* HttpServerRequest.HttpServerRequest;

          const requested = new URL(
            request.url,
            "http://world"
          ).searchParams.get("world");

          if (requested !== null && !nameLocked) {
            worldName = requested;
            nameLocked = true;
            yield* state.storage.put(NAME_KEY, requested);
          }

          const [response, socket] = yield* Cloudflare.upgrade();

          nextOrdinal += 1;
          socket.serializeAttachment({
            id: `${state.id.toString()}-${nextOrdinal}`,
            ordinal: nextOrdinal,
          } satisfies Attachment);

          return response;
        }),
        place,
        punch,
        snapshot: Effect.sync(() => snapshot()),
        webSocketClose: Effect.fn("World.webSocketClose")(
          function* webSocketClose(socket: Cloudflare.WebSocket) {
            const attachment = socket.deserializeAttachment<Attachment>();

            if (attachment === null) {
              return;
            }

            sessions.delete(attachment.id);
            yield* broadcast(
              ServerMessageSchema.cases.PlayerLeft.make({ id: attachment.id })
            );
          }
        ),
        webSocketMessage: Effect.fn("World.webSocketMessage")(
          function* webSocketMessage(
            socket: Cloudflare.WebSocket,
            message: string | ArrayBuffer
          ) {
            const raw = Schema.decodeUnknownOption(Schema.String)(message);

            if (Option.isSome(raw)) {
              yield* handleSocketMessage(socket, raw.value);
            }
          }
        ),
      };
    });
  })
) {}
