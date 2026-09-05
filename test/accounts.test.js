import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { accountSnapshot, updateAccount, handleAccountRequest, authenticateUser } from "../server/accounts.js";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const env = { CLERK_JWT_KEY: publicKey.export({ type: "spki", format: "pem" }), CLERK_AUTHORIZED_PARTIES: "https://app.example.com" };
function token(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = `${encode({ alg: "RS256", typ: "JWT", kid: "test" })}.${encode({ sub: "user_alice", sid: "sess_test", iss: "https://example.clerk.accounts.dev", azp: "https://app.example.com", iat: now, nbf: now - 10, exp: now + 60, ...overrides })}`;
  return `${body}.${sign("RSA-SHA256", Buffer.from(body), privateKey).toString("base64url")}`;
}
function request(path = "/api/me", bearer, method = "GET") {
  return new Request(`https://app.example.com${path}`, { method, headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} });
}

test("verifies session signature, expiry and authorized origin", async () => {
  assert.equal(await authenticateUser(request("/api/me", token()), env), "user_alice");
  for (const bearer of ["forged", token({ exp: 1 }), token({ azp: "https://attacker.example" }), token({ sid: null })]) {
    await assert.rejects(authenticateUser(request("/api/me", bearer), env), { status: 401 });
  }
});

test("account API derives user identity from the token and rejects unauthenticated access", async () => {
  const users = [];
  const store = { read: id => { users.push(id); return accountSnapshot(id, updateAccount()); } };
  assert.equal((await handleAccountRequest(request(), env, store)).status, 401);
  assert.equal(users.length, 0);
  const response = await handleAccountRequest(request("/api/me?userId=user_bob", token()), env, store);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.id, "user_alice");
  assert.deepEqual(users, ["user_alice"]);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal((await handleAccountRequest(request("/api/me", token(), "PATCH"), env, store)).status, 405);
});

test("monthly usage resets in UTC and preserves account creation time", () => {
  const january = new Date("2026-01-31T23:59:59Z");
  const february = new Date("2026-02-01T00:00:00Z");
  const first = updateAccount(null, true, january);
  const second = updateAccount(first, true, january);
  assert.equal(second.aiRequests, 2);
  const next = accountSnapshot("user_alice", second, february);
  assert.equal(next.usage.aiRequests, 0);
  assert.equal(next.usage.resetsAt, "2026-03-01T00:00:00.000Z");
  const incremented = updateAccount(second, true, february);
  assert.equal(incremented.aiRequests, 1);
  assert.equal(incremented.createdAt, first.createdAt);
  assert.equal(next.plan.id, "free");
});
