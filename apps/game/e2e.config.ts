import { web } from "@e2e-dev/web";
import type { E2EConfig } from "e2e";

export default {
  targets: [
    {
      app: {
        command: {
          args: [
            "exec",
            "vite",
            "--host",
            "127.0.0.1",
            "--port",
            "{port}",
            "--strictPort",
          ],
          env: { VITE_API_URL: "http://127.0.0.1:1" },
          executable: "pnpm",
          log: ".e2e/logs/app.log",
        },
        url: "http://127.0.0.1:0",
      },
      engine: web(),
    },
  ],
} satisfies E2EConfig;
