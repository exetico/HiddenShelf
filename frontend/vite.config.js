import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET || "http://localhost:8000";
const basePath = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  plugins: [vue()],
  base: basePath,
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      "/h": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      "/public/view.html": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      "/public/output.css": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      "/public/favicon.png": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../public/app",
    emptyOutDir: true,
  },
});
