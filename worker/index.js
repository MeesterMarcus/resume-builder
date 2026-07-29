import { createOpenAiRequest, getOutputText } from "../shared/ai-contract.js";

const jsonHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
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
}

async function reviseResume(request, env) {
  if (!isAllowedRequest(request, env.AI_ALLOWED_IPS)) {
    return jsonResponse({ error: "AI access is restricted for this deployment." }, 403);
  }
  if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL) {
    return jsonResponse({ error: "The AI service is not configured." }, 503);
  }

  try {
    const payload = await request.json();
    validatePayload(payload);

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createOpenAiRequest(payload, env.OPENAI_MODEL)),
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
      return jsonResponse({
        configured: Boolean(env.OPENAI_API_KEY && env.OPENAI_MODEL),
        model: env.OPENAI_MODEL ?? null,
      });
    }

    if (url.pathname === "/api/ai/revise" && request.method === "POST") {
      return reviseResume(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return jsonResponse({ error: "Not found." }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};

