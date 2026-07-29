import { config } from "./config.js";

const resumeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["basics", "summary", "achievements", "skills", "experience", "education"],
  properties: {
    basics: {
      type: "object",
      additionalProperties: false,
      required: ["name", "title", "tagline", "location", "phone", "email", "portfolio"],
      properties: Object.fromEntries(
        ["name", "title", "tagline", "location", "phone", "email", "portfolio"].map((key) => [key, { type: "string" }]),
      ),
    },
    summary: { type: "string" },
    achievements: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["value", "label"],
        properties: { value: { type: "string" }, label: { type: "string" } },
      },
    },
    skills: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "items"],
        properties: { category: { type: "string" }, items: { type: "string" } },
      },
    },
    experience: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["company", "role", "dates", "location", "bullets"],
        properties: {
          company: { type: "string" },
          role: { type: "string" },
          dates: { type: "string" },
          location: { type: "string" },
          bullets: { type: "array", minItems: 1, items: { type: "string" } },
        },
      },
    },
    education: {
      type: "object",
      additionalProperties: false,
      required: ["school", "degree", "date"],
      properties: {
        school: { type: "string" },
        degree: { type: "string" },
        date: { type: "string" },
      },
    },
  },
};

const systemPrompt = `You are an expert technical resume editor. Return a complete revised resume matching the provided schema.

Rules:
- Never invent employers, dates, degrees, certifications, technologies, metrics, or accomplishments.
- Preserve factual claims unless the uploaded resume provides a justified correction.
- Apply the user's request and use the job description to improve relevance, keyword alignment, and ordering.
- Write concise, credible, ATS-friendly language. Avoid keyword stuffing and generic filler.
- Prefer strong verbs and measurable outcomes already supported by the source material.
- Keep the result suitable for a polished two-page senior engineering resume.
- Return exactly four high-signal achievements.
- Do not add commentary outside the structured result.`;

function buildUserContent({ action, currentResume, prompt, documents = [] }) {
  const instruction =
    action === "optimize"
      ? "Perform a comprehensive optimization: improve clarity, impact, concision, ATS alignment, and prioritization."
      : prompt;

  const content = [
    {
      type: "input_text",
      text: `USER REQUEST:\n${instruction}\n\nCURRENT RESUME JSON:\n${JSON.stringify(currentResume)}`,
    },
  ];

  for (const document of documents) {
    if (!document?.data || !document?.name) continue;
    content.push({
      type: "input_file",
      filename: document.name,
      file_data: document.data,
    });
  }

  return content;
}

function getOutputText(apiResponse) {
  for (const item of apiResponse.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  throw new Error("The model returned no résumé content.");
}

export async function reviseResume(payload) {
  if (!config.openAiApiKey || !config.openAiModel) {
    throw new Error("OPENAI_API_KEY and OPENAI_MODEL must be configured in .env.");
  }

  const apiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.openAiModel,
      instructions: systemPrompt,
      input: [{ role: "user", content: buildUserContent(payload) }],
      text: {
        format: {
          type: "json_schema",
          name: "resume",
          strict: true,
          schema: resumeSchema,
        },
      },
    }),
  });

  const responseBody = await apiResponse.json();
  if (!apiResponse.ok) {
    throw new Error(responseBody.error?.message ?? "The AI request failed.");
  }

  return JSON.parse(getOutputText(responseBody));
}

