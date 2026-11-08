import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the React app runs on 5173 and forwards /api to Express on
// 3000, so the browser sees one origin and session cookies just work.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
