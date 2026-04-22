import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages (project site) の配信パスを固定する
  base: "/seven-runner/",
  server: { port: 5173, host: true },
  build: { target: "esnext" },
});
