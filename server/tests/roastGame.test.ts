import { describe, expect, it } from "vitest";
import type { RoomErrorCode } from "@chaos/shared";
import { RoastGame, type RoastConfig, type RoastPrompt } from "../src/games/roast/RoastGame";
import type { ContentReportEntry } from "../src/games/types";
import type { Result } from "../src/rooms/types";
import { seededRandom } from "./helpers";

const CONFIG: RoastConfig = { rounds: 2, writingMs: 4_000, votingMs: 3_000, revealMs: 2_000 };

const PROMPTS: RoastPrompt[] = [
  { id: "r1", category: "about", text: "{name} gets arrested. What is the most likely reason?" },
  { id: "r2", category: "general", text: "What is the worst name for a superhero?" },
  { id: "r3", category: "about", text: "What would {name} name their autobiography?" },
  { id: "r4", category: "general", text: "What should never be served at a birthday party?" },
];

function expectError(result: Result<void>, error: RoomErrorCode): void {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe(error);
}

function setup(playerCount = 3, config: Partial<RoastConfig> = {}) {
  let time = 1_000_000;
  const ids = ["a", "b", "c", "d"].slice(0, playerCount);
  const players = ids.map((id) => ({
    id,
    nickname: `Player${id.toUpperCase()}`,
    avatar: "cat" as const,
    color: "grape" as const,
  }));
  const connected = new Set(ids);
  const reports: Array<Omit<ContentReportEntry, "roomCode" | "createdAt">> = [];
  const game = new RoastGame({
    players,
    prompts: PROMPTS,
    now: () => time,
    random: seededRandom(5),
    isConnected: (id) => connected.has(id),
    reportContent: (entry) => reports.push(entry),
    config: { ...CONFIG, ...config },
  });
  return {
    game,
    ids,
    connected,
    reports,
    advance: (ms: number) => {
      time += ms;
      return game.tick(time);
    },
  };
}

type Setup = ReturnType<typeof setup>;

const act = (game: RoastGame, id: string, action: unknown) => game.handleAction(id, action);
const submit = (s: Setup, id: string, text = `answer from ${id}`) => act(s.game, id, { type: "submit", text });
const submitAll = (s: Setup) => s.ids.forEach((id) => submit(s, id));

/** Each player knows which anonymous answer is theirs: the one marked "mine". */
const myAnswerId = (s: Setup, id: string) => s.game.viewFor(id).answers.find((a) => a.mine)?.id ?? "";

describe("starting", () => {
  it("opens round 1 with a prompt, filling in a player's name when the prompt is about a player", () => {
    const s = setup();
    const view = s.game.viewFor("a");
    expect(view.step).toBe("writing");
    expect(view.round).toBe(1);
    expect(view.totalRounds).toBe(2);
    expect(view.prompt).not.toContain("{name}");
    for (const round of [1, 2]) {
      expect(s.game.viewFor("a").prompt).not.toBeNull();
      submitAll(s);
      s.advance(CONFIG.votingMs);
      s.advance(CONFIG.revealMs);
      void round;
    }
  });

  it("uses picking with 3 or 4 players and star ratings with 2", () => {
    expect(setup(3).game.viewFor("a").mode).toBe("pick");
    expect(setup(4).game.viewFor("a").mode).toBe("pick");
    expect(setup(2).game.viewFor("a").mode).toBe("stars");
  });
});

describe("writing answers", () => {
  it("accepts one friendly answer each, and keeps it private to its writer", () => {
    const s = setup();
    expect(submit(s, "a", "  a   funny   answer ").ok).toBe(true);
    expect(s.game.viewFor("a").mySubmission).toBe("a funny answer");
    expect(s.game.viewFor("b").mySubmission).toBeNull();
    expect(s.game.viewFor("b").submittedIds).toEqual(["a"]);
    expect(JSON.stringify(s.game.viewFor("b"))).not.toContain("a funny answer");
    expectError(submit(s, "a", "again"), "ALREADY_DONE");
  });

  it("rejects empty, blocked and out-of-place submissions", () => {
    const s = setup();
    expectError(act(s.game, "a", { type: "submit", text: "   " }), "INVALID_INPUT");
    expectError(act(s.game, "a", { type: "submit", text: "x".repeat(141) }), "INVALID_INPUT");
    expectError(submit(s, "a", "what the fuck"), "CONTENT_NOT_ALLOWED");
    expectError(act(s.game, "outsider", { type: "submit", text: "hi" }), "NOT_A_PARTICIPANT");
    expectError(act(s.game, "a", { type: "vote", answerId: "a1" }), "WRONG_STEP");
  });

  it("starts voting when everyone has answered, or when time runs out", () => {
    const early = setup();
    submitAll(early);
    expect(early.game.viewFor("a").step).toBe("voting");

    const late = setup();
    submit(late, "a");
    submit(late, "b");
    expect(late.advance(CONFIG.writingMs)).toBe(true);
    const view = late.game.viewFor("a");
    expect(view.step).toBe("voting");
    expect(view.answers).toHaveLength(2);
  });

  it("skips voting if nobody wrote anything", () => {
    const s = setup();
    s.advance(CONFIG.writingMs);
    const view = s.game.viewFor("a");
    expect(view.step).toBe("reveal");
    expect(view.reveal?.answers).toEqual([]);
    expect(view.scores).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("does not wait for a player who is offline", () => {
    const s = setup();
    s.connected.delete("c");
    submit(s, "a");
    submit(s, "b");
    expect(s.game.viewFor("a").step).toBe("voting");
  });
});

describe("voting by picking (3 or 4 players)", () => {
  it("shows answers without names, marking only your own", () => {
    const s = setup();
    submitAll(s);
    for (const id of s.ids) {
      const view = s.game.viewFor(id);
      expect(view.answers).toHaveLength(3);
      expect(view.answers.filter((a) => a.mine)).toHaveLength(1);
      const json = JSON.stringify(view);
      expect(json).not.toContain("authorId");
      expect(json).not.toContain("voterId");
    }
  });

  it("has rules, and keeps votes secret until voting closes", () => {
    const s = setup();
    submitAll(s);
    const mine = myAnswerId(s, "a");
    const other = s.game.viewFor("a").answers.find((x) => !x.mine)?.id ?? "";
    expectError(act(s.game, "a", { type: "vote", answerId: mine }), "CANNOT_VOTE_SELF");
    expectError(act(s.game, "a", { type: "vote", answerId: "zzz" }), "ANSWER_NOT_FOUND");
    expectError(act(s.game, "a", { type: "rate", answerId: other, stars: 2 }), "WRONG_STEP");
    expect(act(s.game, "a", { type: "vote", answerId: other }).ok).toBe(true);
    expectError(act(s.game, "a", { type: "vote", answerId: other }), "ALREADY_VOTED");
    expect(s.game.viewFor("b").votedIds).toEqual(["a"]);
    expect(s.game.viewFor("b").reveal).toBeNull();
  });

  it("gives 2 points per vote, plus 1 to the answer with the most votes", () => {
    const s = setup();
    submitAll(s);
    // a and c vote for b's answer. b votes for a's answer.
    act(s.game, "a", { type: "vote", answerId: myAnswerId(s, "b") });
    act(s.game, "c", { type: "vote", answerId: myAnswerId(s, "b") });
    act(s.game, "b", { type: "vote", answerId: myAnswerId(s, "a") });

    const view = s.game.viewFor("a");
    expect(view.step).toBe("reveal");
    expect(view.reveal?.roundWinnerIds).toEqual(["b"]);
    expect(view.reveal?.pointsGained).toEqual({ a: 2, b: 5, c: 0 });
    expect(view.scores).toEqual({ a: 2, b: 5, c: 0 });
    const winning = view.reveal?.answers[0];
    expect(winning?.authorId).toBe("b");
    expect(winning?.votes.map((v) => v.voterId).sort()).toEqual(["a", "c"]);
  });

  it("shares the bonus when answers tie", () => {
    const s = setup();
    submitAll(s);
    const ring = ["b", "c", "a"];
    s.ids.forEach((id, i) => act(s.game, id, { type: "vote", answerId: myAnswerId(s, ring[i] ?? "") }));
    const view = s.game.viewFor("a");
    expect(view.reveal?.roundWinnerIds.sort()).toEqual(["a", "b", "c"]);
    expect(view.scores).toEqual({ a: 3, b: 3, c: 3 });
  });

  it("closes voting when time runs out", () => {
    const s = setup();
    submitAll(s);
    act(s.game, "a", { type: "vote", answerId: myAnswerId(s, "b") });
    expect(s.advance(CONFIG.votingMs)).toBe(true);
    expect(s.game.viewFor("c").step).toBe("reveal");
    expect(s.game.viewFor("c").scores).toEqual({ a: 0, b: 3, c: 0 });
  });
});

describe("rating by stars (2 players)", () => {
  it("scores the stars each answer receives, with no bonus", () => {
    const s = setup(2);
    submitAll(s);
    expectError(act(s.game, "a", { type: "vote", answerId: myAnswerId(s, "b") }), "WRONG_STEP");
    expectError(act(s.game, "a", { type: "rate", answerId: myAnswerId(s, "a"), stars: 2 }), "CANNOT_VOTE_SELF");
    expectError(act(s.game, "a", { type: "rate", answerId: myAnswerId(s, "b"), stars: 4 }), "INVALID_INPUT");

    act(s.game, "a", { type: "rate", answerId: myAnswerId(s, "b"), stars: 3 });
    act(s.game, "b", { type: "rate", answerId: myAnswerId(s, "a"), stars: 1 });
    const view = s.game.viewFor("a");
    expect(view.step).toBe("reveal");
    expect(view.scores).toEqual({ a: 1, b: 3 });
    expect(view.reveal?.roundWinnerIds).toEqual(["b"]);
  });
});

describe("reporting", () => {
  it("passes a report on once per answer, and only while answers are showing", () => {
    const s = setup();
    expectError(act(s.game, "a", { type: "report", answerId: "a1" }), "WRONG_STEP");
    submitAll(s);
    const target = s.game.viewFor("a").answers.find((x) => !x.mine);
    expect(act(s.game, "a", { type: "report", answerId: target?.id ?? "", reason: "rude" }).ok).toBe(true);
    expectError(act(s.game, "a", { type: "report", answerId: target?.id ?? "" }), "ALREADY_DONE");
    expectError(act(s.game, "a", { type: "report", answerId: "zzz" }), "ANSWER_NOT_FOUND");
    expect(s.reports).toEqual([{ game: "roast", text: target?.text, reason: "rude" }]);
  });
});

describe("the whole game", () => {
  it("moves through the rounds, then ranks players, shares ties and names a best answer", () => {
    const s = setup();
    for (let round = 1; round <= 2; round++) {
      submitAll(s);
      const ring = ["b", "c", "a"];
      s.ids.forEach((id, i) => act(s.game, id, { type: "vote", answerId: myAnswerId(s, ring[i] ?? "") }));
      expect(s.game.viewFor("a").step).toBe("reveal");
      s.advance(CONFIG.revealMs);
    }
    const view = s.game.viewFor("a");
    expect(view.step).toBe("finished");
    expect(view.prompt).toBeNull();
    expect(view.results?.ranking.map((r) => r.score)).toEqual([6, 6, 6]);
    expect(view.results?.ranking.map((r) => r.rank)).toEqual([1, 1, 1]);
    expect(view.results?.awards.map((a) => a.id)).toEqual(["funniest-human", "crowd-favorite"]);
    expect(view.results?.bestAnswer?.text).toMatch(/^answer from /);
    expect(view.results?.bestAnswer?.prompt.length).toBeGreaterThan(5);
  });

  it("can be ended early", () => {
    const s = setup();
    s.game.forceFinish();
    expect(s.game.isFinished()).toBe(true);
    expect(s.game.viewFor("a").results?.endedEarly).toBe(true);
  });
});
