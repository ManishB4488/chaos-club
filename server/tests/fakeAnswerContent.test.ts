import { describe, expect, it } from "vitest";
import { FAKE_ANSWER_CATEGORIES } from "@chaos/shared";
import { loadTrivia } from "../src/content/loadTrivia";
import { normalizeAnswer } from "../src/games/fakeAnswer/FakeAnswerGame";
import { containsBlockedWord } from "../src/moderation/profanity";

describe("the real trivia file", () => {
  const questions = loadTrivia();

  it("has at least 100 questions, with plenty in every category", () => {
    expect(questions.length).toBeGreaterThanOrEqual(100);
    for (const category of FAKE_ANSWER_CATEGORIES) {
      expect(questions.filter((q) => q.category === category).length).toBeGreaterThanOrEqual(10);
    }
  });

  it("has no repeated ids or questions, and nothing blocked", () => {
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
    expect(new Set(questions.map((q) => q.question.toLowerCase())).size).toBe(questions.length);
    for (const q of questions) {
      expect(containsBlockedWord(`${q.question} ${q.answer}`)).toBe(false);
    }
  });

  it("has short answers that a player could try to imitate, and no answer given away by its question", () => {
    for (const q of questions) {
      expect(q.answer.length).toBeLessThanOrEqual(40);
      const key = normalizeAnswer(q.answer);
      expect(normalizeAnswer(q.question)).not.toContain(key.length > 2 ? key : "\u0000");
    }
  });
});
