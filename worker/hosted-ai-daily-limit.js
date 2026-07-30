import { DurableObject } from "cloudflare:workers";

const USAGE_STORAGE_KEY = "hosted-ai-usage";

function getUtcDay() {
  return new Date().toISOString().slice(0, 10);
}

function getNextUtcDay() {
  return `${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}T00:00:00.000Z`;
}

export class HostedAiDailyLimit extends DurableObject {
  async consume(maxRequests) {
    const day = getUtcDay();
    const storedUsage = await this.ctx.storage.get(USAGE_STORAGE_KEY);
    const count = storedUsage?.day === day ? storedUsage.count : 0;

    if (count >= maxRequests) {
      return { allowed: false, remaining: 0, resetsAt: getNextUtcDay() };
    }

    const nextCount = count + 1;
    await this.ctx.storage.put(USAGE_STORAGE_KEY, { day, count: nextCount });

    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - nextCount),
      resetsAt: getNextUtcDay(),
    };
  }
}

export async function consumeHostedAiDailyAllowance(env, maxRequests) {
  if (!env.HOSTED_AI_DAILY_LIMIT) {
    throw new Error("HOSTED_AI_DAILY_LIMIT_UNAVAILABLE");
  }

  const id = env.HOSTED_AI_DAILY_LIMIT.idFromName("hosted-ai-global");
  return env.HOSTED_AI_DAILY_LIMIT.get(id).consume(maxRequests);
}
