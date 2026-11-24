import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { FAKE_ANSWER_CATEGORIES } from "@chaos/shared";
import type { FakeAnswerQuestion } from "../games/fakeAnswer/FakeAnswerGame";

const fileSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        category: z.enum(FAKE_ANSWER_CATEGORIES),
        question: z.string().min(10).max(200),
        answer: z.string().min(1).max(40),
        alsoAccept: z.array(z.string().min(1).max(40)).default([]),
      }),
    )
    .min(20),
});

const DEFAULT_FILE = resolve(import.meta.dirname, "../../../content/en/fake-answer-trivia.json");

/** Reads the trivia file once, when the server starts. Stops with a clear message if it is wrong. */
export function loadTrivia(file: string = DEFAULT_FILE): FakeAnswerQuestion[] {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown problem";
    throw new Error(`Could not read the trivia file at ${file}: ${reason}`);
  }
  const parsed = fileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`The trivia file ${file} is not valid: ${parsed.error.issues[0]?.message ?? "unknown problem"}`);
  }
  return parsed.data.items;
}
