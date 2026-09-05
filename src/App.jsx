import { useEffect, useRef, useState } from "react";
import { resumeData } from "./resume-data.js";
import { VersionHistory } from "./version-history.js";
import {
  MAX_BACKUP_BYTES,
  backupFileName,
  createBackup,
  normalizeResume,
  parseBackup,
} from "./backup-service.js";
import { KEYS, backupOptions, loadDocument } from "./storage.js";
import Topbar from "./components/Topbar.jsx";
import EditorPanel from "./components/EditorPanel.jsx";
import PreviewPanel from "./components/PreviewPanel.jsx";
import DesignGallery from "./components/DesignGallery.jsx";
import HistoryDrawer from "./components/HistoryDrawer.jsx";
import ActionModal from "./components/ActionModal.jsx";
import AiDrawer from "./components/AiDrawer.jsx";

export default function App({ initialDocument, initialHistory, onPersist, onDirtyChange }) {
  const [draft, setDraft] = useState(() => initialDocument ?? loadDocument());
  const { data, documentName, theme, layout, textScale } = draft;
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState(onPersist ? "Saved to account" : "Saved locally");
  const [history] = useState(() => new VersionHistory(onPersist ? null : KEYS.history, 10, initialHistory));
  const [saving, setSaving] = useState(false);
  const [syncError, setSyncError] = useState("");
  const editGeneration = useRef(0);
  const savingRef = useRef(false);
  const [entries, setEntries] = useState(() => history.all());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [previousAiVersion, setPreviousAiVersion] = useState(null);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const pendingModal = useRef(null);
  useEffect(() => { onDirtyChange?.(dirty || saving); }, [dirty, saving, onDirtyChange]);
  useEffect(() => {
    if (!onPersist || !dirty || saving || syncError) return;
    const timer = setTimeout(() => save(), 1500);
    return () => clearTimeout(timer);
  }, [draft, dirty, saving, syncError]);
  useEffect(() => {
    try {
      localStorage.removeItem(KEYS.apiKey);
      localStorage.removeItem("cv-studio-remember-openai-key");
    } catch {
      /* Storage may be disabled. */
    }
    return () => {
      pendingModal.current?.(null);
    };
  }, []);
  useEffect(() => {
    const beforeUnload = (event) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  useEffect(() => {
    const keydown = (event) => {
      if (event.key !== "Escape" || modal) return;
      setHistoryOpen(false);
      setDesignOpen(false);
      setAiOpen(false);
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [modal]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timeout);
  }, [toast]);
  function showToast(message) {
    setToast({ message });
  }
  function markDirty(message = "Unsaved changes") {
    editGeneration.current++;
    setDirty(true);
    setSaveStatus(message);
  }
  function update(patch, message) {
    setDraft((current) => ({ ...current, ...patch }));
    markDirty(message);
  }
  function changeField(event) {
    const { name, type, checked, value } = event.target;
    setDraft((current) => {
      const next = structuredClone(current.data);
      const keys = name.split(".");
      let target = next;
      keys.slice(0, -1).forEach((key) => {
        target = target[key];
      });
      target[keys.at(-1)] =
        type === "checkbox"
          ? checked
          : keys.at(-1) === "bullets"
            ? value.split("\n")
            : value;
      return { ...current, data: next };
    });
    markDirty();
  }
  function addItem(kind, item) {
    setDraft((current) => ({
      ...current,
      data: { ...current.data, [kind]: [...current.data[kind], item] },
    }));
    markDirty();
    requestAnimationFrame(() => {
      const container = document.getElementById(
        kind === "experience" ? "experienceFields" : "skillFields",
      );
      container?.lastElementChild?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      container?.lastElementChild
        ?.querySelector("input")
        ?.focus({ preventScroll: true });
    });
  }
  function removeItem(kind, index) {
    setDraft((current) => ({
      ...current,
      data: {
        ...current.data,
        [kind]: current.data[kind].filter((_, i) => i !== index),
      },
    }));
    markDirty();
  }
  function snapshot(label, force = false) {
    const created = history.snapshot({ ...draft, label }, force);
    setEntries(history.all());
    return created;
  }
  async function save() {
    if (savingRef.current) return;
    const generation = editGeneration.current;
    savingRef.current = true;
    setSaving(true);
    try {
      if (onPersist) {
        snapshot("Saved version");
        setSaveStatus("Saving to account…");
        await onPersist(draft, history.all());
        setSyncError("");
        if (generation === editGeneration.current) {
          setDirty(false);
          setSaveStatus("Saved to account");
        } else setSaveStatus("Unsaved changes");
        return;
      }
      localStorage.setItem(KEYS.resume, JSON.stringify(data));
      localStorage.setItem(KEYS.name, documentName);
      localStorage.setItem(KEYS.theme, theme);
      localStorage.setItem(KEYS.layout, layout);
      localStorage.setItem(KEYS.textScale, String(textScale));
      const created = snapshot("Saved version");
      setDirty(false);
      setSaveStatus("Saved locally");
      showToast(created ? "Version saved" : "Everything is already saved");
    } catch (error) {
      setSaveStatus(onPersist ? "Not synced — retry Save" : "Could not save locally");
      if (onPersist) setSyncError(error.message);
      showToast(onPersist ? error.message : "Browser storage is unavailable");
    } finally { savingRef.current = false; setSaving(false); }
  }
  function ask(options) {
    pendingModal.current?.(null);
    setModal(options);
    return new Promise((resolve) => {
      pendingModal.current = resolve;
    });
  }
  function resolveModal(result) {
    pendingModal.current?.(result);
    pendingModal.current = null;
    setModal(null);
  }
  async function rename() {
    const next = await ask({
      tone: "primary",
      icon: "✎",
      eyebrow: "Document details",
      title: "Rename this résumé",
      description:
        "Choose a short name that will make this draft easy to recognize in your backups.",
      confirmLabel: "Save name",
      input: {
        label: "Document name",
        value: documentName,
        required: true,
        requiredMessage: "Enter a document name.",
      },
    });
    if (next) update({ documentName: next }, "Document title not saved");
  }
  async function reset() {
    if (
      !(await ask({
        tone: "danger",
        icon: "↺",
        eyebrow: "Start over",
        title: "Reset this résumé?",
        description:
          "Every field in the current draft will be cleared. Your previously saved versions will remain available in History.",
        confirmLabel: "Reset résumé",
      }))
    )
      return;
    update({ data: structuredClone(resumeData) }, "Blank résumé not saved");
    setPreviousAiVersion(null);
    showToast("Résumé cleared");
  }
  function exportBackup() {
    const backup = createBackup({
      resume: data,
      document: { name: documentName, theme, layout, textScale },
    });
    const url = URL.createObjectURL(
      new Blob([`${JSON.stringify(backup, null, 2)}\n`], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFileName(documentName);
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast("Backup downloaded");
  }
  async function importBackup(file) {
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      showToast("Backup must be smaller than 1 MB");
      return;
    }
    try {
      const imported = parseBackup(await file.text(), backupOptions);
      if (
        !(await ask({
          tone: "primary",
          icon: "↑",
          eyebrow: "Restore from backup",
          title: `Import “${imported.documentName}”?`,
          description:
            "This will replace the current draft. RapidCV will save a restorable copy in History before importing.",
          confirmLabel: "Import backup",
        }))
      )
        return;
      snapshot("Before backup import", true);
      update(
        {
          ...imported,
          textScale: Math.max(
            0.875,
            Math.min(1.5, Math.round(imported.textScale / 0.0625) * 0.0625),
          ),
        },
        "Imported backup not saved",
      );
      setPreviousAiVersion(null);
      showToast(
        imported.migrated
          ? "Older backup upgraded — save to keep it"
          : "Backup imported — save to keep it",
      );
    } catch (error) {
      showToast(error.message || "Could not import this backup");
    }
  }
  function restore(entry) {
    try {
      update(
        {
          data: normalizeResume(entry.data, resumeData),
          documentName: entry.documentName ?? "Untitled résumé",
          theme: backupOptions.themes.includes(entry.theme)
            ? entry.theme
            : "blue",
          layout: backupOptions.layouts.includes(entry.layout)
            ? entry.layout
            : "modern",
          textScale: Math.max(
            0.875,
            Math.min(1.5, Number(entry.textScale) || 1.25),
          ),
        },
        "Restored version not saved",
      );
      setPreviousAiVersion(null);
      setHistoryOpen(false);
      showToast("Previous version restored");
    } catch {
      showToast("This saved version could not be restored");
    }
  }
  function applyAi(resume) {
    const normalized = normalizeResume(resume, resumeData);
    setPreviousAiVersion(structuredClone(data));
    update({ data: normalized }, "AI changes not saved");
    setAiOpen(false);
    showToast("AI changes applied");
  }
  return (
    <>
      <Topbar
        {...{
          documentName,
          saveStatus,
          dirty,
          rename,
          exportBackup,
          importBackup,
          setHistoryOpen,
          reset,
          save,
          setAiOpen,
        }}
      />
      {syncError && <div className="cloud-message" role="alert">
        {syncError} Your changes remain in this tab. <button onClick={save}>Retry save</button>{" "}
        <button onClick={exportBackup}>Export unsaved draft</button>{" "}
        <button onClick={() => { if (window.confirm("Reload the account version and discard unsaved changes in this tab? Export a backup first if you want to keep them.")) window.location.reload(); }}>Reload account version</button>
      </div>}
      <main className="workspace">
        <EditorPanel
          {...{ data, changeField, removeItem }}
          addExperience={() =>
            addItem("experience", {
              company: "",
              role: "",
              dates: "",
              location: "",
              bullets: [""],
            })
          }
          addSkill={() => addItem("skills", { category: "", items: "" })}
        />
        <PreviewPanel
          {...{ data, textScale, theme, layout, setDesignOpen }}
          changeTheme={(theme) => update({ theme }, "Color change not saved")}
          changeTextScale={(scale) =>
            update(
              {
                textScale: Math.max(
                  0.875,
                  Math.min(1.5, Math.round(scale / 0.0625) * 0.0625),
                ),
              },
              "Text size change not saved",
            )
          }
        />
      </main>
      {designOpen && (
        <DesignGallery
          {...{ theme, layout }}
          close={() => setDesignOpen(false)}
          select={(layout) => {
            update({ layout }, "Design change not saved");
            setDesignOpen(false);
            document.getElementById("openDesignButton")?.focus();
          }}
        />
      )}
      {historyOpen && (
        <HistoryDrawer
          cloud={Boolean(onPersist)}
          {...{ entries, restore }}
          close={() => setHistoryOpen(false)}
        />
      )}
      <AiDrawer
        open={aiOpen}
        close={() => setAiOpen(false)}
        data={data}
        applyAi={applyAi}
        showToast={showToast}
      />
      {previousAiVersion && (
        <div className="change-bar visible" id="changeBar">
          <span>
            <strong>AI changes applied</strong> Review the live preview before
            exporting.
          </span>
          <button
            id="undoAiButton"
            onClick={() => {
              update({ data: previousAiVersion }, "Undo not saved");
              setPreviousAiVersion(null);
              showToast("AI changes undone");
            }}
          >
            Undo
          </button>
        </div>
      )}
      {modal && <ActionModal options={modal} resolve={resolveModal} />}
      <div
        className={`toast ${toast ? "show" : ""}`}
        id="toast"
        role="status"
        aria-live="polite"
      >
        {toast?.message}
      </div>
    </>
  );
}
