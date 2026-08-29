/**
 * Token bucket rate limiter.
 *
 * Buckets are held in memory per Durable Object instance. If the DO is evicted
 * they reset, which is acceptable: buckets exist to stop chat/reaction flooding
 * within a live session, not to enforce a long-lived quota.
 */
export interface RateLimitRule {
  /** Maximum burst size. */
  capacity: number;
  /** Tokens replenished per second. */
  refillPerSecond: number;
}

export const RATE_LIMITS = {
  chat: { capacity: 5, refillPerSecond: 1 },
  reaction: { capacity: 8, refillPerSecond: 2 },
  gameAction: { capacity: 20, refillPerSecond: 10 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitKind = keyof typeof RATE_LIMITS;

interface Bucket {
  tokens: number;
  lastRefillAt: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  /**
   * Consumes one token. Returns false when the caller is over their limit.
   */
  consume(key: string, kind: RateLimitKind, now: number = Date.now()): boolean {
    const rule = RATE_LIMITS[kind];
    const bucketKey = `${kind}:${key}`;
    const bucket = this.buckets.get(bucketKey) ?? {
      tokens: rule.capacity,
      lastRefillAt: now,
    };

    const elapsedSeconds = Math.max(0, now - bucket.lastRefillAt) / 1000;
    bucket.tokens = Math.min(rule.capacity, bucket.tokens + elapsedSeconds * rule.refillPerSecond);
    bucket.lastRefillAt = now;

    if (bucket.tokens < 1) {
      this.buckets.set(bucketKey, bucket);
      return false;
    }

    bucket.tokens -= 1;
    this.buckets.set(bucketKey, bucket);
    return true;
  }

  /** Drops all buckets for a connection that has gone away. */
  forget(key: string): void {
    for (const kind of Object.keys(RATE_LIMITS)) {
      this.buckets.delete(`${kind}:${key}`);
    }
  }
}
