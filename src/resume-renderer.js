import { GALLERY_SAMPLE } from "./resume-designs.js";
import stylesAsset from "./styles.css?url";
import layoutsAsset from "./resume-layouts.css?url";
const escapeHtml = (value = "") =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character],
  );
const sectionTitle = (title) =>
  `<h2 class="resume-section-title">${title}</h2>`;
const experienceHtml = (roles) =>
  roles
    .map(
      (role) => `<article class="resume-role">
        <div class="role-heading"><div><h3>${escapeHtml(role.company)}</h3><p>${escapeHtml(role.role)}</p></div><div class="role-meta"><strong>${escapeHtml(role.dates)}</strong><span>${escapeHtml(role.location)}</span></div></div>
        <ul>${role.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>
      </article>`,
    )
    .join("");

function fitFirstPageExperience(preview) {
  const firstPage = preview.querySelector(".resume-page:first-child");
  const firstExperience = firstPage?.querySelector(".experience-section");
  const secondExperience = preview.querySelector(
    ".resume-page:nth-child(2) .experience-section",
  );
  const footer = firstPage?.querySelector("footer");
  if (!firstExperience || !secondExperience || !footer) return;

  let lastRole = firstExperience.querySelector(".resume-role:last-child");
  while (
    lastRole &&
    lastRole.getBoundingClientRect().bottom >
      footer.getBoundingClientRect().top - 12
  ) {
    secondExperience
      .querySelector(".resume-section-title")
      .insertAdjacentElement("afterend", lastRole);
    lastRole = firstExperience.querySelector(".resume-role:last-child");
  }
  secondExperience.hidden = !secondExperience.querySelector(".resume-role");
}

function fitClosingStatement(preview, textScale) {
  const secondPage = preview.querySelector(".resume-page:nth-child(2)");
  const closing = secondPage?.querySelector(".philosophy");
  const footer = secondPage?.querySelector("footer");
  if (!closing || !footer) return;

  let fitScale = 1;
  const applyScale = () => {
    closing.style.setProperty("--closing-margin", `${42 * fitScale}px`);
    closing.style.setProperty("--closing-padding", `${31 * fitScale}px`);
    closing.style.setProperty(
      "--closing-label-size",
      `${7.5 * textScale * fitScale}px`,
    );
    closing.style.setProperty(
      "--closing-font-size",
      `${16 * textScale * fitScale}px`,
    );
  };

  applyScale();
  while (
    closing.getBoundingClientRect().bottom >
      footer.getBoundingClientRect().top - 12 &&
    fitScale > 0.5
  ) {
    fitScale = Math.max(0.5, fitScale - 0.05);
    applyScale();
  }
}

export function fitResumeLayout(preview, textScale) {
  fitFirstPageExperience(preview);
  fitClosingStatement(preview, textScale);
}

export function renderPreview(preview, data, zoom, textScale) {
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
  fitResumeLayout(preview, textScale);
}

export function galleryPreviewDocument(layout, theme) {
  const sample = GALLERY_SAMPLE;
  const stylesUrl = new URL(stylesAsset, window.location.origin).href;
  const layoutsUrl = new URL(layoutsAsset, window.location.origin).href;
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

export function fitGallerySample(frame) {
  const document = frame.contentDocument;
  const section = document?.querySelector(".experience-section");
  const footer = document?.querySelector("footer");
  if (!section || !footer) return;

  let role = section.querySelector(".resume-role:last-child");
  while (
    role &&
    role.getBoundingClientRect().bottom >
      footer.getBoundingClientRect().top - 12
  ) {
    role.remove();
    role = section.querySelector(".resume-role:last-child");
  }
}
