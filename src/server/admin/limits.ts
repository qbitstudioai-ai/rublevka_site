import { sql } from "drizzle-orm";
import { db } from "../events/db";
import { rateLimits } from "../events/schema";

// The key belongs to an application-defined bucket, not to a raw IP or phone.
export async function takeRateLimit(key: string, max: number, seconds: number) {
  const expiry = sql`now() + ${seconds} * interval '1 second'`;
  const [bucket] = await db
    .insert(rateLimits)
    .values({ key, count: 1, expiresAt: expiry })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.expiresAt} <= now() then 1 else ${rateLimits.count} + 1 end`,
        expiresAt: sql`case when ${rateLimits.expiresAt} <= now() then ${expiry} else ${rateLimits.expiresAt} end`,
      },
      setWhere: sql`${rateLimits.expiresAt} <= now() or ${rateLimits.count} < ${max}`,
    })
    .returning({ count: rateLimits.count });
  return Boolean(bucket);
}
