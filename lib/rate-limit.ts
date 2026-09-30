import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { ApiError } from "./api-response";

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const WINDOW_SECONDS = readPositiveInteger(
  process.env.RATE_LIMIT_WINDOW,
  3_600,
);
const WINDOW_MS = WINDOW_SECONDS * 1_000;
const LIMIT = readPositiveInteger(process.env.RATE_LIMIT_REQUESTS, 100);
const localHits = new Map<string, { count: number; resetAt: number }>();

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const isUpstashConfigured = Boolean(redisUrl && redisToken);

const distributedLimiter = isUpstashConfigured
  ? new Ratelimit({
      redis: new Redis({ url: redisUrl!, token: redisToken! }),
      limiter: Ratelimit.slidingWindow(LIMIT, `${WINDOW_SECONDS} s`),
      prefix: "arrume-meu-link:rate-limit",
      analytics: false,
    })
  : null;

export type RateLimitMode = "upstash" | "development-memory" | "unavailable";

export function getRateLimitMode(): RateLimitMode {
  if (distributedLimiter) return "upstash";
  return process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test"
    ? "development-memory"
    : "unavailable";
}

function clientIdentifier(request: Request): string {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "anonymous"
  );
}

export async function enforceRateLimit(
  request: Request,
  bucket: string,
): Promise<Record<string, string>> {
  const identifier = `${bucket}:${clientIdentifier(request)}`;

  if (distributedLimiter) {
    const result = await distributedLimiter.limit(identifier);
    if (!result.success) {
      throw new ApiError(
        429,
        "RATE_LIMITED",
        "Muitas solicitações. Tente novamente em instantes.",
      );
    }
    return {
      "X-RateLimit-Limit": String(result.limit),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(result.reset),
    };
  }

  if (getRateLimitMode() === "unavailable") {
    throw new ApiError(
      503,
      "RATE_LIMIT_UNAVAILABLE",
      "Serviço temporariamente indisponível.",
    );
  }

  const now = Date.now();
  if (localHits.size > 10_000) {
    for (const [key, value] of localHits) {
      if (value.resetAt <= now) localHits.delete(key);
    }
  }
  const current = localHits.get(identifier);
  const entry =
    !current || current.resetAt <= now
      ? { count: 1, resetAt: now + WINDOW_MS }
      : { count: current.count + 1, resetAt: current.resetAt };
  localHits.set(identifier, entry);

  if (entry.count > LIMIT) {
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "Muitas solicitações. Tente novamente em instantes.",
    );
  }
  return {
    "X-RateLimit-Limit": String(LIMIT),
    "X-RateLimit-Remaining": String(Math.max(0, LIMIT - entry.count)),
    "X-RateLimit-Reset": String(entry.resetAt),
    "X-RateLimit-Policy": "development-memory",
  };
}
