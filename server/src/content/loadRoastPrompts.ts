import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { ROAST_CATEGORIES } from "@chaos/shared";
import type { RoastPrompt } from "../games/roast/RoastGame";

const fileSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        category: z.enum(ROAST_CATEGORIES),
        text: z.string().min(10).max(200),
      }),
    )
    .min(20),
});

const DEFAULT_FILE = resolve(import.meta.dirname, "../../../content/en/roast-prompts.json");

/** Reads the prompt file once, when the server starts. Stops with a clear message if it is wrong. */
export function loadRoastPrompts(file: string = DEFAULT_FILE): RoastPrompt[] {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown problem";
    throw new Error(`Could not read the prompt file at ${file}: ${reason}`);
  }
  const parsed = fileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`The prompt file ${file} is not valid: ${parsed.error.issues[0]?.message ?? "unknown problem"}`);
  }
  return parsed.data.items;
}
