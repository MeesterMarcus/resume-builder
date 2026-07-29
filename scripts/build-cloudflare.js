import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(projectDirectory, "src");
const outputDirectory = path.join(projectDirectory, "dist", "site");
const browserAssets = [
  "app.js",
  "index.html",
  "resume-data.js",
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

console.log(`Built Cloudflare assets in ${path.relative(projectDirectory, outputDirectory)}`);
