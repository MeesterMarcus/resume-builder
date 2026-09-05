import { build, loadEnv } from "vite";
import { copyFile } from "node:fs/promises";

const buildEnv = loadEnv("production", process.cwd(), "VITE_");
if (!/^pk_(test|live)_[A-Za-z0-9]+$/.test(buildEnv.VITE_CLERK_PUBLISHABLE_KEY ?? "")) {
  throw new Error("Set VITE_CLERK_PUBLISHABLE_KEY in Cloudflare Builds variables before building. A Worker runtime variable alone is not available to Vite.");
}
await build();
// The Worker serves these aliases to avoid static-asset canonical redirects.
await Promise.all(
  ["privacy", "terms", "roadmap"].map((route) =>
    copyFile(`dist/site/${route}/index.html`, `dist/site/${route}.page`),
  ),
);
console.log("Built React + Vite assets for Cloudflare.");
