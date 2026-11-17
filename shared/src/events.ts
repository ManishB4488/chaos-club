import type { AvatarId, GameId, PlayerColor } from "./constants";
import type { ImpostorView } from "./games/impostor";
import type { MltView } from "./games/mostLikelyTo";
import type { RoastView } from "./games/roast";

/** What a player can see of the running game. */
export type GameView = MltView | ImpostorView | RoastView;

/** Events the browser sends to the server. */
export const CLIENT_EVENTS = {
  createRoom: "room:create",
  joinRoom: "room:join",
  rejoinRoom: "room:rejoin",
  leaveRoom: "room:leave",
  kickPlayer: "room:kick",
  selectGame: "room:selectGame",
  startGame: "room:start",
  gameAction: "game:action",
  returnToLobby: "room:returnToLobby",
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
  | "SERVER_BUSY"
  | "NO_GAME_RUNNING"
  | "NOT_A_PARTICIPANT"
  | "ALREADY_VOTED"
  | "CANNOT_VOTE_SELF"
  | "VOTING_CLOSED"
  | "NOT_YOUR_TURN"
  | "WRONG_STEP"
  | "CLUE_NOT_ALLOWED"
  | "ALREADY_DONE"
  | "CONTENT_NOT_ALLOWED"
  | "ANSWER_NOT_FOUND";

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
  NO_GAME_RUNNING: "There is no game running right now.",
  NOT_A_PARTICIPANT: "You are not part of this game.",
  ALREADY_VOTED: "You have already voted this round.",
  CANNOT_VOTE_SELF: "You cannot vote for yourself.",
  VOTING_CLOSED: "Voting is closed for this round.",
  NOT_YOUR_TURN: "It is not your turn.",
  WRONG_STEP: "You cannot do that right now.",
  CLUE_NOT_ALLOWED: "That clue is not allowed. Use one word that does not contain your secret word.",
  ALREADY_DONE: "You have already done that.",
  CONTENT_NOT_ALLOWED: "That is not allowed here. Please keep it friendly and try again.",
  ANSWER_NOT_FOUND: "That answer does not exist.",
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
  /** The running game as this player may see it, or null in the lobby. */
  game: GameView | null;
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
