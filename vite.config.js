import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: "src",
  envDir: process.cwd(),
  publicDir: "../public",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    proxy: { "/api": "http://127.0.0.1:8080" },
  },
  build: {
    outDir: "../dist/site",
    emptyOutDir: true,
    rolldownOptions: {
      input: Object.fromEntries(
        [
          "index.html",
          "app/index.html",
          "privacy/index.html",
          "terms/index.html",
          "roadmap/index.html",
        ].map((entry) => [entry, path.resolve("src", entry)]),
      ),
    },
  },
});
