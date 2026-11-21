import { z } from "zod";
import type { AvatarId, PlayerColor } from "../constants";

export const IMPOSTOR_CATEGORIES = ["food", "animals", "places", "objects", "entertainment"] as const;
export type ImpostorCategory = (typeof IMPOSTOR_CATEGORIES)[number];

/** Everything a player can do in this game. Which one is allowed depends on the step. */
export const impostorActionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("clue"), text: z.string().min(1).max(40) }),
  z.strictObject({ type: z.literal("ready") }),
  z.strictObject({ type: z.literal("vote"), targetId: z.string().min(1).max(64) }),
  z.strictObject({ type: z.literal("guess"), text: z.string().min(1).max(40) }),
]);
export type ImpostorAction = z.infer<typeof impostorActionSchema>;

/**
 * A player's private role and word. Delivered ONLY as the direct reply to that player's own authorized
 * request, never in a broadcast. The crew get the word. The impostor is told their role and gets NO word.
 */
export type ImpostorSecret = { role: "crew"; word: string } | { role: "impostor"; word: null };

export type ImpostorStep =
  | "words" // everyone reads their own secret word
  | "clues" // one clue each, in turn
  | "discussion" // talk it over
  | "voting" // secret vote
  | "guess" // a caught impostor guesses the crew's word
  | "result" // everything is revealed
  | "finished";

export type ImpostorAwardId = "master-of-disguise" | "sharpest-detective" | "smooth-operator";

export type ImpostorParticipant = {
  id: string;
  nickname: string;
  avatar: AvatarId;
  color: PlayerColor;
};

export type ImpostorOutcome = {
  /** Only present once voting has closed, when the impostor is no longer a secret. */
  impostorId: string;
  caught: boolean;
  votes: { voterId: string; targetId: string }[];
  counts: Record<string, number>;
  /** Hidden until the result step, because a caught impostor is still guessing it. */
  crewWord: string | null;
  guess: string | null;
  guessCorrect: boolean | null;
  pointsGained: Record<string, number> | null;
};

export type ImpostorRanking = {
  playerId: string;
  score: number;
  rank: number;
  survivals: number;
  correctVotes: number;
};

export type ImpostorAward = {
  id: ImpostorAwardId;
  title: string;
  playerIds: string[];
  value: number;
};

/**
 * What ONE player may see in the shared room updates. It deliberately contains NO secrets:
 * no role and no word. A player gets their own secret only by asking the server for it (see ImpostorSecret).
 * The crew word appears here only at the round result, after the votes and the guess are final.
 */
export type ImpostorView = {
  gameId: "impostor";
  step: ImpostorStep;
  round: number;
  totalRounds: number;
  category: ImpostorCategory | null;
  stepEndsAt: number | null;
  stepDurationMs: number | null;
  participants: ImpostorParticipant[];
  clueOrder: string[];
  currentSpeakerId: string | null;
  /** Clues are public: everyone sees every clue and who gave it. */
  clues: { playerId: string; text: string }[];
  readyIds: string[];
  votedIds: string[];
  myVote: string | null;
  outcome: ImpostorOutcome | null;
  scores: Record<string, number>;
  results: { ranking: ImpostorRanking[]; awards: ImpostorAward[]; endedEarly: boolean } | null;
};
