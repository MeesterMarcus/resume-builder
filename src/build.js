import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(sourceDir, "../dist");
const previewDir = path.resolve(sourceDir, "../tmp/pdfs");
const mimeTypes = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });
const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), "cv-studio-"));
const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, "http://localhost");
  const requestedPath = requestUrl.pathname === "/" ? "/app/index.html" : requestUrl.pathname;
  const filePath = path.join(outputDir, "site", requestedPath);
  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] ?? "application/octet-stream" });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

const browser = await puppeteer.launch({
  headless: true,
  userDataDir: profileDir,
  args: ["--disable-crash-reporter", "--no-crash-upload"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1200, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#resumePreview .resume-page");
  await page.emulateMediaType("print");
  await page.pdf({
    path: path.join(outputDir, "marcus-lorenzana-resume.pdf"),
    format: "Letter",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await page.emulateMediaType("screen");
  await page.evaluate(() => {
    const resumeMarkup = document.querySelector("#resumePreview").innerHTML;
    document.body.innerHTML = resumeMarkup;
    document.body.style.cssText = "margin:0;background:white;width:816px;";
    document.querySelectorAll(".resume-page").forEach((resumePage) => {
      resumePage.style.cssText = "transform:none;margin:0;box-shadow:none;";
    });
  });
  const pages = await page.$$(".resume-page");
  for (const [index, resumePage] of pages.entries()) {
    await resumePage.screenshot({ path: path.join(previewDir, `resume-page-${index + 1}.png`) });
  }
  console.log("Created dist/marcus-lorenzana-resume.pdf");
} finally {
  await browser.close();
  server.close();
  await fs.rm(profileDir, { recursive: true, force: true });
}
