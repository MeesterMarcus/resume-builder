import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { accountSnapshot, updateAccount } from "./accounts.js";
import { DOCUMENT_SCHEMA, listDocuments, readDocument, writeDocument } from "./documents.js";

mkdirSync(new URL("../.data/", import.meta.url), { recursive: true });
const db = new DatabaseSync(new URL("../.data/accounts.sqlite", import.meta.url).pathname);
db.exec(DOCUMENT_SCHEMA);
const query = (sql, ...args) => {
  const statement = db.prepare(sql);
  if (statement.columns().length) return statement.all(...args);
  statement.run(...args);
  return [];
};
db.exec("CREATE TABLE IF NOT EXISTS accounts (user_id TEXT PRIMARY KEY, record TEXT NOT NULL)");
const select = db.prepare("SELECT record FROM accounts WHERE user_id = ?");
const save = db.prepare("INSERT INTO accounts VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET record = excluded.record");
function update(userId, increment = false) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = select.get(userId);
    const record = updateAccount(row ? JSON.parse(row.record) : null, increment);
    save.run(userId, JSON.stringify(record));
    db.exec("COMMIT");
    return accountSnapshot(userId, record);
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}
export const localAccounts = {
  read: userId => update(userId), increment: userId => update(userId, true),
  listDocuments: userId => listDocuments(query, userId),
  readDocument: (userId, id) => readDocument(query, userId, id),
  writeDocument: (userId, id, value) => {
    db.exec("BEGIN IMMEDIATE");
    try { const result = writeDocument(query, userId, id, value); db.exec("COMMIT"); return result; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  },
};
