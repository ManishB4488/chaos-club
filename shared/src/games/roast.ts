import { z } from "zod";
import type { AvatarId, PlayerColor } from "../constants";

export const ROAST_CATEGORIES = ["about", "general"] as const;
export type RoastCategory = (typeof ROAST_CATEGORIES)[number];

export const ROAST_ANSWER_MAX_LENGTH = 140;

export const roastActionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("submit"), text: z.string().min(1).max(ROAST_ANSWER_MAX_LENGTH) }),
  /** 3 or 4 players: pick the funniest answer that is not your own. */
  z.strictObject({ type: z.literal("vote"), answerId: z.string().min(1).max(32) }),
  /** 2 players: rate the other player's answer from 1 to 3 stars. */
  z.strictObject({
    type: z.literal("rate"),
    answerId: z.string().min(1).max(32),
    stars: z.number().int().min(1).max(3),
  }),
  /** Tell the site an answer is not okay. */
  z.strictObject({
    type: z.literal("report"),
    answerId: z.string().min(1).max(32),
    reason: z.string().max(80).optional(),
  }),
]);
export type RoastAction = z.infer<typeof roastActionSchema>;

export type RoastStep = "writing" | "voting" | "reveal" | "finished";
export type RoastAwardId = "funniest-human" | "crowd-favorite";

export type RoastParticipant = {
  id: string;
  nickname: string;
  avatar: AvatarId;
  color: PlayerColor;
};

/** An answer while voting is open: anonymous, and only YOU can tell which one is yours. */
export type RoastAnswerView = { id: string; text: string; mine: boolean };

/** Shown only after voting has closed, when the writers are no longer secret. */
export type RoastReveal = {
  answers: {
    id: string;
    authorId: string;
    text: string;
    votes: { voterId: string; value: number }[];
    total: number;
    pointsGained: number;
    isWinner: boolean;
  }[];
  roundWinnerIds: string[];
  pointsGained: Record<string, number>;
};

export type RoastAward = { id: RoastAwardId; title: string; playerIds: string[]; value: number };
export type RoastRanking = { playerId: string; score: number; rank: number; roundWins: number };
export type RoastBestAnswer = { playerId: string; text: string; prompt: string; total: number };

export type RoastView = {
  gameId: "roast";
  step: RoastStep;
  round: number;
  totalRounds: number;
  prompt: string | null;
  stepEndsAt: number | null;
  stepDurationMs: number | null;
  /** "pick" with 3 or 4 players, "stars" with 2. */
  mode: "pick" | "stars";
  participants: RoastParticipant[];
  submittedIds: string[];
  /** Your own answer, never anyone else's. */
  mySubmission: string | null;
  answers: RoastAnswerView[];
  votedIds: string[];
  myVoteAnswerId: string | null;
  myStars: number | null;
  reveal: RoastReveal | null;
  scores: Record<string, number>;
  results: {
    ranking: RoastRanking[];
    awards: RoastAward[];
    bestAnswer: RoastBestAnswer | null;
    endedEarly: boolean;
  } | null;
};
