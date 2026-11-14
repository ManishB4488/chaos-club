/** Joins class names, skipping anything falsy. A tiny replacement for the "clsx" package. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
