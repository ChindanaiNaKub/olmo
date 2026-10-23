import {
  Air,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  TILE_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  blockColors,
  blockNames,
  inventorySlots,
} from "@olmo/game/model";
import type { BlockId, PlayerState } from "@olmo/game/model";
import { tileIndex } from "@olmo/game/physics";
import { Canvas } from "foldkit";
import type { Document, Html, HtmlBuilder } from "foldkit/html";

import { GameMessage } from "../../client/game/message.js";
import type { Message } from "../../client/game/message.js";
import type { Model } from "../../client/game/model.js";

const CANVAS_WIDTH = WORLD_WIDTH * TILE_SIZE;

const CANVAS_HEIGHT = WORLD_HEIGHT * TILE_SIZE;

const tileParts = (model: Model) => {
  const parts = [
    Canvas.Rect({
      fill: "#8ec9e8",
      height: CANVAS_HEIGHT,
      width: CANVAS_WIDTH,
      x: 0,
      y: 0,
    }),
  ];

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
          lineWidth: 1,
          stroke: "rgba(15, 23, 42, 0.18)",
          width: TILE_SIZE,
          x: tx * TILE_SIZE,
          y: ty * TILE_SIZE,
        })
      );
    }
  }

  if (model.hover !== null) {
    parts.push(
      Canvas.Rect({
        height: TILE_SIZE,
        lineWidth: 1.5,
        stroke: "rgba(255, 255, 255, 0.9)",
        width: TILE_SIZE,
        x: model.hover.x * TILE_SIZE,
        y: model.hover.y * TILE_SIZE,
      })
    );
  }

  return parts;
};

const playerParts = (player: PlayerState, isSelf: boolean) => [
  ...(isSelf
    ? [
        Canvas.Rect({
          height: PLAYER_HEIGHT + 6,
          lineWidth: 2,
          stroke: "#ff1493",
          width: PLAYER_WIDTH + 6,
          x: player.x - 3,
          y: player.y - 3,
        }),
      ]
    : []),
  Canvas.Rect({
    fill: player.color,
    height: PLAYER_HEIGHT - 12,
    width: PLAYER_WIDTH,
    x: player.x,
    y: player.y + 12,
  }),
  Canvas.Circle({
    fill: player.color,
    radius: 10,
    x: player.x + PLAYER_WIDTH / 2,
    y: player.y + 10,
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

const sceneParts = (model: Model) => [
  ...tileParts(model),
  ...model.players
    .filter((player) => player.id !== model.selfId)
    .flatMap((player) => playerParts(player, false)),
  ...(model.self === null ? [] : playerParts(model.self, true)),
];

const statusLabel = (model: Model): string => {
  if (model.connection === "live") {
    return `${model.players.length} online`;
  }

  return model.connection === "connecting" ? "connecting" : "offline";
};

const topBar = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("topbar")],
    [
      h.div([h.Class("world-tag")], [`/w/${model.world}`]),
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
            ["A small side-scrolling world. Dig, build, and bump into friends."]
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
