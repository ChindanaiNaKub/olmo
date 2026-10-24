# Rat-stack deviations

Olmo vendors rat-stack as its build method. This file records every deliberate departure from the reference, why it exists, and what would remove it. Add a row before shipping a new departure.

| # | rat-stack expects | Olmo does | Why | Risk or follow-up |
| --- | --- | --- | --- | --- |
| 1 | A child project renames its scope on day one. | The repo, root package, and `apps/infra` package still use `rat-stack` names. Product packages use `@olmo/*`. | The reference surfaces (`apps/web`, `apps/site`, `apps/cli`, and the cartridges) still run the rat-stack gate. Renaming them is a separate cleanup. | Confusing deploy and package output. Rename when the reference surfaces are deleted. |
| 2 | Finite lifecycles are XState machines started with `createEffectActor`. | The `World` Durable Object is one steady state. There is no lifecycle machine. | A world has no finite modes in v1: it loads, accepts sockets, and persists tiles. A machine would add states with no transitions. | Retries and reconnect lifecycles are not modeled. Add a machine when a world gains rounds, resets, or a queued save. |
| 3 | Capabilities are the only mutation surface. | The socket carries movement, chat, punch, and place. RPC carries world creation and snapshots. Both call the same Durable Object methods. | A platformer needs low-latency frames and server push. RPC per tile or per frame is the wrong transport. | Two transports to keep in sync. The shared `World` methods and the schemas in `@olmo/game` are the single implementation. |
| 4 | Browser Commands call an `RpcClient` built from `toRpcGroup`. | The browser has no RPC client. It sends schema-validated JSON over the WebSocket. | v1 has no browser RPC operation: snapshots arrive on join, and mutations are socket messages. | A future browser RPC surface needs a client and CORS. The contracts already exist. |
| 5 | The site Worker forwards `/rpc` to a private backend through a service binding. | `Web` is a static Foldkit site. `Api` is a separate Worker with a public URL, and `VITE_API_URL` is baked into the client build. | The game client is static; only the API needs a Worker. This is the Alchemy `effect-prezzy` shape. | The API URL is public and fixed at build time. A same-origin proxy would remove the build-time value and add a Worker to the site. |
| 6 | The template's public site is the deployed surface. | Olmo deploys `Api` and `Web`. The inherited reader site, CLI, and cartridges remain in the workspace but are not in the Stack. | The reference surfaces keep the fence and its tests green while Olmo grows. | The workspace carries code Olmo does not run. Delete surfaces when the reference is no longer needed. |
| 7 | The shared domain lives in `packages/core`. | The game domain lives in `packages/game`. | `rat-stack-boundaries/no-browser-server-imports` lets browser modules import only `@rat-stack/core/contracts` and `@rat-stack/capability/rpc-group`. A new pure package gives the game a browser-safe edge without widening the reference rule. | One more package to name and export. |
| 8 | Accounts and `CurrentPerson` identify a caller. | A nickname and an ephemeral session token identify a player. | v1 has no accounts. A friend should open a URL and play. | No durable identity, no moderation, no ownership. Add auth before private worlds or persistent inventories. |
| 9 | The server owns movement. | The client predicts movement; the server accepts a move within a distance allowance and outside solid tiles, or sends `Corrected`. | A round trip per frame would feel bad. Prediction keeps the platformer responsive. | A cheater can move faster than the allowance in small steps. Tighten the allowance or add a server-side step when cheating matters. |
| 10 | Capability inputs carry the caller identity from auth middleware. | `punchBlock` and `placeBlock` require the session token sent in `Snapshot`. The socket path uses the socket attachment. | The RPC mutation path is public. A player id alone is visible in broadcasts and is not a credential. | The token travels in the snapshot and is held in the client model. Keep it out of broadcasts and `getWorld`. |
| 11 | Every Effect test runs under `@effect/vitest` with `it.effect`, and a domain rule is an `it.prop`. | Olmo has no unit tests. `apps/game/tests/*.e2e.ts` drive the served client with [e2e](https://e2e.tester.army), and `pnpm test` runs that suite. | One test path for a browser game. A canvas world is only proved by opening it. | `accessRejection`, physics, and world rules have no fast unit check. The e2e suite reaches only the name gate and the offline path until the Durable Object runs locally; the reference surfaces still carry their Vitest suite. |

## Fixed during the build

- The socket subscription started on `model.started`, before the managed resource was acquired. `GameSocket.get` failed with `ResourceNotAvailable`, the stream became empty, and the client never received `Snapshot`. It now starts on `model.joined`.
- `punchBlock` and `placeBlock` accepted any `playerId` over public RPC, so a player could act as another player whose id was broadcast. They now require the session token.
- The hotbar sat over the bottom of the play field, hiding players and the ground. It now sits below the stage.

## Unverified

- The real Durable Object path, hibernation, and deployed persistence. Local `pnpm infra:dev` stops at Cloudflare OAuth scope selection.
- Cloudflare's WebSocket upgrade behavior through the `Api` Worker and the `World` Durable Object.
- The production Foldkit build with the resolved `VITE_API_URL`.
