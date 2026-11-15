import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { IMPOSTOR_CATEGORIES } from "@chaos/shared";
import type { ImpostorWordPair } from "../games/impostor/ImpostorGame";

const fileSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        category: z.enum(IMPOSTOR_CATEGORIES),
        crew: z.string().min(2).max(30),
        impostor: z.string().min(2).max(30),
      }),
    )
    .min(20),
});

const DEFAULT_FILE = resolve(import.meta.dirname, "../../../content/en/impostor-words.json");

/** Reads the word pairs once, when the server starts. Stops with a clear message if the file is wrong. */
export function loadImpostorWords(file: string = DEFAULT_FILE): ImpostorWordPair[] {
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
