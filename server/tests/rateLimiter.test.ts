import { describe, expect, it } from "vitest";
import { KeyedLimiter, TokenBucket } from "../src/socket/rateLimiter";

describe("TokenBucket", () => {
  it("allows a burst up to its capacity, then blocks", () => {
    let time = 0;
    const bucket = new TokenBucket(3, 1, () => time);
    expect([bucket.take(), bucket.take(), bucket.take(), bucket.take()]).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("refills over time", () => {
    let time = 0;
    const bucket = new TokenBucket(2, 1, () => time);
    bucket.take();
    bucket.take();
    expect(bucket.take()).toBe(false);
    time += 1_000;
    expect(bucket.take()).toBe(true);
    expect(bucket.take()).toBe(false);
  });
});

describe("KeyedLimiter", () => {
  it("limits each key separately", () => {
    const limiter = new KeyedLimiter(1, 0, () => 0);
    expect(limiter.take("a")).toBe(true);
    expect(limiter.take("a")).toBe(false);
    expect(limiter.take("b")).toBe(true);
  });
});
