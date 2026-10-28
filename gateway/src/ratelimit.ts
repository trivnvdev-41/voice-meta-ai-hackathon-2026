export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

/**
 * In-memory fixed-window limiter (single gateway instance). Returns true when
 * the request is allowed. Good enough to blunt credential stuffing; swap for
 * Redis if the gateway ever runs more than one replica.
 */
export function createRateLimiter(opts: RateLimitOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const maxKeys = 10_000;
  return (key: string): boolean => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (hits.size >= maxKeys) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
        if (hits.size >= maxKeys) hits.clear();
      }
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
      return true;
    }
    if (entry.count >= opts.limit) return false;
    entry.count += 1;
    return true;
  };
}
