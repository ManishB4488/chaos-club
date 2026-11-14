import { createRoomSchema, type CreateRoomInput } from "@chaos/shared";

export type ProfileValues = CreateRoomInput;
export type StoredSession = { playerId: string; sessionToken: string };

const PROFILE_KEY = "chaos:profile";
const sessionKey = (code: string) => `chaos:session:${code}`;

/**
 * The private reconnect code is kept in sessionStorage: it belongs to ONE browser tab,
 * so each tab is its own player and a refresh keeps the same player.
 */
export function saveSession(code: string, session: StoredSession): void {
  try {
    window.sessionStorage.setItem(sessionKey(code), JSON.stringify(session));
  } catch {
    /* storage unavailable: the player simply cannot reconnect after a refresh */
  }
}

export function loadSession(code: string): StoredSession | null {
  try {
    const raw = window.sessionStorage.getItem(sessionKey(code));
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (
      typeof data === "object" &&
      data !== null &&
      "playerId" in data &&
      "sessionToken" in data &&
      typeof data.playerId === "string" &&
      typeof data.sessionToken === "string"
    ) {
      return { playerId: data.playerId, sessionToken: data.sessionToken };
    }
  } catch {
    /* unreadable or missing: treat as no session */
  }
  return null;
}

export function clearSession(code: string): void {
  try {
    window.sessionStorage.removeItem(sessionKey(code));
  } catch {
    /* nothing to clear */
  }
}

/** Remembers the last nickname, avatar and color as a convenience. This is not secret. */
export function saveProfile(profile: ProfileValues): void {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* storage unavailable */
  }
}

export function loadProfile(): ProfileValues | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = createRoomSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
