import { config } from "./config.js";
import { createOpenAiRequest, getOutputText } from "../shared/ai-contract.js";

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
    body: JSON.stringify(createOpenAiRequest(payload, config.openAiModel)),
  });

  const responseBody = await apiResponse.json();
  if (!apiResponse.ok) {
    throw new Error(responseBody.error?.message ?? "The AI request failed.");
  }

  return JSON.parse(getOutputText(responseBody));
}
