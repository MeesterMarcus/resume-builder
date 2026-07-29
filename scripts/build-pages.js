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

await fs.writeFile(
  path.join(outputDirectory, "_routes.json"),
  `${JSON.stringify({ version: 1, include: ["/api/*"], exclude: [] }, null, 2)}\n`,
);
await fs.writeFile(
  path.join(outputDirectory, "_headers"),
  `/*
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`,
);

console.log(`Built Cloudflare Pages assets in ${path.relative(projectDirectory, outputDirectory)}`);
