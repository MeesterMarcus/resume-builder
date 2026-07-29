import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile() {
  const envPath = path.join(projectDirectory, ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;

    const value = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    process.env[match[1]] = value;
  }
}

loadEnvFile();

export const config = {
  host: process.env.HOST ?? "127.0.0.1",
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL,
  port: Number.parseInt(process.env.PORT ?? "8080", 10),
};

