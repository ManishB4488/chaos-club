import { describe, expect, it } from "vitest";
import { containsBlockedWord } from "../src/moderation/profanity";

describe("containsBlockedWord", () => {
  it("blocks listed words, including common disguises", () => {
    expect(containsBlockedWord("shit")).toBe(true);
    expect(containsBlockedWord("Sh!t.")).toBe(true);
    expect(containsBlockedWord("fuuuuck")).toBe(true);
    expect(containsBlockedWord("f.u.c.k")).toBe(true);
    expect(containsBlockedWord("what the fuck")).toBe(true);
  });

  it("does not block innocent words that merely contain a blocked word", () => {
    for (const word of ["grape", "class", "assassin", "Niger", "Essex", "cocktail", "hello world"]) {
      expect(containsBlockedWord(word)).toBe(false);
    }
  });
});
