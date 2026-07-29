import { resumeData as defaultData } from "./resume-data.js";

const STORAGE_KEY = "cv-studio-resume-v1";
const clone = (value) => JSON.parse(JSON.stringify(value));
let data = clone(defaultData);
let zoom = 0.82;
let saveTimer;

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
    field.value = value ?? "";
  });

  document.querySelector("#experienceFields").innerHTML = data.experience
    .map(
      (role, index) => `
        <fieldset class="role-card">
          <legend><span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(role.company)}</legend>
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
          <label>Category<input name="skills.${index}.category" value="${escapeHtml(skill.category)}"></label>
          <label>Skills<input name="skills.${index}.items" value="${escapeHtml(skill.items)}"></label>
        </div>`,
    )
    .join("");
  document.querySelector("#summaryCount").textContent = data.summary.length;
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
  const firstRoles = data.experience.slice(0, 3);
  const secondRoles = data.experience.slice(3);
  preview.innerHTML = `
    <article class="resume-page">
      <header class="resume-header">
        <div class="header-main"><p class="resume-kicker">Curriculum Vitae · 2026</p><h1>${escapeHtml(data.basics.name)}</h1><h2>${escapeHtml(data.basics.title)}</h2></div>
        <address>
          <span>${escapeHtml(data.basics.location)}</span><span>${escapeHtml(data.basics.phone)}</span>
          <a href="mailto:${escapeHtml(data.basics.email)}">${escapeHtml(data.basics.email)}</a>
          <span>${escapeHtml(data.basics.portfolio)}</span>
        </address>
      </header>
      <p class="resume-tagline">${escapeHtml(data.basics.tagline)}</p>
      <section>${sectionTitle("Profile")}<p class="summary-copy">${escapeHtml(data.summary)}</p></section>
      <section>${sectionTitle("Selected impact")}<div class="achievement-grid">${data.achievements.map((item) => `<div><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></div>`).join("")}</div></section>
      <section>${sectionTitle("Core competencies")}<div class="skills-grid">${data.skills.map((skill) => `<div><strong>${escapeHtml(skill.category)}</strong><span>${escapeHtml(skill.items)}</span></div>`).join("")}</div></section>
      <section>${sectionTitle("Professional experience")}${experienceHtml(firstRoles)}</section>
      <footer><span>${escapeHtml(data.basics.name)}</span><span>01 / 02</span></footer>
    </article>
    <article class="resume-page">
      <div class="page-two-heading"><span>${escapeHtml(data.basics.name)}</span><span>${escapeHtml(data.basics.title)}</span></div>
      <section>${sectionTitle("Professional experience · continued")}${experienceHtml(secondRoles)}</section>
      <section class="education-section">${sectionTitle("Education")}<div class="education-row"><div><h3>${escapeHtml(data.education.school)}</h3><p>${escapeHtml(data.education.degree)}</p></div><strong>${escapeHtml(data.education.date)}</strong></div></section>
      <section class="philosophy"><span>What I bring</span><p>Pragmatic architecture, clear technical leadership, and an instinct for turning complex systems into dependable products.</p></section>
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

function queueSave() {
  saveStatus.textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      saveStatus.textContent = "Saved locally";
    } catch {
      saveStatus.textContent = "Changes in this session";
    }
  }, 450);
}

form.addEventListener("input", (event) => {
  setByPath(event.target.name, event.target.value);
  if (event.target.name === "summary") document.querySelector("#summaryCount").textContent = event.target.value.length;
  renderPreview();
  updateCompletion();
  queueSave();
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
  if (!confirm("Reset every field to the original sample resume?")) return;
  data = clone(defaultData);
  localStorage.removeItem(STORAGE_KEY);
  fillEditor();
  renderPreview();
  updateCompletion();
  showToast("Sample resume restored");
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

fillEditor();
renderPreview();
updateCompletion();
