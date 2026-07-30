import { config } from "./config.js";
import { createOpenAiRequest, getOutputText } from "../shared/ai-contract.js";

export async function reviseResume(payload, providedApiKey = "") {
  const apiKey = config.openAiApiKey || providedApiKey;
  const model = config.openAiModel ?? "gpt-5.6-luna";
  if (!apiKey) {
    throw new Error("Add an OpenAI API key in the AI panel or configure OPENAI_API_KEY in .env.");
  }

  const apiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createOpenAiRequest(payload, model)),
  });

  const responseBody = await apiResponse.json();
  if (!apiResponse.ok) {
    throw new Error(responseBody.error?.message ?? "The AI request failed.");
  }

  return JSON.parse(getOutputText(responseBody));
}
