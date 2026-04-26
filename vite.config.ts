import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Phaser のシーン状態は HMR だけでは差し替わりにくいため、
// src 配下の変更時はフルリロードで必ず最新状態にする。
function fullReloadOnSrcChange(): Plugin {
  return {
    name: "full-reload-on-src-change",
    configureServer(server) {
      server.watcher.on("change", (filePath) => {
        const normalized = filePath.replace(/\\/g, "/");
        if (!normalized.includes("/src/")) return;
        server.ws.send({ type: "full-reload", path: "*" });
      });
    },
  };
}

export default defineConfig({
  // Vercel は "/"、GitHub Pages は "/seven-runner/" を使う
  // （VERCEL 環境変数は Vercel ビルド時に自動で付与される）
  base: process.env.VERCEL ? "/" : "/seven-runner/",
  server: {
    port: 5173,
    host: true,
    // Windows 環境で保存イベントが取りこぼされる場合の保険
    watch:
      process.platform === "win32"
        ? {
            usePolling: true,
            interval: 200,
          }
        : undefined,
  },
  build: { target: "esnext" },
  plugins: [
    fullReloadOnSrcChange(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "icons/pwa-192.png",
        "icons/pwa-512.png",
        "icons/apple-touch-icon.png",
      ],
      manifest: {
        name: "コンビニランナー",
        short_name: "コンビニランナー",
        description: "コンビニで稼ぐ横スクロールランゲーム",
        theme_color: "#111111",
        background_color: "#111111",
        display: "standalone",
        orientation: "landscape",
        start_url: "./",
        scope: "./",
        icons: [
          {
            src: "icons/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg,mp3,woff2}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
