import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwind()],
  // ✅ local dev should be "/", production build stays "/static/"
  base: mode === "development" ? "/" : "/static/",
  server: { port: 5173 },
  build: {
    outDir: "dist",
    assetsDir: "",
  },
}));