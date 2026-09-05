import { DurableObject } from "cloudflare:workers";
import { accountSnapshot, updateAccount } from "../server/accounts.js";
import { DOCUMENT_SCHEMA, listDocuments, readDocument, writeDocument } from "../server/documents.js";

export class UserAccount extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec(DOCUMENT_SCHEMA);
  }
  query = (sql, ...args) => this.ctx.storage.sql.exec(sql, ...args).toArray();
  listDocuments(userId) { return listDocuments(this.query, userId); }
  readDocument(userId, id) { return readDocument(this.query, userId, id); }
  writeDocument(userId, id, value) {
    return this.ctx.storage.transactionSync(() => writeDocument(this.query, userId, id, value));
  }
  async update(userId, increment = false) {
    return this.ctx.storage.transaction(async storage => {
      const record = updateAccount(await storage.get("account"), increment);
      await storage.put("account", record);
      return accountSnapshot(userId, record);
    });
  }
}

export function userAccountStore(env) {
  function account(userId) {
    if (!env.USER_ACCOUNTS) throw new Error("User account storage unavailable");
    return env.USER_ACCOUNTS.get(env.USER_ACCOUNTS.idFromName(userId));
  }
  return {
    read: userId => account(userId).update(userId),
    increment: userId => account(userId).update(userId, true),
    listDocuments: userId => account(userId).listDocuments(userId),
    readDocument: (userId, id) => account(userId).readDocument(userId, id),
    writeDocument: (userId, id, value) => account(userId).writeDocument(userId, id, value),
  };
}
