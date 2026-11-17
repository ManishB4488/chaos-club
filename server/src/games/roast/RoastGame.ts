import {
  roastActionSchema,
  type RoastAward,
  type RoastAwardId,
  type RoastBestAnswer,
  type RoastCategory,
  type RoastRanking,
  type RoastReveal,
  type RoastView,
  type RoomErrorCode,
} from "@chaos/shared";
import { containsBlockedWord } from "../../moderation/profanity";
import type { Result } from "../../rooms/types";
import { pickRoundRobin, shuffle } from "../random";
import type { GameContext, GameInstance, GamePlayer } from "../types";

export type RoastPrompt = { id: string; category: RoastCategory; text: string };

export type RoastConfig = { rounds: number; writingMs: number; votingMs: number; revealMs: number };
export const DEFAULT_ROAST_CONFIG: RoastConfig = {
  rounds: 6,
  writingMs: 45_000,
  votingMs: 20_000,
  revealMs: 10_000,
};

export type RoastContext = GameContext & { prompts: RoastPrompt[]; config?: Partial<RoastConfig> };

type AnswerEntry = { id: string; authorId: string; text: string };

const fail = (error: RoomErrorCode): Result<void> => ({ ok: false, error });
const done: Result<void> = { ok: true, value: undefined };

const VOTE_POINTS = 2;
const WINNER_BONUS = 1;

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

export class RoastGame implements GameInstance {
  readonly id = "roast" as const;

  private readonly participants: GamePlayer[];
  private readonly config: RoastConfig;
  private readonly now: () => number;
  private readonly isConnected: (playerId: string) => boolean;
  private readonly random: () => number;
  private readonly reportContent: GameContext["reportContent"];
  private readonly plan: string[];
  /** With 2 players, picking one answer would always tie, so each player rates the other's answer instead. */
  private readonly mode: "pick" | "stars";

  private readonly scores = new Map<string, number>();
  private readonly roundWins = new Map<string, number>();
  private bestAnswer: RoastBestAnswer | null = null;

  private step: RoastView["step"] = "writing";
  private round = 0;
  private stepEndsAt: number | null = null;
  private stepDurationMs: number | null = null;
  private submissions = new Map<string, string>();
  private answers: AnswerEntry[] = [];
  private votes = new Map<string, string>();
  private stars = new Map<string, number>();
  private reported = new Set<string>();
  private reveal: RoastReveal | null = null;
  private results: RoastView["results"] = null;

  constructor(context: RoastContext) {
    this.participants = context.players.map((player) => ({ ...player }));
    this.config = { ...DEFAULT_ROAST_CONFIG, ...context.config };
    this.now = context.now;
    this.isConnected = context.isConnected;
    this.random = context.random;
    this.reportContent = context.reportContent;
    this.mode = this.participants.length === 2 ? "stars" : "pick";

    const picked = pickRoundRobin(context.prompts, this.config.rounds, context.random);
    if (picked.length === 0) throw new Error("Roast Your Friends needs at least one prompt.");

    // Each player takes turns being "the target" of prompts that talk about a player.
    const targets = shuffle(this.participants, context.random);
    let targetIndex = 0;
    this.plan = picked.map((prompt) => {
      if (prompt.category !== "about") return prompt.text;
      const target = targets[targetIndex % targets.length];
      targetIndex++;
      return prompt.text.replaceAll("{name}", target?.nickname ?? "Someone");
    });

    for (const player of this.participants) {
      this.scores.set(player.id, 0);
      this.roundWins.set(player.id, 0);
    }
    this.beginRound(1);
  }

  handleAction(playerId: string, action: unknown): Result<void> {
    if (!this.isParticipant(playerId)) return fail("NOT_A_PARTICIPANT");
    const parsed = roastActionSchema.safeParse(action);
    if (!parsed.success) return fail("INVALID_INPUT");
    const move = parsed.data;

    switch (move.type) {
      case "submit":
        return this.submit(playerId, move.text);
      case "vote":
        return this.castVote(playerId, move.answerId, null);
      case "rate":
        return this.castVote(playerId, move.answerId, move.stars);
      case "report":
        return this.report(playerId, move.answerId, move.reason ?? null);
    }
  }

  tick(now: number): boolean {
    const timeUp = this.stepEndsAt !== null && now >= this.stepEndsAt;
    switch (this.step) {
      case "writing":
        if (timeUp || this.everyoneConnectedSubmitted()) {
          this.startVoting();
          return true;
        }
        return false;
      case "voting":
        if (timeUp || this.everyoneEligibleVoted()) {
          this.closeVoting();
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

  viewFor(playerId: string): RoastView {
    const finished = this.step === "finished";
    return {
      gameId: "roast",
      step: this.step,
      round: this.round,
      totalRounds: this.plan.length,
      prompt: finished ? null : (this.plan[this.round - 1] ?? null),
      stepEndsAt: this.stepEndsAt,
      stepDurationMs: this.stepDurationMs,
      mode: this.mode,
      participants: this.participants.map((p) => ({ ...p })),
      submittedIds: this.participants.filter((p) => this.submissions.has(p.id)).map((p) => p.id),
      mySubmission: this.submissions.get(playerId) ?? null,
      // Anonymous: no author appears here. Only the viewer's own answer is marked.
      answers:
        this.step === "voting"
          ? this.answers.map((a) => ({ id: a.id, text: a.text, mine: a.authorId === playerId }))
          : [],
      votedIds: this.participants.filter((p) => this.votes.has(p.id)).map((p) => p.id),
      myVoteAnswerId: this.votes.get(playerId) ?? null,
      myStars: this.stars.get(playerId) ?? null,
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

    this.submissions.set(playerId, text);
    if (this.everyoneConnectedSubmitted()) this.startVoting();
    return done;
  }

  private castVote(playerId: string, answerId: string, stars: number | null): Result<void> {
    if (this.step !== "voting") return fail("WRONG_STEP");
    // "vote" is for pick mode and "rate" is for star mode. The wrong one for this game is refused.
    if ((stars === null) !== (this.mode === "pick")) return fail("WRONG_STEP");
    if (this.votes.has(playerId)) return fail("ALREADY_VOTED");

    const answer = this.answers.find((a) => a.id === answerId);
    if (!answer) return fail("ANSWER_NOT_FOUND");
    if (answer.authorId === playerId) return fail("CANNOT_VOTE_SELF");

    this.votes.set(playerId, answerId);
    if (stars !== null) this.stars.set(playerId, stars);
    if (this.everyoneEligibleVoted()) this.closeVoting();
    return done;
  }

  private report(playerId: string, answerId: string, reason: string | null): Result<void> {
    if (this.step !== "voting" && this.step !== "reveal") return fail("WRONG_STEP");
    const answer = this.answers.find((a) => a.id === answerId);
    if (!answer) return fail("ANSWER_NOT_FOUND");
    const key = `${this.round}:${playerId}:${answerId}`;
    if (this.reported.has(key)) return fail("ALREADY_DONE");
    this.reported.add(key);
    this.reportContent?.({ game: "roast", text: answer.text, reason });
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

  /** Players who are here and have at least one answer that is not their own to choose from. */
  private everyoneEligibleVoted(): boolean {
    const eligible = this.connectedParticipants().filter((p) =>
      this.answers.some((a) => a.authorId !== p.id),
    );
    return eligible.every((p) => this.votes.has(p.id));
  }

  private setStep(step: RoastView["step"], durationMs: number | null): void {
    this.step = step;
    this.stepDurationMs = durationMs;
    this.stepEndsAt = durationMs === null ? null : this.now() + durationMs;
  }

  private beginRound(round: number): void {
    this.round = round;
    this.submissions = new Map();
    this.answers = [];
    this.votes = new Map();
    this.stars = new Map();
    this.reveal = null;
    this.setStep("writing", this.config.writingMs);
  }

  private startVoting(): void {
    // Shuffle so the order gives nothing away. The ids carry no information about the writer.
    const entries = shuffle([...this.submissions.entries()], this.random);
    this.answers = entries.map(([authorId, text], index) => ({ id: `a${index + 1}`, authorId, text }));
    this.setStep("voting", this.config.votingMs);
    if (this.answers.length === 0 || this.everyoneEligibleVoted()) this.closeVoting();
  }

  private closeVoting(): void {
    const pick = this.mode === "pick";
    const rows = this.answers.map((answer) => {
      const voters: { voterId: string; value: number }[] = [];
      for (const [voterId, answerId] of this.votes) {
        if (answerId === answer.id) voters.push({ voterId, value: pick ? 1 : (this.stars.get(voterId) ?? 1) });
      }
      return { answer, voters, total: voters.reduce((sum, voter) => sum + voter.value, 0) };
    });

    const most = Math.max(0, ...rows.map((row) => row.total));
    const winnerIds = new Set(most > 0 ? rows.filter((row) => row.total === most).map((row) => row.answer.id) : []);

    const pointsGained: Record<string, number> = {};
    for (const player of this.participants) pointsGained[player.id] = 0;
    const revealRows: RoastReveal["answers"] = rows.map((row) => {
      const isWinner = winnerIds.has(row.answer.id);
      const points = pick ? row.total * VOTE_POINTS + (isWinner ? WINNER_BONUS : 0) : row.total;
      pointsGained[row.answer.authorId] = (pointsGained[row.answer.authorId] ?? 0) + points;
      if (isWinner) {
        this.roundWins.set(row.answer.authorId, (this.roundWins.get(row.answer.authorId) ?? 0) + 1);
      }
      if (row.total > 0 && (this.bestAnswer === null || row.total > this.bestAnswer.total)) {
        this.bestAnswer = {
          playerId: row.answer.authorId,
          text: row.answer.text,
          prompt: this.plan[this.round - 1] ?? "",
          total: row.total,
        };
      }
      return {
        id: row.answer.id,
        authorId: row.answer.authorId,
        text: row.answer.text,
        votes: row.voters,
        total: row.total,
        pointsGained: points,
        isWinner,
      };
    });
    revealRows.sort((a, b) => b.total - a.total);

    for (const player of this.participants) {
      this.scores.set(player.id, (this.scores.get(player.id) ?? 0) + (pointsGained[player.id] ?? 0));
    }
    this.reveal = {
      answers: revealRows,
      roundWinnerIds: revealRows.filter((row) => row.isWinner).map((row) => row.authorId),
      pointsGained,
    };
    this.setStep("reveal", this.config.revealMs);
  }

  private advance(): void {
    if (this.round >= this.plan.length) this.finish(false);
    else this.beginRound(this.round + 1);
  }

  private finish(endedEarly: boolean): void {
    const ordered = [...this.participants].sort(
      (a, b) =>
        (this.scores.get(b.id) ?? 0) - (this.scores.get(a.id) ?? 0) ||
        (this.roundWins.get(b.id) ?? 0) - (this.roundWins.get(a.id) ?? 0),
    );
    const ranking: RoastRanking[] = [];
    ordered.forEach((player, index) => {
      const score = this.scores.get(player.id) ?? 0;
      const roundWins = this.roundWins.get(player.id) ?? 0;
      const previous = ranking[index - 1];
      const rank =
        previous && previous.score === score && previous.roundWins === roundWins ? previous.rank : index + 1;
      ranking.push({ playerId: player.id, score, rank, roundWins });
    });

    const candidates: { id: RoastAwardId; title: string; values: Map<string, number> }[] = [
      { id: "funniest-human", title: "Funniest Human", values: this.scores },
      { id: "crowd-favorite", title: "Crowd Favorite", values: this.roundWins },
    ];
    const awards: RoastAward[] = [];
    for (const candidate of candidates) {
      const top = topOf(candidate.values, this.participants);
      if (top) awards.push({ id: candidate.id, title: candidate.title, ...top });
    }

    this.setStep("finished", null);
    this.reveal = null;
    this.results = { ranking, awards, bestAnswer: this.bestAnswer, endedEarly };
  }
}
