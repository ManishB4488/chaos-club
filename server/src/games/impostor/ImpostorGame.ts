import {
  impostorActionSchema,
  type ImpostorAward,
  type ImpostorAwardId,
  type ImpostorCategory,
  type ImpostorOutcome,
  type ImpostorRanking,
  type ImpostorSecret,
  type ImpostorView,
  type RoomErrorCode,
} from "@chaos/shared";
import { containsBlockedWord } from "../../moderation/profanity";
import type { Result } from "../../rooms/types";
import { pickRoundRobin, shuffle } from "../random";
import type { GameContext, GameInstance, GamePlayer } from "../types";

export type ImpostorWordPair = {
  id: string;
  category: ImpostorCategory;
  crew: string;
  impostor: string;
};

export type ImpostorConfig = {
  wordsMs: number;
  clueMs: number;
  discussionMs: number;
  voteMs: number;
  guessMs: number;
  resultMs: number;
};

export const DEFAULT_IMPOSTOR_CONFIG: ImpostorConfig = {
  wordsMs: 10_000,
  clueMs: 30_000,
  discussionMs: 45_000,
  voteMs: 20_000,
  guessMs: 20_000,
  resultMs: 10_000,
};

export type ImpostorContext = GameContext & {
  words: ImpostorWordPair[];
  config?: Partial<ImpostorConfig>;
};

type RoundPlan = {
  impostorId: string;
  category: ImpostorCategory;
  crewWord: string;
};

type RoundOutcome = {
  votes: { voterId: string; targetId: string }[];
  counts: Record<string, number>;
  caught: boolean;
  guess: string | null;
  guessCorrect: boolean | null;
  pointsGained: Record<string, number>;
};

const fail = (error: RoomErrorCode): Result<void> => ({ ok: false, error });
const done: Result<void> = { ok: true, value: undefined };

const CLUE_FORMAT = /^[\p{L}\p{N}'-]{1,24}$/u;
const CREW_VOTE_POINTS = 2;
const SURVIVAL_POINTS = 3;
const GUESS_POINTS = 2;

/** Ignores capitals, spaces, punctuation, accents and a final "s". */
export function normalizeWord(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .replace(/s$/, "");
}

/** The players with the highest value (above zero), or null if nobody has any. */
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

export class ImpostorGame implements GameInstance {
  readonly id = "impostor" as const;

  private readonly participants: GamePlayer[];
  private readonly config: ImpostorConfig;
  private readonly now: () => number;
  private readonly isConnected: (playerId: string) => boolean;
  private readonly random: () => number;
  private readonly plan: RoundPlan[];

  private readonly scores = new Map<string, number>();
  private readonly survivals = new Map<string, number>();
  private readonly correctVotes = new Map<string, number>();
  private readonly correctGuesses = new Map<string, number>();

  private step: ImpostorView["step"] = "words";
  private round = 0;
  private stepEndsAt: number | null = null;
  private stepDurationMs: number | null = null;
  private clueOrder: string[] = [];
  private clueIndex = 0;
  private clues: { playerId: string; text: string }[] = [];
  private ready = new Set<string>();
  private votes = new Map<string, string>();
  private outcome: RoundOutcome | null = null;
  private results: ImpostorView["results"] = null;

  constructor(context: ImpostorContext) {
    this.participants = context.players.map((player) => ({ ...player }));
    this.config = { ...DEFAULT_IMPOSTOR_CONFIG, ...context.config };
    this.now = context.now;
    this.isConnected = context.isConnected;
    this.random = context.random;

    // One round per player, so everybody is the impostor exactly once.
    const rounds = this.participants.length;
    const pairs = pickRoundRobin(context.words, rounds, context.random);
    if (pairs.length < rounds) throw new Error("The Impostor game needs more word pairs.");
    const impostors = shuffle(
      this.participants.map((p) => p.id),
      context.random,
    );
    this.plan = impostors.map((impostorId, index) => {
      const pair = pairs[index]!;
      const swap = context.random() < 0.5;
      return {
        impostorId,
        category: pair.category,
        // Either word of the pair can become the crew word. The other word is not used.
        crewWord: swap ? pair.impostor : pair.crew,
      };
    });

    for (const player of this.participants) {
      this.scores.set(player.id, 0);
      this.survivals.set(player.id, 0);
      this.correctVotes.set(player.id, 0);
      this.correctGuesses.set(player.id, 0);
    }
    this.beginRound(1);
  }

  handleAction(playerId: string, action: unknown): Result<void> {
    if (!this.isParticipant(playerId)) return fail("NOT_A_PARTICIPANT");
    const parsed = impostorActionSchema.safeParse(action);
    if (!parsed.success) return fail("INVALID_INPUT");
    const move = parsed.data;

    switch (move.type) {
      case "clue":
        return this.giveClue(playerId, move.text);
      case "ready":
        return this.markReady(playerId);
      case "vote":
        return this.castVote(playerId, move.targetId);
      case "guess":
        return this.makeGuess(playerId, move.text);
    }
  }

  tick(now: number): boolean {
    switch (this.step) {
      case "words":
        if (this.timeUp(now)) {
          this.startClues();
          return true;
        }
        return false;
      case "clues":
        return this.advanceClues(now);
      case "discussion":
        if (this.timeUp(now) || this.everyoneConnectedReady()) {
          this.startVoting();
          return true;
        }
        return false;
      case "voting":
        if (this.timeUp(now) || this.everyoneConnectedVoted()) {
          this.closeVoting();
          return true;
        }
        return false;
      case "guess":
        if (this.timeUp(now) || !this.isConnected(this.currentPlan().impostorId)) {
          this.settleGuess(null);
          return true;
        }
        return false;
      case "result":
        if (this.timeUp(now)) {
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
   * The ONLY way a player learns their role or word. The caller has already proven which player is asking.
   * The crew get the word. The impostor is told their role and is NEVER given the word.
   * Only available while the round is running; after that the word is public in the round result anyway.
   */
  secretFor(playerId: string): Result<ImpostorSecret> {
    if (!this.isParticipant(playerId)) return { ok: false, error: "NOT_A_PARTICIPANT" };
    if (!["words", "clues", "discussion", "voting", "guess"].includes(this.step)) {
      return { ok: false, error: "WRONG_STEP" };
    }
    const plan = this.currentPlan();
    const secret: ImpostorSecret =
      playerId === plan.impostorId
        ? { role: "impostor", word: null }
        : { role: "crew", word: plan.crewWord };
    return { ok: true, value: secret };
  }

  viewFor(playerId: string): ImpostorView {
    const finished = this.step === "finished";
    const plan = this.plan[this.round - 1];
    let outcome: ImpostorOutcome | null = null;
    if (this.outcome && plan && (this.step === "guess" || this.step === "result")) {
      const atResult = this.step === "result";
      outcome = {
        impostorId: plan.impostorId,
        caught: this.outcome.caught,
        votes: this.outcome.votes.map((vote) => ({ ...vote })),
        counts: { ...this.outcome.counts },
        crewWord: atResult ? plan.crewWord : null,
        guess: this.outcome.guess,
        guessCorrect: this.outcome.guessCorrect,
        pointsGained: atResult ? { ...this.outcome.pointsGained } : null,
      };
    }

    return {
      gameId: "impostor",
      step: this.step,
      round: this.round,
      totalRounds: this.plan.length,
      category: finished ? null : (plan?.category ?? null),
      stepEndsAt: this.stepEndsAt,
      stepDurationMs: this.stepDurationMs,
      participants: this.participants.map((p) => ({ ...p })),
      clueOrder: [...this.clueOrder],
      currentSpeakerId: this.step === "clues" ? (this.clueOrder[this.clueIndex] ?? null) : null,
      clues: this.clues.map((clue) => ({ ...clue })),
      readyIds: this.step === "discussion" ? [...this.ready] : [],
      votedIds: this.participants.filter((p) => this.votes.has(p.id)).map((p) => p.id),
      myVote: this.votes.get(playerId) ?? null,
      outcome,
      scores: Object.fromEntries(this.scores),
      results: this.results,
    };
  }

  // ---------- actions ----------

  private giveClue(playerId: string, text: string): Result<void> {
    if (this.step !== "clues") return fail("WRONG_STEP");
    if (this.clueOrder[this.clueIndex] !== playerId) return fail("NOT_YOUR_TURN");

    const clue = text.trim();
    if (!CLUE_FORMAT.test(clue) || containsBlockedWord(clue)) return fail("CLUE_NOT_ALLOWED");

    const plan = this.currentPlan();
    // The impostor has no word, so there is nothing for their clue to give away.
    if (playerId !== plan.impostorId) {
      const ownWord = normalizeWord(plan.crewWord);
      const normalized = normalizeWord(clue);
      if (normalized.includes(ownWord) || (normalized.length >= 3 && ownWord.includes(normalized))) {
        return fail("CLUE_NOT_ALLOWED");
      }
    }

    this.clues.push({ playerId, text: clue });
    this.nextSpeaker();
    return done;
  }

  private markReady(playerId: string): Result<void> {
    if (this.step !== "discussion") return fail("WRONG_STEP");
    if (this.ready.has(playerId)) return fail("ALREADY_DONE");
    this.ready.add(playerId);
    if (this.everyoneConnectedReady()) this.startVoting();
    return done;
  }

  private castVote(playerId: string, targetId: string): Result<void> {
    if (this.step !== "voting") return fail("WRONG_STEP");
    if (this.votes.has(playerId)) return fail("ALREADY_VOTED");
    if (!this.isParticipant(targetId)) return fail("PLAYER_NOT_FOUND");
    if (targetId === playerId) return fail("CANNOT_VOTE_SELF");

    this.votes.set(playerId, targetId);
    if (this.everyoneConnectedVoted()) this.closeVoting();
    return done;
  }

  private makeGuess(playerId: string, text: string): Result<void> {
    if (this.step !== "guess") return fail("WRONG_STEP");
    if (playerId !== this.currentPlan().impostorId) return fail("NOT_YOUR_TURN");
    if (containsBlockedWord(text)) return fail("CLUE_NOT_ALLOWED");
    this.settleGuess(text.trim());
    return done;
  }

  // ---------- flow ----------

  private currentPlan(): RoundPlan {
    const plan = this.plan[this.round - 1];
    if (!plan) throw new Error("No round is active.");
    return plan;
  }

  private isParticipant(playerId: string): boolean {
    return this.participants.some((p) => p.id === playerId);
  }

  private timeUp(now: number): boolean {
    return this.stepEndsAt !== null && now >= this.stepEndsAt;
  }

  private connectedParticipants(): GamePlayer[] {
    return this.participants.filter((p) => this.isConnected(p.id));
  }

  private everyoneConnectedReady(): boolean {
    const connected = this.connectedParticipants();
    return connected.length > 0 && connected.every((p) => this.ready.has(p.id));
  }

  private everyoneConnectedVoted(): boolean {
    const connected = this.connectedParticipants();
    return connected.length > 0 && connected.every((p) => this.votes.has(p.id));
  }

  private setStep(step: ImpostorView["step"], durationMs: number | null): void {
    this.step = step;
    this.stepDurationMs = durationMs;
    this.stepEndsAt = durationMs === null ? null : this.now() + durationMs;
  }

  private beginRound(round: number): void {
    this.round = round;
    this.clueOrder = [];
    this.clueIndex = 0;
    this.clues = [];
    this.ready = new Set();
    this.votes = new Map();
    this.outcome = null;
    this.setStep("words", this.config.wordsMs);
  }

  private startClues(): void {
    this.clueOrder = shuffle(
      this.participants.map((p) => p.id),
      this.random,
    );
    this.clueIndex = 0;
    this.setStep("clues", this.config.clueMs);
  }

  /** Skips speakers who are offline or out of time. Returns true if anything changed. */
  private advanceClues(now: number): boolean {
    let changed = false;
    while (this.step === "clues") {
      const speaker = this.clueOrder[this.clueIndex];
      if (speaker === undefined) {
        this.startDiscussion();
        return true;
      }
      if (this.timeUp(now) || !this.isConnected(speaker)) {
        this.nextSpeaker();
        changed = true;
        continue;
      }
      break;
    }
    return changed;
  }

  private nextSpeaker(): void {
    this.clueIndex++;
    if (this.clueIndex >= this.clueOrder.length) this.startDiscussion();
    else this.setStep("clues", this.config.clueMs);
  }

  private startDiscussion(): void {
    this.ready = new Set();
    this.setStep("discussion", this.config.discussionMs);
  }

  private startVoting(): void {
    this.votes = new Map();
    this.setStep("voting", this.config.voteMs);
  }

  private closeVoting(): void {
    const plan = this.currentPlan();
    const counts: Record<string, number> = {};
    for (const player of this.participants) counts[player.id] = 0;
    const votes: RoundOutcome["votes"] = [];
    for (const player of this.participants) {
      const targetId = this.votes.get(player.id);
      if (targetId === undefined) continue;
      votes.push({ voterId: player.id, targetId });
      counts[targetId] = (counts[targetId] ?? 0) + 1;
    }

    // The impostor is caught only when they alone have the most votes.
    const most = Math.max(0, ...Object.values(counts));
    const top = most > 0 ? this.participants.filter((p) => counts[p.id] === most) : [];
    const caught = top.length === 1 && top[0]?.id === plan.impostorId;

    const pointsGained: Record<string, number> = {};
    for (const player of this.participants) pointsGained[player.id] = 0;
    for (const vote of votes) {
      if (vote.targetId === plan.impostorId && vote.voterId !== plan.impostorId) {
        pointsGained[vote.voterId] = (pointsGained[vote.voterId] ?? 0) + CREW_VOTE_POINTS;
        this.bump(this.correctVotes, vote.voterId, 1);
      }
    }
    if (!caught) {
      pointsGained[plan.impostorId] = (pointsGained[plan.impostorId] ?? 0) + SURVIVAL_POINTS;
      this.bump(this.survivals, plan.impostorId, 1);
    }
    for (const player of this.participants) this.bump(this.scores, player.id, pointsGained[player.id] ?? 0);

    this.outcome = { votes, counts, caught, guess: null, guessCorrect: null, pointsGained };
    if (caught) this.setStep("guess", this.config.guessMs);
    else this.setStep("result", this.config.resultMs);
  }

  /** The caught impostor's one guess at the crew's word (or null if none was made). */
  private settleGuess(guess: string | null): void {
    const outcome = this.outcome;
    if (outcome) {
      const plan = this.currentPlan();
      outcome.guess = guess;
      outcome.guessCorrect = guess === null ? false : normalizeWord(guess) === normalizeWord(plan.crewWord);
      if (outcome.guessCorrect) {
        outcome.pointsGained[plan.impostorId] = (outcome.pointsGained[plan.impostorId] ?? 0) + GUESS_POINTS;
        this.bump(this.scores, plan.impostorId, GUESS_POINTS);
        this.bump(this.correctGuesses, plan.impostorId, 1);
      }
    }
    this.setStep("result", this.config.resultMs);
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
        (this.survivals.get(b.id) ?? 0) - (this.survivals.get(a.id) ?? 0),
    );
    const ranking: ImpostorRanking[] = [];
    ordered.forEach((player, index) => {
      const score = this.scores.get(player.id) ?? 0;
      const survivals = this.survivals.get(player.id) ?? 0;
      const previous = ranking[index - 1];
      const rank =
        previous && previous.score === score && previous.survivals === survivals ? previous.rank : index + 1;
      ranking.push({
        playerId: player.id,
        score,
        rank,
        survivals,
        correctVotes: this.correctVotes.get(player.id) ?? 0,
      });
    });

    const candidates: { id: ImpostorAwardId; title: string; values: Map<string, number> }[] = [
      { id: "master-of-disguise", title: "Master of Disguise", values: this.survivals },
      { id: "sharpest-detective", title: "Sharpest Detective", values: this.correctVotes },
      { id: "smooth-operator", title: "Smooth Operator", values: this.correctGuesses },
    ];
    const awards: ImpostorAward[] = [];
    for (const candidate of candidates) {
      const top = topOf(candidate.values, this.participants);
      if (top) awards.push({ id: candidate.id, title: candidate.title, ...top });
    }

    this.setStep("finished", null);
    this.results = { ranking, awards, endedEarly };
  }
}
