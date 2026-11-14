import type { AvatarId, GameId, PlayerColor, RoomErrorCode, RoomPhase } from "@chaos/shared";

export type PlayerProfile = {
  nickname: string;
  avatar: AvatarId;
  color: PlayerColor;
};

/** Server-side player record. Contains the private session token, so it never leaves the server. */
export type Player = PlayerProfile & {
  id: string;
  sessionToken: string;
  socketId: string | null;
  connected: boolean;
  disconnectedAt: number | null;
};

export type Room = {
  code: string;
  phase: RoomPhase;
  hostId: string;
  /** In join order, so the first connected entry is the longest-present player. */
  players: Player[];
  selectedGame: GameId | null;
  countdownEndsAt: number | null;
  createdAt: number;
  /** When the last connected player left, or null while someone is connected. */
  emptySince: number | null;
};

export type Result<T> = { ok: true; value: T } | { ok: false; error: RoomErrorCode };
