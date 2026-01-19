import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@eskiz/spec": path.resolve(__dirname, "../../packages/spec/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
});
