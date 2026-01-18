import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Determine API target: use service name in Docker, localhost for local dev
// Default to localhost:3000 for local development without Docker
// In Docker Compose dev, VITE_API_URL=http://api:4000 is set automatically
const apiTarget = process.env.VITE_API_URL || "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
