import { describe, expect, it } from "vitest";
import { ROAST_ANSWER_MAX_LENGTH, roastActionSchema } from "../src";

describe("roastActionSchema", () => {
  it("accepts each real action", () => {
    expect(roastActionSchema.safeParse({ type: "submit", text: "A funny answer" }).success).toBe(true);
    expect(roastActionSchema.safeParse({ type: "vote", answerId: "a1" }).success).toBe(true);
    expect(roastActionSchema.safeParse({ type: "rate", answerId: "a1", stars: 3 }).success).toBe(true);
    expect(roastActionSchema.safeParse({ type: "report", answerId: "a1" }).success).toBe(true);
  });

  it("limits answer length and star values", () => {
    expect(roastActionSchema.safeParse({ type: "submit", text: "" }).success).toBe(false);
    expect(
      roastActionSchema.safeParse({ type: "submit", text: "x".repeat(ROAST_ANSWER_MAX_LENGTH + 1) }).success,
    ).toBe(false);
    expect(roastActionSchema.safeParse({ type: "rate", answerId: "a1", stars: 4 }).success).toBe(false);
    expect(roastActionSchema.safeParse({ type: "rate", answerId: "a1", stars: 0 }).success).toBe(false);
  });

  it("rejects extra fields and unknown actions", () => {
    expect(roastActionSchema.safeParse({ type: "vote", answerId: "a1", extra: 1 }).success).toBe(false);
    expect(roastActionSchema.safeParse({ type: "cheat" }).success).toBe(false);
  });
});
