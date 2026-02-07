import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwind()],
  base: "/static/",
  build: {
    outDir: "dist",
    assetsDir: "",
  server: { port: 5173 },
  },
});