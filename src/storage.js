import { resumeData } from "./resume-data.js";
import { parseBackup } from "./backup-service.js";
import { RESUME_LAYOUTS } from "./resume-designs.js";
export const KEYS = {
  resume: "cv-studio-resume-v1",
  name: "cv-studio-document-name",
  theme: "cv-studio-theme",
  layout: "cv-studio-layout",
  textScale: "cv-studio-text-scale-v2",
  history: "cv-studio-history-v1",
  apiKey: "cv-studio-openai-key",
};
export const backupOptions = {
  defaultResume: resumeData,
  layouts: RESUME_LAYOUTS.map((item) => item.id),
  themes: ["blue", "slate", "teal", "green", "plum"],
  defaultLayout: "modern",
  defaultTheme: "blue",
  defaultTextScale: 1.25,
};
export function readStorage(key, fallback, storage = localStorage) {
  try {
    return storage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
export function loadDocument() {
  const initial = {
    data: structuredClone(resumeData),
    documentName: readStorage(KEYS.name, "Untitled résumé"),
    theme: readStorage(KEYS.theme, "blue"),
    layout: readStorage(KEYS.layout, "modern"),
    textScale: Number(readStorage(KEYS.textScale, "1.25")),
  };
  if (!backupOptions.themes.includes(initial.theme)) initial.theme = "blue";
  if (!backupOptions.layouts.includes(initial.layout))
    initial.layout = "modern";
  initial.textScale = Number.isFinite(initial.textScale)
    ? Math.max(0.875, Math.min(1.5, initial.textScale))
    : 1.25;
  try {
    const saved = readStorage(KEYS.resume, null);
    if (saved) initial.data = parseBackup(saved, backupOptions).data;
  } catch {
    /* A damaged saved draft must not prevent the editor from opening. */
  }
  return initial;
}
