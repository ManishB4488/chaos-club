import { z } from "zod";
import type { AvatarId, PlayerColor } from "../constants";

export const FAKE_ANSWER_CATEGORIES = ["animals", "words", "science", "geography", "food", "history"] as const;
export type FakeAnswerCategory = (typeof FAKE_ANSWER_CATEGORIES)[number];

export const FAKE_ANSWER_MAX_LENGTH = 60;

export const fakeAnswerActionSchema = z.discriminatedUnion("type", [
  /** Write a believable fake answer. */
  z.strictObject({ type: z.literal("submit"), text: z.string().min(1).max(FAKE_ANSWER_MAX_LENGTH) }),
  /** Pick the answer you think is real. */
  z.strictObject({ type: z.literal("choose"), optionId: z.string().min(1).max(32) }),
  /** Tell the site a fake answer is not okay. */
  z.strictObject({
    type: z.literal("report"),
    optionId: z.string().min(1).max(32),
    reason: z.string().max(80).optional(),
  }),
]);
export type FakeAnswerAction = z.infer<typeof fakeAnswerActionSchema>;

export type FakeAnswerStep = "writing" | "choosing" | "reveal" | "finished";
export type FakeAnswerAwardId = "professional-liar" | "truth-seeker";

export type FakeAnswerParticipant = { id: string; nickname: string; avatar: AvatarId; color: PlayerColor };

/** An answer to pick from. Nothing here says which one is real or who wrote it. */
export type FakeAnswerOption = { id: string; text: string };

/** Shown only after choosing has closed. */
export type FakeAnswerReveal = {
  realAnswer: string;
  options: {
    id: string;
    text: string;
    isReal: boolean;
    /** Who wrote this fake. Empty for the real answer. */
    authorIds: string[];
    /** Who picked it. */
    chooserIds: string[];
  }[];
  pointsGained: Record<string, number>;
};

export type FakeAnswerRanking = {
  playerId: string;
  score: number;
  rank: number;
  correct: number;
  fooled: number;
};
export type FakeAnswerAward = { id: FakeAnswerAwardId; title: string; playerIds: string[]; value: number };

export type FakeAnswerView = {
  gameId: "fake-answer";
  step: FakeAnswerStep;
  round: number;
  totalRounds: number;
  question: string | null;
  category: FakeAnswerCategory | null;
  stepEndsAt: number | null;
  stepDurationMs: number | null;
  participants: FakeAnswerParticipant[];
  submittedIds: string[];
  /** Your own fake answer, never anyone else's. */
  mySubmission: string | null;
  /** The answers to pick from, WITHOUT the ones you wrote yourself. */
  options: FakeAnswerOption[];
  chosenIds: string[];
  myChoiceId: string | null;
  reveal: FakeAnswerReveal | null;
  scores: Record<string, number>;
  results: { ranking: FakeAnswerRanking[]; awards: FakeAnswerAward[]; endedEarly: boolean } | null;
};
