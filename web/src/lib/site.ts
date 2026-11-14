/** Brand settings in one place. The name is configurable: set NEXT_PUBLIC_SITE_NAME in web/.env.local. */
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "CHAOS CLUB";
export const SITE_TAGLINE = "Less serious. More chaos.";
export const SITE_DESCRIPTION =
  "Gather your friends, join a room and find out who is the funniest, smartest and biggest liar.";
