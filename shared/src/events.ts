import type { AvatarId, GameId, PlayerColor } from "./constants";

/** Events the browser sends to the server. */
export const CLIENT_EVENTS = {
  createRoom: "room:create",
  joinRoom: "room:join",
  rejoinRoom: "room:rejoin",
  leaveRoom: "room:leave",
  kickPlayer: "room:kick",
  selectGame: "room:selectGame",
  startGame: "room:start",
} as const;

/** Events the server sends to browsers. */
export const SERVER_EVENTS = {
  /** A fresh, private snapshot of the room, built separately for each player. */
  roomState: "room:state",
  /** Sent only to a player who was removed by the host. */
  kicked: "room:kicked",
} as const;

export type RoomPhase = "lobby" | "starting" | "in-game";

export type RoomErrorCode =
  | "INVALID_INPUT"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "ROOM_LOCKED"
  | "NICKNAME_TAKEN"
  | "INVALID_SESSION"
  | "ALREADY_IN_ROOM"
  | "NOT_IN_ROOM"
  | "NOT_HOST"
  | "PLAYER_NOT_FOUND"
  | "CANNOT_KICK_SELF"
  | "NO_GAME_SELECTED"
  | "GAME_NOT_AVAILABLE"
  | "NOT_ENOUGH_PLAYERS"
  | "TOO_MANY_PLAYERS"
  | "RATE_LIMITED"
  | "SERVER_BUSY";

/** Plain-language messages the website can show. */
export const ROOM_ERROR_MESSAGES: Record<RoomErrorCode, string> = {
  INVALID_INPUT: "Something in that request was not valid. Please check it and try again.",
  ROOM_NOT_FOUND: "That room does not exist. Check the code and try again.",
  ROOM_FULL: "That room is full.",
  ROOM_LOCKED: "That room has already started, so nobody can join or change it right now.",
  NICKNAME_TAKEN: "Someone in this room already uses that nickname. Pick another one.",
  INVALID_SESSION: "We could not restore your seat in that room. Please join again.",
  ALREADY_IN_ROOM: "You are already in a room.",
  NOT_IN_ROOM: "You are not in a room.",
  NOT_HOST: "Only the host can do that.",
  PLAYER_NOT_FOUND: "That player is not in the room.",
  CANNOT_KICK_SELF: "You cannot remove yourself. Leave the room instead.",
  NO_GAME_SELECTED: "Pick a game first.",
  GAME_NOT_AVAILABLE: "That game is not available yet.",
  NOT_ENOUGH_PLAYERS: "There are not enough connected players for that game.",
  TOO_MANY_PLAYERS: "There are too many players in the room for that game.",
  RATE_LIMITED: "Slow down a little and try again.",
  SERVER_BUSY: "The server is busy. Please try again in a moment.",
};

export type PlayerView = {
  id: string;
  nickname: string;
  avatar: AvatarId;
  color: PlayerColor;
  isHost: boolean;
  connected: boolean;
};

/** What one player is allowed to know about their room. Never contains session tokens. */
export type RoomView = {
  code: string;
  phase: RoomPhase;
  hostId: string;
  /** The id of the player this snapshot was built for. */
  selfId: string;
  players: PlayerView[];
  selectedGame: GameId | null;
  /** Games the server can currently start. Games not listed are not ready yet. */
  availableGames: GameId[];
  /** The fewest connected players the selected game needs, or null if no game is selected. */
  minPlayersForGame: number | null;
  maxPlayers: number;
  /** Server clock time (ms) when the start countdown ends, or null. */
  countdownEndsAt: number | null;
  /** Server clock time (ms) when this snapshot was made, so the browser can correct clock differences. */
  serverTime: number;
};

export type AckError = { ok: false; error: RoomErrorCode; message: string };
export type Ack<T extends object = object> = ({ ok: true } & T) | AckError;

/** Reply to room:create and room:join. The sessionToken is private to that player. */
export type JoinedPayload = {
  code: string;
  playerId: string;
  sessionToken: string;
  room: RoomView;
};
