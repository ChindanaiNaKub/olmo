import {
  Air,
  Brick,
  Dirt,
  Grass,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  Stone,
  TILE_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  Wood,
  blockColors,
  blockHardness,
  blockNames,
  inventorySlots,
} from "@olmo/game/model";
import type { BlockId, PlayerState } from "@olmo/game/model";
import { insideWorld, tileAt, tileIndex } from "@olmo/game/physics";
import { Canvas } from "foldkit";
import type { Document, Html, HtmlBuilder } from "foldkit/html";

import { GameMessage } from "../../client/game/message.js";
import type { Message } from "../../client/game/message.js";
import { BURST_MS } from "../../client/game/model.js";
import type { Model } from "../../client/game/model.js";

const CANVAS_WIDTH = WORLD_WIDTH * TILE_SIZE;

const CANVAS_HEIGHT = WORLD_HEIGHT * TILE_SIZE;

const SKY_BANDS = [
  { color: "#6fb6e2", from: 0, to: 0.25 },
  { color: "#7fc1e7", from: 0.25, to: 0.55 },
  { color: "#8fcbeb", from: 0.55, to: 0.8 },
  { color: "#a2d5ef", from: 0.8, to: 1 },
] as const;

const CLOUDS = [
  { x: 160, y: 70 },
  { x: 470, y: 140 },
  { x: 810, y: 210 },
] as const;

const CRACK_LINES = [
  [-7, -7],
  [7, -6],
  [-6, 7],
  [6, 6],
  [-9, 0],
  [9, 1],
] as const;

const BURST_SHARDS = [
  [-1, -1],
  [0, -1.2],
  [1, -1],
  [-0.7, 0.2],
  [0.8, 0.1],
  [0, -0.4],
] as const;

const HILL_ROWS = [
  {
    fill: "#9ec48a",
    hills: [
      [-30, 176, 60],
      [110, 150, 44],
      [236, 168, 66],
      [390, 132, 40],
      [500, 180, 70],
      [660, 148, 46],
      [790, 172, 58],
      [944, 140, 42],
      [1060, 168, 56],
    ],
  },
  {
    fill: "#7dab6c",
    hills: [
      [-20, 160, 52],
      [136, 144, 38],
      [268, 178, 62],
      [432, 150, 44],
      [566, 164, 56],
      [716, 140, 36],
      [848, 172, 60],
      [1008, 150, 46],
    ],
  },
] as const;

const skyParts = () =>
  SKY_BANDS.map((band) =>
    Canvas.Rect({
      fill: band.color,
      height: CANVAS_HEIGHT * (band.to - band.from),
      width: CANVAS_WIDTH,
      x: 0,
      y: CANVAS_HEIGHT * band.from,
    })
  );

const cloudParts = () =>
  CLOUDS.map((cloud) =>
    Canvas.Group({
      opacity: 0.85,
      // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Foldkit's Canvas.Group names this field shapes.
      shapes: [
        Canvas.Circle({ fill: "#ffffff", radius: 22, x: 0, y: 6 }),
        Canvas.Circle({ fill: "#ffffff", radius: 30, x: -28, y: 0 }),
        Canvas.Circle({ fill: "#ffffff", radius: 26, x: 26, y: 2 }),
        Canvas.Circle({ fill: "#ffffff", radius: 18, x: 54, y: 10 }),
      ],
      translate: { x: cloud.x, y: cloud.y },
    })
  );

const hill = (
  fill: string,
  baseline: number,
  x: number,
  width: number,
  height: number
) =>
  Canvas.Path({
    fill,
    instructions: [
      Canvas.MoveTo({ x, y: baseline }),
      Canvas.LineTo({ x: x + width * 0.24, y: baseline - height * 0.72 }),
      Canvas.LineTo({ x: x + width * 0.5, y: baseline - height }),
      Canvas.LineTo({ x: x + width * 0.76, y: baseline - height * 0.72 }),
      Canvas.LineTo({ x: x + width, y: baseline }),
    ],
  });

const hillParts = () => {
  const baseline = CANVAS_HEIGHT - TILE_SIZE * 2;

  return HILL_ROWS.flatMap((row) =>
    row.hills.map(([x, width, height]) =>
      hill(row.fill, baseline, x, width, height)
    )
  );
};

const tileFace = (block: BlockId, tx: number, ty: number) => {
  const left = tx * TILE_SIZE;
  const top = ty * TILE_SIZE;
  const seed = (tx * 73 + ty * 37 + tx * ty * 11) % 9;

  if (block === Grass) {
    return [
      Canvas.Rect({
        fill: "#8a5a3b",
        height: TILE_SIZE - 7,
        width: TILE_SIZE - 2,
        x: left + 1,
        y: top + 6,
      }),
      Canvas.Rect({
        fill: "#4f9a42",
        height: 6,
        width: TILE_SIZE,
        x: left,
        y: top,
      }),
      Canvas.Rect({
        fill: "#63b354",
        height: 6,
        width: 2,
        x: left + 4,
        y: top,
      }),
      Canvas.Rect({
        fill: "#63b354",
        height: 6,
        width: 2,
        x: left + 11,
        y: top,
      }),
      Canvas.Rect({
        fill: "#63b354",
        height: 6,
        width: 2,
        x: left + 18,
        y: top,
      }),
    ];
  }

  if (block === Dirt) {
    return [
      Canvas.Rect({
        fill: "#6d4329",
        height: 3,
        width: 3,
        x: left + 3 + (seed % 5),
        y: top + 4 + ((seed * 3) % 6),
      }),
      Canvas.Rect({
        fill: "#6d4329",
        height: 3,
        width: 3,
        x: left + 12 + ((seed * 2) % 8),
        y: top + 14 + ((seed * 5) % 7),
      }),
    ];
  }

  if (block === Stone) {
    return [
      Canvas.Rect({
        fill: "#969dab",
        height: 4,
        width: 6,
        x: left + 3 + (seed % 11),
        y: top + 4 + ((seed * 2) % 13),
      }),
      Canvas.Rect({
        fill: "#666d79",
        height: 3,
        width: 4,
        x: left + 4 + ((seed * 5) % 15),
        y: top + 8 + ((seed * 3) % 12),
      }),
    ];
  }

  if (block === Wood) {
    return [
      Canvas.Rect({
        fill: "#88582f",
        height: TILE_SIZE - 6,
        width: 2,
        x: left + 5 + (seed % 4),
        y: top + 6,
      }),
      Canvas.Rect({
        fill: "#88582f",
        height: TILE_SIZE - 6,
        width: 2,
        x: left + 14 + ((seed * 3) % 5),
        y: top + 6,
      }),
      Canvas.Rect({
        fill: "#c08a55",
        height: 3,
        width: TILE_SIZE,
        x: left,
        y: top,
      }),
    ];
  }

  if (block === Brick) {
    return [
      Canvas.Rect({
        fill: "#8c3529",
        height: 2,
        width: TILE_SIZE,
        x: left,
        y: top + 10,
      }),
      Canvas.Rect({
        fill: "#8c3529",
        height: TILE_SIZE - 12,
        width: 2,
        x: left + (tx % 2 === 0 ? 8 : 16),
        y: top + 12,
      }),
    ];
  }

  return [];
};

const tileParts = (model: Model) => {
  const parts = [];

  for (let ty = 0; ty < WORLD_HEIGHT; ty += 1) {
    for (let tx = 0; tx < WORLD_WIDTH; tx += 1) {
      const block: BlockId = model.tiles[tileIndex(tx, ty)] ?? Air;

      if (block === Air) {
        continue;
      }

      parts.push(
        Canvas.Rect({
          fill: blockColors[block],
          height: TILE_SIZE,
          width: TILE_SIZE,
          x: tx * TILE_SIZE,
          y: ty * TILE_SIZE,
        }),
        Canvas.Rect({
          height: TILE_SIZE,
          lineWidth: 2,
          stroke: "#241a12",
          width: TILE_SIZE,
          x: tx * TILE_SIZE,
          y: ty * TILE_SIZE,
        }),
        ...tileFace(block, tx, ty)
      );
    }
  }

  if (model.hover !== null) {
    parts.push(
      Canvas.Rect({
        height: TILE_SIZE,
        lineWidth: 2,
        stroke: "#fff7d6",
        width: TILE_SIZE,
        x: model.hover.x * TILE_SIZE,
        y: model.hover.y * TILE_SIZE,
      })
    );
  }

  return parts;
};

const crackParts = (model: Model) => {
  const parts = [];

  for (const hit of model.hits) {
    if (!insideWorld(hit.tx, hit.ty)) {
      continue;
    }

    const block = tileAt(model.tiles, hit.tx, hit.ty);
    const hardness = blockHardness[block];

    if (hardness <= 0) {
      continue;
    }

    const stage = Math.min(
      Math.max(Math.ceil((hit.hits / hardness) * 3), 1),
      3
    );

    const centerX = hit.tx * TILE_SIZE + TILE_SIZE / 2;
    const centerY = hit.ty * TILE_SIZE + TILE_SIZE / 2;

    for (let line = 0; line < stage * 2; line += 1) {
      const [dx, dy] = CRACK_LINES[line] ?? [0, 0];

      parts.push(
        Canvas.Path({
          instructions: [
            Canvas.MoveTo({ x: centerX, y: centerY }),
            Canvas.LineTo({ x: centerX + dx, y: centerY + dy }),
          ],
          lineCap: "Round",
          lineWidth: 2,
          stroke: "rgba(18, 12, 8, 0.8)",
        })
      );
    }
  }

  return parts;
};

const burstParts = (model: Model) => {
  const parts = [];

  for (const burst of model.bursts) {
    const age = model.now - burst.at;

    if (age < 0 || age > BURST_MS) {
      continue;
    }

    const progress = age / BURST_MS;
    const centerX = burst.tx * TILE_SIZE + TILE_SIZE / 2;
    const centerY = burst.ty * TILE_SIZE + TILE_SIZE / 2;
    const fill = blockColors[burst.block];

    for (const [dx, dy] of BURST_SHARDS) {
      const distance = 10 + 22 * progress;

      parts.push(
        Canvas.Rect({
          fill,
          height: 5,
          width: 5,
          x: centerX + dx * distance - 2.5,
          y: centerY + dy * distance + 34 * progress * progress - 2.5,
        })
      );
    }

    parts.push(
      Canvas.Text({
        align: "Center",
        baseline: "Middle",
        content: "+1",
        fill: `rgba(255, 247, 214, ${1 - progress})`,
        font: "700 13px ui-sans-serif, system-ui, sans-serif",
        lineWidth: 2,
        stroke: "rgba(20, 14, 10, 0.5)",
        x: centerX,
        y: centerY - 6 - 26 * progress,
      })
    );
  }

  return parts;
};

const playerParts = (
  player: PlayerState,
  isSelf: boolean,
  punchProgress: number
) => {
  const facesRight = player.facing === "right";
  const swing = isSelf ? Math.sin(punchProgress * Math.PI) * 1.4 : 0;

  return [
    ...(isSelf
      ? [
          Canvas.Rect({
            height: PLAYER_HEIGHT + 2,
            lineWidth: 2,
            stroke: "#ff1493",
            width: PLAYER_WIDTH + 2,
            x: player.x - 1,
            y: player.y - 1,
          }),
        ]
      : []),
    Canvas.Rect({
      fill: "#3b2f2a",
      height: 15,
      width: 6,
      x: player.x + 1,
      y: player.y + 27,
    }),
    Canvas.Rect({
      fill: "#3b2f2a",
      height: 15,
      width: 6,
      x: player.x + 11,
      y: player.y + 27,
    }),
    Canvas.Rect({
      fill: player.color,
      height: 16,
      width: PLAYER_WIDTH,
      x: player.x,
      y: player.y + 11,
    }),
    Canvas.Rect({
      fill: player.color,
      height: 13,
      lineWidth: 1,
      stroke: "#241a12",
      width: 16,
      x: player.x + 1,
      y: player.y,
    }),
    Canvas.Rect({
      fill: "#241a12",
      height: 2,
      width: 2,
      x: player.x + (facesRight ? 10 : 6),
      y: player.y + 5,
    }),
    Canvas.Group({
      rotate: facesRight ? -swing : swing,
      // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Foldkit's Canvas.Group names this field shapes.
      shapes: [
        Canvas.Rect({
          fill: player.color,
          height: 15,
          width: 6,
          x: -3,
          y: 0,
        }),
      ],
      translate: {
        x: player.x + (facesRight ? PLAYER_WIDTH - 3 : 3),
        y: player.y + 14,
      },
    }),
    Canvas.Text({
      align: "Center",
      baseline: "Bottom",
      content: player.name,
      fill: "#ffffff",
      font: "600 11px ui-sans-serif, system-ui, sans-serif",
      lineWidth: 3,
      stroke: "rgba(15, 23, 42, 0.65)",
      x: player.x + PLAYER_WIDTH / 2,
      y: player.y - 4,
    }),
  ];
};

const sceneParts = (model: Model) => {
  const punchProgress = Math.min(
    Math.max((model.now - model.punchAt) / 160, 0),
    1
  );

  return [
    ...skyParts(),
    ...cloudParts(),
    ...hillParts(),
    ...tileParts(model),
    ...crackParts(model),
    ...model.players
      .filter((player) => player.id !== model.selfId)
      .flatMap((player) => playerParts(player, false, 0)),
    ...(model.self === null
      ? []
      : playerParts(model.self, true, punchProgress)),
    ...burstParts(model),
  ];
};

const statusLabel = (model: Model): string => {
  if (model.connection === "live") {
    return `${model.players.length} online`;
  }

  return model.connection === "connecting" ? "connecting" : "offline";
};

const ownershipControl = (model: Model, h: HtmlBuilder<Message>): Html => {
  if (model.isOwner) {
    return h.button(
      [
        h.Class("owner-action"),
        h.OnClick(GameMessage.ToggledWorldLock()),
        h.Type("button"),
      ],
      [model.locked ? "Unlock world" : "Lock world"]
    );
  }

  if (model.owner !== null) {
    return h.div(
      [h.Class("owner-chip")],
      [model.locked ? `Locked by ${model.owner}` : `${model.owner}'s world`]
    );
  }

  if (model.world !== "lobby" && model.joined) {
    return h.button(
      [
        h.Class("owner-action"),
        h.OnClick(GameMessage.ClaimedWorld()),
        h.Type("button"),
      ],
      ["Claim this world"]
    );
  }

  return h.div([h.Class("hidden")], []);
};

const topBar = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("topbar")],
    [
      h.div([h.Class("world-tag")], [`/w/${model.world}`]),
      ownershipControl(model, h),
      h.div([h.Class(`status ${model.connection}`)], [statusLabel(model)]),
    ]
  );

const chatLine = (
  entry: Model["chat"][number],
  h: HtmlBuilder<Message>
): Html =>
  h.div(
    [h.Class("chat-line")],
    [
      h.span(
        [h.Class("chat-name"), h.Style({ color: entry.color })],
        [entry.name]
      ),
      h.span([h.Class("chat-text")], [entry.text]),
    ]
  );

const chatLog = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("chat")],
    [
      h.div(
        [h.Class("chat-lines")],
        model.chat.slice(-4).map((entry) => chatLine(entry, h))
      ),
      model.chatOpen
        ? h.form(
            [h.Class("composer"), h.OnSubmit(GameMessage.SubmittedChat())],
            [
              h.input([
                h.AriaLabel("Chat message"),
                h.Autofocus(true),
                h.Class("chat-input"),
                h.OnInput((value) => GameMessage.UpdatedChatDraft({ value })),
                h.Placeholder("Say something"),
                h.Value(model.chatDraft),
              ]),
              h.button([h.Class("chat-send"), h.Type("submit")], ["Send"]),
              h.button(
                [
                  h.Class("chat-send ghost"),
                  h.OnClick(GameMessage.ClosedChat()),
                  h.Type("button"),
                ],
                ["Close"]
              ),
            ]
          )
        : h.div([h.Class("chat-hint")], ["Enter to chat"]),
    ]
  );

const hotbar = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("hotbar")],
    inventorySlots.map((block, index) => {
      const count = model.counts[block] ?? 0;
      const isSelected = block === model.selected && block !== Air;

      return h.button(
        [
          h.AriaLabel(`Select ${blockNames[block]}`),
          h.Class(isSelected ? "slot selected" : "slot"),
          h.OnClick(GameMessage.SelectedBlock({ block })),
          h.Title(blockNames[block]),
          h.Type("button"),
        ],
        [
          h.span(
            [
              h.Class(block === Air ? "swatch empty" : "swatch"),
              h.Style({
                background: block === Air ? "transparent" : blockColors[block],
              }),
            ],
            []
          ),
          h.span([h.Class("slot-key")], [String(index + 1)]),
          h.span(
            [h.Class("slot-count")],
            [block === Air ? "—" : String(count)]
          ),
        ]
      );
    })
  );

const gameView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("game")],
    [
      h.div(
        [h.Class("stage")],
        [
          Canvas.view(
            {
              className: "scene",
              height: CANVAS_HEIGHT,
              onPointerDown: ({ x, y }) => GameMessage.ClickedTile({ x, y }),
              onPointerMove: ({ x, y }) => GameMessage.HoveredTile({ x, y }),
              // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Foldkit's Canvas.view names this field shapes.
              shapes: sceneParts(model),
              width: CANVAS_WIDTH,
            },
            h
          ),
          h.div(
            [h.Class("hud")],
            [
              topBar(model, h),
              chatLog(model, h),
              model.error === null
                ? h.div([h.Class("hidden")], [])
                : h.div([h.Class("banner")], [model.error]),
            ]
          ),
        ]
      ),
      hotbar(model, h),
      h.footer(
        [h.Class("foot")],
        [
          h.span([h.Class("foot-world")], [`/w/${model.world}`]),
          h.span([h.Class("foot-dot")], ["·"]),
          h.span([], ["Share this URL to play together"]),
        ]
      ),
    ]
  );

const nameView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.main(
    [h.Class("gate")],
    [
      h.div(
        [h.Class("gate-card")],
        [
          h.div([h.Class("eyebrow")], ["Shared sandbox"]),
          h.h1([h.Class("wordmark")], ["Olmo"]),
          h.p(
            [h.Class("lede")],
            [
              "A small side-scrolling world you can claim, build, and keep. Friends drop in by URL.",
            ]
          ),
          h.form(
            [h.Class("gate-form"), h.OnSubmit(GameMessage.SubmittedName())],
            [
              h.input([
                h.AriaLabel("Your name"),
                h.Autofocus(true),
                h.Class("text-input"),
                h.OnInput((value) => GameMessage.UpdatedNameDraft({ value })),
                h.Placeholder("Your name"),
                h.Value(model.nameDraft),
              ]),
              h.button([h.Class("primary"), h.Type("submit")], ["Enter world"]),
            ]
          ),
          model.error === null
            ? h.div([h.Class("gate-note")], [`World /w/${model.world}`])
            : h.div([h.Class("gate-error")], [model.error]),
        ]
      ),
    ]
  );

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  body: h.div(
    [h.Class("page")],
    [model.started ? gameView(model, h) : nameView(model, h)]
  ),
  title: `Olmo · /w/${model.world}`,
});
