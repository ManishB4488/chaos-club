/** Allows short bursts, then a steady rate. Each action uses one token. */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillPerSecond: number;
  private readonly now: () => number;

  constructor(capacity: number, refillPerSecond: number, now: () => number = () => Date.now()) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.now = now;
    this.tokens = capacity;
    this.lastRefill = now();
  }

  take(): boolean {
    const current = this.now();
    const elapsedSeconds = (current - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillPerSecond);
    this.lastRefill = current;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  get lastActivity(): number {
    return this.lastRefill;
  }
}

/** One bucket per key (for example, per visitor address). */
export class KeyedLimiter {
  private readonly buckets = new Map<string, TokenBucket>();
  private readonly capacity: number;
  private readonly refillPerSecond: number;
  private readonly now: () => number;

  constructor(capacity: number, refillPerSecond: number, now: () => number = () => Date.now()) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.now = now;
  }

  take(key: string): boolean {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(this.capacity, this.refillPerSecond, this.now);
      this.buckets.set(key, bucket);
    }
    return bucket.take();
  }

  /** Forget keys that have been idle, so memory does not grow forever. */
  prune(maxIdleMs = 10 * 60_000): void {
    const cutoff = this.now() - maxIdleMs;
    for (const [key, bucket] of this.buckets) {
      if (bucket.lastActivity < cutoff) this.buckets.delete(key);
    }
  }
}
