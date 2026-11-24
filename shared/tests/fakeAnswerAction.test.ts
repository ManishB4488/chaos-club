import { describe, expect, it } from "vitest";
import { FAKE_ANSWER_CATEGORIES, FAKE_ANSWER_MAX_LENGTH, fakeAnswerActionSchema } from "../src";

describe("fakeAnswerActionSchema", () => {
  it("accepts each real action", () => {
    expect(fakeAnswerActionSchema.safeParse({ type: "submit", text: "A pink parliament" }).success).toBe(true);
    expect(fakeAnswerActionSchema.safeParse({ type: "choose", optionId: "o1" }).success).toBe(true);
    expect(fakeAnswerActionSchema.safeParse({ type: "report", optionId: "o1" }).success).toBe(true);
  });

  it("limits length and rejects extra fields", () => {
    expect(fakeAnswerActionSchema.safeParse({ type: "submit", text: "" }).success).toBe(false);
    expect(
      fakeAnswerActionSchema.safeParse({ type: "submit", text: "x".repeat(FAKE_ANSWER_MAX_LENGTH + 1) }).success,
    ).toBe(false);
    expect(fakeAnswerActionSchema.safeParse({ type: "choose", optionId: "o1", extra: 1 }).success).toBe(false);
    expect(fakeAnswerActionSchema.safeParse({ type: "cheat" }).success).toBe(false);
  });

  it("has six categories", () => {
    expect(FAKE_ANSWER_CATEGORIES).toHaveLength(6);
  });
});
