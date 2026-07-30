export const BACKUP_KIND = "rapidcv-backup";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 1024 * 1024;

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const clone = (value) => JSON.parse(JSON.stringify(value));

function optionalString(value, fallback, field) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") throw new Error(`${field} must be text.`);
  return value;
}

function optionalBoolean(value, fallback, field) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new Error(`${field} must be true or false.`);
  return value;
}

function optionalRecord(value, field) {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) throw new Error(`${field} is not valid.`);
  return value;
}

function optionalArray(value, field, limit) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > limit) throw new Error(`${field} is not valid.`);
  return value;
}

function normalizeStringRecord(value, defaults, field) {
  const source = optionalRecord(value, field);
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [
      key,
      optionalString(source[key], fallback, `${field}.${key}`),
    ]),
  );
}

export function normalizeResume(value, defaultResume) {
  if (!isRecord(value)) throw new Error("The résumé data is missing.");
  return {
    basics: normalizeStringRecord(value.basics, defaultResume.basics, "resume.basics"),
    summary: optionalString(value.summary, defaultResume.summary, "resume.summary"),
    achievements: optionalArray(value.achievements, "resume.achievements", 50).map((item, index) =>
      normalizeStringRecord(item, { value: "", label: "" }, `resume.achievements.${index}`)),
    skills: optionalArray(value.skills, "resume.skills", 50).map((item, index) =>
      normalizeStringRecord(item, { category: "", items: "" }, `resume.skills.${index}`)),
    experience: optionalArray(value.experience, "resume.experience", 100).map((item, index) => {
      const role = optionalRecord(item, `resume.experience.${index}`);
      return {
        ...normalizeStringRecord(role, { company: "", role: "", dates: "", location: "" }, `resume.experience.${index}`),
        bullets: optionalArray(role.bullets, `resume.experience.${index}.bullets`, 100).map((bullet, bulletIndex) =>
          optionalString(bullet, "", `resume.experience.${index}.bullets.${bulletIndex}`)),
      };
    }),
    education: normalizeStringRecord(value.education, defaultResume.education, "resume.education"),
    closingStatement: {
      ...normalizeStringRecord(value.closingStatement, { label: "", text: "" }, "resume.closingStatement"),
      enabled: optionalBoolean(value.closingStatement?.enabled, false, "resume.closingStatement.enabled"),
    },
  };
}

export function createBackup({ resume, document }) {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    document: clone(document),
    resume: clone(resume),
  };
}

export function backupFileName(documentName) {
  const safeName = documentName
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .toLowerCase();
  return `${safeName || "rapidcv-resume"}-backup.json`;
}

export function parseBackup(rawBackup, { defaultResume, layouts, themes, defaultLayout, defaultTheme, defaultTextScale }) {
  let backup;
  try {
    backup = JSON.parse(rawBackup);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!isRecord(backup)) throw new Error("This backup is empty or malformed.");
  if (backup.kind && backup.kind !== BACKUP_KIND) throw new Error("This is not a RapidCV backup.");
  if (Number.isInteger(backup.version) && backup.version > BACKUP_VERSION) {
    throw new Error("This backup was created by a newer version of RapidCV.");
  }

  const resumeSource = backup.resume ?? backup.data ?? (backup.basics ? backup : null);
  if (!resumeSource) throw new Error("The résumé data is missing.");

  const documentSource = isRecord(backup.document) ? backup.document : {};
  const fallbackName = resumeSource.basics?.name?.trim()
    ? `${resumeSource.basics.name.trim()} résumé`
    : "Imported résumé";
  const name = optionalString(
    documentSource.name ?? backup.documentName,
    fallbackName,
    "document.name",
  ).trim() || fallbackName;
  const requestedLayout = documentSource.layout ?? backup.layout;
  const requestedTheme = documentSource.theme ?? backup.theme;
  const importedScale = Number(documentSource.textScale ?? backup.textScale);

  return {
    data: normalizeResume(resumeSource, defaultResume),
    documentName: name,
    layout: layouts.includes(requestedLayout) ? requestedLayout : defaultLayout,
    theme: themes.includes(requestedTheme) ? requestedTheme : defaultTheme,
    textScale: Number.isFinite(importedScale) ? importedScale : defaultTextScale,
    migrated: backup.kind !== BACKUP_KIND || backup.version !== BACKUP_VERSION || !isRecord(backup.document),
  };
}
