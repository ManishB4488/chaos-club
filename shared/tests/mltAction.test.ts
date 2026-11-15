import { describe, expect, it } from "vitest";
import { MLT_CATEGORIES, gameActionSchema, mltActionSchema } from "../src";

describe("mltActionSchema", () => {
  it("accepts a vote and rejects anything else", () => {
    expect(mltActionSchema.safeParse({ type: "vote", targetId: "abc" }).success).toBe(true);
    expect(mltActionSchema.safeParse({ type: "vote" }).success).toBe(false);
    expect(mltActionSchema.safeParse({ type: "skip", targetId: "abc" }).success).toBe(false);
    expect(mltActionSchema.safeParse({ type: "vote", targetId: "abc", extra: 1 }).success).toBe(false);
  });
});

describe("gameActionSchema", () => {
  it("needs a known game", () => {
    expect(gameActionSchema.safeParse({ gameId: "most-likely-to", action: {} }).success).toBe(true);
    expect(gameActionSchema.safeParse({ gameId: "chess", action: {} }).success).toBe(false);
  });
});

describe("categories", () => {
  it("include the three that drive awards", () => {
    for (const category of ["drama", "sneaky", "accident"]) {
      expect(MLT_CATEGORIES).toContain(category);
    }
  });
});
