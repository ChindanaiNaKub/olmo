# olmo

A shared, persistent, side-view sandbox. Open `/w/<name>`, pick a nickname, and build with friends.

The product intent is in `VISION.md`. The build method is [rat-stack](https://ratstack.sh); deliberate departures are in `docs/rat-stack-deviations.md`.

## Run

```sh
pnpm install
pnpm dev
```

The client runs on port 5174. It expects the game API on port 1337 by default. Set `VITE_API_URL` to point at another API.

The full local stack needs an Alchemy Cloudflare profile:

```sh
pnpm alchemy profile refresh --profile default --provider Cloudflare
pnpm infra:dev
```

## Check

```sh
pnpm turbo run check test build --concurrency=1
```

Created in [T3 Code](https://t3.codes).
