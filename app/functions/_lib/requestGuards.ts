interface RateLimitOptions {
  keyPrefix: string;
  limit: number;
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweepAt = 0;

function getClientAddress(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return "unknown";

  const first = forwarded.split(",")[0]?.trim();
  return first || "unknown";
}

function sweepExpired(now: number) {
  const shouldSweep = now - lastSweepAt > 30_000 || buckets.size > 2_000;
  if (!shouldSweep) return;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  lastSweepAt = now;
}

export function enforceRateLimit(
  request: Request,
  options: RateLimitOptions,
): Response | null {
  const now = Date.now();
  sweepExpired(now);

  const client = getClientAddress(request);
  const key = `${options.keyPrefix}:${client}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  if (current.count >= options.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return Response.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please retry shortly.",
        },
      },
      {
        status: 429,
        headers: {
          "cache-control": "no-store",
          "retry-after": String(retryAfterSeconds),
        },
      },
    );
  }

  current.count += 1;
  buckets.set(key, current);
  return null;
}
