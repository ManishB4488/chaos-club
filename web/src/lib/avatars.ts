import { ACCENT_COLORS, type AccentColor } from "./theme";

/**
 * Avatar and player-color choices.
 * NOTE: when the website is linked to the shared package (room system step), these lists move
 * to @chaos/shared so the SERVER can validate them too.
 */
export const AVATAR_IDS = [
  "ghost",
  "cat",
  "dog",
  "bot",
  "rocket",
  "pizza",
  "bird",
  "fish",
  "rabbit",
  "skull",
] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];

export const PLAYER_COLORS = ACCENT_COLORS;
export type PlayerColor = AccentColor;
