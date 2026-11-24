import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { DRAW_CATEGORIES } from "@chaos/shared";
import type { DrawWord } from "../games/drawItWrong/DrawItWrongGame";

const fileSchema = z.object({
  items: z
    .array(z.object({ id: z.string().min(1), category: z.enum(DRAW_CATEGORIES), word: z.string().min(2).max(30) }))
    .min(30),
});

const DEFAULT_FILE = resolve(import.meta.dirname, "../../../content/en/draw-words.json");

/** Reads the drawing words once, when the server starts. Stops with a clear message if the file is wrong. */
export function loadDrawWords(file: string = DEFAULT_FILE): DrawWord[] {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown problem";
    throw new Error(`Could not read the word file at ${file}: ${reason}`);
  }
  const parsed = fileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`The word file ${file} is not valid: ${parsed.error.issues[0]?.message ?? "unknown problem"}`);
  }
  return parsed.data.items;
}
