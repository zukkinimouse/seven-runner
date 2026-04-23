import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // GitHub Pages (project site) の配信パスを固定する
  base: "/seven-runner/",
  server: { port: 5173, host: true },
  build: { target: "esnext" },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
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
