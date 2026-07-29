import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reviseResume } from "./ai-service.js";
import { config } from "./config.js";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function resolveRequestPath(url = "/") {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const resolvedPath = path.resolve(sourceDirectory, relativePath);

  if (!resolvedPath.startsWith(`${sourceDirectory}${path.sep}`)) {
    return null;
  }

  return resolvedPath;
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 15 * 1024 * 1024) throw new Error("The upload is too large. Keep files under 10 MB.");
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/api/ai/status") {
    sendJson(response, 200, {
      configured: Boolean(config.openAiApiKey && config.openAiModel),
      model: config.openAiModel ?? null,
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/ai/revise") {
    try {
      const result = await reviseResume(await readJson(request));
      sendJson(response, 200, { resume: result });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  const filePath = resolveRequestPath(request.url);

  if (!filePath) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) throw new Error("Not a file");

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes[path.extname(filePath)] ?? "application/octet-stream",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(config.port, config.host, () => {
  console.log(`CV Studio is running at http://${config.host}:${config.port}`);
});
