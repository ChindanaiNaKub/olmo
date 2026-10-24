# Agent instructions

Olmo is a shared, persistent, side-view sandbox for the browser. Read `VISION.md` for the product intent before planning substantial work. `VISION.md` does not override this file.

The build reference is [rat-stack](https://ratstack.sh). Follow its stack, fence, and source-first rules. When Olmo deliberately departs from rat-stack, record it in `docs/rat-stack-deviations.md` and in the change description. Do not silently drift.

For a non-trivial task, start with `skills/rat-stack-mode`.

## Stack contract

Workspace `package.json` files declare the pinned stack. Keep dependencies exact. Repo-local config wins. Record drift instead of silently migrating the project.

- pnpm workspaces + Turborepo (`apps/*`, `packages/*`)
- Node `>=24.18.0` and pnpm `11.3.0`; do not replace pnpm with Bun or npm for installs
- Effect `4.0.0` and `@effect/platform-node` `4.0.0`. Hold the runtime family here until Foldkit publishes against a newer Effect; its exact peer and platform dependency must share one runtime.
- XState `6.0.0-alpha.70` for finite lifecycles, retries, cancellation, and resumability. Olmo has no lifecycle machine in v1; the world is a steady state. Do not add a machine only to satisfy the template.
- `@xstate/effect` `1.0.0-alpha.9` bridges the two: machines run as scoped Effects via `createEffectActor`, side effects are declared `createEffectLogic` actors. `vendor/README.md` keeps the rules for the next unpublished pin.
- Alchemy `2.0.0-beta.83` (Infrastructure as Effects) for every cloud resource; declared in `apps/infra/alchemy.run.ts`, authenticated through Alchemy profiles, never through env vars in this repo
- TypeScript `7.0.2` in strict mode, patched by `@effect/tsgo` `0.54.0` in `prepare` so the Effect language service diagnostics in `tsconfig.base.json` fail `tsc`, not just the editor. Escape hatch for a real boundary: `// @effect-diagnostics-next-line <rule>:off -- <reason>`
- `@effect/vitest` `4.0.0` for every Effect test in the inherited reference surfaces: `it.effect` and `it.layer(layer)`; `Effect.run*` and `ManagedRuntime.make` in test files are a lint error. Olmo has no unit tests; see Testing.
- `@oxlint/plugins` `1.88.0` for the two typed lint rules in `scripts/oxlint-plugin-*.ts` and the vendored [anti-slop](https://github.com/dmmulroy/anti-slop) rules in `tools/oxlint/anti-slop/` (all generic rules plus the Effect group, at `error`). The copy is ours; `UPSTREAM.md` there says where it came from and how to take upstream fixes
- Oxlint `1.88.0` with Ultracite `8.0.1`, Oxfmt `0.73.0`, and Turborepo `2.11.9`
- varlock `1.23.0`: declare every env var in `.env.schema`, never read `.env.local` directly, run `pnpm env:check` after schema edits

The base Effect plugin owns diagnostic severity. Child configs may add exact `allowedUnstableApis` only for modules warned about in that scope. Do not use subtree prefixes, copy severity maps, or set `ignoreEffectWarningsInTscExitCode` to true.

## Packages

| Package | Path | Role |
| --- | --- | --- |
| `@olmo/game` | `packages/game` | Pure domain: block and player schemas, constants, physics, world rules, and the `createWorld`, `getWorld`, `punchBlock`, and `placeBlock` contracts. Safe in a browser or a Worker. |
| `@olmo/server` | `apps/server` | The `Api` Worker and the `World` Durable Object. Owns `/ws`, `/rpc`, sessions, tile persistence, movement validation, and the capability handlers. |
| `@olmo/client` | `apps/game` | Foldkit client. The game program, socket resource, Canvas view, HUD, and styles. Deployed as a static Foldkit site. |
| `@rat-stack/infra` | `apps/infra` | Olmo's Alchemy Stack: `Api` and the Foldkit `Web` site. The package keeps its inherited name until the scope rename. |

Inherited reference surfaces remain in the workspace so the rat-stack fence and its tests stay green: `apps/web`, `apps/site`, `apps/cli`, and the `packages/*` cartridges. They are not part of Olmo's runtime. Do not add Olmo product behavior to them. Delete a surface only by following the reference's Keep or cut list and keeping the gate green.

## Nouns

| Noun | Home | Runtime job |
| --- | --- | --- |
| Contract | `packages/game/src/contracts.ts` | Shared name, schemas, failure, annotations, and approval setting. |
| Capability | `apps/server/src/worker.ts` | Binds one contract to a Durable Object method with `implement`. |
| Projection | `packages/capability/src/to-rpc.ts` | Exposes implemented capabilities on one runtime surface. Olmo projects RPC. |
| World | `apps/server/src/world-object.ts` | One Durable Object instance per world name. Owns tiles, sessions, ownership, validation, and storage. |
| Session | `apps/server/src/world-object.ts` | One joined player: socket attachment, player state, inventory, owner flag, and last-seen time. |
| Feature | `apps/game/src/features/game/` | Thin view that reads the Model and sends Messages. |
| Client | `apps/game/src/client/game/` | Foldkit Model, Messages, update, Commands, socket resource, and subscriptions. |

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install workspace dependencies |
| `pnpm sources:fetch` | Import missing pinned code objects once before the first gate; generation stays local-only |
| `pnpm dev` | Run the game client under Vite at `http://127.0.0.1:5174` |
| `pnpm dev:reference` | Run the inherited rat-stack reader under Vite |
| `pnpm infra:dev` | Run the Alchemy Stack locally: the `Api` Worker and the Foldkit site. Needs a Cloudflare profile with OAuth scopes selected. |
| `pnpm check` | Typecheck, verify formatting, and run type-aware linting |
| `pnpm lint` | Type-aware lint plus format check only; `turbo run check` runs this once at the root as `//#lint` |
| `pnpm fix` | Apply Oxfmt and safe Oxlint fixes |
| `pnpm test` | Build and run the e2e suite once |
| `pnpm build` | Compile package outputs |
| `pnpm typecheck` | `turbo run typecheck` |
| `pnpm vendor:agent-sources` | Shallow-clone Effect, effect-solutions, xstate, alchemy, better-auth, and Foldkit mirrors |
| `pnpm infra:plan` | Preview the Alchemy Stack diff without applying |
| `pnpm infra:deploy` / `pnpm infra:destroy` | Apply or tear down the Stack (asks for approval) |
| `pnpm exec lefthook install` | Install git hooks (also via `prepare`) |
| `pnpm turbo run check test build` | Required validation before claiming a change is ready |

Run `pnpm fix` only when you intend to rewrite files. Finish with `pnpm turbo run check test build --concurrency=1`.

`pnpm dev` alone runs the client. It connects to `VITE_API_URL`, defaulting to `http://localhost:1337`, so the game shows the name gate and then an offline error unless an API is listening. Use `pnpm infra:dev` for the full local stack.

## Testing

Olmo tests the browser, not the modules. `apps/game/e2e.config.ts` starts Vite on a free port and `apps/game/tests/*.e2e.ts` drive it with [e2e](https://e2e.tester.army). `pnpm test` runs that suite. Do not add Vitest, `@effect/vitest`, or unit tests to `packages/game`, `apps/game`, `apps/server`, or `apps/infra`. The inherited reference surfaces keep their own Vitest suite.

Tests use exact locators, so a run needs no model credential. The suite points `VITE_API_URL` at a closed port, so it asserts the served client and the offline path. Join, movement, chat, punch, and persistence wait for the real Durable Object; Cloudflare OAuth is still the blocker. Add `agents.default.model` to the config only when a goal needs judgment.

## Deploy

- Run `pnpm turbo run check test build --concurrency=1` before deployment.
- `pnpm deploy:plan --profile <profile>` reads and classifies the production plan without applying it.
- `pnpm deploy:prod --profile <profile> --yes` applies that exact plan, then runs typed checks and a bounded watch.
- `pnpm deploy:rollback --profile <profile> --yes` restores prior Worker versions from a local apply receipt. It requires explicit approval; no automatic rollback runs.
- Recovery evidence lives in gitignored `.rat/deploy/`. Rollback writes separate progress receipts and preserves its source.
- Set `ALCHEMY_PROFILE` explicitly. It must match `--profile`. The driver refuses environment provider credentials.
- Only updates and no-ops pass by default. Use `--allow` with a JSON array of exact `{resource, action}` pairs for other actions.
- An allow-list does not grant approval. Replacements and deletions still need owner sign-off, recorded with `--ownerApproved` as well as exact allow entries. A refused plan names the resources in the verdict.
- `--expectSha <full sha>` refuses to plan or apply unless `HEAD` is that commit and the tree is clean.
- Partial apply exits 4 and names completed and incomplete resources. A crash exits 5. Unknown evidence never establishes health.
- The driver refuses Alchemy state-store bootstrap during planning. Bootstrap needs separate authorization.

The Cloudflare profile is the deploy blocker. `pnpm alchemy profile refresh --profile default --provider Cloudflare` selects the OAuth scopes. Do not work around it with provider credentials in env vars.

## Fence (cheating is uncomfortable)

Why lives in `AGENTS.md` / `VISION.md`. The stack and hooks are the enforceable fence. Fence wins over prose.

- Lefthook pre-commit runs `pnpm check` and `pnpm test`
- Agents must not use `git … --no-verify` (or equivalent hook bypass)
- Blocked by: Pi `.pi/extensions/git-interceptor`, Cursor `.cursor/hooks.json`, Claude Code `.claude/settings.json`
- Policy source: `scripts/vcs-command-policy.js`

If a hook fails, fix the failure. Do not disable the fence.

## Source-first Effect / XState work

Before writing, reviewing, or refactoring Effect or XState code, read the installed Effect package's `AGENTS.md` first, for example `packages/core/node_modules/effect/AGENTS.md`. It ships with the installed version, so it is never stale. Then inspect vendored source for the pinned versions. Populate mirrors:

```sh
pnpm vendor:agent-sources
# or
./scripts/vendor-agent-sources.sh --refresh
```

Inventory: `.agent_sources/README.md` is generated in the local source mirror and is not part of this repository.

| Need | Path |
| --- | --- |
| Effect Schema, Context.Service, CLI | `.agent_sources/github.com/Effect-TS/effect/` |
| Idiomatic Effect | `.agent_sources/github.com/kitlangton/effect-solutions/` |
| XState | `.agent_sources/github.com/statelyai/xstate/` |
| `@xstate/effect` (v6 Effect bridge) | `.agent_sources/github.com/statelyai/xstate/packages/xstate-effect/` (`README.md`, `docs/`, `src/*.test.ts`) |
| Alchemy resources, Cloudflare, AWS | `.agent_sources/github.com/alchemy-run/alchemy/` and https://alchemy.run/llms.txt |
| Foldkit | `.agent_sources/github.com/foldkit/foldkit/` (`examples/websocket-chat`) |

Refs are derived from the workspace pins, so bumping a package and re-running the script keeps them matched. The `pi-effect` tool reads the Effect mirror in place; it needs no link.

Mirrors are reference material, not runtime dependencies. Exclude them from typecheck, test, lint, and format. Do not vendor product-specific corpora in this template.

## Source control

Preserve existing work. Inspect status before editing, stage only files changed for the current task, and do not commit generated output, secrets, or populated `.agent_sources/github.com/` trees. Use the repository's existing source-control tool; do not initialize or migrate one without approval. Never pass `--no-verify` to git.

## Project law

- One contract, every surface. Define schemas and metadata with `defineContract`; bind a server-side handler with `implement` and add the capability to `capabilities`. Do not add a route or tool handler that bypasses a capability. The socket is a second transport for the same Durable Object methods, not a bypass.
- Schemas are the contract. Input, output, and failure are Effect `Schema`. Parse every socket frame and every RPC body at the boundary. JSON Schema, OpenAPI, and code-mode declarations are derived from schemas, never hand-written.
- The server is authoritative. The client predicts movement. The server rejects a move that is too far for the elapsed time or that enters a solid tile, and sends `Corrected`. Do not trust a client position, tile, or inventory count.
- Tiles persist in Durable Object storage. A world name persists with its tiles. Do not add a second source of truth for world state.
- Sessions persist in socket attachments. Rebuild sessions from attachments after hibernation. Do not keep authoritative sessions in module-level state.
- A browser module may import `@olmo/game` and `@rat-stack/capability/rpc-group` only from the shared packages. It must not import `@olmo/server`, a handler, or a Durable Object.
- The client is Foldkit. Remote state lives in the Model. A Command returns a result Message; `update` folds it in. Do not add a second state container or call `fetch` from a view.
- The socket is a managed resource. A subscription that reads it starts only after the resource is acquired (`model.joined`), never before. This was a real bug: the subscription caught `ResourceNotAvailable` and stayed empty forever.
- No comments in code. `no-comments/no-comments` (`scripts/oxlint-plugin-no-comments.ts`) bans them, after Lauren Tan's Dune rule: agents copy comments, and a comment that explains a workaround spreads the workaround. Say it in a name, a type, a test, a commit message, or the Brain. Two kinds survive: tool directives, with the reason inline after `--`, and a one-line `SAFETY:` invariant above a type assertion.
- Diagnostic overrides are targeted and explained: `// @effect-diagnostics-next-line <rule>:off -- <reason>`. Lint overrides follow the same rule: `// oxlint-disable-next-line <rule> -- <reason>`. Every type assertion carries a one-line `SAFETY:` comment naming the invariant it relies on.
- Tautological tests and change-detector tests are harmful. Olmo's regression tests are browser e2e over flows a player uses, in `apps/game/tests`. The reference surfaces keep property and model tests; do not extend that pattern into Olmo. Plant a bug before trusting a new test: it must fail.
- Errors are part of the interface. Name the failure, keep its source context, say how to fix it, and fail at the boundary.
- Hot pink is the only accent. `--accent` (#ff1493) marks the own-player outline and `:focus-visible`. Do not use pink for links, headings, tables, or ordinary UI text.
- Pins stay exact. A vendored dependency carries a matching `minimumReleaseAgeExclude` entry and a removal rule in `vendor/README.md`.

## Architecture

- `packages/game` is the shared domain. `model.ts` owns schemas and constants. `physics.ts` owns movement, collision, spawn, reach, and validation. `world.ts` owns tiles and inventory rules. `contracts.ts` owns the four capabilities. It imports Effect only; it does not import a Worker, a Durable Object, Foldkit, or Alchemy.
- `apps/server/src/world-object.ts` is the authority. The `World` Durable Object class owns `tiles`, `worldName`, `ownership`, `sessions`, and `nextOrdinal`. It loads storage on construction, rebuilds sessions from socket attachments, and returns methods to the Alchemy runtime. Socket handlers and capability handlers call the same `punch`, `place`, and `snapshot` methods.
- `apps/server/src/worker.ts` is the `Api` Worker. It decodes `/ws?world=`, forwards the upgrade to the world's Durable Object, serves `/rpc` from the capability projection, and exports the `World` class for Wrangler. It is the only place the server composition is wired.
- `apps/game/src/client/game/` owns the Foldkit program. `model.ts` holds the Model and world-from-location logic. `message.ts` holds the Message union. `update.ts` folds server messages, input, and ticks. `command.ts` sends a client message over the socket. `socket.ts` owns the WebSocket managed resource and the decode boundary. `subscription.ts` gates the socket stream on `joined`.
- `apps/game/src/features/game/view.ts` is the only view. It draws the Canvas scene, HUD, hotbar, chat, and name gate. The hotbar sits below the stage; do not put a control bar over the play field.
- `apps/infra/alchemy.run.ts` is the Stack. `Api` owns the `World` Durable Object and the `/ws` and `/rpc` routes. `Web` is the Foldkit site with `VITE_API_URL` set to `api.url.as<string>()`; Alchemy resolves that value before the Vite build and inlines it into the client bundle.
- `apps/server/src/observability.ts` holds the shared private observability policy. `apps/infra` imports it, so deploy and runtime agree.
- The reference `apps/web` and `apps/site` still run their own content, RPC, and devtools compositions. They do not provide Olmo behavior and must not become a second game server.

## Game client blueprint

`apps/game/src/features/game/view.ts` is a thin view. It reads the Model and sends Messages; it never opens a socket, retries, or starts a process. `apps/game/src/client/game/` owns the Foldkit program: Model, Messages, `update`, named `Command.define` definitions, the managed socket, and subscriptions. Remote state lives in the Model as plain schema-validated values.

One input follows one path: view → Message → `update` → named Command → `WebSocket.send` → `World` Durable Object → `ServerMessage` → `ReceivedServerMessage` → `update` → Model → view. The server stays authoritative. A correction replaces the local player position; it does not rewind other players.

## Boundaries and sign-off

- Safe by default: adding a domain rule or capability in `packages/game` and wiring it into `apps/server`; new or tightened e2e tests; a targeted diagnostic override with a written reason; README, AGENTS.md, VISION.md, `docs/`, and `.brain/` edits; tightening a lint rule; any change under `apps/infra` and `pnpm infra:deploy` once `pnpm infra:plan` shows only the intended diff and the gate passes.
- When a call is unclear, get a second opinion from a Pi session on `openai-codex/gpt-6-astra:xhigh` before asking the owner.
- Needs owner sign-off: adding or changing a dependency version (pins are exact and CI installs cold); any edit to `oxlint.config.ts`, the diagnostics map in `tsconfig.base.json`, `lefthook.yml`, or `scripts/vcs-command-policy.js` that loosens the fence; `pnpm infra:destroy`, and a deploy whose plan replaces or deletes a resource; widening sandbox permissions or adding a runtime that reaches the network; exposing `serve` or `mcp` beyond localhost; vendoring a package as a `file:` tarball; deleting `.agent_sources/` or `vendor/`.

## Known gaps

- The local Alchemy profile has no Cloudflare OAuth scopes selected. `pnpm infra:dev` fails with `CredentialsUnavailable` until the owner runs `alchemy profile refresh --profile default --provider Cloudflare`.
- The client has been played against a protocol-compatible local mock. The real Durable Object path, hibernation, and deployed persistence are not yet verified.
- The RPC `punchBlock` and `placeBlock` capabilities require the session token sent in `Snapshot`. The browser uses the socket path, where the attachment owns the identity. Keep the token out of broadcasts and world snapshots.
- The root package and the infra package still use rat-stack names. Rename only when the reference surface is removed.
