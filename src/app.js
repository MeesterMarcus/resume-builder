import { resumeData as defaultData } from "./resume-data.js";
import { VersionHistory } from "./version-history.js";

const STORAGE_KEY = "cv-studio-resume-v1";
const THEME_KEY = "cv-studio-theme";
const HISTORY_KEY = "cv-studio-history-v1";
const clone = (value) => JSON.parse(JSON.stringify(value));
let data = clone(defaultData);
let zoom = 0.82;
let previousAiVersion = null;
let isDirty = false;
const aiDocuments = { resume: null, job: null };
const versionHistory = new VersionHistory(HISTORY_KEY, 10);

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) data = { ...data, ...JSON.parse(saved) };
} catch {
  // Storage can be unavailable in private browsing; the editor still works.
}

const form = document.querySelector("#resumeForm");
const preview = document.querySelector("#resumePreview");
const saveStatus = document.querySelector("#saveStatus");
const escapeHtml = (value = "") =>
  value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);

function fillEditor() {
  form.querySelectorAll("[name]").forEach((field) => {
    const path = field.name.split(".");
    let value = data;
    path.forEach((key) => (value = value?.[key]));
    if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = value ?? "";
  });

  document.querySelector("#experienceFields").innerHTML = data.experience
    .map(
      (role, index) => `
        <fieldset class="role-card">
          <legend><span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(role.company || "New role")}</legend>
          <button class="remove-button" type="button" data-remove-experience="${index}" aria-label="Remove ${escapeHtml(role.company || "role")}">Remove</button>
          <label>Company<input name="experience.${index}.company" value="${escapeHtml(role.company)}"></label>
          <label>Role<input name="experience.${index}.role" value="${escapeHtml(role.role)}"></label>
          <div class="field-row">
            <label>Dates<input name="experience.${index}.dates" value="${escapeHtml(role.dates)}"></label>
            <label>Location<input name="experience.${index}.location" value="${escapeHtml(role.location)}"></label>
          </div>
          <label>Highlights<textarea name="experience.${index}.bullets" rows="7">${escapeHtml(role.bullets.join("\n"))}</textarea><span class="field-hint">One achievement per line</span></label>
        </fieldset>`,
    )
    .join("");

  document.querySelector("#skillFields").innerHTML = data.skills
    .map(
      (skill, index) => `
        <div class="skill-field">
          <button class="remove-button" type="button" data-remove-skill="${index}" aria-label="Remove ${escapeHtml(skill.category || "skill group")}">Remove</button>
          <label>Category<input name="skills.${index}.category" value="${escapeHtml(skill.category)}"></label>
          <label>Skills<input name="skills.${index}.items" value="${escapeHtml(skill.items)}"></label>
        </div>`,
    )
    .join("");
  document.querySelector("#summaryCount").textContent = data.summary.length;
  document.querySelector("#closingEditorFields").classList.toggle("disabled", !data.closingStatement.enabled);
}

const sectionTitle = (title) => `<h2 class="resume-section-title">${title}</h2>`;
const experienceHtml = (roles) =>
  roles
    .map(
      (role) => `<article class="resume-role">
        <div class="role-heading"><div><h3>${escapeHtml(role.company)}</h3><p>${escapeHtml(role.role)}</p></div><div class="role-meta"><strong>${escapeHtml(role.dates)}</strong><span>${escapeHtml(role.location)}</span></div></div>
        <ul>${role.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>
      </article>`,
    )
    .join("");

function renderPreview() {
  const hasResumeContent =
    Object.values(data.basics).some((value) => value.trim()) ||
    data.summary.trim() ||
    data.achievements.length ||
    data.skills.length ||
    data.experience.length ||
    Object.values(data.education).some((value) => value.trim()) ||
    (data.closingStatement.enabled && data.closingStatement.text.trim());

  if (!hasResumeContent) {
    preview.innerHTML = `
      <article class="resume-page resume-empty">
        <div class="resume-empty-state">
          <span>01</span>
          <h2>Your résumé starts here.</h2>
          <p>Add your details manually, upload an existing résumé, or ask AI to help you build the first draft.</p>
        </div>
      </article>`;
    preview.style.setProperty("--preview-scale", zoom);
    return;
  }

  const firstRoles = data.experience.slice(0, 3);
  const secondRoles = data.experience.slice(3);
  preview.innerHTML = `
    <article class="resume-page">
      <header class="resume-header">
        <div class="header-main">${data.basics.documentLabel?.trim() ? `<p class="resume-kicker">${escapeHtml(data.basics.documentLabel)} · ${new Date().getFullYear()}</p>` : ""}<h1>${escapeHtml(data.basics.name)}</h1><h2>${escapeHtml(data.basics.title)}</h2></div>
        <address>
          <span>${escapeHtml(data.basics.location)}</span><span>${escapeHtml(data.basics.phone)}</span>
          <a href="mailto:${escapeHtml(data.basics.email)}">${escapeHtml(data.basics.email)}</a>
          <span>${escapeHtml(data.basics.portfolio)}</span>
        </address>
      </header>
      <p class="resume-tagline">${escapeHtml(data.basics.tagline)}</p>
      <section>${sectionTitle("Profile")}<p class="summary-copy">${escapeHtml(data.summary)}</p></section>
      ${data.achievements?.length ? `<section>${sectionTitle("Selected impact")}<div class="achievement-grid">${data.achievements.map((item) => `<div><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></div>`).join("")}</div></section>` : ""}
      <section>${sectionTitle("Core competencies")}<div class="skills-grid">${data.skills.map((skill) => `<div><strong>${escapeHtml(skill.category)}</strong><span>${escapeHtml(skill.items)}</span></div>`).join("")}</div></section>
      <section>${sectionTitle("Professional experience")}${experienceHtml(firstRoles)}</section>
      <footer><span>${escapeHtml(data.basics.name)}</span><span>01 / 02</span></footer>
    </article>
    <article class="resume-page">
      <div class="page-two-heading"><span>${escapeHtml(data.basics.name)}</span><span>${escapeHtml(data.basics.title)}</span></div>
      <section>${sectionTitle("Professional experience · continued")}${experienceHtml(secondRoles)}</section>
      <section class="education-section">${sectionTitle("Education")}<div class="education-row"><div><h3>${escapeHtml(data.education.school)}</h3><p>${escapeHtml(data.education.degree)}</p></div><strong>${escapeHtml(data.education.date)}</strong></div></section>
      ${data.closingStatement.enabled && data.closingStatement.text.trim() ? `<section class="philosophy"><span>${escapeHtml(data.closingStatement.label || "Professional value")}</span><p>${escapeHtml(data.closingStatement.text)}</p></section>` : ""}
      <footer><span>${escapeHtml(data.basics.name)}</span><span>02 / 02</span></footer>
    </article>`;
  preview.style.setProperty("--preview-scale", zoom);
}

function setByPath(path, value) {
  const keys = path.split(".");
  let target = data;
  keys.slice(0, -1).forEach((key) => (target = target[key]));
  const finalKey = keys.at(-1);
  target[finalKey] = finalKey === "bullets" ? value.split("\n").filter((line) => line.trim()) : value;
}

function updateCompletion() {
  const fields = [...form.querySelectorAll("input, textarea")];
  const complete = fields.filter((field) => field.value.trim()).length;
  const percent = Math.round((complete / fields.length) * 100);
  document.querySelector("#completion").textContent = `${percent}%`;
  document.querySelector("#progressBar").style.width = `${percent}%`;
}

function markDirty(message = "Unsaved changes") {
  isDirty = true;
  saveStatus.textContent = message;
  document.querySelector("#saveButton").classList.add("dirty");
}

function createVersion(label, force = false) {
  const created = versionHistory.snapshot({
    data,
    theme: document.documentElement.dataset.resumeTheme ?? "blue",
    label,
  }, force);
  if (created) renderVersionHistory();
  return created;
}

function saveResume() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(THEME_KEY, document.documentElement.dataset.resumeTheme ?? "blue");
    const created = createVersion("Saved version");
    isDirty = false;
    saveStatus.textContent = "Saved locally";
    document.querySelector("#saveButton").classList.remove("dirty");
    showToast(created ? "Version saved" : "Everything is already saved");
  } catch {
    saveStatus.textContent = "Could not save locally";
    showToast("Browser storage is unavailable");
  }
}

form.addEventListener("input", (event) => {
  setByPath(event.target.name, event.target.type === "checkbox" ? event.target.checked : event.target.value);
  if (event.target.name === "summary") document.querySelector("#summaryCount").textContent = event.target.value.length;
  if (event.target.name === "closingStatement.enabled") {
    document.querySelector("#closingEditorFields").classList.toggle("disabled", !event.target.checked);
  }
  renderPreview();
  updateCompletion();
  markDirty();
});

function refreshEditorAfterCollectionChange(section, focusLast = false) {
  fillEditor();
  renderPreview();
  updateCompletion();
  markDirty();
  if (focusLast) requestAnimationFrame(() => {
    const container = document.querySelector(section === "experience" ? "#experienceFields" : "#skillFields");
    container.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
    container.lastElementChild?.querySelector("input")?.focus({ preventScroll: true });
  });
}

document.querySelector("#addExperienceButton").addEventListener("click", () => {
  data.experience.push({
    company: "",
    role: "",
    dates: "",
    location: "",
    bullets: [""],
  });
  refreshEditorAfterCollectionChange("experience", true);
});

document.querySelector("#addSkillButton").addEventListener("click", () => {
  data.skills.push({ category: "", items: "" });
  refreshEditorAfterCollectionChange("skills", true);
});

form.addEventListener("click", (event) => {
  const experienceButton = event.target.closest("[data-remove-experience]");
  if (experienceButton) {
    data.experience.splice(Number(experienceButton.dataset.removeExperience), 1);
    refreshEditorAfterCollectionChange("experience");
    return;
  }

  const skillButton = event.target.closest("[data-remove-skill]");
  if (skillButton) {
    data.skills.splice(Number(skillButton.dataset.removeSkill), 1);
    refreshEditorAfterCollectionChange("skills");
  }
});

document.querySelectorAll(".tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab, .form-section").forEach((element) => element.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`[data-section="${tab.dataset.target}"]`).classList.add("active");
  }),
);

function setZoom(nextZoom) {
  zoom = Math.min(1, Math.max(0.58, nextZoom));
  document.querySelector("#zoomValue").textContent = `${Math.round(zoom * 100)}%`;
  preview.style.setProperty("--preview-scale", zoom);
}
document.querySelector("#zoomOut").addEventListener("click", () => setZoom(zoom - 0.06));
document.querySelector("#zoomIn").addEventListener("click", () => setZoom(zoom + 0.06));
document.querySelector("#exportButton").addEventListener("click", () => window.print());
document.querySelector("#resetButton").addEventListener("click", () => {
  if (!confirm("Clear every field and start with a blank résumé?")) return;
  data = clone(defaultData);
  fillEditor();
  renderPreview();
  updateCompletion();
  markDirty("Blank résumé not saved");
  showToast("Résumé cleared");
});
document.querySelector("#saveButton").addEventListener("click", saveResume);
window.addEventListener("beforeunload", (event) => {
  if (!isDirty) return;
  event.preventDefault();
});
document.querySelector("#documentName").addEventListener("click", () => {
  const current = document.querySelector("#documentName").childNodes[0].textContent.trim();
  const next = prompt("Document name", current);
  if (next?.trim()) document.querySelector("#documentName").childNodes[0].textContent = `${next.trim()} `;
});

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function setTheme(theme, record = true) {
  document.documentElement.dataset.resumeTheme = theme;
  document.querySelectorAll(".color-swatch").forEach((swatch) => {
    swatch.classList.toggle("active", swatch.dataset.theme === theme);
  });
  if (record) markDirty("Color change not saved");
}

document.querySelectorAll(".color-swatch").forEach((swatch) => {
  swatch.addEventListener("click", () => setTheme(swatch.dataset.theme));
});

const aiDrawer = document.querySelector("#aiDrawer");
const aiBackdrop = document.querySelector("#aiBackdrop");
const aiStatus = document.querySelector("#aiStatus");
const aiPrompt = document.querySelector("#aiPrompt");

function toggleAiDrawer(open) {
  aiDrawer.classList.toggle("open", open);
  aiBackdrop.classList.toggle("open", open);
  aiDrawer.setAttribute("aria-hidden", String(!open));
  if (open) setTimeout(() => aiPrompt.focus(), 280);
}

document.querySelector("#openAiButton").addEventListener("click", () => toggleAiDrawer(true));
document.querySelector("#closeAiButton").addEventListener("click", () => toggleAiDrawer(false));
aiBackdrop.addEventListener("click", () => toggleAiDrawer(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && aiDrawer.classList.contains("open")) toggleAiDrawer(false);
});

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result });
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function setAiFile(kind, file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showToast("Please choose a file under 10 MB");
    return;
  }

  aiDocuments[kind] = await readFile(file);
  const label = document.querySelector(kind === "resume" ? "#resumeFileName" : "#jobFileName");
  label.textContent = file.name;
  label.closest(".drop-zone").classList.add("has-file");
}

function setupDropZone(kind, inputSelector, zoneSelector) {
  const input = document.querySelector(inputSelector);
  const zone = document.querySelector(zoneSelector);
  input.addEventListener("change", () => setAiFile(kind, input.files[0]));
  ["dragenter", "dragover"].forEach((eventName) =>
    zone.addEventListener(eventName, (event) => {
      event.preventDefault();
      zone.classList.add("dragging");
    }),
  );
  ["dragleave", "drop"].forEach((eventName) =>
    zone.addEventListener(eventName, (event) => {
      event.preventDefault();
      zone.classList.remove("dragging");
    }),
  );
  zone.addEventListener("drop", (event) => setAiFile(kind, event.dataTransfer.files[0]));
}

setupDropZone("resume", "#resumeFile", "#resumeDropZone");
setupDropZone("job", "#jobFile", "#jobDropZone");

document.querySelectorAll(".prompt-suggestions button").forEach((button) => {
  button.addEventListener("click", () => {
    aiPrompt.value = button.textContent;
    aiPrompt.focus();
  });
});

function setAiStatus(state, message) {
  aiStatus.classList.toggle("visible", state !== "idle");
  aiStatus.classList.toggle("error", state === "error");
  if (message) {
    aiStatus.querySelector("strong").textContent = state === "error" ? "Couldn’t update the résumé" : "Improving your résumé…";
    aiStatus.querySelector("small").textContent = message;
  }
}

function applyAiResume(resume) {
  previousAiVersion = clone(data);
  data = resume;
  fillEditor();
  renderPreview();
  updateCompletion();
  markDirty("AI changes not saved");
  document.querySelector("#changeBar").classList.add("visible");
  toggleAiDrawer(false);
}

async function runAi(action) {
  const prompt = aiPrompt.value.trim();
  if (action === "revise" && !prompt && !aiDocuments.resume && !aiDocuments.job) {
    setAiStatus("error", "Add a request or upload a document first.");
    return;
  }

  setAiStatus("loading", action === "optimize" ? "Checking impact, clarity, keywords, and concision." : "Applying your request without inventing details.");
  document.querySelectorAll("#optimizeButton, #sendAiButton").forEach((button) => (button.disabled = true));

  try {
    const response = await fetch("/api/ai/revise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        prompt,
        currentResume: data,
        documents: Object.values(aiDocuments).filter(Boolean),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "The request failed.");
    applyAiResume(result.resume);
    setAiStatus("idle");
    showToast("AI changes applied");
  } catch (error) {
    setAiStatus("error", error.message);
  } finally {
    document.querySelectorAll("#optimizeButton, #sendAiButton").forEach((button) => (button.disabled = false));
  }
}

document.querySelector("#optimizeButton").addEventListener("click", () => runAi("optimize"));
document.querySelector("#sendAiButton").addEventListener("click", () => runAi("revise"));
aiPrompt.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") runAi("revise");
});
document.querySelector("#undoAiButton").addEventListener("click", () => {
  if (!previousAiVersion) return;
  data = previousAiVersion;
  previousAiVersion = null;
  fillEditor();
  renderPreview();
  updateCompletion();
  markDirty("Undo not saved");
  document.querySelector("#changeBar").classList.remove("visible");
  showToast("AI changes undone");
});

function formatVersionTime(dateValue) {
  const date = new Date(dateValue);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function renderVersionHistory() {
  const list = document.querySelector("#historyList");
  const entries = versionHistory.all();
  list.innerHTML = entries.length
    ? entries
        .map(
          (entry, index) => `<button class="history-entry" data-version-id="${entry.id}">
            <span class="history-dot">${index === 0 ? "●" : "○"}</span>
            <span><strong>${escapeHtml(entry.label)}</strong><small>${formatVersionTime(entry.createdAt)}${index === 0 ? " · Current" : ""}</small></span>
            <span class="restore-label">${index === 0 ? "" : "Restore"}</span>
          </button>`,
        )
        .join("")
    : '<p class="empty-history">Your saved versions will appear here.</p>';
}

const historyDrawer = document.querySelector("#historyDrawer");
const historyBackdrop = document.querySelector("#historyBackdrop");
function toggleHistory(open) {
  historyDrawer.classList.toggle("open", open);
  historyBackdrop.classList.toggle("open", open);
  historyDrawer.setAttribute("aria-hidden", String(!open));
}

document.querySelector("#openHistoryButton").addEventListener("click", () => toggleHistory(true));
document.querySelector("#closeHistoryButton").addEventListener("click", () => toggleHistory(false));
historyBackdrop.addEventListener("click", () => toggleHistory(false));
document.querySelector("#historyList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-version-id]");
  if (!button) return;
  const version = versionHistory.get(button.dataset.versionId);
  if (!version) return;

  data = clone(version.data);
  setTheme(version.theme ?? "blue", false);
  fillEditor();
  renderPreview();
  updateCompletion();
  markDirty("Restored version not saved");
  toggleHistory(false);
  showToast("Previous version restored");
});

fillEditor();
renderPreview();
updateCompletion();
setTheme(localStorage.getItem(THEME_KEY) ?? "blue", false);
renderVersionHistory();
