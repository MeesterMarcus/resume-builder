const RATE_LIMIT_WINDOW_SECONDS = 60;

async function fingerprint(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function check(rateLimiter, key) {
  if (!rateLimiter) {
    throw new Error("AI_RATE_LIMITER_UNAVAILABLE");
  }

  return rateLimiter.limit({ key });
}

export async function checkAiRateLimit({ request, env, hasHostedAccess, providedApiKey }) {
  if (hasHostedAccess) {
    const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const [perClient, global] = await Promise.all([
      check(env.HOSTED_AI_RATE_LIMITER, `hosted:${clientIp}`),
      check(env.HOSTED_AI_GLOBAL_RATE_LIMITER, "hosted:global"),
    ]);

    return {
      allowed: perClient.success && global.success,
      retryAfter: RATE_LIMIT_WINDOW_SECONDS,
    };
  }

  const credentialFingerprint = await fingerprint(providedApiKey);
  const result = await check(env.BYOK_AI_RATE_LIMITER, `byok:${credentialFingerprint}`);

  return {
    allowed: result.success,
    retryAfter: RATE_LIMIT_WINDOW_SECONDS,
  };
}
