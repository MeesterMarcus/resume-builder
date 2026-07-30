import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
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
const securityHeaders = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'sha256-VMefWjQ7SbGXsfKMa6Equmdz+kEDbDB0qvfYe+Th8hU=' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function resolveRequestPath(url = "/") {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const routePath = pathname === "/app" ? "/app/" : pathname;
  const relativePath = routePath === "/" ? "index.html" : routePath.endsWith("/") ? `${routePath.slice(1)}index.html` : routePath.slice(1);
  const resolvedPath = path.resolve(sourceDirectory, relativePath);

  if (!resolvedPath.startsWith(`${sourceDirectory}${path.sep}`)) {
    return null;
  }

  return resolvedPath;
}

function sendJson(response, status, body) {
  response.writeHead(status, { ...securityHeaders, "Content-Type": "application/json; charset=utf-8" });
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
      configured: Boolean(config.openAiApiKey),
      hostedAccess: Boolean(config.openAiApiKey),
      byokSupported: true,
      model: config.openAiModel ?? "gpt-5.6-luna",
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/ai/revise") {
    try {
      const result = await reviseResume(await readJson(request), request.headers["x-openai-api-key"]?.trim());
      sendJson(response, 200, { resume: result });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  const filePath = resolveRequestPath(request.url);

  if (!filePath) {
    response.writeHead(403, { ...securityHeaders, "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) throw new Error("Not a file");

    let content = null;
    if (path.basename(filePath) === "index.html") {
      content = await readFile(filePath, "utf8");
      content = content.replaceAll("__SITE_ORIGIN__", `http://${request.headers.host}`);
    }
    response.writeHead(200, {
      ...securityHeaders,
      "Cache-Control": "no-store",
      "Content-Type": contentTypes[path.extname(filePath)] ?? "application/octet-stream",
    });
    if (content !== null) response.end(content);
    else createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { ...securityHeaders, "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(config.port, config.host, () => {
  console.log(`RapidCV is running at http://${config.host}:${config.port}`);
});
