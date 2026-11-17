import type { AvatarId, GameId, GameView, PlayerColor } from "@chaos/shared";
import type { Result } from "../rooms/types";

export type GamePlayer = {
  id: string;
  nickname: string;
  avatar: AvatarId;
  color: PlayerColor;
};

/** A player's report that some content is not okay. Kept for review (the admin panel comes later). */
export type ContentReportEntry = {
  game: GameId;
  text: string;
  reason: string | null;
  roomCode: string;
  createdAt: number;
};

/** Everything a game is given when a room starts it. */
export type GameContext = {
  /** The players who take part. Fixed for the whole game. */
  players: GamePlayer[];
  now: () => number;
  random: () => number;
  /** Whether a player is connected right now. */
  isConnected: (playerId: string) => boolean;
  /** Lets a game pass on a player's report. */
  reportContent?: (entry: Omit<ContentReportEntry, "roomCode" | "createdAt">) => void;
};

/**
 * What every game module provides. The server decides everything: a game receives validated-by-itself
 * actions from a player id it can trust, and produces a private view for each player.
 */
export interface GameInstance {
  readonly id: GameId;
  handleAction(playerId: string, action: unknown): Result<void>;
  /** Called a few times a second. Moves timers along. Returns true if anything changed. */
  tick(now: number): boolean;
  /** Ends the game now, showing the scores so far. */
  forceFinish(): void;
  isFinished(): boolean;
  viewFor(playerId: string): GameView;
}
