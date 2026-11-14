/** The five games. The string values are used in events, URLs and content files. */
export const GAME_IDS = [
  "most-likely-to",
  "impostor",
  "roast",
  "fake-answer",
  "draw-it-wrong",
] as const;

export type GameId = (typeof GAME_IDS)[number];

/** Room-wide limits (decision D-008 and the master prompt). */
export const ROOM_MIN_PLAYERS = 2;
export const ROOM_MAX_PLAYERS = 4;

/** Per-game player limits. The SERVER enforces these; the UI only displays them. */
export const GAME_PLAYER_LIMITS: Record<GameId, { min: number; max: number }> = {
  "most-likely-to": { min: 2, max: 4 },
  impostor: { min: 3, max: 4 },
  roast: { min: 2, max: 4 },
  "fake-answer": { min: 2, max: 4 },
  "draw-it-wrong": { min: 2, max: 4 },
};

/** Room codes: 6 characters, no look-alike characters (no 0, O, 1, I, L). */
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 16;

/** Avatar choices (drawn by the website; validated by the server). */
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

/** Player colors. There must always be at least as many as ROOM_MAX_PLAYERS. */
export const PLAYER_COLORS = ["grape", "volt", "tangerine", "bubblegum", "sunny"] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];
