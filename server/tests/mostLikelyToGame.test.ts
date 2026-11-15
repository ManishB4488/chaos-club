import { describe, expect, it } from "vitest";
import { MLT_CATEGORIES, type RoomErrorCode } from "@chaos/shared";
import {
  MostLikelyToGame,
  pickQuestions,
  type MltConfig,
  type MltQuestion,
} from "../src/games/mostLikelyTo/MostLikelyToGame";
import type { Result } from "../src/rooms/types";
import { sampleQuestions, seededRandom } from "./helpers";

function expectError(result: Result<void>, error: RoomErrorCode): void {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe(error);
}

function setup(playerCount = 3, config: Partial<MltConfig> = {}, questions: MltQuestion[] = sampleQuestions()) {
  let time = 1_000_000;
  const players = ["A", "B", "C", "D"].slice(0, playerCount).map((name) => ({
    id: name.toLowerCase(),
    nickname: name,
    avatar: "cat" as const,
    color: "grape" as const,
  }));
  const connected = new Set(players.map((p) => p.id));
  const game = new MostLikelyToGame({
    players,
    questions,
    now: () => time,
    random: seededRandom(7),
    isConnected: (id) => connected.has(id),
    config: { rounds: 3, voteMs: 10_000, revealMs: 5_000, ...config },
  });
  return {
    game,
    connected,
    /** Moves the clock forward and lets the game react, like the server's timer does. */
    advance: (ms: number) => {
      time += ms;
      return game.tick(time);
    },
  };
}

const vote = (game: MostLikelyToGame, voter: string, target: string) =>
  game.handleAction(voter, { type: "vote", targetId: target });

describe("starting", () => {
  it("opens round 1 with a question and nobody voted", () => {
    const { game } = setup();
    const view = game.viewFor("a");
    expect(view.step).toBe("voting");
    expect(view.round).toBe(1);
    expect(view.totalRounds).toBe(3);
    expect(view.question).toMatch(/Who is most likely to/);
    expect(view.votedIds).toEqual([]);
    expect(view.allowSelfVote).toBe(false);
    expect(view.stepDurationMs).toBe(10_000);
    expect(view.scores).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("never plans more rounds than there are questions", () => {
    const { game } = setup(3, { rounds: 10 }, sampleQuestions(1));
    expect(game.viewFor("a").totalRounds).toBe(5);
  });

  it("lets the categories take turns", () => {
    const { game, advance } = setup(3, { rounds: 5 });
    const seen: string[] = [];
    for (let round = 1; round <= 5; round++) {
      seen.push(game.viewFor("a").category ?? "none");
      advance(10_000);
      advance(5_000);
    }
    expect(new Set(seen).size).toBe(5);
    expect(pickQuestions(sampleQuestions(), 5, seededRandom(3)).map((q) => q.category).sort()).toEqual(
      [...MLT_CATEGORIES].sort(),
    );
  });
});

describe("voting rules", () => {
  it("does not allow voting for yourself with 3 players, but does with 2", () => {
    expectError(vote(setup(3).game, "a", "a"), "CANNOT_VOTE_SELF");
    const two = setup(2);
    expect(vote(two.game, "a", "a").ok).toBe(true);
    expect(two.game.viewFor("a").allowSelfVote).toBe(true);
  });

  it("rejects bad votes", () => {
    const { game } = setup();
    expectError(vote(game, "a", "nobody"), "PLAYER_NOT_FOUND");
    expectError(game.handleAction("outsider", { type: "vote", targetId: "b" }), "NOT_A_PARTICIPANT");
    expectError(game.handleAction("a", { type: "vote" }), "INVALID_INPUT");
    expectError(game.handleAction("a", { type: "vote", targetId: "b", extra: 1 }), "INVALID_INPUT");
  });

  it("rejects a second vote in the same round", () => {
    const { game } = setup();
    expect(vote(game, "a", "b").ok).toBe(true);
    expectError(vote(game, "a", "c"), "ALREADY_VOTED");
  });

  it("keeps votes secret until everyone has voted", () => {
    const { game } = setup();
    vote(game, "a", "b");
    const seenByB = game.viewFor("b");
    expect(seenByB.votedIds).toEqual(["a"]);
    expect(seenByB.myVote).toBeNull();
    expect(seenByB.reveal).toBeNull();
    expect(JSON.stringify(seenByB)).not.toContain("targetId");
    expect(game.viewFor("a").myVote).toBe("b");
  });

  it("refuses votes once voting has closed", () => {
    const { game } = setup();
    vote(game, "a", "b");
    vote(game, "b", "a");
    vote(game, "c", "a");
    expect(game.viewFor("a").step).toBe("reveal");
    expectError(vote(game, "a", "c"), "VOTING_CLOSED");
  });
});

describe("scoring a round", () => {
  it("gives one point per vote and a bonus point to the Round Star", () => {
    const { game } = setup();
    vote(game, "a", "b");
    vote(game, "c", "b");
    vote(game, "b", "a");
    const view = game.viewFor("a");
    expect(view.step).toBe("reveal");
    expect(view.reveal?.counts).toEqual({ a: 1, b: 2, c: 0 });
    expect(view.reveal?.roundStarIds).toEqual(["b"]);
    expect(view.reveal?.pointsGained).toEqual({ a: 1, b: 3, c: 0 });
    expect(view.reveal?.votes).toHaveLength(3);
    expect(view.scores).toEqual({ a: 1, b: 3, c: 0 });
  });

  it("makes everyone a Round Star when votes tie", () => {
    const { game } = setup();
    vote(game, "a", "b");
    vote(game, "b", "c");
    vote(game, "c", "a");
    const view = game.viewFor("a");
    expect(view.reveal?.roundStarIds.sort()).toEqual(["a", "b", "c"]);
    expect(view.reveal?.pointsGained).toEqual({ a: 2, b: 2, c: 2 });
  });

  it("closes voting when time runs out and scores the votes that exist", () => {
    const { game, advance } = setup();
    vote(game, "a", "b");
    expect(advance(9_999)).toBe(false);
    expect(advance(1)).toBe(true);
    const view = game.viewFor("c");
    expect(view.step).toBe("reveal");
    expect(view.reveal?.pointsGained).toEqual({ a: 0, b: 2, c: 0 });
  });

  it("gives nobody anything when nobody voted", () => {
    const { game, advance } = setup();
    advance(10_000);
    const view = game.viewFor("a");
    expect(view.reveal?.roundStarIds).toEqual([]);
    expect(view.scores).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("moves to the next round after the reveal", () => {
    const { game, advance } = setup();
    const first = game.viewFor("a").question;
    advance(10_000);
    advance(5_000);
    const view = game.viewFor("a");
    expect(view.step).toBe("voting");
    expect(view.round).toBe(2);
    expect(view.question).not.toBe(first);
    expect(view.votedIds).toEqual([]);
    expect(view.reveal).toBeNull();
  });
});

describe("players who are offline", () => {
  it("does not wait for a disconnected player", () => {
    const { game, connected } = setup();
    connected.delete("c");
    vote(game, "a", "b");
    vote(game, "b", "a");
    expect(game.viewFor("a").step).toBe("reveal");
  });

  it("closes voting when the last missing voter drops out", () => {
    const { game, connected, advance } = setup();
    vote(game, "a", "b");
    vote(game, "b", "a");
    expect(game.viewFor("a").step).toBe("voting");
    connected.delete("c");
    expect(advance(0)).toBe(true);
    expect(game.viewFor("a").step).toBe("reveal");
  });
});

describe("finishing", () => {
  function playRound(game: MostLikelyToGame, advance: (ms: number) => boolean) {
    vote(game, "a", "b");
    vote(game, "c", "b");
    vote(game, "b", "a");
    advance(5_000);
  }

  it("ranks players, ending after the last round", () => {
    const { game, advance } = setup(3, { rounds: 2 });
    playRound(game, advance);
    playRound(game, advance);
    const view = game.viewFor("a");
    expect(view.step).toBe("finished");
    expect(game.isFinished()).toBe(true);
    expect(view.question).toBeNull();
    expect(view.results?.endedEarly).toBe(false);
    expect(view.results?.ranking.map((r) => r.playerId)).toEqual(["b", "a", "c"]);
    expect(view.results?.ranking.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(view.results?.ranking[0]).toMatchObject({ score: 6, stars: 2, votesReceived: 4 });
  });

  it("shares a rank when score and Round Stars are equal", () => {
    const { game, advance } = setup(3, { rounds: 1 });
    vote(game, "a", "b");
    vote(game, "b", "c");
    vote(game, "c", "a");
    advance(5_000);
    expect(game.viewFor("a").results?.ranking.map((r) => r.rank)).toEqual([1, 1, 1]);
  });

  it("hands out awards only to players who earned them, with ties shared", () => {
    const dramaOnly = sampleQuestions().filter((q) => q.category === "drama");
    const { game, advance } = setup(3, { rounds: 2 }, dramaOnly);
    playRound(game, advance);
    playRound(game, advance);
    const awards = game.viewFor("a").results?.awards ?? [];
    const byId = Object.fromEntries(awards.map((a) => [a.id, a]));
    expect(byId["most-voted"]).toMatchObject({ playerIds: ["b"], value: 4 });
    expect(byId["main-character"]).toMatchObject({ playerIds: ["b"], value: 2 });
    expect(byId["drama-queen"]).toMatchObject({ playerIds: ["b"], value: 4 });
    expect(byId["most-suspicious"]).toBeUndefined();
    expect(byId["walking-disaster"]).toBeUndefined();
  });

  it("can be ended early, showing the scores so far", () => {
    const { game } = setup();
    vote(game, "a", "b");
    game.forceFinish();
    const view = game.viewFor("a");
    expect(view.step).toBe("finished");
    expect(view.results?.endedEarly).toBe(true);
    expect(game.isFinished()).toBe(true);
  });
});
