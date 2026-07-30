import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(projectDirectory, "src");
const outputDirectory = path.join(projectDirectory, "dist", "site");
const browserAssets = [
  "app.js",
  "action-modal.js",
  "analytics.js",
  "backup-service.js",
  "index.html",
  "landing.css",
  "landing.js",
  "legal.css",
  "resume-layouts.css",
  "resume-data.js",
  "robots.txt",
  "site.webmanifest",
  "sitemap.xml",
  "styles.css",
  "version-history.js",
];

await fs.rm(outputDirectory, { recursive: true, force: true });
await fs.mkdir(outputDirectory, { recursive: true });

await Promise.all(
  browserAssets.map((fileName) =>
    fs.copyFile(path.join(sourceDirectory, fileName), path.join(outputDirectory, fileName)),
  ),
);
await fs.mkdir(path.join(outputDirectory, "app"), { recursive: true });
await fs.copyFile(path.join(sourceDirectory, "app", "index.html"), path.join(outputDirectory, "app", "index.html"));
await Promise.all(
  ["privacy", "terms"].map(async (route) => {
    await fs.mkdir(path.join(outputDirectory, route), { recursive: true });
    await fs.copyFile(path.join(sourceDirectory, route, "index.html"), path.join(outputDirectory, route, "index.html"));
    await fs.copyFile(path.join(sourceDirectory, route, "index.html"), path.join(outputDirectory, `${route}.page`));
  }),
);
await fs.cp(path.join(sourceDirectory, "assets"), path.join(outputDirectory, "assets"), { recursive: true });

console.log(`Built Cloudflare assets in ${path.relative(projectDirectory, outputDirectory)}`);
