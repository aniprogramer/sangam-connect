import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@sangam/shared": path.resolve(__dirname, "../../packages/shared/src/index.js"),
      "@sangam/api-client": path.resolve(__dirname, "../../packages/api-client/src/index.js"),
      "@sangam/tokens": path.resolve(__dirname, "../../packages/tokens/src/index.js"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8002",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:8002",
        ws: true,
      },
    },
  },
});
