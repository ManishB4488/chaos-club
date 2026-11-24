import { describe, expect, it } from "vitest";
import { DRAW_CATEGORIES } from "@chaos/shared";
import { loadDrawWords } from "../src/content/loadDrawWords";
import { containsBlockedWord } from "../src/moderation/profanity";

describe("the real drawing word file", () => {
  const words = loadDrawWords();

  it("has at least 100 words, with plenty in every category", () => {
    expect(words.length).toBeGreaterThanOrEqual(100);
    for (const category of DRAW_CATEGORIES) {
      expect(words.filter((w) => w.category === category).length).toBeGreaterThanOrEqual(15);
    }
  });

  it("has no repeats and nothing blocked", () => {
    expect(new Set(words.map((w) => w.id)).size).toBe(words.length);
    expect(new Set(words.map((w) => w.word.toLowerCase())).size).toBe(words.length);
    for (const entry of words) expect(containsBlockedWord(entry.word)).toBe(false);
  });
});
