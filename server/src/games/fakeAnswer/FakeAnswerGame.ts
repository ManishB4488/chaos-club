import {
  fakeAnswerActionSchema,
  type FakeAnswerAward,
  type FakeAnswerAwardId,
  type FakeAnswerCategory,
  type FakeAnswerRanking,
  type FakeAnswerReveal,
  type FakeAnswerView,
  type RoomErrorCode,
} from "@chaos/shared";
import { containsBlockedWord } from "../../moderation/profanity";
import type { Result } from "../../rooms/types";
import { pickRoundRobin, shuffle } from "../random";
import type { GameContext, GameInstance, GamePlayer } from "../types";

export type FakeAnswerQuestion = {
  id: string;
  category: FakeAnswerCategory;
  question: string;
  answer: string;
  /** Other ways of writing the real answer. A fake matching any of them is treated as the real answer. */
  alsoAccept: string[];
};

export type FakeAnswerConfig = { rounds: number; writingMs: number; choosingMs: number; revealMs: number };
export const DEFAULT_FAKE_ANSWER_CONFIG: FakeAnswerConfig = {
  rounds: 6,
  writingMs: 45_000,
  choosingMs: 25_000,
  revealMs: 10_000,
};

export type FakeAnswerContext = GameContext & {
  questions: FakeAnswerQuestion[];
  config?: Partial<FakeAnswerConfig>;
};

type Option = { id: string; text: string; isReal: boolean; authorIds: string[] };

const fail = (error: RoomErrorCode): Result<void> => ({ ok: false, error });
const done: Result<void> = { ok: true, value: undefined };

const CORRECT_POINTS = 2;
const FOOLED_POINTS = 1;

/** Ignores capitals, accents, punctuation, spaces and a leading a / an / the. */
export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/^\s*(a|an|the)\s+/, "")
    .replace(/\s+/g, "");
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

export class FakeAnswerGame implements GameInstance {
  readonly id = "fake-answer" as const;

  private readonly participants: GamePlayer[];
  private readonly config: FakeAnswerConfig;
  private readonly now: () => number;
  private readonly isConnected: (playerId: string) => boolean;
  private readonly random: () => number;
  private readonly reportContent: GameContext["reportContent"];
  private readonly plan: FakeAnswerQuestion[];

  private readonly scores = new Map<string, number>();
  private readonly correct = new Map<string, number>();
  private readonly fooled = new Map<string, number>();

  private step: FakeAnswerView["step"] = "writing";
  private round = 0;
  private stepEndsAt: number | null = null;
  private stepDurationMs: number | null = null;
  private submissions = new Map<string, string>();
  private options: Option[] = [];
  private choices = new Map<string, string>();
  private reported = new Set<string>();
  private reveal: FakeAnswerReveal | null = null;
  private results: FakeAnswerView["results"] = null;

  constructor(context: FakeAnswerContext) {
    this.participants = context.players.map((player) => ({ ...player }));
    this.config = { ...DEFAULT_FAKE_ANSWER_CONFIG, ...context.config };
    this.now = context.now;
    this.isConnected = context.isConnected;
    this.random = context.random;
    this.reportContent = context.reportContent;
    this.plan = pickRoundRobin(context.questions, this.config.rounds, context.random);
    if (this.plan.length === 0) throw new Error("The Fake Answer needs at least one question.");

    for (const player of this.participants) {
      this.scores.set(player.id, 0);
      this.correct.set(player.id, 0);
      this.fooled.set(player.id, 0);
    }
    this.beginRound(1);
  }

  handleAction(playerId: string, action: unknown): Result<void> {
    if (!this.isParticipant(playerId)) return fail("NOT_A_PARTICIPANT");
    const parsed = fakeAnswerActionSchema.safeParse(action);
    if (!parsed.success) return fail("INVALID_INPUT");
    const move = parsed.data;

    switch (move.type) {
      case "submit":
        return this.submit(playerId, move.text);
      case "choose":
        return this.choose(playerId, move.optionId);
      case "report":
        return this.report(playerId, move.optionId, move.reason ?? null);
    }
  }

  tick(now: number): boolean {
    const timeUp = this.stepEndsAt !== null && now >= this.stepEndsAt;
    switch (this.step) {
      case "writing":
        if (timeUp || this.everyoneConnectedSubmitted()) {
          this.startChoosing();
          return true;
        }
        return false;
      case "choosing":
        if (timeUp || this.everyoneConnectedChose()) {
          this.closeChoosing();
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

  viewFor(playerId: string): FakeAnswerView {
    const finished = this.step === "finished";
    const question = finished ? undefined : this.plan[this.round - 1];
    return {
      gameId: "fake-answer",
      step: this.step,
      round: this.round,
      totalRounds: this.plan.length,
      question: question?.question ?? null,
      category: question?.category ?? null,
      stepEndsAt: this.stepEndsAt,
      stepDurationMs: this.stepDurationMs,
      participants: this.participants.map((p) => ({ ...p })),
      submittedIds: this.participants.filter((p) => this.submissions.has(p.id)).map((p) => p.id),
      mySubmission: this.submissions.get(playerId) ?? null,
      // Your own fake is hidden from you. Nothing says which option is real or who wrote the others.
      options:
        this.step === "choosing"
          ? this.options.filter((o) => !o.authorIds.includes(playerId)).map((o) => ({ id: o.id, text: o.text }))
          : [],
      chosenIds: this.participants.filter((p) => this.choices.has(p.id)).map((p) => p.id),
      myChoiceId: this.choices.get(playerId) ?? null,
      reveal: this.step === "reveal" ? this.reveal : null,
      scores: Object.fromEntries(this.scores),
      results: this.results,
    };
  }

  // ---------- actions ----------

  private submit(playerId: string, rawText: string): Result<void> {
    if (this.step !== "writing") return fail("WRONG_STEP");
    if (this.submissions.has(playerId)) return fail("ALREADY_DONE");
    const text = rawText.replace(/\s+/g, " ").trim();
    if (text.length === 0) return fail("INVALID_INPUT");
    if (containsBlockedWord(text)) return fail("CONTENT_NOT_ALLOWED");

    // A fake that happens to match the real answer is NOT refused: refusing would let a player find the real
    // answer by trying guesses. It is quietly set aside when the options are built.
    this.submissions.set(playerId, text);
    if (this.everyoneConnectedSubmitted()) this.startChoosing();
    return done;
  }

  private choose(playerId: string, optionId: string): Result<void> {
    if (this.step !== "choosing") return fail("WRONG_STEP");
    if (this.choices.has(playerId)) return fail("ALREADY_VOTED");
    const option = this.options.find((o) => o.id === optionId);
    if (!option) return fail("ANSWER_NOT_FOUND");
    if (option.authorIds.includes(playerId)) return fail("CANNOT_VOTE_SELF");

    this.choices.set(playerId, optionId);
    if (this.everyoneConnectedChose()) this.closeChoosing();
    return done;
  }

  private report(playerId: string, optionId: string, reason: string | null): Result<void> {
    if (this.step !== "choosing" && this.step !== "reveal") return fail("WRONG_STEP");
    const option = this.options.find((o) => o.id === optionId);
    if (!option) return fail("ANSWER_NOT_FOUND");
    // Reporting the real answer (or your own fake) gets the same plain "ok" as any other report, but is not
    // recorded. A different reply would let a player find the real answer by reporting each option in turn.
    if (option.isReal || option.authorIds.includes(playerId)) return done;
    const key = `${this.round}:${playerId}:${optionId}`;
    if (this.reported.has(key)) return fail("ALREADY_DONE");
    this.reported.add(key);
    this.reportContent?.({ game: "fake-answer", text: option.text, reason });
    return done;
  }

  // ---------- flow ----------

  private isParticipant(playerId: string): boolean {
    return this.participants.some((p) => p.id === playerId);
  }

  private connectedParticipants(): GamePlayer[] {
    return this.participants.filter((p) => this.isConnected(p.id));
  }

  private everyoneConnectedSubmitted(): boolean {
    const connected = this.connectedParticipants();
    return connected.length > 0 && connected.every((p) => this.submissions.has(p.id));
  }

  private everyoneConnectedChose(): boolean {
    const connected = this.connectedParticipants();
    return connected.length > 0 && connected.every((p) => this.choices.has(p.id));
  }

  private setStep(step: FakeAnswerView["step"], durationMs: number | null): void {
    this.step = step;
    this.stepDurationMs = durationMs;
    this.stepEndsAt = durationMs === null ? null : this.now() + durationMs;
  }

  private currentQuestion(): FakeAnswerQuestion {
    const question = this.plan[this.round - 1];
    if (!question) throw new Error("No round is active.");
    return question;
  }

  private beginRound(round: number): void {
    this.round = round;
    this.submissions = new Map();
    this.options = [];
    this.choices = new Map();
    this.reveal = null;
    this.setStep("writing", this.config.writingMs);
  }

  private startChoosing(): void {
    const question = this.currentQuestion();
    const realForms = [question.answer, ...question.alsoAccept].map(normalizeAnswer);

    // Identical fakes are merged into one option, and every writer of it gets credit.
    const fakes = new Map<string, { text: string; authorIds: string[] }>();
    for (const [authorId, text] of this.submissions) {
      const key = normalizeAnswer(text);
      if (!key || realForms.includes(key)) continue;
      const existing = fakes.get(key);
      if (existing) existing.authorIds.push(authorId);
      else fakes.set(key, { text, authorIds: [authorId] });
    }

    const all = shuffle<Omit<Option, "id">>(
      [{ text: question.answer, isReal: true, authorIds: [] }, ...[...fakes.values()].map((f) => ({ ...f, isReal: false }))],
      this.random,
    );
    this.options = all.map((option, index) => ({ ...option, id: `o${index + 1}` }));
    this.setStep("choosing", this.config.choosingMs);
  }

  private closeChoosing(): void {
    const question = this.currentQuestion();
    const pointsGained: Record<string, number> = {};
    for (const player of this.participants) pointsGained[player.id] = 0;

    const revealOptions: FakeAnswerReveal["options"] = this.options.map((option) => {
      const chooserIds = this.participants.filter((p) => this.choices.get(p.id) === option.id).map((p) => p.id);
      if (option.isReal) {
        for (const id of chooserIds) {
          pointsGained[id] = (pointsGained[id] ?? 0) + CORRECT_POINTS;
          this.bump(this.correct, id, 1);
        }
      } else {
        for (const authorId of option.authorIds) {
          pointsGained[authorId] = (pointsGained[authorId] ?? 0) + chooserIds.length * FOOLED_POINTS;
          this.bump(this.fooled, authorId, chooserIds.length);
        }
      }
      return { id: option.id, text: option.text, isReal: option.isReal, authorIds: [...option.authorIds], chooserIds };
    });

    for (const player of this.participants) this.bump(this.scores, player.id, pointsGained[player.id] ?? 0);
    this.reveal = { realAnswer: question.answer, options: revealOptions, pointsGained };
    this.setStep("reveal", this.config.revealMs);
  }

  private advance(): void {
    if (this.round >= this.plan.length) this.finish(false);
    else this.beginRound(this.round + 1);
  }

  private bump(map: Map<string, number>, key: string, amount: number): void {
    map.set(key, (map.get(key) ?? 0) + amount);
  }

  private finish(endedEarly: boolean): void {
    const ordered = [...this.participants].sort(
      (a, b) =>
        (this.scores.get(b.id) ?? 0) - (this.scores.get(a.id) ?? 0) ||
        (this.correct.get(b.id) ?? 0) - (this.correct.get(a.id) ?? 0),
    );
    const ranking: FakeAnswerRanking[] = [];
    ordered.forEach((player, index) => {
      const score = this.scores.get(player.id) ?? 0;
      const correct = this.correct.get(player.id) ?? 0;
      const previous = ranking[index - 1];
      const rank = previous && previous.score === score && previous.correct === correct ? previous.rank : index + 1;
      ranking.push({ playerId: player.id, score, rank, correct, fooled: this.fooled.get(player.id) ?? 0 });
    });

    const candidates: { id: FakeAnswerAwardId; title: string; values: Map<string, number> }[] = [
      { id: "professional-liar", title: "Professional Liar", values: this.fooled },
      { id: "truth-seeker", title: "Truth Seeker", values: this.correct },
    ];
    const awards: FakeAnswerAward[] = [];
    for (const candidate of candidates) {
      const top = topOf(candidate.values, this.participants);
      if (top) awards.push({ id: candidate.id, title: candidate.title, ...top });
    }

    this.setStep("finished", null);
    this.reveal = null;
    this.results = { ranking, awards, endedEarly };
  }
}
