const WINDOW_MS = 60_000; // 1-minute window
const MAX_REQUESTS = 60; // 60 requests per minute per key

type BucketEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, BucketEntry>();

// Periodic cleanup every 5 minutes to prevent memory growth
let cleanupScheduled = false;
function scheduleCleanup() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  setTimeout(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (entry.resetAt <= now) {
        buckets.delete(key);
      }
    }
    cleanupScheduled = false;
  }, 5 * 60_000);
}

/**
 * Returns { allowed, remaining, resetAt } for the given key.
 * Call this in middleware to enforce per-key rate limits.
 */
export function checkRateLimit(key: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + WINDOW_MS;
    buckets.set(key, { count: 1, resetAt });
    scheduleCleanup();
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetAt };
  }

  existing.count += 1;
  const remaining = Math.max(0, MAX_REQUESTS - existing.count);

  if (existing.count > MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  return { allowed: true, remaining, resetAt: existing.resetAt };
}
