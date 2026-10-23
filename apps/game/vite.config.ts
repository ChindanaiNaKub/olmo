import { foldkit } from "@foldkit/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  build: { outDir: "dist" },
  plugins: [foldkit()],
  server: { port: 5174 },
});
