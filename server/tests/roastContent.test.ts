import { describe, expect, it } from "vitest";
import { loadRoastPrompts } from "../src/content/loadRoastPrompts";
import { containsBlockedWord } from "../src/moderation/profanity";

describe("the real Roast prompt file", () => {
  const prompts = loadRoastPrompts();

  it("has at least 100 prompts of both kinds", () => {
    expect(prompts.length).toBeGreaterThanOrEqual(100);
    expect(prompts.filter((p) => p.category === "about").length).toBeGreaterThanOrEqual(40);
    expect(prompts.filter((p) => p.category === "general").length).toBeGreaterThanOrEqual(40);
  });

  it("has no repeats, and only the about prompts contain a name placeholder", () => {
    expect(new Set(prompts.map((p) => p.id)).size).toBe(prompts.length);
    expect(new Set(prompts.map((p) => p.text.toLowerCase())).size).toBe(prompts.length);
    for (const prompt of prompts) {
      expect(prompt.text.includes("{name}")).toBe(prompt.category === "about");
      expect(containsBlockedWord(prompt.text)).toBe(false);
    }
  });
});
