import { verifyToken } from "@clerk/backend";

export const FREE_PLAN = Object.freeze({ id: "free", name: "Free", limits: { aiRequestsPerMonth: null } });

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function authenticateUser(request, env) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) throw new ApiError(401, "Sign in to access your account.");
  const match = /^Bearer (\S+)$/i.exec(authorization);
  if (!match) throw new ApiError(401, "Invalid authentication token.");
  if (!env.CLERK_SECRET_KEY && !env.CLERK_JWT_KEY) {
    throw new ApiError(503, "Account authentication is not configured.");
  }
  const origin = new URL(request.url).origin;
  const authorizedParties = env.CLERK_AUTHORIZED_PARTIES
    ? env.CLERK_AUTHORIZED_PARTIES.split(",").map(value => value.trim()).filter(Boolean)
    : [origin];
  try {
    const claims = await verifyToken(match[1], {
      secretKey: env.CLERK_SECRET_KEY,
      jwtKey: env.CLERK_JWT_KEY,
      authorizedParties,
    });
    if (!claims.sub?.startsWith("user_") || !claims.sid) throw new Error("Session required");
    return claims.sub;
  } catch {
    throw new ApiError(401, "Your session is invalid or expired. Please sign in again.");
  }
}

export function usagePeriod(now = new Date()) {
  return {
    month: now.toISOString().slice(0, 7),
    resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
  };
}

export function accountSnapshot(userId, record, now = new Date()) {
  const { month, resetsAt } = usagePeriod(now);
  return {
    user: { id: userId, createdAt: record.createdAt },
    plan: FREE_PLAN,
    usage: { period: month, resetsAt, aiRequests: record.month === month ? record.aiRequests : 0 },
  };
}

export function updateAccount(record, increment = false, now = new Date()) {
  const { month } = usagePeriod(now);
  return {
    createdAt: record?.createdAt ?? now.toISOString(),
    month,
    aiRequests: (record?.month === month ? record.aiRequests : 0) + (increment ? 1 : 0),
  };
}

export function accountJson(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function handleAccountRequest(request, env, store) {
  const path = new URL(request.url).pathname;
  if (!["/api/me", "/api/me/usage", "/api/plans"].includes(path)) return null;
  if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });
  if (path === "/api/plans") return accountJson({ plans: [FREE_PLAN] });
  try {
    const userId = await authenticateUser(request, env);
    const account = await store.read(userId);
    return accountJson(path === "/api/me/usage" ? { plan: account.plan, usage: account.usage } : account);
  } catch (error) {
    return accountJson({ error: error.status ? error.message : "Account service unavailable." }, error.status ?? 503);
  }
}
