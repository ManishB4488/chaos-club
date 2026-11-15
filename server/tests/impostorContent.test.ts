import { describe, expect, it } from "vitest";
import { IMPOSTOR_CATEGORIES } from "@chaos/shared";
import { loadImpostorWords } from "../src/content/loadImpostorWords";
import { containsBlockedWord } from "../src/moderation/profanity";

describe("the real Impostor word file", () => {
  const pairs = loadImpostorWords();

  it("has at least 100 pairs, with plenty in every category", () => {
    expect(pairs.length).toBeGreaterThanOrEqual(100);
    for (const category of IMPOSTOR_CATEGORIES) {
      expect(pairs.filter((pair) => pair.category === category).length).toBeGreaterThanOrEqual(15);
    }
  });

  it("has no repeated ids, and no word appears twice", () => {
    expect(new Set(pairs.map((pair) => pair.id)).size).toBe(pairs.length);
    const words = pairs.flatMap((pair) => [pair.crew.toLowerCase(), pair.impostor.toLowerCase()]);
    expect(new Set(words).size).toBe(words.length);
  });

  it("never pairs a word with itself, and nothing is blocked", () => {
    for (const pair of pairs) {
      expect(pair.crew.toLowerCase()).not.toBe(pair.impostor.toLowerCase());
      expect(containsBlockedWord(pair.crew) || containsBlockedWord(pair.impostor)).toBe(false);
    }
  });
});
