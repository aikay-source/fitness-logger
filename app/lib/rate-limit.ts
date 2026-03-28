import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limiters are null when Upstash env vars are not configured — the app
// runs normally, just without rate limiting. Set UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN in Vercel environment variables to enable.
function createLimiter(requests: number, window: `${number} ${"ms" | "s" | "m" | "h" | "d"}`) {
  if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(requests, window) });
}

// 5 registration attempts per IP per hour
export const registerLimiter = createLimiter(5, "1 h");

// 10 login attempts per email per 15 minutes
export const loginLimiter = createLimiter(10, "15 m");

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ limited: boolean; retryAfter?: number }> {
  if (!limiter) return { limited: false };
  const { success, reset } = await limiter.limit(identifier);
  return { limited: !success, retryAfter: Math.ceil((reset - Date.now()) / 1000) };
}
