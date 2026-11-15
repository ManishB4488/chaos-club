import { describe, expect, it } from "vitest";
import { IMPOSTOR_CATEGORIES, impostorActionSchema } from "../src";

describe("impostorActionSchema", () => {
  it("accepts each real action", () => {
    expect(impostorActionSchema.safeParse({ type: "clue", text: "red" }).success).toBe(true);
    expect(impostorActionSchema.safeParse({ type: "ready" }).success).toBe(true);
    expect(impostorActionSchema.safeParse({ type: "vote", targetId: "abc" }).success).toBe(true);
    expect(impostorActionSchema.safeParse({ type: "guess", text: "pizza" }).success).toBe(true);
  });

  it("rejects unknown actions, missing fields and extra fields", () => {
    expect(impostorActionSchema.safeParse({ type: "cheat" }).success).toBe(false);
    expect(impostorActionSchema.safeParse({ type: "vote" }).success).toBe(false);
    expect(impostorActionSchema.safeParse({ type: "ready", extra: 1 }).success).toBe(false);
  });

  it("has five word categories", () => {
    expect(IMPOSTOR_CATEGORIES).toHaveLength(5);
  });
});
