export function onRequestGet({ env }) {
  return Response.json(
    {
      configured: Boolean(env.OPENAI_API_KEY && env.OPENAI_MODEL),
      model: env.OPENAI_MODEL ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

