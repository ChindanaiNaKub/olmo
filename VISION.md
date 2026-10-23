# Vision

Olmo is a shared, persistent, side-view sandbox you play in a browser with friends.

Open a named world at `/w/<name>`, pick a nickname, and you are in. Dig the ground, place what you dug, build a small structure, and see the other people in the room. The world stays where you left it. There are no accounts, no inventory to lose, and no economy to grind.

The build method is [rat-stack](https://ratstack.sh). Effect owns the hard parts, Alchemy owns the cloud, Foldkit owns the client, and the fence keeps the easy path honest. This document is Olmo's product intent. The rat-stack reference remains the build reference.

## The game

- One screen is one world. The default world is `/w/lobby`; any lowercase name makes another persistent world.
- A world is 48 by 27 tiles at 24 pixels. The camera shows the whole room, so friends are always in view.
- Players move left and right, jump, punch a block, and place a block from their hotbar.
- Breaking is work. A block absorbs a few punches and shows the damage; harder blocks resist longer. The punch that finally breaks it collects it.
- A world can be claimed. The claim mints a key that lives only in that browser, and the owner can lock the world so only they dig and build. The lock is the point: a shared URL is safe to hand out because the owner's work cannot be flattened.
- `/w/lobby` is the commons. It cannot be claimed or locked.
- Chat is local to the world. Presence is local to the world.
- Tiles and the world name persist in the world's Durable Object storage.
- Six block types ship: dirt, grass, stone, wood, brick, and air. Breaking a block adds it to your inventory. Placing one spends it.
- A world holds up to 16 players.

The first session is the whole tutorial: move, jump, punch, place, say hello.

## The feel

Growtopia is the reference for how Olmo should feel, not for what it should contain. The room is chunky and readable, the punch takes effort, and the world answers back.

- Blocks have hard outlines, saturated faces, and visible crack stages as they take damage.
- The player is a small figure with a swinging arm, not a silhouette.
- The room has a banded sky, distant hills, and light that reads as outdoors.
- Every action has a sound: hit, break, place, jump. Sound is a handful of recorded files, not a synth.

The look is drawn from canvas primitives. There are no sprites and no image pipeline: readability and rhythm carry the feel, not fidelity.

## How it is built

- **One domain.** `@olmo/game` owns the schemas, physics, world rules, and capabilities. It is pure TypeScript and safe to import in a browser or a Worker.
- **One authority.** The `World` Durable Object owns tiles, sessions, and validation. The browser predicts its own movement and its own punch progress; the server corrects a move that is too far or inside a solid tile, and a punch that should not have landed.
- **Two transports, one implementation.** The socket carries movement, chat, and tile changes. RPC carries world creation and snapshots. Both call the same Durable Object methods.
- **A thin client.** `apps/game` is a Foldkit program. The view reads the model and sends messages. The socket is a managed resource. Commands return result messages.
- **Cloudflare from code.** `apps/infra` declares the API Worker, the Durable Object, and the static Foldkit site in one Alchemy Stack.

## Scope

v1 is owned worlds you share by URL. It is not a platform.

- No accounts, profiles, or friends lists. Ownership is a key kept in one browser, not an identity. Clearing that browser's storage leaves the world locked to an owner who can no longer prove it.
- No trading, gems, shops, or economy.
- No seeds, growth, or splicing. The grow loop is the first thing to add after the feel, and even then it is one growable that needs only a stored timestamp, not an item catalog.
- No moderation tools beyond the world URL.
- No world browser, search, or discovery page yet. Sharing is a URL you send, plus the lobby.
- No mobile-first controls or touch layout.
- No server-side rollback netcode. The server validates and corrects; it does not rewind.

## Status

The domain, server, client, and infrastructure typecheck and pass the full gate. The client has been played against a local protocol-compatible mock. The real Durable Object path has not run yet because the local Alchemy profile needs Cloudflare OAuth scopes selected.

The next proof is two browser windows on one deployed URL: see each other, move, punch, place, chat, reload, and find the same tiles.

The feel pass — punch effort, crack stages, optimistic hits, art, sound — is decided in `docs/adr/` and not built. It sits behind the deployed two-browser proof, not in front of it.

## Success

Two friends open the same URL on different machines. They see each other, build something small together, and come back later to find it still there. One of them claims the world, locks it, and sends the URL to someone new, who can walk through the work without being able to wreck it.
