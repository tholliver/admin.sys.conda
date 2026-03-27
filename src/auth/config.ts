import { db } from "@/db";
import { rateLimit } from "@/db/schema";
import { sql } from "drizzle-orm";

export const RATE_LIMIT_WINDOW = import.meta.env.RATE_LIMIT_WINDOW || 900; // 15 minutes (900 seconds)
export const MAX_ATTEMPTS = import.meta.env.MAX_ATTEMPTS || 5;

export async function getRateLimitCount(identifier: string): Promise<number> {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW * 1000;

  const existing = await db.query.rateLimit.findFirst({
    where: (r, { eq }) => eq(r.key, identifier),
  });

  if (!existing || existing.lastRequest <= windowStart) return 0;
  return existing.count;
}

export async function incrementRateLimit(identifier: string): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW * 1000;

  const result = await db
    .insert(rateLimit)
    .values({
      id: crypto.randomUUID(),
      key: identifier,
      count: 1,
      lastRequest: now,
      window: RATE_LIMIT_WINDOW,
      max: MAX_ATTEMPTS,
    })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`CASE WHEN ${rateLimit.lastRequest} > ${windowStart} THEN ${rateLimit.count} + 1 ELSE 1 END`,
        lastRequest: now,
      },
    })
    .returning({ count: rateLimit.count });

  const count = result[0].count;
  return { allowed: count <= MAX_ATTEMPTS, remaining: Math.max(0, MAX_ATTEMPTS - count) };
}
