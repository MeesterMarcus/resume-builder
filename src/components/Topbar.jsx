import { useEffect, useRef, useState } from "react";
export default function Topbar({
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
}) {
  const [backupOpen, setBackupOpen] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => {
    const click = (event) => {
      if (!event.target.closest(".backup-control")) setBackupOpen(false);
    };
    const keydown = (event) => {
      if (event.key === "Escape") setBackupOpen(false);
    };
    document.addEventListener("click", click);
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("click", click);
      document.removeEventListener("keydown", keydown);
    };
  }, []);
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="RapidCV home">
        <img src="/assets/rapidcv-logo.svg" alt="" />
        <span>
          Rapid<span>CV</span>
        </span>
      </a>
      <div className="document-state">
        <button
          className="document-name"
          id="documentName"
          onClick={rename}
          aria-label="Rename document"
        >
          {documentName} <span>✎</span>
        </button>
        <span className="save-state">
          <i></i>
          <span id="saveStatus">{saveStatus}</span>
        </span>
      </div>
      <div className="top-actions">
        <a
          className="button button-support"
          href="https://ko-fi.com/marcuslorenzana"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Support RapidCV on Ko-fi"
          title="Tip jar"
        >
          <span aria-hidden="true">♡</span>
          <span className="secondary-label">Tip jar</span>
        </a>
        <div className="backup-control">
          <button
            className="button button-backup"
            id="backupMenuButton"
            onClick={() => setBackupOpen(!backupOpen)}
            type="button"
            aria-haspopup="menu"
            aria-expanded={backupOpen}
          >
            <span aria-hidden="true">⇅</span>
            <span className="secondary-label">Backup</span>
          </button>
          <div
            className="backup-menu"
            id="backupMenu"
            role="menu"
            hidden={!backupOpen}
          >
            <button
              id="exportBackupButton"
              onClick={() => {
                setBackupOpen(false);
                exportBackup();
              }}
              type="button"
              role="menuitem"
            >
              <span>↓</span>
              <strong>Export backup</strong>
              <small>Download a portable JSON file</small>
            </button>
            <button
              id="importBackupButton"
              onClick={() => {
                setBackupOpen(false);
                fileRef.current.click();
              }}
              type="button"
              role="menuitem"
            >
              <span>↑</span>
              <strong>Import backup</strong>
              <small>Restore a RapidCV JSON file</small>
            </button>
          </div>
          <input
            className="sr-only"
            id="backupFileInput"
            ref={fileRef}
            onChange={async (event) => {
              const input = event.currentTarget;
              await importBackup(input.files?.[0]);
              input.value = "";
            }}
            type="file"
            accept=".json,application/json"
          />
        </div>
        <button
          className="button button-ghost"
          id="openHistoryButton"
          onClick={() => setHistoryOpen(true)}
          type="button"
          aria-label="Version history"
          title="History"
        >
          <span aria-hidden="true">↶</span>
          <span className="secondary-label">History</span>
        </button>
        <button
          className="button button-ghost"
          id="resetButton"
          onClick={reset}
          type="button"
          aria-label="Reset résumé"
          title="Reset"
        >
          <span aria-hidden="true">↺</span>
          <span className="secondary-label">Reset</span>
        </button>
        <button
          className={`button button-save ${dirty ? "dirty" : ""}`}
          id="saveButton"
          onClick={save}
        >
          <span>✓</span>
          <span className="compact-label">Save</span>
        </button>
        <button
          className="button button-ai"
          id="openAiButton"
          onClick={() => setAiOpen(true)}
        >
          <span>✦</span> Ask AI
        </button>
        <button
          className="button button-primary"
          id="exportButton"
          onClick={() => window.print()}
        >
          <span>↓</span>
          <span className="compact-label">Export PDF</span>
        </button>
      </div>
    </header>
  );
}
