import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: { enabled: false },
      filename: "sw.js",
      // The static public/manifest.json is the source of truth.
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-navigations",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: ({ sameOrigin, request }) =>
              sameOrigin &&
              (request.destination === "image" || request.destination === "font"),
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
