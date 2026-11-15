import {
  mltActionSchema,
  type MltAward,
  type MltAwardId,
  type MltCategory,
  type MltRanking,
  type MltReveal,
  type MltView,
  type RoomErrorCode,
} from "@chaos/shared";
import type { Result } from "../../rooms/types";
import type { GameContext, GameInstance, GamePlayer } from "../types";

export type MltQuestion = { id: string; category: MltCategory; text: string };

export type MltConfig = { rounds: number; voteMs: number; revealMs: number };
export const DEFAULT_MLT_CONFIG: MltConfig = { rounds: 8, voteMs: 20_000, revealMs: 8_000 };

export type MltContext = GameContext & {
  questions: MltQuestion[];
  config?: Partial<MltConfig>;
};

const fail = (error: RoomErrorCode): Result<void> => ({ ok: false, error });

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a === undefined || b === undefined) continue;
    copy[i] = b;
    copy[j] = a;
  }
  return copy;
}

/** Picks questions so the categories take turns, which gives every award a fair chance. */
export function pickQuestions(
  questions: MltQuestion[],
  rounds: number,
  random: () => number,
): MltQuestion[] {
  const byCategory = new Map<MltCategory, MltQuestion[]>();
  for (const question of questions) {
    const list = byCategory.get(question.category) ?? [];
    list.push(question);
    byCategory.set(question.category, list);
  }
  const order = shuffle([...byCategory.keys()], random);
  const pools = new Map<MltCategory, MltQuestion[]>();
  for (const category of order) {
    pools.set(category, shuffle(byCategory.get(category) ?? [], random));
  }

  const plan: MltQuestion[] = [];
  let cursor = 0;
  let emptyStreak = 0;
  while (plan.length < rounds && emptyStreak < order.length) {
    const category = order[cursor % order.length];
    cursor++;
    const next = category ? pools.get(category)?.pop() : undefined;
    if (next) {
      plan.push(next);
      emptyStreak = 0;
    } else {
      emptyStreak++;
    }
  }
  return plan;
}

/** The players with the highest value (above zero), or null if nobody scored. */
function topOf(
  values: Map<string, number> | undefined,
  participants: GamePlayer[],
): { playerIds: string[]; value: number } | null {
  if (!values) return null;
  let max = 0;
  for (const player of participants) max = Math.max(max, values.get(player.id) ?? 0);
  if (max <= 0) return null;
  return {
    playerIds: participants.filter((p) => (values.get(p.id) ?? 0) === max).map((p) => p.id),
    value: max,
  };
}

export class MostLikelyToGame implements GameInstance {
  readonly id = "most-likely-to" as const;

  private readonly participants: GamePlayer[];
  private readonly config: MltConfig;
  private readonly now: () => number;
  private readonly isConnected: (playerId: string) => boolean;
  private readonly plan: MltQuestion[];
  /** With only two players, voting for another player always ties, so voting for yourself is allowed. */
  private readonly allowSelfVote: boolean;

  private readonly scores = new Map<string, number>();
  private readonly stars = new Map<string, number>();
  private readonly votesReceived = new Map<string, number>();
  private readonly categoryVotes = new Map<MltCategory, Map<string, number>>();

  private votes = new Map<string, string>();
  private step: MltView["step"] = "voting";
  private round = 0;
  private stepEndsAt: number | null = null;
  private stepDurationMs: number | null = null;
  private reveal: MltReveal | null = null;
  private results: MltView["results"] = null;

  constructor(context: MltContext) {
    this.participants = context.players.map((player) => ({ ...player }));
    this.config = { ...DEFAULT_MLT_CONFIG, ...context.config };
    this.now = context.now;
    this.isConnected = context.isConnected;
    this.allowSelfVote = this.participants.length === 2;
    this.plan = pickQuestions(context.questions, this.config.rounds, context.random);
    if (this.plan.length === 0) throw new Error("Who's Most Likely To needs at least one question.");

    for (const player of this.participants) {
      this.scores.set(player.id, 0);
      this.stars.set(player.id, 0);
      this.votesReceived.set(player.id, 0);
    }
    this.beginRound(1);
  }

  handleAction(playerId: string, action: unknown): Result<void> {
    if (this.step !== "voting") return fail("VOTING_CLOSED");
    if (!this.isParticipant(playerId)) return fail("NOT_A_PARTICIPANT");
    const parsed = mltActionSchema.safeParse(action);
    if (!parsed.success) return fail("INVALID_INPUT");
    if (this.votes.has(playerId)) return fail("ALREADY_VOTED");

    const { targetId } = parsed.data;
    if (!this.isParticipant(targetId)) return fail("PLAYER_NOT_FOUND");
    if (targetId === playerId && !this.allowSelfVote) return fail("CANNOT_VOTE_SELF");

    this.votes.set(playerId, targetId);
    if (this.everyoneConnectedHasVoted()) this.closeVoting();
    return { ok: true, value: undefined };
  }

  tick(now: number): boolean {
    if (this.step === "voting") {
      const timeUp = this.stepEndsAt !== null && now >= this.stepEndsAt;
      if (timeUp || this.everyoneConnectedHasVoted()) {
        this.closeVoting();
        return true;
      }
      return false;
    }
    if (this.step === "reveal" && this.stepEndsAt !== null && now >= this.stepEndsAt) {
      this.advance();
      return true;
    }
    return false;
  }

  forceFinish(): void {
    if (this.step === "finished") return;
    this.finish(true);
  }

  isFinished(): boolean {
    return this.step === "finished";
  }

  viewFor(playerId: string): MltView {
    const question = this.step === "finished" ? null : (this.plan[this.round - 1] ?? null);
    return {
      gameId: "most-likely-to",
      step: this.step,
      round: this.round,
      totalRounds: this.plan.length,
      question: question?.text ?? null,
      category: question?.category ?? null,
      stepEndsAt: this.stepEndsAt,
      stepDurationMs: this.stepDurationMs,
      participants: this.participants.map((p) => ({ ...p })),
      votedIds: this.participants.filter((p) => this.votes.has(p.id)).map((p) => p.id),
      myVote: this.votes.get(playerId) ?? null,
      allowSelfVote: this.allowSelfVote,
      // Votes are only ever shown once voting has closed.
      reveal: this.step === "reveal" ? this.reveal : null,
      scores: Object.fromEntries(this.scores),
      results: this.results,
    };
  }

  // ---------- internals ----------

  private isParticipant(playerId: string): boolean {
    return this.participants.some((p) => p.id === playerId);
  }

  private everyoneConnectedHasVoted(): boolean {
    const connected = this.participants.filter((p) => this.isConnected(p.id));
    return connected.length > 0 && connected.every((p) => this.votes.has(p.id));
  }

  private beginRound(round: number): void {
    this.round = round;
    this.votes = new Map();
    this.reveal = null;
    this.step = "voting";
    this.stepEndsAt = this.now() + this.config.voteMs;
    this.stepDurationMs = this.config.voteMs;
  }

  private closeVoting(): void {
    const question = this.plan[this.round - 1];
    const counts: Record<string, number> = {};
    for (const player of this.participants) counts[player.id] = 0;

    const votes: MltReveal["votes"] = [];
    for (const player of this.participants) {
      const targetId = this.votes.get(player.id);
      if (targetId === undefined) continue;
      votes.push({ voterId: player.id, targetId });
      counts[targetId] = (counts[targetId] ?? 0) + 1;
    }

    const most = Math.max(0, ...Object.values(counts));
    const roundStarIds = most > 0 ? this.participants.filter((p) => counts[p.id] === most).map((p) => p.id) : [];

    const pointsGained: Record<string, number> = {};
    for (const player of this.participants) {
      const received = counts[player.id] ?? 0;
      const isStar = roundStarIds.includes(player.id);
      pointsGained[player.id] = received + (isStar ? 1 : 0);

      this.scores.set(player.id, (this.scores.get(player.id) ?? 0) + pointsGained[player.id]!);
      this.votesReceived.set(player.id, (this.votesReceived.get(player.id) ?? 0) + received);
      if (isStar) this.stars.set(player.id, (this.stars.get(player.id) ?? 0) + 1);
      if (question && received > 0) {
        const perPlayer = this.categoryVotes.get(question.category) ?? new Map<string, number>();
        perPlayer.set(player.id, (perPlayer.get(player.id) ?? 0) + received);
        this.categoryVotes.set(question.category, perPlayer);
      }
    }

    this.reveal = { votes, counts, roundStarIds, pointsGained };
    this.step = "reveal";
    this.stepEndsAt = this.now() + this.config.revealMs;
    this.stepDurationMs = this.config.revealMs;
  }

  private advance(): void {
    if (this.round >= this.plan.length) this.finish(false);
    else this.beginRound(this.round + 1);
  }

  private finish(endedEarly: boolean): void {
    const ordered = [...this.participants].sort(
      (a, b) =>
        (this.scores.get(b.id) ?? 0) - (this.scores.get(a.id) ?? 0) ||
        (this.stars.get(b.id) ?? 0) - (this.stars.get(a.id) ?? 0),
    );

    const ranking: MltRanking[] = [];
    ordered.forEach((player, index) => {
      const score = this.scores.get(player.id) ?? 0;
      const stars = this.stars.get(player.id) ?? 0;
      const previous = ranking[index - 1];
      const rank = previous && previous.score === score && previous.stars === stars ? previous.rank : index + 1;
      ranking.push({
        playerId: player.id,
        score,
        rank,
        stars,
        votesReceived: this.votesReceived.get(player.id) ?? 0,
      });
    });

    const candidates: { id: MltAwardId; title: string; values: Map<string, number> | undefined }[] = [
      { id: "most-voted", title: "Most Voted Player", values: this.votesReceived },
      { id: "main-character", title: "Main Character", values: this.stars },
      { id: "drama-queen", title: "Biggest Drama Queen", values: this.categoryVotes.get("drama") },
      { id: "most-suspicious", title: "Most Suspicious", values: this.categoryVotes.get("sneaky") },
      { id: "walking-disaster", title: "Walking Disaster", values: this.categoryVotes.get("accident") },
    ];
    const awards: MltAward[] = [];
    for (const candidate of candidates) {
      const top = topOf(candidate.values, this.participants);
      if (top) awards.push({ id: candidate.id, title: candidate.title, ...top });
    }

    this.step = "finished";
    this.stepEndsAt = null;
    this.stepDurationMs = null;
    this.reveal = null;
    this.results = { ranking, awards, endedEarly };
  }
}
