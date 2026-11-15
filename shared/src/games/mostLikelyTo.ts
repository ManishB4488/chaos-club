import { z } from "zod";
import type { AvatarId, PlayerColor } from "../constants";

export const MLT_CATEGORIES = ["drama", "sneaky", "accident", "success", "survival"] as const;
export type MltCategory = (typeof MLT_CATEGORIES)[number];

/** The only thing a player can do in this game: vote for someone. */
export const mltActionSchema = z.strictObject({
  type: z.literal("vote"),
  targetId: z.string().min(1).max(64),
});
export type MltAction = z.infer<typeof mltActionSchema>;

export type MltAwardId =
  | "most-voted"
  | "main-character"
  | "drama-queen"
  | "most-suspicious"
  | "walking-disaster";

export type MltParticipant = {
  id: string;
  nickname: string;
  avatar: AvatarId;
  color: PlayerColor;
};

/** Shown only after every vote is in. */
export type MltReveal = {
  votes: { voterId: string; targetId: string }[];
  counts: Record<string, number>;
  /** Everyone tied for the most votes this round. Empty if nobody voted. */
  roundStarIds: string[];
  pointsGained: Record<string, number>;
};

export type MltRanking = {
  playerId: string;
  score: number;
  /** Equal scores share a rank. */
  rank: number;
  stars: number;
  votesReceived: number;
};

export type MltAward = {
  id: MltAwardId;
  title: string;
  playerIds: string[];
  value: number;
};

/** What one player is allowed to see of the game. During voting nobody can see who voted for whom. */
export type MltView = {
  gameId: "most-likely-to";
  step: "voting" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  question: string | null;
  category: MltCategory | null;
  /** Server clock time (ms) when this step ends, or null. */
  stepEndsAt: number | null;
  /** How long this step lasts in total (ms), so a timer bar can be drawn. */
  stepDurationMs: number | null;
  participants: MltParticipant[];
  /** Who has already voted this round. Never says who they voted for. */
  votedIds: string[];
  /** This player's own vote this round, or null. */
  myVote: string | null;
  /** True only in a 2 player game, where voting for yourself is allowed. */
  allowSelfVote: boolean;
  reveal: MltReveal | null;
  scores: Record<string, number>;
  results: { ranking: MltRanking[]; awards: MltAward[]; endedEarly: boolean } | null;
};
