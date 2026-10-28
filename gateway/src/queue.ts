import type { Redis } from "ioredis";

export interface RecipeJob {
  waFrom: string;
  messageId: string;
  audioId?: string;
  textBody?: string;
  receivedAt: string;
}

export async function enqueueJob(
  redis: Redis,
  queueName: string,
  job: object,
): Promise<void> {
  await redis.lpush(queueName, JSON.stringify(job));
}
