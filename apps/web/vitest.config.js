import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@sangam/shared": path.resolve(__dirname, "../../packages/shared/src/index.js"),
      "@sangam/api-client": path.resolve(__dirname, "../../packages/api-client/src/index.js"),
      "@sangam/tokens": path.resolve(__dirname, "../../packages/tokens/src/index.js"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/setupTests.js"],
  },
});
