import { useEffect, useRef, useState } from "react";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";
export default function Topbar({
  documentPicker,
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
  const accountRef = useRef(null);
  useEffect(() => {
    const click = (event) => {
      if (!event.target.closest(".backup-control")) setBackupOpen(false);
      if (accountRef.current && !accountRef.current.contains(event.target)) accountRef.current.open = false;
    };
    const keydown = (event) => {
      if (event.key === "Escape") setBackupOpen(false);
      if (event.key === "Escape" && accountRef.current?.open) {
        accountRef.current.open = false;
        accountRef.current.querySelector("summary")?.focus();
      }
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
      <div className="document-context">
      {documentPicker}
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
      </div>
      <div className="top-actions">
        <div className="backup-control">
          <button
            className="button button-backup"
            id="backupMenuButton"
            aria-label="More document actions"
            title="More actions"
            onClick={() => setBackupOpen(!backupOpen)}
            type="button"
            aria-haspopup="menu"
            aria-expanded={backupOpen}
          >
            <span aria-hidden="true">···</span>
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
            <button onClick={() => { setBackupOpen(false); rename(); }} type="button" role="menuitem"><span>✎</span><strong>Rename CV</strong><small>Give this version a name</small></button>
            <button id="resetButton" onClick={() => { setBackupOpen(false); reset(); }} type="button" role="menuitem"><span>↺</span><strong>Reset CV</strong><small>Start over and keep your history</small></button>
            <a className="menu-support" role="menuitem" href="https://ko-fi.com/marcuslorenzana" target="_blank" rel="noopener noreferrer">♡ Support RapidCV</a>
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
        <div className="auth-controls">
          <Show when="signed-out">
            <details className="account-menu" ref={accountRef}>
              <summary aria-label="Account options" title="Account">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                </svg>
              </summary>
              <div className="account-dropdown">
                <strong>Your workspace, anywhere</strong>
                <p>Sign in to save your CVs and history to your account.</p>
                <SignInButton mode="modal">
                  <button className="account-signin" type="button" onClick={() => { accountRef.current.open = false; }}>Sign in <span aria-hidden="true">→</span></button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="account-signup" type="button" onClick={() => { accountRef.current.open = false; }}>Create an account</button>
                </SignUpButton>
              </div>
            </details>
          </Show>
          <Show when="signed-in">
            <UserButton appearance={{ elements: { avatarBox: { width: "36px", height: "36px" } } }} />
          </Show>
        </div>
      </div>
    </header>
  );
}
