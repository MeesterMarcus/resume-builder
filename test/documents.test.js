import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { generateKeyPairSync, sign } from "node:crypto";
import { DOCUMENT_SCHEMA, writeDocument, readDocument, listDocuments, validateDocument, handleDocumentRequest } from "../server/documents.js";
import { resumeData } from "../src/resume-data.js";

const draft = { data: resumeData, documentName: "My CV", layout: "modern", theme: "blue", textScale: 1.25 };
test("CVs and history persist independently by account; stale writes cannot overwrite", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(DOCUMENT_SCHEMA);
  const query = (sql, ...args) => { const s = db.prepare(sql); if (s.columns().length) return s.all(...args); s.run(...args); return []; };
  try {
    const history = [{ ...draft, id: "v1", label: "Saved version", createdAt: new Date().toISOString() }];
    const value = validateDocument({ revision: 0, draft, history });
    assert.equal(writeDocument(query, "alice", "cv1", value).document.revision, 1);
    assert.equal(readDocument(query, "bob", "cv1"), null);
    assert.deepEqual(listDocuments(query, "bob"), []);
    assert.deepEqual(readDocument(query, "alice", "cv1").history, history);
    assert.equal(writeDocument(query, "alice", "cv1", value).status, 409);
    assert.equal(writeDocument(query, "alice", "cv1", { ...value, revision: 1, draft: { ...draft, documentName: "Updated" } }).document.revision, 2);
    assert.equal(listDocuments(query, "alice")[0].name, "Updated");
    assert.equal(writeDocument(query, "bob", "cv1", value).document.revision, 1);
    assert.equal(readDocument(query, "alice", "cv1").draft.documentName, "Updated");
  } finally { db.close(); }
});
test("invalid documents and excess history are rejected", () => {
  for (const value of [{}, { revision: -1, draft, history: [] }, { revision: 0, draft: { ...draft, textScale: 8 }, history: [] }, { revision: 0, draft, history: Array(11).fill({}) }]) {
    assert.throws(() => validateDocument(value), { status: 400 });
  }
});
test("document reads and writes require authentication before touching storage", async () => {
  for (const method of ["GET", "PUT"]) {
    const response = await handleDocumentRequest(new Request("https://example.com/api/documents/cv1", { method }), {}, {});
    assert.equal(response.status, 401);
  }
});

test("authenticated document API validates JSON and handles saves, loads and conflicts", async () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const env = { CLERK_JWT_KEY: publicKey.export({ type: "spki", format: "pem" }) };
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  function request(method, body, user = "user_alice") {
    const now = Math.floor(Date.now() / 1000);
    const payload = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ sub: user, sid: "sess_test", iss: "https://example.clerk.accounts.dev", azp: "https://example.com", iat: now, nbf: now - 10, exp: now + 60 })}`;
    const token = `${payload}.${sign("RSA-SHA256", Buffer.from(payload), privateKey).toString("base64url")}`;
    return new Request("https://example.com/api/documents/cv1", { method, headers: { Authorization: `Bearer ${token}` }, ...(body === undefined ? {} : { body }) });
  }
  const db = new DatabaseSync(":memory:");
  db.exec(DOCUMENT_SCHEMA);
  const query = (sql, ...args) => { const s = db.prepare(sql); if (s.columns().length) return s.all(...args); s.run(...args); return []; };
  const store = { readDocument: (u, id) => readDocument(query, u, id), writeDocument: (u, id, v) => writeDocument(query, u, id, v) };
  try {
    const body = JSON.stringify({ revision: 0, draft, history: [] });
    assert.equal((await handleDocumentRequest(request("PUT", "bad json"), env, store)).status, 400);
    assert.equal((await handleDocumentRequest(request("PUT", body), env, store)).status, 200);
    const loaded = await handleDocumentRequest(request("GET"), env, store);
    assert.equal((await loaded.json()).document.draft.documentName, "My CV");
    assert.equal((await handleDocumentRequest(request("GET", undefined, "user_bob"), env, store)).status, 404);
    assert.equal((await handleDocumentRequest(request("PUT", body), env, store)).status, 409);
    assert.equal((await handleDocumentRequest(request("PUT", "x".repeat(2 * 1024 * 1024 + 1)), env, store)).status, 413);
  } finally { db.close(); }
});
