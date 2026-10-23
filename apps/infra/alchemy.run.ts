import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

import { privateObservability } from "../server/src/observability.js";
import Api from "../server/src/worker.js";

export default Alchemy.Stack(
  "Olmo",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* stack() {
    const api = yield* Api;

    const web = yield* Cloudflare.Website.Foldkit("Web", {
      dev: { port: 5174 },
      env: { VITE_API_URL: api.url.as<string>() },
      observability: privateObservability,
      rootDir: "../game",
    });

    return { api: api.url.as<string>(), web: web.url };
  })
);
