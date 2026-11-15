import { describe, expect, it } from "vitest";
import { MLT_CATEGORIES } from "@chaos/shared";
import { loadMostLikelyToQuestions } from "../src/content/loadQuestions";

describe("the real question file", () => {
  const questions = loadMostLikelyToQuestions();

  it("has at least 100 questions", () => {
    expect(questions.length).toBeGreaterThanOrEqual(100);
  });

  it("has no repeated ids or texts", () => {
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
    expect(new Set(questions.map((q) => q.text.toLowerCase())).size).toBe(questions.length);
  });

  it("has plenty in every category, so every award can be earned", () => {
    for (const category of MLT_CATEGORIES) {
      expect(questions.filter((q) => q.category === category).length).toBeGreaterThanOrEqual(15);
    }
  });

  it("only asks questions that start with Who", () => {
    for (const question of questions) expect(question.text).toMatch(/^Who /);
  });
});
