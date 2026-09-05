import { useAuth, useClerk, UserButton } from "@clerk/react";
import { useEffect, useRef, useState } from "react";
import App from "./App.jsx";
import { loadDocument, KEYS } from "./storage.js";
import { resumeData } from "./resume-data.js";
import { VersionHistory } from "./version-history.js";

export default function AccountWorkspace() {
  const { isLoaded, userId } = useAuth();
  if (!isLoaded) return <p role="status">Loading your workspace…</p>;
  return userId ? <CloudWorkspace key={userId} /> : <App key="guest" />;
}

function CloudWorkspace() {
  const { getToken, userId } = useAuth();
  const clerk = useClerk();
  const [documents, setDocuments] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const activeId = useRef(null);
  const generation = useRef(0);

  async function api(path, options = {}) {
    const token = await getToken();
    if (!token || clerk.user?.id !== userId) throw new Error("Your account changed. Please reopen your workspace.");
    const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not sync your CVs.");
    return result;
  }
  function select(document) {
    revision.current = document.revision;
    activeId.current = document.id;
    setCurrent(document);
    setDirty(false);
  }
  async function load() {
    const run = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const result = await api("/api/documents");
      const first = result.documents[0];
      const document = first ? (await api(`/api/documents/${first.id}`)).document : null;
      if (run !== generation.current) return;
      setDocuments(result.documents);
      if (document) select(document);
    } catch (error) { if (run === generation.current) setError(error.message); }
    finally { if (run === generation.current) setLoading(false); }
  }
  useEffect(() => { load(); return () => { generation.current++; }; }, []);

  async function open(id) {
    if (dirty || busy) return;
    setBusy(true);
    setError("");
    try { select((await api(`/api/documents/${id}`)).document); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function create(importLocal = false) {
    if (dirty || busy) return;
    setBusy(true);
    setError("");
    try {
      const draft = importLocal ? loadDocument() : { data: structuredClone(resumeData), documentName: "Untitled résumé", theme: "blue", layout: "modern", textScale: 1.25 };
      const history = importLocal ? new VersionHistory(KEYS.history).all() : [];
      const id = crypto.randomUUID();
      const { document } = await api(`/api/documents/${id}`, { method: "PUT", body: JSON.stringify({ revision: 0, draft, history }) });
      setDocuments(items => [{ id, name: draft.documentName }, ...items]);
      select(document);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function persist(draft, history) {
    const id = activeId.current;
    const { document } = await api(`/api/documents/${id}`, { method: "PUT", body: JSON.stringify({ revision: revision.current, draft, history }) });
    if (activeId.current === id) revision.current = document.revision;
    setDocuments(items => items.map(item => item.id === id ? { ...item, name: document.draft.documentName } : item));
  }

  return <>
    <nav className="account-workspace" aria-label="Your CVs">
      <a href="/">RapidCV</a>
      <label>Your CVs <select aria-label="Select a CV" value={current?.id ?? ""} disabled={dirty || busy || loading} onChange={event => open(event.target.value)}>
        {!current && <option value="">Choose a CV</option>}
        {documents.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <button type="button" disabled={dirty || busy || loading || Boolean(error && !current)} onClick={() => create()}>New CV</button>
      <button type="button" disabled={dirty || busy || loading || Boolean(error && !current)} onClick={() => create(true)}>Import browser draft</button>
      {dirty && <span role="status">Save your changes before switching CVs.</span>}
      {!current && <UserButton />}
    </nav>
    {error && <div className="cloud-message" role="alert">{error} {!current && <button onClick={load}>Retry</button>}</div>}
    {loading ? <p className="cloud-message" role="status">Loading your CVs…</p> : current ?
      <App key={current.id} initialDocument={current.draft} initialHistory={current.history} onPersist={persist} onDirtyChange={setDirty} /> :
      !error && <div className="cloud-message"><h1>Your CVs, saved to your account</h1><p>Create a CV or import this browser’s saved draft and history to get started.</p></div>}
  </>;
}
