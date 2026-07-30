import { resumeData as defaultData } from "./resume-data.js";
import { VersionHistory } from "./version-history.js";
import { createActionModal } from "./action-modal.js";
import {
  MAX_BACKUP_BYTES,
  backupFileName,
  createBackup,
  parseBackup,
} from "./backup-service.js";

const STORAGE_KEY = "cv-studio-resume-v1";
const DOCUMENT_NAME_KEY = "cv-studio-document-name";
const THEME_KEY = "cv-studio-theme";
const LAYOUT_KEY = "cv-studio-layout";
const TEXT_SCALE_KEY = "cv-studio-text-scale-v2";
const TEXT_SCALE_BASE = 1.25;
const TEXT_SCALE_MIN = 0.875;
const TEXT_SCALE_MAX = 1.5;
const TEXT_SCALE_STEP = 0.0625;
const HISTORY_KEY = "cv-studio-history-v1";
const BYOK_STORAGE_KEY = "cv-studio-openai-key";
const BYOK_REMEMBER_PREFERENCE_KEY = "cv-studio-remember-openai-key";
const RESUME_LAYOUTS = [
  { id: "modern", name: "Modern", description: "Balanced and versatile" },
  { id: "executive", name: "Executive", description: "Formal and composed" },
  { id: "minimal", name: "Minimal", description: "Quiet and spacious" },
  { id: "editorial", name: "Editorial", description: "Expressive hierarchy" },
  { id: "sidebar", name: "Sidebar", description: "Structured identity rail" },
  { id: "technical", name: "Technical", description: "Precise and systematic" },
  { id: "swiss", name: "Swiss", description: "Bold modernist grid" },
  { id: "compact", name: "Compact", description: "Dense and efficient" },
  { id: "bold", name: "Bold", description: "Confident color blocks" },
  { id: "classic", name: "Classic", description: "Traditional and timeless" },
];
const GALLERY_SAMPLE = {
  basics: {
    documentLabel: "Résumé",
    name: "Jordan Morgan",
    title: "Senior Product Engineer",
    tagline: "Strategy · Design · Delivery · Leadership",
    location: "Austin, TX",
    phone: "555-0100",
    email: "jordan@example.com",
    portfolio: "jordan.dev",
  },
  summary: "Product-minded engineer with 10+ years of experience turning complex business needs into clear, dependable digital experiences. Trusted to lead cross-functional delivery, improve operations, and mentor high-performing teams.",
  achievements: [
    { value: "40%", label: "lower operating costs" },
    { value: "3x", label: "faster delivery" },
    { value: "12M+", label: "monthly users" },
    { value: "99.9%", label: "availability" },
  ],
  skills: [
    { category: "Strategy", items: "Roadmaps, Discovery, Analytics" },
    { category: "Delivery", items: "Product, Design, Engineering" },
    { category: "Technology", items: "Cloud, Web, APIs" },
    { category: "Leadership", items: "Mentoring, Facilitation" },
    { category: "Operations", items: "Analytics, Automation, Quality" },
    { category: "Collaboration", items: "Stakeholders, Workshops, Research" },
  ],
  experience: [
    {
      company: "Northstar Labs",
      role: "Senior Product Engineer",
      dates: "2021 — Present",
      location: "Remote",
      bullets: [
        "Led cross-functional delivery of reliable customer-facing platforms.",
        "Improved performance and reduced operating costs through automation.",
        "Mentored engineers and established reusable delivery practices.",
      ],
    },
    {
      company: "Fieldwork Studio",
      role: "Product Engineer",
      dates: "2018 — 2021",
      location: "Austin, TX",
      bullets: [
        "Built accessible digital products for growing organizations.",
        "Partnered with design and product teams from discovery through launch.",
        "Introduced customer research and analytics into roadmap decisions.",
      ],
    },
    {
      company: "Atlas Group",
      role: "Product Engineer",
      dates: "2015 — 2018",
      location: "Chicago, IL",
      bullets: [
        "Modernized core workflows used by distributed operations teams.",
        "Created shared components that accelerated product development.",
        "Improved release quality through automated testing and monitoring.",
      ],
    },
    {
      company: "Civic Works",
      role: "Associate Engineer",
      dates: "2012 — 2015",
      location: "Chicago, IL",
      bullets: [
        "Delivered responsive web experiences for public-facing programs.",
        "Collaborated with stakeholders to translate policy into usable tools.",
        "Supported production systems and continuous improvement initiatives.",
      ],
    },
  ],
};
const clone = (value) => JSON.parse(JSON.stringify(value));
let data = clone(defaultData);
let documentName = localStorage.getItem(DOCUMENT_NAME_KEY) ?? "Untitled résumé";
let zoom = 0.82;
let textScale = Number.parseFloat(localStorage.getItem(TEXT_SCALE_KEY) ?? String(TEXT_SCALE_BASE));
let previousAiVersion = null;
let isDirty = false;
let aiHostedAccess = null;
let byokApiKey = sessionStorage.getItem(BYOK_STORAGE_KEY) ?? "";
const aiDocuments = { resume: null, job: null };
const versionHistory = new VersionHistory(HISTORY_KEY, 10);

// Older releases offered persistent API-key storage. Remove those values during
// migration so credentials cannot remain in localStorage after this update.
localStorage.removeItem(BYOK_STORAGE_KEY);
localStorage.removeItem(BYOK_REMEMBER_PREFERENCE_KEY);

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
const showActionModal = createActionModal();

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

function fitFirstPageExperience() {
  const firstPage = preview.querySelector(".resume-page:first-child");
  const firstExperience = firstPage?.querySelector(".experience-section");
  const secondExperience = preview.querySelector(".resume-page:nth-child(2) .experience-section");
  const footer = firstPage?.querySelector("footer");
  if (!firstExperience || !secondExperience || !footer) return;

  let lastRole = firstExperience.querySelector(".resume-role:last-child");
  while (lastRole && lastRole.getBoundingClientRect().bottom > footer.getBoundingClientRect().top - 12) {
    secondExperience.querySelector(".resume-section-title").insertAdjacentElement("afterend", lastRole);
    lastRole = firstExperience.querySelector(".resume-role:last-child");
  }
  secondExperience.hidden = !secondExperience.querySelector(".resume-role");
}

function fitClosingStatement() {
  const secondPage = preview.querySelector(".resume-page:nth-child(2)");
  const closing = secondPage?.querySelector(".philosophy");
  const footer = secondPage?.querySelector("footer");
  if (!closing || !footer) return;

  let fitScale = 1;
  const applyScale = () => {
    closing.style.setProperty("--closing-margin", `${42 * fitScale}px`);
    closing.style.setProperty("--closing-padding", `${31 * fitScale}px`);
    closing.style.setProperty("--closing-label-size", `${7.5 * textScale * fitScale}px`);
    closing.style.setProperty("--closing-font-size", `${16 * textScale * fitScale}px`);
  };

  applyScale();
  while (closing.getBoundingClientRect().bottom > footer.getBoundingClientRect().top - 12 && fitScale > 0.5) {
    fitScale = Math.max(0.5, fitScale - 0.05);
    applyScale();
  }
}

function fitResumeLayout() {
  fitFirstPageExperience();
  fitClosingStatement();
}

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

  const firstRoles = data.experience;
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
      <section class="profile-section">${sectionTitle("Profile")}<p class="summary-copy">${escapeHtml(data.summary)}</p></section>
      ${data.achievements?.length ? `<section class="impact-section">${sectionTitle("Selected impact")}<div class="achievement-grid">${data.achievements.map((item) => `<div><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></div>`).join("")}</div></section>` : ""}
      <section class="skills-section">${sectionTitle("Core competencies")}<div class="skills-grid">${data.skills.map((skill) => `<div><strong>${escapeHtml(skill.category)}</strong><span>${escapeHtml(skill.items)}</span></div>`).join("")}</div></section>
      <section class="experience-section">${sectionTitle("Professional experience")}${experienceHtml(firstRoles)}</section>
      <footer><span>${escapeHtml(data.basics.name)}</span><span>01 / 02</span></footer>
    </article>
    <article class="resume-page">
      <div class="page-two-heading"><span>${escapeHtml(data.basics.name)}</span><span>${escapeHtml(data.basics.title)}</span></div>
      <section class="experience-section" hidden>${sectionTitle("Professional experience · continued")}</section>
      <section class="education-section">${sectionTitle("Education")}<div class="education-row"><div><h3>${escapeHtml(data.education.school)}</h3><p>${escapeHtml(data.education.degree)}</p></div><strong>${escapeHtml(data.education.date)}</strong></div></section>
      ${data.closingStatement.enabled && data.closingStatement.text.trim() ? `<section class="philosophy"><span>${escapeHtml(data.closingStatement.label || "Professional value")}</span><p>${escapeHtml(data.closingStatement.text)}</p></section>` : ""}
      <footer><span>${escapeHtml(data.basics.name)}</span><span>02 / 02</span></footer>
    </article>`;
  preview.style.setProperty("--preview-scale", zoom);
  fitResumeLayout();
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
    documentName,
    theme: document.documentElement.dataset.resumeTheme ?? "blue",
    layout: document.documentElement.dataset.resumeLayout ?? "modern",
    textScale,
    label,
  }, force);
  if (created) renderVersionHistory();
  return created;
}

function saveResume() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(DOCUMENT_NAME_KEY, documentName);
    localStorage.setItem(THEME_KEY, document.documentElement.dataset.resumeTheme ?? "blue");
    localStorage.setItem(LAYOUT_KEY, document.documentElement.dataset.resumeLayout ?? "modern");
    localStorage.setItem(TEXT_SCALE_KEY, String(textScale));
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

function currentBackup() {
  return createBackup({
    resume: data,
    document: {
      name: documentName,
      theme: document.documentElement.dataset.resumeTheme ?? "blue",
      layout: document.documentElement.dataset.resumeLayout ?? "modern",
      textScale,
    },
  });
}

function exportBackup() {
  const blob = new Blob([`${JSON.stringify(currentBackup(), null, 2)}\n`], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = backupFileName(documentName);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
  showToast("Backup downloaded");
}

async function importBackup(file) {
  if (!file) return;
  if (file.size > MAX_BACKUP_BYTES) {
    showToast("Backup must be smaller than 1 MB");
    return;
  }
  try {
    const imported = parseBackup(await file.text(), {
      defaultResume: defaultData,
      layouts: RESUME_LAYOUTS.map((item) => item.id),
      themes: ["blue", "slate", "teal", "green", "plum"],
      defaultLayout: "modern",
      defaultTheme: "blue",
      defaultTextScale: TEXT_SCALE_BASE,
    });
    const confirmed = await showActionModal({
      tone: "primary",
      icon: "↑",
      eyebrow: "Restore from backup",
      title: `Import “${imported.documentName}”?`,
      description: "This will replace the current draft. RapidCV will save a restorable copy in History before importing.",
      confirmLabel: "Import backup",
    });
    if (!confirmed) return;
    createVersion("Before backup import", true);
    data = imported.data;
    documentName = imported.documentName;
    document.querySelector("#documentName").childNodes[0].textContent = `${documentName} `;
    setTheme(imported.theme, false);
    setLayout(imported.layout, false);
    setTextScale(imported.textScale, false);
    fillEditor();
    renderPreview();
    updateCompletion();
    markDirty("Imported backup not saved");
    showToast(imported.migrated ? "Older backup upgraded — save to keep it" : "Backup imported — save to keep it");
  } catch (error) {
    showToast(error.message || "Could not import this backup");
  }
}

const backupMenuButton = document.querySelector("#backupMenuButton");
const backupMenu = document.querySelector("#backupMenu");
const backupFileInput = document.querySelector("#backupFileInput");
function toggleBackupMenu(open) {
  backupMenu.hidden = !open;
  backupMenuButton.setAttribute("aria-expanded", String(open));
  if (open) backupMenu.querySelector("button")?.focus();
}
backupMenuButton.addEventListener("click", () => toggleBackupMenu(backupMenu.hidden));
document.querySelector("#exportBackupButton").addEventListener("click", () => {
  toggleBackupMenu(false);
  exportBackup();
});
document.querySelector("#importBackupButton").addEventListener("click", () => {
  toggleBackupMenu(false);
  backupFileInput.click();
});
backupFileInput.addEventListener("change", async () => {
  await importBackup(backupFileInput.files?.[0]);
  backupFileInput.value = "";
});
document.addEventListener("click", (event) => {
  if (!backupMenu.hidden && !event.target.closest(".backup-control")) toggleBackupMenu(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !backupMenu.hidden) {
    toggleBackupMenu(false);
    backupMenuButton.focus();
  }
});

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
document.querySelector("#resetButton").addEventListener("click", async () => {
  const confirmed = await showActionModal({
    tone: "danger",
    icon: "↺",
    eyebrow: "Start over",
    title: "Reset this résumé?",
    description: "Every field in the current draft will be cleared. Your previously saved versions will remain available in History.",
    confirmLabel: "Reset résumé",
  });
  if (!confirmed) return;
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
document.querySelector("#documentName").addEventListener("click", async () => {
  const next = await showActionModal({
    tone: "primary",
    icon: "✎",
    eyebrow: "Document details",
    title: "Rename this résumé",
    description: "Choose a short name that will make this draft easy to recognize in your backups.",
    confirmLabel: "Save name",
    input: {
      label: "Document name",
      value: documentName,
      required: true,
      requiredMessage: "Enter a document name.",
    },
  });
  if (!next) return;
  documentName = next;
  document.querySelector("#documentName").childNodes[0].textContent = `${documentName} `;
  markDirty("Document title not saved");
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

function galleryPreviewDocument(layout, theme) {
  const sample = GALLERY_SAMPLE;
  const stylesUrl = new URL("/styles.css", window.location.origin).href;
  const layoutsUrl = new URL("/resume-layouts.css", window.location.origin).href;
  return `<!doctype html>
    <html data-resume-layout="${layout}" data-resume-theme="${theme}" style="--resume-type-scale:1.15">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="${stylesUrl}">
        <link rel="stylesheet" href="${layoutsUrl}">
        <style>
          html, body { width: 816px; height: 1056px; overflow: hidden; background: #fff; }
          .resume-page { transform: none !important; margin: 0 !important; box-shadow: none !important; }
        </style>
      </head>
      <body>
        <article class="resume-page">
          <header class="resume-header">
            <div class="header-main"><p class="resume-kicker">${sample.basics.documentLabel} · ${new Date().getFullYear()}</p><h1>${sample.basics.name}</h1><h2>${sample.basics.title}</h2></div>
            <address><span>${sample.basics.location}</span><span>${sample.basics.phone}</span><span>${sample.basics.email}</span><span>${sample.basics.portfolio}</span></address>
          </header>
          <p class="resume-tagline">${sample.basics.tagline}</p>
          <section class="profile-section">${sectionTitle("Profile")}<p class="summary-copy">${sample.summary}</p></section>
          <section class="impact-section">${sectionTitle("Selected impact")}<div class="achievement-grid">${sample.achievements.map((item) => `<div><strong>${item.value}</strong><span>${item.label}</span></div>`).join("")}</div></section>
          <section class="skills-section">${sectionTitle("Core competencies")}<div class="skills-grid">${sample.skills.map((skill) => `<div><strong>${skill.category}</strong><span>${skill.items}</span></div>`).join("")}</div></section>
          <section class="experience-section">${sectionTitle("Professional experience")}${experienceHtml(sample.experience)}</section>
          <footer><span>${sample.basics.name}</span><span>01 / 02</span></footer>
        </article>
      </body>
    </html>`;
}

function fitGallerySample(frame) {
  const document = frame.contentDocument;
  const section = document?.querySelector(".experience-section");
  const footer = document?.querySelector("footer");
  if (!section || !footer) return;

  let role = section.querySelector(".resume-role:last-child");
  while (role && role.getBoundingClientRect().bottom > footer.getBoundingClientRect().top - 12) {
    role.remove();
    role = section.querySelector(".resume-role:last-child");
  }
}

function renderDesignGallery() {
  const selectedLayout = document.documentElement.dataset.resumeLayout ?? "modern";
  const theme = document.documentElement.dataset.resumeTheme ?? "blue";
  document.querySelector("#designGrid").innerHTML = RESUME_LAYOUTS.map(
    ({ id, name, description }) => `
      <button class="design-card${id === selectedLayout ? " selected" : ""}" type="button" data-select-layout="${id}" aria-label="Use ${name} design" aria-pressed="${id === selectedLayout}">
        <span class="design-live-preview" aria-hidden="true"><iframe class="design-live-frame" data-preview-layout="${id}" title="${name} résumé preview" tabindex="-1"></iframe></span>
        <span class="design-card-copy"><strong>${name}</strong><small>${description}</small></span>
      </button>`,
  ).join("");
  document.querySelectorAll(".design-live-frame").forEach((frame) => {
    frame.addEventListener("load", () => {
      fitGallerySample(frame);
      frame.contentDocument.fonts?.ready.then(() => fitGallerySample(frame));
    });
    frame.srcdoc = galleryPreviewDocument(frame.dataset.previewLayout, theme);
  });
}

function setLayout(layout, record = true) {
  const selectedLayout = RESUME_LAYOUTS.find((item) => item.id === layout) ?? RESUME_LAYOUTS[0];
  document.documentElement.dataset.resumeLayout = selectedLayout.id;
  document.querySelector("#currentDesignName").textContent = selectedLayout.name;
  document.querySelectorAll(".design-card").forEach((card) => {
    const selected = card.dataset.selectLayout === selectedLayout.id;
    card.classList.toggle("selected", selected);
    card.setAttribute("aria-pressed", String(selected));
  });
  renderPreview();
  if (record) markDirty("Design change not saved");
}

const designModal = document.querySelector("#designModal");
const designBackdrop = document.querySelector("#designBackdrop");
function toggleDesignGallery(open) {
  if (open) renderDesignGallery();
  designModal.classList.toggle("open", open);
  designBackdrop.classList.toggle("open", open);
  designModal.setAttribute("aria-hidden", String(!open));
  if (open) {
    designModal.querySelector(".design-card.selected")?.focus();
  } else {
    document.querySelector("#openDesignButton").focus();
  }
}

function setTextScale(nextScale, record = true) {
  const steppedScale = Math.round(nextScale / TEXT_SCALE_STEP) * TEXT_SCALE_STEP;
  textScale = Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, steppedScale));
  document.documentElement.style.setProperty("--resume-type-scale", textScale);
  document.querySelector("#textSizeValue").textContent =
    `${Math.round((textScale / TEXT_SCALE_BASE) * 100)}%`;
  document.querySelector("#textSizeDown").disabled = textScale <= TEXT_SCALE_MIN;
  document.querySelector("#textSizeUp").disabled = textScale >= TEXT_SCALE_MAX;
  if (record) {
    renderPreview();
    markDirty("Text size change not saved");
  }
}

document.querySelector("#textSizeDown").addEventListener("click", () => setTextScale(textScale - TEXT_SCALE_STEP));
document.querySelector("#textSizeUp").addEventListener("click", () => setTextScale(textScale + TEXT_SCALE_STEP));

document.querySelectorAll(".color-swatch").forEach((swatch) => {
  swatch.addEventListener("click", () => setTheme(swatch.dataset.theme));
});
document.querySelector("#openDesignButton").addEventListener("click", () => toggleDesignGallery(true));
document.querySelector("#closeDesignButton").addEventListener("click", () => toggleDesignGallery(false));
designBackdrop.addEventListener("click", () => toggleDesignGallery(false));
document.querySelector("#designGrid").addEventListener("click", (event) => {
  const card = event.target.closest("[data-select-layout]");
  if (!card) return;
  setLayout(card.dataset.selectLayout);
  toggleDesignGallery(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && designModal.classList.contains("open")) toggleDesignGallery(false);
});

const aiDrawer = document.querySelector("#aiDrawer");
const aiBackdrop = document.querySelector("#aiBackdrop");
const aiStatus = document.querySelector("#aiStatus");
const aiPrompt = document.querySelector("#aiPrompt");
const aiAccessCard = document.querySelector("#aiAccessCard");
const byokSettings = document.querySelector("#byokSettings");
const byokInput = document.querySelector("#byokApiKey");

function updateAiAccessDisplay() {
  const hasByok = Boolean(byokApiKey);
  aiAccessCard.classList.toggle("hosted", aiHostedAccess === true);
  aiAccessCard.classList.toggle("byok", aiHostedAccess !== true && hasByok);

  if (aiHostedAccess === true) {
    document.querySelector("#aiAccessTitle").textContent = "Hosted AI access available";
    document.querySelector("#aiAccessDescription").textContent = "This connection can use the site’s configured AI service.";
  } else if (hasByok) {
    document.querySelector("#aiAccessTitle").textContent = "Using your OpenAI API key";
    document.querySelector("#aiAccessDescription").textContent = "Requests are billed directly to your OpenAI account.";
  } else if (aiHostedAccess === false) {
    document.querySelector("#aiAccessTitle").textContent = "Bring your own OpenAI key";
    document.querySelector("#aiAccessDescription").textContent = "Hosted AI is limited, but you can connect your own account.";
  } else {
    document.querySelector("#aiAccessTitle").textContent = "Checking AI access…";
    document.querySelector("#aiAccessDescription").textContent = "Confirming which connection this browser can use.";
  }
}

async function readApiResponse(response) {
  const responseText = await response.text();
  try {
    return responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(response.ok ? "The server returned an invalid response." : `AI endpoint unavailable (${response.status}). Start the app with npm run preview.`);
  }
}

async function refreshAiAccessStatus() {
  try {
    const response = await fetch("/api/ai/status", { headers: { Accept: "application/json" } });
    const result = await readApiResponse(response);
    aiHostedAccess = response.ok && result.hostedAccess === true;
  } catch {
    aiHostedAccess = false;
  }
  updateAiAccessDisplay();
  return aiHostedAccess;
}

function toggleAiDrawer(open) {
  aiDrawer.classList.toggle("open", open);
  aiBackdrop.classList.toggle("open", open);
  aiDrawer.setAttribute("aria-hidden", String(!open));
  if (open) {
    refreshAiAccessStatus();
    setTimeout(() => aiPrompt.focus(), 280);
  }
}

document.querySelector("#openAiButton").addEventListener("click", () => toggleAiDrawer(true));
document.querySelector("#closeAiButton").addEventListener("click", () => toggleAiDrawer(false));
aiBackdrop.addEventListener("click", () => toggleAiDrawer(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && aiDrawer.classList.contains("open")) toggleAiDrawer(false);
});

byokInput.value = byokApiKey;
document.querySelector("#saveByokKey").addEventListener("click", () => {
  const key = byokInput.value.trim();
  if (key.length < 20) {
    setAiStatus("error", "Enter a valid OpenAI API key.");
    return;
  }
  byokApiKey = key;
  sessionStorage.setItem(BYOK_STORAGE_KEY, key);
  byokSettings.open = false;
  updateAiAccessDisplay();
  setAiStatus("idle");
  showToast("OpenAI key ready for this tab");
});
document.querySelector("#clearByokKey").addEventListener("click", () => {
  byokApiKey = "";
  byokInput.value = "";
  sessionStorage.removeItem(BYOK_STORAGE_KEY);
  localStorage.removeItem(BYOK_STORAGE_KEY);
  updateAiAccessDisplay();
  showToast("OpenAI key cleared");
});
document.querySelector("#toggleByokVisibility").addEventListener("click", (event) => {
  const reveal = byokInput.type === "password";
  byokInput.type = reveal ? "text" : "password";
  event.currentTarget.textContent = reveal ? "Hide" : "Show";
  event.currentTarget.setAttribute("aria-label", `${reveal ? "Hide" : "Show"} API key`);
});
updateAiAccessDisplay();

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

  if (aiHostedAccess === null) await refreshAiAccessStatus();
  if (!aiHostedAccess && !byokApiKey) {
    byokSettings.open = true;
    byokInput.focus();
    setAiStatus("error", "Add your OpenAI API key to use AI from this connection.");
    return;
  }

  setAiStatus("loading", action === "optimize" ? "Checking impact, clarity, keywords, and concision." : "Applying your request without inventing details.");
  document.querySelectorAll("#optimizeButton, #sendAiButton").forEach((button) => (button.disabled = true));

  try {
    const response = await fetch("/api/ai/revise", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(!aiHostedAccess && byokApiKey ? { "X-OpenAI-API-Key": byokApiKey } : {}),
      },
      body: JSON.stringify({
        action,
        prompt,
        currentResume: data,
        documents: Object.values(aiDocuments).filter(Boolean),
      }),
    });
    const result = await readApiResponse(response);
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
  documentName = version.documentName ?? "Untitled résumé";
  document.querySelector("#documentName").childNodes[0].textContent = `${documentName} `;
  setTheme(version.theme ?? "blue", false);
  setLayout(version.layout ?? "modern", false);
  setTextScale(version.textScale ?? TEXT_SCALE_BASE, false);
  fillEditor();
  renderPreview();
  updateCompletion();
  markDirty("Restored version not saved");
  toggleHistory(false);
  showToast("Previous version restored");
});

fillEditor();
document.querySelector("#documentName").childNodes[0].textContent = `${documentName} `;
setTheme(localStorage.getItem(THEME_KEY) ?? "blue", false);
setLayout(localStorage.getItem(LAYOUT_KEY) ?? "modern", false);
setTextScale(textScale, false);
renderPreview();
updateCompletion();
renderVersionHistory();
document.fonts?.ready.then(fitResumeLayout);
