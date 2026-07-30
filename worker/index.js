import { createOpenAiRequest, getOutputText } from "../shared/ai-contract.js";
import { checkAiRateLimit } from "./ai-rate-limit.js";
import { HostedAiDailyLimit, consumeHostedAiDailyAllowance } from "./hosted-ai-daily-limit.js";

export { HostedAiDailyLimit };

const HOSTED_AI_DAILY_LIMIT = 50;

const jsonHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};
const securityHeaders = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'sha256-VMefWjQ7SbGXsfKMa6Equmdz+kEDbDB0qvfYe+Th8hU='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function jsonResponse(body, status = 200, additionalHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...additionalHeaders },
  });
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  Object.entries(securityHeaders).forEach(([name, value]) => headers.set(name, value));
  return headers;
}

function isAllowedRequest(request, allowedIpsValue) {
  const hostname = new URL(request.url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;

  const clientIp = request.headers.get("CF-Connecting-IP");
  const allowedIps = (allowedIpsValue ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return Boolean(clientIp && allowedIps.includes(clientIp));
}

function validatePayload(payload) {
  if (!payload?.currentResume || typeof payload.currentResume !== "object") {
    throw new Error("A current résumé is required.");
  }
  if (!["optimize", "revise"].includes(payload.action)) {
    throw new Error("The requested AI action is not supported.");
  }
  if (payload.documents && (!Array.isArray(payload.documents) || payload.documents.length > 2)) {
    throw new Error("Upload at most one résumé and one job description.");
  }
  if (typeof payload.prompt === "string" && payload.prompt.length > 20_000) {
    throw new Error("Keep AI instructions under 20,000 characters.");
  }
  const documentSize = (payload.documents ?? []).reduce((total, document) => total + (document?.data?.length ?? 0), 0);
  if (documentSize > 14 * 1024 * 1024) {
    throw new Error("Uploaded documents are too large. Keep the combined upload under 10 MB.");
  }
}

async function reviseResume(request, env) {
  const contentLength = Number.parseInt(request.headers.get("Content-Length") ?? "0", 10);
  if (contentLength > 15 * 1024 * 1024) {
    return jsonResponse({ error: "The AI request is too large." }, 413);
  }
  const hasHostedAccess = isAllowedRequest(request, env.AI_ALLOWED_IPS) && Boolean(env.OPENAI_API_KEY);
  const providedApiKey = request.headers.get("X-OpenAI-API-Key")?.trim() ?? "";
  if (providedApiKey && (providedApiKey.length < 20 || providedApiKey.length > 512)) {
    return jsonResponse({ error: "The provided OpenAI API key is not valid." }, 400);
  }
  if (!hasHostedAccess && !providedApiKey) {
    return jsonResponse({ error: "Add your own OpenAI API key to use AI from this connection." }, 403);
  }
  const apiKey = hasHostedAccess ? env.OPENAI_API_KEY : providedApiKey;
  const model = env.OPENAI_MODEL ?? "gpt-5.6-luna";

  try {
    const rateLimit = await checkAiRateLimit({ request, env, hasHostedAccess, providedApiKey });
    if (!rateLimit.allowed) {
      return jsonResponse(
        { error: "Too many AI requests. Please wait a minute and try again." },
        429,
        { "Retry-After": String(rateLimit.retryAfter) },
      );
    }

    const payload = await request.json();
    validatePayload(payload);

    if (hasHostedAccess) {
      const dailyAllowance = await consumeHostedAiDailyAllowance(env, HOSTED_AI_DAILY_LIMIT);
      if (!dailyAllowance.allowed) {
        return jsonResponse(
          { error: "The hosted AI daily limit has been reached. Please try again after the allowance resets at midnight UTC." },
          429,
        );
      }
    }

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createOpenAiRequest(payload, model)),
    });
    const responseBody = await openAiResponse.json();
    if (!openAiResponse.ok) {
      throw new Error(responseBody.error?.message ?? "The AI request failed.");
    }

    return jsonResponse({ resume: JSON.parse(getOutputText(responseBody)) });
  } catch (error) {
    return jsonResponse({ error: error.message ?? "The AI request failed." }, 400);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/ai/status" && request.method === "GET") {
      const hostedConfigured = Boolean(env.OPENAI_API_KEY);
      const hostedAccess = hostedConfigured && isAllowedRequest(request, env.AI_ALLOWED_IPS);
      return jsonResponse({
        configured: hostedConfigured,
        hostedAccess,
        byokSupported: true,
        model: env.OPENAI_MODEL ?? "gpt-5.6-luna",
      });
    }

    if (url.pathname === "/api/ai/revise" && request.method === "POST") {
      return reviseResume(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return jsonResponse({ error: "Not found." }, 404);
    }

    if (url.pathname === "/sitemap.xml") {
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${url.origin}/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>
  <url><loc>${url.origin}/privacy/</loc><changefreq>yearly</changefreq><priority>0.2</priority></url>
  <url><loc>${url.origin}/terms/</loc><changefreq>yearly</changefreq><priority>0.2</priority></url>
</urlset>`;
      return new Response(sitemap, {
        headers: {
          ...securityHeaders,
          "Cache-Control": "public, max-age=3600",
          "Content-Type": "application/xml; charset=utf-8",
        },
      });
    }

    if (url.pathname === "/app") {
      const appUrl = new URL(request.url);
      appUrl.pathname = "/app/";
      return Response.redirect(appUrl, 308);
    }
    let assetRequest = request;
    if (["/privacy/", "/terms/"].includes(url.pathname)) {
      const legalUrl = new URL(request.url);
      legalUrl.pathname = `${url.pathname.slice(0, -1)}.page`;
      assetRequest = new Request(legalUrl, request);
    }
    const assetResponse = await env.ASSETS.fetch(assetRequest);
    const headers = withSecurityHeaders(assetResponse);
    if (["/privacy/", "/terms/"].includes(url.pathname) && assetResponse.ok) {
      headers.set("Content-Type", "text/html; charset=utf-8");
    }
    if (["/", "/privacy/", "/terms/"].includes(url.pathname) && assetResponse.ok) {
      const html = (await assetResponse.text()).replaceAll("__SITE_ORIGIN__", url.origin);
      headers.set("Content-Type", "text/html; charset=utf-8");
      return new Response(html, { status: assetResponse.status, headers });
    }
    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    });
  },
};
