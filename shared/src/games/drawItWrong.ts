import { z } from "zod";
import type { AvatarId, PlayerColor } from "../constants";

export const DRAW_CATEGORIES = ["animals", "food", "objects", "places", "actions"] as const;
export type DrawCategory = (typeof DRAW_CATEGORIES)[number];

/** The drawing is a square. Every point is a whole number from 0 to this, whatever the screen size. */
export const DRAW_CANVAS_SIZE = 1000;
/** The most points one message may carry. Longer lines are sent as several messages. */
export const DRAW_MAX_POINTS_PER_CHUNK = 64;

export const DRAW_COLORS = [
  "#111111",
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#92400e",
  "#ffffff",
] as const;
export type DrawColor = (typeof DRAW_COLORS)[number];
export const DRAW_SIZES = [4, 10, 22] as const;
export type DrawSize = (typeof DRAW_SIZES)[number];

const colorSchema = z.enum(DRAW_COLORS);
const sizeSchema = z.union([z.literal(4), z.literal(10), z.literal(22)]);
const coordinate = z.number().int().min(0).max(DRAW_CANVAS_SIZE);
const strokeId = z.number().int().min(1).max(100_000);

export const drawItWrongActionSchema = z.discriminatedUnion("type", [
  /** The artist picks one of the three words they were offered (by position, never by text). */
  z.strictObject({ type: z.literal("pick"), index: z.number().int().min(0).max(2) }),
  /** A piece of a line. Pieces with the same id join up. `done` closes the line. */
  z.strictObject({
    type: z.literal("stroke"),
    id: strokeId,
    color: colorSchema,
    size: sizeSchema,
    points: z.array(z.tuple([coordinate, coordinate])).min(1).max(DRAW_MAX_POINTS_PER_CHUNK),
    done: z.boolean().optional(),
  }),
  z.strictObject({
    type: z.literal("circle"),
    id: strokeId,
    color: colorSchema,
    size: sizeSchema,
    cx: coordinate,
    cy: coordinate,
    r: z.number().int().min(1).max(DRAW_CANVAS_SIZE / 2),
  }),
  z.strictObject({ type: z.literal("undo") }),
  z.strictObject({ type: z.literal("clear") }),
  z.strictObject({ type: z.literal("guess"), text: z.string().min(1).max(40) }),
]);
export type DrawItWrongAction = z.infer<typeof drawItWrongActionSchema>;

export type DrawStroke =
  | { id: number; kind: "path"; color: DrawColor; size: DrawSize; points: [number, number][]; done: boolean }
  | { id: number; kind: "circle"; color: DrawColor; size: DrawSize; cx: number; cy: number; r: number; done: true };

/** A small update sent to the other players while the artist draws. Never the whole picture. */
export type DrawDelta =
  | { type: "stroke"; stroke: DrawStroke; append: boolean }
  | { type: "undo"; strokeId: number }
  | { type: "clear" };

/** The whole drawing of one round, for joining late, refreshing, and the final replay. */
export type DrawingSnapshot = {
  round: number;
  /** The word. Only present once the round is over and the word is public. */
  word: string | null;
  artistId: string;
  strokes: DrawStroke[];
};

export type DrawMode = "free" | "circles" | "one-color" | "one-stroke" | "five-strokes" | "eyes-closed";

export type DrawRules = {
  mode: DrawMode;
  title: string;
  description: string;
  allowedColors: DrawColor[];
  allowedKinds: ("path" | "circle")[];
  maxStrokes: number;
  canUndo: boolean;
  canClear: boolean;
  /** "Eyes closed": the artist's own canvas stays blank while they draw. */
  hideCanvasFromArtist: boolean;
};

/**
 * The artist's private words. Delivered ONLY as the reply to the artist's own request, never in a broadcast.
 * Guessers learn nothing except that they are guessers.
 */
export type DrawSecret =
  | { role: "artist"; /** The three offered words while choosing, empty afterwards. */ options: string[]; word: string | null }
  | { role: "guesser" };

export type DrawStep = "choosing" | "drawing" | "reveal" | "finished";
export type DrawAwardId = "sharpest-eye" | "artist-of-the-chaos";

export type DrawParticipant = { id: string; nickname: string; avatar: AvatarId; color: PlayerColor };

export type DrawReveal = {
  /** Empty if the round was skipped before a word was picked. */
  word: string;
  artistId: string;
  /** Who guessed it, in order. */
  correctIds: string[];
  pointsGained: Record<string, number>;
  skipped: boolean;
};

export type DrawRanking = { playerId: string; score: number; rank: number; firstGuesses: number; artistCorrect: number };
export type DrawAward = { id: DrawAwardId; title: string; playerIds: string[]; value: number };

export type DrawItWrongView = {
  gameId: "draw-it-wrong";
  step: DrawStep;
  round: number;
  totalRounds: number;
  artistId: string | null;
  rules: DrawRules | null;
  /** The length of each word of the answer, for example [3, 5] for "ice cream". Never the letters. */
  wordShape: number[] | null;
  stepEndsAt: number | null;
  stepDurationMs: number | null;
  participants: DrawParticipant[];
  /** Wrong guesses, newest last. Correct guesses never show their text. */
  guesses: { playerId: string; text: string }[];
  correctIds: string[];
  reveal: DrawReveal | null;
  scores: Record<string, number>;
  results: {
    ranking: DrawRanking[];
    awards: DrawAward[];
    /** The drawing worth replaying: the round with the most correct guessers. */
    highlight: { round: number; word: string; artistId: string; correctCount: number } | null;
    endedEarly: boolean;
  } | null;
};
