import { defineConfig } from "vitest/config";

import { stylexRenderingPlugin } from "./stylex.js";

export default defineConfig({
  plugins: [stylexRenderingPlugin()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          environment: "jsdom",
          include: [
            "test/app.test.ts",
            "test/overlay.test.ts",
            "test/reader-csp.test.ts",
          ],
          name: "browser",
        },
      },
      {
        extends: true,
        test: {
          environment: "node",
          exclude: [
            "test/app.test.ts",
            "test/overlay.test.ts",
            "test/reader-csp.test.ts",
          ],
          hookTimeout: 30_000,
          include: ["test/**/*.test.ts"],
          name: "server",
          testTimeout: 30_000,
        },
      },
    ],
  },
});
