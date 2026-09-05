import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { resumeData } from "../src/resume-data.js";

const port = 18080;
const origin = process.env.BROWSER_TEST_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.BROWSER_TEST_ORIGIN
  ? null
  : spawn(process.execPath, ["src/server.js"], {
      env: {
        ...process.env,
        PORT: String(port),
        HOST: "127.0.0.1",
        OPENAI_API_KEY: "",
      },
      stdio: ["ignore", "pipe", "inherit"],
    });
let browser;
let page;
try {
  if (server)
    await Promise.race([
      once(server.stdout, "data"),
      once(server, "exit").then(([code]) => {
        throw new Error(`Local server exited before startup (${code})`);
      }),
    ]);
  browser = await puppeteer.launch({
    headless: true,
    args: ["--disable-crash-reporter", "--no-crash-upload"],
  });
  page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("net::ERR"))
      errors.push(message.text());
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.setRequestInterception(true);
  let aiRequest;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/ai/status"))
      return request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ hostedAccess: true }),
      });
    if (request.url().endsWith("/api/ai/revise")) {
      aiRequest = JSON.parse(request.postData());
      const resume = structuredClone(aiRequest.currentResume);
      resume.summary = "AI revision for browser verification.";
      return request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ resume }),
      });
    }
    if (
      !request.url().startsWith(origin) &&
      !request.url().startsWith("data:") &&
      !request.url().startsWith("about:") &&
      !request.url().startsWith("https://fonts.googleapis.com/") &&
      !request.url().startsWith("https://fonts.gstatic.com/")
    )
      return request.abort();
    request.continue();
  });
  for (const route of ["/", "/privacy/", "/terms/", "/roadmap/"]) {
    const response = await page.goto(origin + route);
    assert.equal(response.status(), 200);
    assert.equal(
      await page.$eval("body", (element) =>
        element.textContent.includes("RapidCV"),
      ),
      true,
    );
  }
  await page.goto(origin + "/app/");
  await page.waitForSelector(".resume-empty");
  const legacy = structuredClone(resumeData);
  legacy.basics.name = "Migration Example";
  legacy.basics.title = "Product Engineer";
  legacy.summary = "An existing saved résumé survives the migration.";
  legacy.experience = [
    {
      company: "Example Company",
      role: "Engineer",
      dates: "2020–2026",
      location: "Remote",
      bullets: ["Delivered reliable products."],
    },
  ];
  legacy.skills = [{ category: "Engineering", items: "JavaScript, React" }];
  await page.evaluate((data) => {
    localStorage.setItem("cv-studio-resume-v1", JSON.stringify(data));
    localStorage.setItem("cv-studio-document-name", "Existing draft");
    localStorage.setItem("cv-studio-theme", "teal");
    localStorage.setItem("cv-studio-layout", "executive");
    localStorage.setItem("cv-studio-text-scale-v2", "1.125");
  }, legacy);
  await page.reload();
  await page.waitForSelector(".resume-header h1");
  assert.equal(
    await page.$eval('[name="basics.name"]', (el) => el.value),
    "Migration Example",
  );
  assert.equal(
    await page.$eval("#currentDesignName", (el) => el.textContent),
    "Executive",
  );
  await page.type('[name="basics.name"]', " Updated");
  await page.waitForFunction(() =>
    document
      .querySelector(".resume-header h1")
      .textContent.endsWith(" Updated"),
  );
  await page.click("#saveButton");
  await page.waitForFunction(
    () => document.querySelector("#saveStatus").textContent === "Saved locally",
  );
  await page.reload();
  await page.waitForSelector(".resume-header h1");
  assert.equal(
    await page.$eval('[name="basics.name"]', (el) => el.value),
    "Migration Example Updated",
  );
  await page.click('[data-target="experience"]');
  await page.click("#addExperienceButton");
  assert.equal(await page.$$eval(".role-card", (els) => els.length), 2);
  await page.type('[name="experience.1.company"]', "Second Company");
  await page.type(
    '[name="experience.1.bullets"]',
    "First bullet\nSecond bullet",
  );
  assert.equal(
    await page.$eval('[name="experience.1.bullets"]', (el) => el.value),
    "First bullet\nSecond bullet",
  );
  await page.click('[data-remove-experience="1"]');
  assert.equal(await page.$$eval(".role-card", (els) => els.length), 1);
  await page.click('[data-target="skills"]');
  await page.click("#addSkillButton");
  await page.click('[data-remove-skill="1"]');
  await page.click("#openDesignButton");
  await page.waitForSelector(".design-live-frame");
  assert.equal(await page.$$eval(".design-card", (els) => els.length), 10);
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".design-live-frame")].every(
      (frame) => frame.contentDocument?.styleSheets.length >= 3,
    ),
  );
  await page.click('[data-select-layout="sidebar"]');
  await page.waitForFunction(
    () => document.documentElement.dataset.resumeLayout === "sidebar",
  );
  await page.click('[data-theme="plum"]');
  await page.click("#textSizeUp");
  await page.click("#saveButton");
  await page.click("#openHistoryButton");
  await page.waitForSelector(".history-entry");
  assert.ok((await page.$$eval(".history-entry", (els) => els.length)) >= 2);
  await page.click(".history-entry:last-child");
  await page.waitForFunction(
    () => document.documentElement.dataset.resumeLayout === "executive",
  );
  await page.click("#documentName");
  await page.waitForSelector("#actionModalInput");
  await page.$eval("#actionModalInput", (el) => el.select());
  await page.type("#actionModalInput", "React draft");
  await page.click("#actionModalConfirmButton");
  await page.waitForFunction(() =>
    document.querySelector("#documentName").textContent.includes("React draft"),
  );
  const backup = {
    ...legacy,
    basics: { ...legacy.basics, name: "Imported Person" },
  };
  await mkdir("tmp", { recursive: true });
  await writeFile("tmp/browser-backup.json", JSON.stringify(backup));
  await (
    await page.$("#backupFileInput")
  ).uploadFile("tmp/browser-backup.json");
  await page.waitForSelector("#actionModalConfirmButton");
  await page.click("#actionModalConfirmButton");
  await page.waitForFunction(
    () =>
      document.querySelector(".resume-header h1").textContent ===
      "Imported Person",
  );
  await page.click("#openAiButton");
  await page.waitForFunction(
    () =>
      document.querySelector("#aiAccessTitle").textContent ===
      "Hosted AI access available",
  );
  await writeFile("tmp/browser-resume.txt", "Sample uploaded resume");
  await (await page.$("#resumeFile")).uploadFile("tmp/browser-resume.txt");
  await page.waitForFunction(
    () =>
      document.querySelector("#resumeFileName").textContent ===
      "browser-resume.txt",
  );
  await page.waitForFunction(() => {
    const button = document.querySelector("#removeResumeFile");
    const rect = button.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.right <= innerWidth &&
      getComputedStyle(button).opacity === "1"
    );
  });
  await page.click("#removeResumeFile");
  await page.type("#aiPrompt", "Improve the summary.");
  await page.click("#sendAiButton");
  await page.waitForSelector("#changeBar.visible");
  assert.equal(aiRequest.prompt, "Improve the summary.");
  assert.equal(aiRequest.documents.length, 0);
  await page.waitForFunction(
    () =>
      document.querySelector(".summary-copy").textContent ===
      "AI revision for browser verification.",
  );
  await page.click("#undoAiButton");
  await page.waitForFunction(
    () =>
      document.querySelector(".summary-copy").textContent ===
      "An existing saved résumé survives the migration.",
  );
  await page.evaluate(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = function (blob) {
      blob.text().then((text) => {
        window.exportedBackup = JSON.parse(text);
      });
      return original.call(URL, blob);
    };
  });
  await page.click("#backupMenuButton");
  await page.click("#exportBackupButton");
  await page.waitForFunction(
    () => window.exportedBackup?.kind === "rapidcv-backup",
  );
  assert.equal(
    await page.evaluate(() => window.exportedBackup.resume.basics.name),
    "Imported Person",
  );
  await page.click("#resetButton");
  await page.waitForSelector("#actionModalCancelButton");
  await page.click("#actionModalCancelButton");
  assert.equal(
    await page.$eval(".resume-header h1", (el) => el.textContent),
    "Imported Person",
  );
  await page.click("#saveButton");
  await page.click("#resetButton");
  await page.waitForSelector("#actionModalConfirmButton");
  await page.click("#actionModalConfirmButton");
  await page.waitForSelector(".resume-empty");
  await page.click("#openHistoryButton");
  await page.waitForSelector(".history-entry");
  await page.click(".history-entry");
  await page.waitForSelector(".resume-header h1");
  await page.click("#saveButton");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  await page.screenshot({
    path: "tmp/react-editor-desktop.png",
    fullPage: true,
  });
  await page.emulateMediaType("print");
  assert.equal(
    await page.$eval(".topbar", (el) => getComputedStyle(el).display),
    "none",
  );
  const pdf = await page.pdf({
    path: "tmp/react-editor-test.pdf",
    format: "Letter",
    printBackground: true,
    preferCSSPageSize: true,
  });
  assert.ok(pdf.length > 1000);
  await page.emulateMediaType("screen");
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  await page.screenshot({
    path: "tmp/react-editor-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.$eval("body", (el) => el.scrollWidth <= window.innerWidth),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: public routes, legacy storage, editing, save/reload, collections, designs, history, rename, backup import/export, reset/restore, mocked AI/undo, PDF, and mobile layout.",
  );
} catch (error) {
  if (page) {
    await page.screenshot({ path: "tmp/browser-failure.png", fullPage: true });
  }
  throw error;
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
