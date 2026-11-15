/**
 * A STARTER word filter. It blocks whole words only, so words like "grape" or "class" are fine.
 * Known limits: it cannot catch every disguise (for example letters separated by spaces), and the
 * list is short. It MUST be extended with a maintained list and reviewed before the site goes public.
 */
const BLOCKED = new Set([
  "fuck", "shit", "bitch", "bastard", "asshole", "dick", "cock", "cunt", "pussy", "slut", "whore",
  "porn", "sex", "cum", "tits", "nazi", "rape", "rapist", "retard", "nigger", "nigga", "faggot", "fag",
]);

const LOOKALIKES: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i",
};

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[013457@$!]/g, (char) => LOOKALIKES[char] ?? char)
    .replace(/[^\p{L}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
}

/** True if any whole word in the text is on the blocked list. */
export function containsBlockedWord(text: string): boolean {
  for (const word of words(text)) {
    const variants = [word, word.replace(/(.)\1{2,}/g, "$1"), word.replace(/s$/, "")];
    if (variants.some((variant) => BLOCKED.has(variant))) return true;
  }
  return false;
}
