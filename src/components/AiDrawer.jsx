import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { KEYS, readStorage } from "../storage.js";

async function readResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      response.ok
        ? "The server returned an invalid response."
        : `AI endpoint unavailable (${response.status}). Start the app with npm run dev.`,
    );
  }
}
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({ name: file.name, type: file.type, data: reader.result });
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}
export default function AiDrawer({ open, close, data, applyAi, showToast }) {
  const { getToken, isSignedIn } = useAuth();
  const [hosted, setHosted] = useState(null);
  const [apiKey, setApiKey] = useState(() =>
    readStorage(KEYS.apiKey, "", sessionStorage),
  );
  const [keyInput, setKeyInput] = useState(apiKey);
  const [reveal, setReveal] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [documents, setDocuments] = useState({ resume: null, job: null });
  const [dragging, setDragging] = useState(null);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const promptRef = useRef(null),
    keyRef = useRef(null),
    settingsRef = useRef(null);
  const resumeRef = useRef(null),
    jobRef = useRef(null),
    requestRef = useRef(null);
  const fileVersion = useRef({ resume: 0, job: 0 });
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setHosted(null);
    fetch("/api/ai/status", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await readResponse(response);
        if (!controller.signal.aborted)
          setHosted(response.ok && result.hostedAccess === true);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setHosted(false);
      });
    const timeout = setTimeout(() => promptRef.current?.focus(), 280);
    return () => {
      controller.abort();
      clearTimeout(timeout);
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [open]);
  useEffect(() => {
    if (open) return;
    setPrompt("");
    setDocuments({ resume: null, job: null });
    setStatus({ state: "idle", message: "" });
    setReveal(false);
    fileVersion.current.resume++;
    fileVersion.current.job++;
    if (resumeRef.current) resumeRef.current.value = "";
    if (jobRef.current) jobRef.current.value = "";
    if (settingsRef.current) settingsRef.current.open = false;
  }, [open]);
  function error(message) {
    setStatus({ state: "error", message });
  }
  function saveKey() {
    const key = keyInput.trim();
    if (key.length < 20) {
      error("Enter a valid OpenAI API key.");
      return;
    }
    setApiKey(key);
    try {
      sessionStorage.setItem(KEYS.apiKey, key);
    } catch {
      /* Still usable in memory. */
    }
    settingsRef.current.open = false;
    setStatus({ state: "idle", message: "" });
    showToast("OpenAI key ready for this tab");
  }
  function clearKey() {
    setApiKey("");
    setKeyInput("");
    try {
      sessionStorage.removeItem(KEYS.apiKey);
      localStorage.removeItem(KEYS.apiKey);
    } catch {
      /* Storage may be disabled. */
    }
    showToast("OpenAI key cleared");
  }
  async function setFile(kind, file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast("Please choose a file under 10 MB");
      return;
    }
    const version = ++fileVersion.current[kind];
    try {
      const document = await readFile(file);
      if (version === fileVersion.current[kind])
        setDocuments((current) => ({ ...current, [kind]: document }));
    } catch (err) {
      showToast(err.message);
    }
  }
  function clearFile(kind) {
    fileVersion.current[kind]++;
    setDocuments((current) => ({ ...current, [kind]: null }));
    (kind === "resume" ? resumeRef : jobRef).current.value = "";
    showToast(
      `${kind === "resume" ? "Résumé" : "Job description"} attachment removed`,
    );
  }
  async function runAi(action) {
    if (requestRef.current) return;
    if (
      action === "revise" &&
      !prompt.trim() &&
      !documents.resume &&
      !documents.job
    ) {
      error("Add a request or upload a document first.");
      return;
    }
    if (hosted === null) {
      error("AI access is still being checked. Please try again in a moment.");
      return;
    }
    if (!hosted && !apiKey) {
      settingsRef.current.open = true;
      keyRef.current.focus();
      error("Add your OpenAI API key to use AI from this connection.");
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus({
      state: "loading",
      message:
        action === "optimize"
          ? "Checking impact, clarity, keywords, and concision."
          : "Applying your request without inventing details.",
    });
    try {
      const token = isSignedIn ? await getToken() : null;
      if (isSignedIn && !token) throw new Error("Please sign in again before using AI.");
      const response = await fetch("/api/ai/revise", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(!hosted && apiKey ? { "X-OpenAI-API-Key": apiKey } : {}),
        },
        body: JSON.stringify({
          action,
          prompt: prompt.trim(),
          currentResume: data,
          documents: Object.values(documents).filter(Boolean),
        }),
      });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(result.error ?? "The request failed.");
      if (!controller.signal.aborted) {
        applyAi(result.resume);
        setStatus({ state: "idle", message: "" });
      }
    } catch (err) {
      if (err.name !== "AbortError") error(err.message);
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }
  const accessTitle =
    hosted === true
      ? "Hosted AI access available"
      : apiKey
        ? "Using your OpenAI API key"
        : hosted === false
          ? "Bring your own OpenAI key"
          : "Checking AI access…";
  const accessDescription =
    hosted === true
      ? "This connection can use the site’s configured AI service."
      : apiKey
        ? "Requests are billed directly to your OpenAI account."
        : hosted === false
          ? "Hosted AI is limited, but you can connect your own account."
          : "Confirming which connection this browser can use.";
  return (
    <>
      <div
        className={`ai-backdrop ${open ? "open" : ""}`}
        onClick={close}
        id="aiBackdrop"
      ></div>
      <aside
        className={`ai-drawer ${open ? "open" : ""}`}
        inert={!open}
        id="aiDrawer"
        aria-hidden={!open}
        aria-labelledby="aiTitle"
      >
        <header className="ai-header">
          <div className="ai-orb">✦</div>
          <div>
            <p className="eyebrow">AI résumé partner</p>
            <h2 id="aiTitle">What should we improve?</h2>
          </div>
          <button
            className="icon-button"
            id="closeAiButton"
            onClick={close}
            aria-label="Close AI assistant"
          >
            ×
          </button>
        </header>

        <div className="ai-content">
          <section
            className={`ai-access-card ${hosted === true ? "hosted" : apiKey ? "byok" : ""}`}
            id="aiAccessCard"
          >
            <div className="ai-access-summary">
              <span className="access-indicator"></span>
              <span>
                <strong id="aiAccessTitle">{accessTitle}</strong>
                <small id="aiAccessDescription">{accessDescription}</small>
              </span>
            </div>
            <details id="byokSettings" ref={settingsRef}>
              <summary>Use your own OpenAI API key</summary>
              <div className="byok-fields">
                <label htmlFor="byokApiKey">OpenAI API key</label>
                <div className="secret-input">
                  <input
                    id="byokApiKey"
                    ref={keyRef}
                    type={reveal ? "text" : "password"}
                    value={keyInput}
                    onChange={(event) => setKeyInput(event.target.value)}
                    autoComplete="off"
                    spellCheck="false"
                    placeholder="sk-…"
                  />
                  <button
                    id="toggleByokVisibility"
                    onClick={() => setReveal(!reveal)}
                    type="button"
                    aria-label={`${reveal ? "Hide" : "Show"} API key`}
                  >
                    {reveal ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="byok-session-note">
                  <strong>Session only.</strong> Your key stays in this browser
                  tab and is cleared when the tab closes. For added safety,
                  RapidCV does not store API keys in persistent browser storage.
                </p>
                <div className="byok-actions">
                  <button id="saveByokKey" onClick={saveKey} type="button">
                    Use this key
                  </button>
                  <button id="clearByokKey" onClick={clearKey} type="button">
                    Clear
                  </button>
                </div>
                <p>
                  Use a dedicated, restricted OpenAI project key with a small
                  spending limit. The key passes through this site’s Worker only
                  for your OpenAI request; it is never added to your résumé or
                  saved on the server.
                </p>
                <p className="byok-future-note">
                  <strong>Where this is headed:</strong> managed AI access is on
                  the roadmap so most users will not need to provide a personal
                  API key.
                </p>
              </div>
            </details>
          </section>

          <button
            className="optimize-card"
            id="optimizeButton"
            disabled={status.state === "loading"}
            onClick={() => runAi("optimize")}
          >
            <span className="optimize-icon">↗</span>
            <span>
              <strong>Optimize my résumé</strong>
              <small>
                Improve impact, clarity, keywords, and concision in one pass.
              </small>
            </span>
            <span>→</span>
          </button>

          <div className="ai-divider">
            <span>or give AI more context</span>
          </div>

          <div className="upload-grid">
            <div className="drop-zone-shell">
              <label
                className={`drop-zone ${documents.resume ? "has-file" : ""} ${dragging === "resume" ? "dragging" : ""}`}
                id="resumeDropZone"
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging("resume");
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragging(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(null);
                  setFile("resume", event.dataTransfer.files[0]);
                }}
              >
                <input
                  type="file"
                  id="resumeFile"
                  ref={resumeRef}
                  onChange={(event) => setFile("resume", event.target.files[0])}
                  accept=".pdf,.doc,.docx,.txt,.md"
                />
                <span className="drop-icon">↑</span>
                <strong>Existing résumé</strong>
                <small id="resumeFileName">
                  {documents.resume?.name ?? "PDF, DOCX, or text"}
                </small>
              </label>
              <button
                className="remove-ai-file"
                id="removeResumeFile"
                onClick={() => clearFile("resume")}
                type="button"
                aria-label="Remove attached résumé"
                title="Remove attachment"
              >
                ×
              </button>
            </div>
            <div className="drop-zone-shell">
              <label
                className={`drop-zone ${documents.job ? "has-file" : ""} ${dragging === "job" ? "dragging" : ""}`}
                id="jobDropZone"
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging("job");
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragging(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(null);
                  setFile("job", event.dataTransfer.files[0]);
                }}
              >
                <input
                  type="file"
                  id="jobFile"
                  ref={jobRef}
                  onChange={(event) => setFile("job", event.target.files[0])}
                  accept=".pdf,.doc,.docx,.txt,.md"
                />
                <span className="drop-icon">◎</span>
                <strong>Job description</strong>
                <small id="jobFileName">
                  {documents.job?.name ?? "Upload the target role"}
                </small>
              </label>
              <button
                className="remove-ai-file"
                id="removeJobFile"
                onClick={() => clearFile("job")}
                type="button"
                aria-label="Remove attached job description"
                title="Remove attachment"
              >
                ×
              </button>
            </div>
          </div>

          <label className="ai-prompt-label" htmlFor="aiPrompt">
            Ask for any change
          </label>
          <div className="prompt-box">
            <textarea
              id="aiPrompt"
              ref={promptRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  runAi("revise");
                }
              }}
              rows="5"
              placeholder="e.g. Tailor this for a Staff Engineer role. Emphasize architecture and leadership without overstating anything."
            ></textarea>
            <button
              id="sendAiButton"
              disabled={status.state === "loading"}
              onClick={() => runAi("revise")}
              aria-label="Send prompt"
            >
              ↑
            </button>
          </div>

          <div
            className="prompt-suggestions"
            onClick={(event) => {
              if (event.target.tagName === "BUTTON") {
                setPrompt(event.target.textContent);
                promptRef.current?.focus();
              }
            }}
          >
            <button>Make my bullets more impactful</button>
            <button>Tailor this to the job description</button>
            <button>Shorten the summary</button>
          </div>

          <div
            className={`ai-status ${status.state !== "idle" ? "visible" : ""} ${status.state === "error" ? "error" : ""}`}
            id="aiStatus"
            role="status"
            aria-live="polite"
          >
            <span className="ai-spinner"></span>
            <p>
              <strong>
                {status.state === "error"
                  ? "Couldn’t update the résumé"
                  : "Improving your résumé…"}
              </strong>
              <small>{status.message}</small>
            </p>
          </div>
        </div>

        <footer className="ai-footer">
          <span>✦</span>
          <p>AI can make mistakes. Review every change before exporting.</p>
        </footer>
      </aside>
    </>
  );
}
