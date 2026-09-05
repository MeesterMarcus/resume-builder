import { ApiError, accountJson, authenticateUser } from "./accounts.js";
import { normalizeResume } from "../src/backup-service.js";
import { resumeData } from "../src/resume-data.js";
import { RESUME_LAYOUTS } from "../src/resume-designs.js";

export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
export const DOCUMENT_SCHEMA = `CREATE TABLE IF NOT EXISTS documents (
  user_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL,
  revision INTEGER NOT NULL, updated_at TEXT NOT NULL, record TEXT NOT NULL,
  PRIMARY KEY (user_id, id))`;

function normalizeDraft(value) {
  if (!value || typeof value.documentName !== "string" || value.documentName.length > 200) throw new Error("Enter a document name under 200 characters.");
  if (!RESUME_LAYOUTS.some(item => item.id === value.layout) || !["blue", "slate", "teal", "green", "plum"].includes(value.theme)) throw new Error("Invalid document design.");
  if (!Number.isFinite(value.textScale) || value.textScale < 0.875 || value.textScale > 1.5) throw new Error("Invalid text scale.");
  return { data: normalizeResume(value.data, resumeData), documentName: value.documentName.trim() || "Untitled résumé", layout: value.layout, theme: value.theme, textScale: value.textScale };
}

export function validateDocument(value) {
  try {
    if (!Number.isSafeInteger(value?.revision) || value.revision < 0) throw new Error("A valid document revision is required.");
    if (!Array.isArray(value.history) || value.history.length > 10) throw new Error("Keep at most 10 history entries.");
    const draft = normalizeDraft(value.draft);
    const history = value.history.map(entry => {
      if (typeof entry.id !== "string" || entry.id.length > 100 || typeof entry.label !== "string" || entry.label.length > 200 || typeof entry.createdAt !== "string" || !Number.isFinite(Date.parse(entry.createdAt))) throw new Error("Invalid history entry.");
      return { ...normalizeDraft(entry), id: entry.id, label: entry.label, createdAt: new Date(entry.createdAt).toISOString() };
    });
    return { revision: value.revision, draft, history };
  } catch (error) { throw new ApiError(400, error.message); }
}

// Both SQLite adapters execute this entire function inside a transaction.
export function writeDocument(query, userId, id, value) {
  const existing = query("SELECT revision FROM documents WHERE user_id = ? AND id = ?", userId, id)[0];
  if ((existing?.revision ?? 0) !== value.revision) return { status: 409, error: "This CV changed on another device. Export your draft before reloading the saved version." };
  if (!existing && query("SELECT COUNT(*) AS count FROM documents WHERE user_id = ?", userId)[0].count >= 50) return { status: 409, error: "Your account has reached the 50 CV storage limit." };
  const record = { ...value, id, revision: value.revision + 1, updatedAt: new Date().toISOString() };
  query(`INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, id) DO UPDATE SET name=excluded.name, revision=excluded.revision, updated_at=excluded.updated_at, record=excluded.record`,
    userId, id, value.draft.documentName, record.revision, record.updatedAt, JSON.stringify(record));
  return { document: record };
}

export function listDocuments(query, userId) {
  return query("SELECT id, name, revision, updated_at AS updatedAt FROM documents WHERE user_id = ? ORDER BY updated_at DESC", userId);
}
export function readDocument(query, userId, id) {
  const row = query("SELECT record FROM documents WHERE user_id = ? AND id = ?", userId, id)[0];
  return row ? JSON.parse(row.record) : null;
}

async function readBody(request) {
  if (Number(request.headers.get("Content-Length")) > MAX_DOCUMENT_BYTES) throw new ApiError(413, "CV and history must be under 2 MB.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Document data is required.");
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_DOCUMENT_BYTES) { await reader.cancel(); throw new ApiError(413, "CV and history must be under 2 MB."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new ApiError(400, "Invalid JSON document."); }
}

export async function handleDocumentRequest(request, env, store) {
  const path = new URL(request.url).pathname;
  if (path !== "/api/documents" && !path.startsWith("/api/documents/")) return null;
  try {
    const userId = await authenticateUser(request, env);
    if (path === "/api/documents" && request.method === "GET") return accountJson({ documents: await store.listDocuments(userId) });
    const id = path.slice("/api/documents/".length);
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new ApiError(404, "CV not found.");
    if (request.method === "GET") {
      const document = await store.readDocument(userId, id);
      if (!document) throw new ApiError(404, "CV not found.");
      return accountJson({ document });
    }
    if (request.method === "PUT") {
      const result = await store.writeDocument(userId, id, validateDocument(await readBody(request)));
      return accountJson(result, result.status ?? 200);
    }
    return new Response(null, { status: 405, headers: { Allow: path === "/api/documents" ? "GET" : "GET, PUT" } });
  } catch (error) { return accountJson({ error: error.status ? error.message : "CV storage is unavailable. Please try saving again." }, error.status ?? 503); }
}
