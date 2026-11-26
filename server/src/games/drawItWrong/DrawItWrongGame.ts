import {
  DRAW_COLORS,
  drawItWrongActionSchema,
  type DrawAward,
  type DrawAwardId,
  type DrawCategory,
  type DrawColor,
  type DrawDelta,
  type DrawItWrongView,
  type DrawMode,
  type DrawRanking,
  type DrawReveal,
  type DrawRules,
  type DrawSecret,
  type DrawStroke,
  type DrawingSnapshot,
  type RoomErrorCode,
} from "@chaos/shared";
import { containsBlockedWord } from "../../moderation/profanity";
import type { Result } from "../../rooms/types";
import { pickRoundRobin, shuffle } from "../random";
import type { GameContext, GameInstance, GamePlayer, StreamBatch, StreamEvent } from "../types";

export type DrawWord = { id: string; category: DrawCategory; word: string };

export type DrawConfig = {
  roundsPerPlayer: number;
  choosingMs: number;
  drawingMs: number;
  revealMs: number;
  /** Which challenges can come up. All of them by default. */
  modes: DrawMode[];
};

const ALL_MODES: DrawMode[] = ["free", "circles", "one-color", "one-stroke", "five-strokes", "eyes-closed"];

export const DEFAULT_DRAW_CONFIG: DrawConfig = {
  roundsPerPlayer: 2,
  choosingMs: 15_000,
  drawingMs: 45_000,
  revealMs: 8_000,
  modes: ALL_MODES,
};

export type DrawContext = GameContext & { words: DrawWord[]; config?: Partial<DrawConfig> };

const fail = (error: RoomErrorCode): Result<void> => ({ ok: false, error });
const done: Result<void> = { ok: true, value: undefined };

const GUESS_POINTS = [3, 2, 1];
const ARTIST_POINTS_PER_GUESSER = 1;
const MIN_GUESS_GAP_MS = 800;
const MAX_POINTS_PER_STROKE = 1_500;
const MAX_POINTS_PER_ROUND = 15_000;
const MAX_GUESSES_KEPT = 30;
const WORD_CHOICES = 3;

/** Ignores capitals, accents, punctuation, spaces and a final "s". */
export function normalizeGuess(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .replace(/s$/, "");
}

function rulesFor(mode: DrawMode, random: () => number): DrawRules {
  const everyColor = [...DRAW_COLORS];
  switch (mode) {
    case "free":
      return {
        mode,
        title: "Free draw",
        description: "Any color, any brush. Use undo and clear if you need them.",
        allowedColors: everyColor,
        allowedKinds: ["path"],
        maxStrokes: 200,
        canUndo: true,
        canClear: true,
        hideCanvasFromArtist: false,
      };
    case "circles":
      return {
        mode,
        title: "Only circles",
        description: "The only shape you can make is a circle.",
        allowedColors: everyColor,
        allowedKinds: ["circle"],
        maxStrokes: 60,
        canUndo: true,
        canClear: true,
        hideCanvasFromArtist: false,
      };
    case "one-color": {
      const choices = everyColor.filter((color): color is Exclude<DrawColor, "#ffffff"> => color !== "#ffffff");
      const color = choices[Math.floor(random() * choices.length)] ?? "#111111";
      return {
        mode,
        title: "One color",
        description: "You get one single color for the whole drawing.",
        allowedColors: [color],
        allowedKinds: ["path"],
        maxStrokes: 200,
        canUndo: true,
        canClear: true,
        hideCanvasFromArtist: false,
      };
    }
    case "one-stroke":
      return {
        mode,
        title: "One single line",
        description: "You may draw exactly one line, without lifting your finger. No undo.",
        allowedColors: everyColor,
        allowedKinds: ["path"],
        maxStrokes: 1,
        canUndo: false,
        canClear: false,
        hideCanvasFromArtist: false,
      };
    case "five-strokes":
      return {
        mode,
        title: "Only five lines",
        description: "You may draw five lines in total. No undo.",
        allowedColors: everyColor,
        allowedKinds: ["path"],
        maxStrokes: 5,
        canUndo: false,
        canClear: false,
        hideCanvasFromArtist: false,
      };
    case "eyes-closed":
      return {
        mode,
        title: "Eyes closed",
        description: "Your own canvas stays blank while you draw. The others can see it. No undo.",
        allowedColors: everyColor,
        allowedKinds: ["path"],
        maxStrokes: 100,
        canUndo: false,
        canClear: false,
        hideCanvasFromArtist: true,
      };
  }
}

function topOf(
  values: Map<string, number>,
  participants: GamePlayer[],
): { playerIds: string[]; value: number } | null {
  let max = 0;
  for (const player of participants) max = Math.max(max, values.get(player.id) ?? 0);
  if (max <= 0) return null;
  return {
    playerIds: participants.filter((p) => (values.get(p.id) ?? 0) === max).map((p) => p.id),
    value: max,
  };
}

type HistoryEntry = { round: number; word: string; artistId: string; strokes: DrawStroke[]; correctCount: number };

export class DrawItWrongGame implements GameInstance {
  readonly id = "draw-it-wrong" as const;

  private readonly participants: GamePlayer[];
  private readonly config: DrawConfig;
  private readonly now: () => number;
  private readonly isConnected: (playerId: string) => boolean;
  private readonly random: () => number;
  private readonly reportContent: GameContext["reportContent"];
  private readonly pool: DrawWord[];
  private readonly artistOrder: string[];
  private readonly totalRounds: number;

  private readonly scores = new Map<string, number>();
  private readonly firstGuesses = new Map<string, number>();
  private readonly artistCorrect = new Map<string, number>();
  private readonly usedWords = new Set<string>();
  private readonly history: HistoryEntry[] = [];
  private previousMode: DrawMode | null = null;

  private step: DrawItWrongView["step"] = "choosing";
  private round = 0;
  private stepEndsAt: number | null = null;
  private stepDurationMs: number | null = null;
  private artistId = "";
  private rules: DrawRules | null = null;
  private choices: string[] = [];
  private word: string | null = null;
  private strokes: DrawStroke[] = [];
  private lastStrokeId = 0;
  private pointTotal = 0;
  private guesses: { playerId: string; text: string }[] = [];
  private correct: string[] = [];
  private lastGuessAt = new Map<string, number>();
  private reveal: DrawReveal | null = null;
  private results: DrawItWrongView["results"] = null;
  private streamEvents: StreamEvent[] = [];
  private silent = false;

  constructor(context: DrawContext) {
    this.participants = context.players.map((player) => ({ ...player }));
    this.config = { ...DEFAULT_DRAW_CONFIG, ...context.config };
    this.now = context.now;
    this.isConnected = context.isConnected;
    this.random = context.random;
    this.reportContent = context.reportContent;
    this.pool = context.words;
    if (this.pool.length < WORD_CHOICES) throw new Error("Draw It Wrong needs at least three words.");

    // Everybody draws the same number of times, in a shuffled order.
    this.artistOrder = shuffle(
      this.participants.map((p) => p.id),
      context.random,
    );
    this.totalRounds = this.participants.length * this.config.roundsPerPlayer;
    for (const player of this.participants) {
      this.scores.set(player.id, 0);
      this.firstGuesses.set(player.id, 0);
      this.artistCorrect.set(player.id, 0);
    }
    this.beginRound(1);
  }

  handleAction(playerId: string, action: unknown): Result<void> {
    this.silent = false;
    if (!this.isParticipant(playerId)) return fail("NOT_A_PARTICIPANT");
    const parsed = drawItWrongActionSchema.safeParse(action);
    if (!parsed.success) return fail("INVALID_INPUT");
    const move = parsed.data;

    switch (move.type) {
      case "pick":
        return this.pick(playerId, move.index);
      case "stroke":
        return this.drawPath(playerId, move);
      case "circle":
        return this.drawCircle(playerId, move);
      case "undo":
        return this.undo(playerId);
      case "clear":
        return this.clear(playerId);
      case "guess":
        return this.guess(playerId, move.text);
    }
  }

  tick(now: number): boolean {
    const timeUp = this.stepEndsAt !== null && now >= this.stepEndsAt;
    const artistHere = this.isConnected(this.artistId);
    switch (this.step) {
      case "choosing":
        if (!artistHere) {
          this.closeRound(true);
          return true;
        }
        if (timeUp) {
          const index = Math.floor(this.random() * this.choices.length);
          this.startDrawing(this.choices[index] ?? this.choices[0] ?? "");
          return true;
        }
        return false;
      case "drawing":
        if (!artistHere || timeUp || this.everyoneGuessed()) {
          this.closeRound(false);
          return true;
        }
        return false;
      case "reveal":
        if (timeUp) {
          this.advance();
          return true;
        }
        return false;
      case "finished":
        return false;
    }
  }

  forceFinish(): void {
    if (this.step === "finished") return;
    this.finish(true);
  }

  isFinished(): boolean {
    return this.step === "finished";
  }

  /**
   * The artist's private words. The caller has already proven which player is asking.
   * Guessers learn nothing but their role. Only available while the round is being played.
   */
  secretFor(playerId: string): Result<DrawSecret> {
    if (!this.isParticipant(playerId)) return { ok: false, error: "NOT_A_PARTICIPANT" };
    if (this.step !== "choosing" && this.step !== "drawing") return { ok: false, error: "WRONG_STEP" };
    if (playerId !== this.artistId) return { ok: true, value: { role: "guesser" } };
    return {
      ok: true,
      value: this.step === "choosing"
        ? { role: "artist", options: [...this.choices], word: null }
        : { role: "artist", options: [], word: this.word },
    };
  }

  /** Live messages from the last move. Reading them empties the queue. */
  drainStream(): StreamBatch {
    const batch: StreamBatch = { events: this.streamEvents, silent: this.silent && this.streamEvents.length > 0 };
    this.streamEvents = [];
    this.silent = false;
    return batch;
  }

  /** A drawing, for joining late, refreshing and the replay. The word is only included once it is public. */
  drawingFor(playerId: string, round?: number): Result<DrawingSnapshot> {
    if (!this.isParticipant(playerId)) return { ok: false, error: "NOT_A_PARTICIPANT" };
    const wanted = round ?? this.round;
    const past = this.history.find((entry) => entry.round === wanted);
    if (past) {
      return {
        ok: true,
        value: {
          round: past.round,
          word: past.word || null,
          artistId: past.artistId,
          strokes: past.strokes.map(copyStroke),
          nextStrokeId: 0,
        },
      };
    }
    if (wanted !== this.round || this.step === "finished") return { ok: false, error: "WRONG_STEP" };
    return {
      ok: true,
      value: {
        round: this.round,
        word: null,
        artistId: this.artistId,
        strokes: this.strokes.map(copyStroke),
        nextStrokeId: this.lastStrokeId + 1,
      },
    };
  }

  viewFor(_playerId: string): DrawItWrongView {
    const drawing = this.step === "drawing" && this.word !== null;
    return {
      gameId: "draw-it-wrong",
      step: this.step,
      round: this.round,
      totalRounds: this.totalRounds,
      artistId: this.step === "finished" ? null : this.artistId,
      rules: this.step === "finished" ? null : this.rules,
      wordShape: drawing ? (this.word ?? "").split(" ").map((part) => part.length) : null,
      stepEndsAt: this.stepEndsAt,
      stepDurationMs: this.stepDurationMs,
      participants: this.participants.map((p) => ({ ...p })),
      guesses: this.guesses.map((g) => ({ ...g })),
      correctIds: [...this.correct],
      reveal: this.step === "reveal" ? this.reveal : null,
      scores: Object.fromEntries(this.scores),
      results: this.results,
    };
  }

  // ---------- moves ----------

  private pick(playerId: string, index: number): Result<void> {
    if (this.step !== "choosing") return fail("WRONG_STEP");
    if (playerId !== this.artistId) return fail("NOT_YOUR_TURN");
    const word = this.choices[index];
    if (word === undefined) return fail("INVALID_INPUT");
    this.startDrawing(word);
    return done;
  }

  /** Checks that this move is the artist's, during drawing. Returns the rules, or an error code. */
  private artistMove(playerId: string): DrawRules | RoomErrorCode {
    if (this.step !== "drawing") return "WRONG_STEP";
    if (playerId !== this.artistId) return "NOT_YOUR_TURN";
    return this.rules ?? "WRONG_STEP";
  }

  private drawPath(
    playerId: string,
    move: Extract<ReturnType<typeof drawItWrongActionSchema.parse>, { type: "stroke" }>,
  ): Result<void> {
    const rules = this.artistMove(playerId);
    if (typeof rules === "string") return fail(rules);
    if (!rules.allowedKinds.includes("path") || !rules.allowedColors.includes(move.color)) return fail("DRAWING_RULE");

    const existing = this.strokes.find((stroke) => stroke.id === move.id);
    if (existing) {
      // More points for a line that is still open.
      if (existing.kind !== "path" || existing.done) return fail("DRAWING_RULE");
      if (existing.points.length + move.points.length > MAX_POINTS_PER_STROKE) return fail("DRAWING_RULE");
      if (this.pointTotal + move.points.length > MAX_POINTS_PER_ROUND) return fail("DRAWING_RULE");
      existing.points.push(...move.points);
      this.pointTotal += move.points.length;
      if (move.done) existing.done = true;
      this.stream({
        type: "stroke",
        stroke: { id: existing.id, kind: "path", color: existing.color, size: existing.size, points: move.points, done: existing.done },
        append: true,
      });
      return done;
    }

    if (this.strokes.length >= rules.maxStrokes || move.id <= this.lastStrokeId) return fail("DRAWING_RULE");
    if (this.pointTotal + move.points.length > MAX_POINTS_PER_ROUND) return fail("DRAWING_RULE");
    const stroke: DrawStroke = {
      id: move.id,
      kind: "path",
      color: move.color,
      size: move.size,
      points: [...move.points],
      done: move.done === true,
    };
    this.strokes.push(stroke);
    this.lastStrokeId = move.id;
    this.pointTotal += move.points.length;
    this.stream({ type: "stroke", stroke: copyStroke(stroke), append: false });
    return done;
  }

  private drawCircle(
    playerId: string,
    move: Extract<ReturnType<typeof drawItWrongActionSchema.parse>, { type: "circle" }>,
  ): Result<void> {
    const rules = this.artistMove(playerId);
    if (typeof rules === "string") return fail(rules);
    if (!rules.allowedKinds.includes("circle") || !rules.allowedColors.includes(move.color)) return fail("DRAWING_RULE");
    if (this.strokes.length >= rules.maxStrokes || move.id <= this.lastStrokeId) return fail("DRAWING_RULE");

    const stroke: DrawStroke = {
      id: move.id,
      kind: "circle",
      color: move.color,
      size: move.size,
      cx: move.cx,
      cy: move.cy,
      r: move.r,
      done: true,
    };
    this.strokes.push(stroke);
    this.lastStrokeId = move.id;
    this.stream({ type: "stroke", stroke: copyStroke(stroke), append: false });
    return done;
  }

  private undo(playerId: string): Result<void> {
    const rules = this.artistMove(playerId);
    if (typeof rules === "string") return fail(rules);
    if (!rules.canUndo) return fail("DRAWING_RULE");
    const last = this.strokes.pop();
    if (last) this.stream({ type: "undo", strokeId: last.id });
    return done;
  }

  private clear(playerId: string): Result<void> {
    const rules = this.artistMove(playerId);
    if (typeof rules === "string") return fail(rules);
    if (!rules.canClear) return fail("DRAWING_RULE");
    this.strokes = [];
    this.stream({ type: "clear" });
    return done;
  }

  private guess(playerId: string, rawText: string): Result<void> {
    if (this.step !== "drawing" || this.word === null) return fail("WRONG_STEP");
    if (playerId === this.artistId) return fail("NOT_YOUR_TURN");
    if (this.correct.includes(playerId)) return fail("ALREADY_DONE");

    const last = this.lastGuessAt.get(playerId);
    if (last !== undefined && this.now() - last < MIN_GUESS_GAP_MS) return fail("RATE_LIMITED");
    const text = rawText.replace(/\s+/g, " ").trim();
    if (text.length === 0) return fail("INVALID_INPUT");
    if (containsBlockedWord(text)) return fail("CONTENT_NOT_ALLOWED");
    this.lastGuessAt.set(playerId, this.now());

    if (normalizeGuess(text) === normalizeGuess(this.word)) {
      this.correct.push(playerId); // The text of a correct guess is never shown.
      if (this.everyoneGuessed()) this.closeRound(false);
    } else {
      this.guesses.push({ playerId, text });
      if (this.guesses.length > MAX_GUESSES_KEPT) this.guesses.shift();
    }
    return done;
  }

  // ---------- flow ----------

  private isParticipant(playerId: string): boolean {
    return this.participants.some((p) => p.id === playerId);
  }

  /** Queues a live message for everyone except the artist. The room update is not re-sent for it. */
  private stream(delta: DrawDelta): void {
    this.streamEvents.push({ event: "draw:delta", data: delta, exceptPlayerId: this.artistId });
    this.silent = true;
  }

  private everyoneGuessed(): boolean {
    const guessers = this.participants.filter((p) => p.id !== this.artistId && this.isConnected(p.id));
    return guessers.length > 0 && guessers.every((p) => this.correct.includes(p.id));
  }

  private setStep(step: DrawItWrongView["step"], durationMs: number | null): void {
    this.step = step;
    this.stepDurationMs = durationMs;
    this.stepEndsAt = durationMs === null ? null : this.now() + durationMs;
  }

  private beginRound(round: number): void {
    this.round = round;
    this.artistId = this.artistOrder[(round - 1) % this.artistOrder.length] ?? "";

    const modes = this.config.modes.filter((mode) => mode !== this.previousMode);
    const mode = shuffle(modes.length > 0 ? modes : this.config.modes, this.random)[0] ?? "free";
    this.previousMode = mode;
    this.rules = rulesFor(mode, this.random);

    // Three words from different categories, never one used before in this game.
    let available = this.pool.filter((entry) => !this.usedWords.has(entry.word));
    if (available.length < WORD_CHOICES) {
      this.usedWords.clear();
      available = this.pool;
    }
    this.choices = pickRoundRobin(available, WORD_CHOICES, this.random).map((entry) => entry.word);
    for (const word of this.choices) this.usedWords.add(word);

    this.word = null;
    this.strokes = [];
    this.lastStrokeId = 0;
    this.pointTotal = 0;
    this.guesses = [];
    this.correct = [];
    this.lastGuessAt = new Map();
    this.reveal = null;
    this.streamEvents = [];
    this.silent = false;
    this.setStep("choosing", this.config.choosingMs);
  }

  private startDrawing(word: string): void {
    this.word = word;
    this.setStep("drawing", this.config.drawingMs);
  }

  private closeRound(skipped: boolean): void {
    const pointsGained: Record<string, number> = {};
    for (const player of this.participants) pointsGained[player.id] = 0;

    if (!skipped) {
      this.correct.forEach((playerId, index) => {
        pointsGained[playerId] = (pointsGained[playerId] ?? 0) + (GUESS_POINTS[index] ?? 1);
      });
      pointsGained[this.artistId] =
        (pointsGained[this.artistId] ?? 0) + this.correct.length * ARTIST_POINTS_PER_GUESSER;
      const first = this.correct[0];
      if (first) this.firstGuesses.set(first, (this.firstGuesses.get(first) ?? 0) + 1);
      this.artistCorrect.set(this.artistId, (this.artistCorrect.get(this.artistId) ?? 0) + this.correct.length);
    }
    for (const player of this.participants) {
      this.scores.set(player.id, (this.scores.get(player.id) ?? 0) + (pointsGained[player.id] ?? 0));
    }

    const word = this.word ?? "";
    this.reveal = { word, artistId: this.artistId, correctIds: [...this.correct], pointsGained, skipped };
    this.history.push({
      round: this.round,
      word,
      artistId: this.artistId,
      strokes: this.strokes.map(copyStroke),
      correctCount: skipped ? 0 : this.correct.length,
    });
    this.setStep("reveal", this.config.revealMs);
  }

  private advance(): void {
    if (this.round >= this.totalRounds) this.finish(false);
    else this.beginRound(this.round + 1);
  }

  private finish(endedEarly: boolean): void {
    const ordered = [...this.participants].sort(
      (a, b) =>
        (this.scores.get(b.id) ?? 0) - (this.scores.get(a.id) ?? 0) ||
        (this.firstGuesses.get(b.id) ?? 0) - (this.firstGuesses.get(a.id) ?? 0),
    );
    const ranking: DrawRanking[] = [];
    ordered.forEach((player, index) => {
      const score = this.scores.get(player.id) ?? 0;
      const firstGuesses = this.firstGuesses.get(player.id) ?? 0;
      const previous = ranking[index - 1];
      const rank =
        previous && previous.score === score && previous.firstGuesses === firstGuesses ? previous.rank : index + 1;
      ranking.push({
        playerId: player.id,
        score,
        rank,
        firstGuesses,
        artistCorrect: this.artistCorrect.get(player.id) ?? 0,
      });
    });

    const candidates: { id: DrawAwardId; title: string; values: Map<string, number> }[] = [
      { id: "sharpest-eye", title: "Sharpest Eye", values: this.firstGuesses },
      { id: "artist-of-the-chaos", title: "Artist of the Chaos", values: this.artistCorrect },
    ];
    const awards: DrawAward[] = [];
    for (const candidate of candidates) {
      const top = topOf(candidate.values, this.participants);
      if (top) awards.push({ id: candidate.id, title: candidate.title, ...top });
    }

    // The drawing worth replaying: the most correct guessers, and something actually drawn.
    let highlight: { round: number; word: string; artistId: string; correctCount: number } | null = null;
    for (const entry of this.history) {
      if (entry.strokes.length === 0 || entry.word === "") continue;
      if (highlight === null || entry.correctCount > highlight.correctCount) {
        highlight = { round: entry.round, word: entry.word, artistId: entry.artistId, correctCount: entry.correctCount };
      }
    }

    this.setStep("finished", null);
    this.reveal = null;
    this.results = { ranking, awards, highlight, endedEarly };
  }
}

function copyStroke(stroke: DrawStroke): DrawStroke {
  return stroke.kind === "path" ? { ...stroke, points: stroke.points.map(([x, y]) => [x, y] as [number, number]) } : { ...stroke };
}
