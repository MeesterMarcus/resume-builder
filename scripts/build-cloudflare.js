import { build } from "vite";
import { copyFile } from "node:fs/promises";

await build();
// The Worker serves these aliases to avoid static-asset canonical redirects.
await Promise.all(
  ["privacy", "terms", "roadmap"].map((route) =>
    copyFile(`dist/site/${route}/index.html`, `dist/site/${route}.page`),
  ),
);
console.log("Built React + Vite assets for Cloudflare.");
