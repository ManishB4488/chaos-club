import { describe, expect, it } from "vitest";
import type { RoomErrorCode } from "@chaos/shared";
import {
  FakeAnswerGame,
  normalizeAnswer,
  type FakeAnswerConfig,
  type FakeAnswerQuestion,
} from "../src/games/fakeAnswer/FakeAnswerGame";
import type { ContentReportEntry } from "../src/games/types";
import type { Result } from "../src/rooms/types";
import { seededRandom } from "./helpers";

const CONFIG: FakeAnswerConfig = { rounds: 1, writingMs: 4_000, choosingMs: 3_000, revealMs: 2_000 };

const MERCURY: FakeAnswerQuestion = {
  id: "q1",
  category: "science",
  question: "Which metal is liquid at room temperature?",
  answer: "Mercury",
  alsoAccept: [],
};
const FLAMINGO: FakeAnswerQuestion = {
  id: "q2",
  category: "animals",
  question: "What is a group of flamingos called?",
  answer: "A flamboyance",
  alsoAccept: ["flamboyance"],
};

function expectError(result: Result<void>, error: RoomErrorCode): void {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe(error);
}

function setup(playerCount = 3, config: Partial<FakeAnswerConfig> = {}, questions = [MERCURY]) {
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
  const game = new FakeAnswerGame({
    players,
    questions,
    now: () => time,
    random: seededRandom(3),
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

const act = (game: FakeAnswerGame, id: string, action: unknown) => game.handleAction(id, action);
const submit = (s: Setup, id: string, text: string) => act(s.game, id, { type: "submit", text });
const optionId = (s: Setup, viewer: string, text: string) =>
  s.game.viewFor(viewer).options.find((o) => o.text === text)?.id ?? "";
const choose = (s: Setup, id: string, option: string) => act(s.game, id, { type: "choose", optionId: option });

/** The real answer's option id, as a player would find it: it is the option with the known answer text. */
const realOption = (s: Setup, viewer: string, answer = "Mercury") => optionId(s, viewer, answer);

describe("writing", () => {
  it("starts with a question and keeps the real answer out of every view", () => {
    const s = setup();
    for (const id of s.ids) {
      const view = s.game.viewFor(id);
      expect(view.step).toBe("writing");
      expect(view.question).toBe(MERCURY.question);
      expect(JSON.stringify(view)).not.toContain("Mercury");
      expect(view.options).toEqual([]);
    }
  });

  it("accepts one friendly fake each, and keeps it private to its writer", () => {
    const s = setup();
    expect(submit(s, "a", "  Gallium  ").ok).toBe(true);
    expect(s.game.viewFor("a").mySubmission).toBe("Gallium");
    expect(s.game.viewFor("b").mySubmission).toBeNull();
    expect(JSON.stringify(s.game.viewFor("b"))).not.toContain("Gallium");
    expectError(submit(s, "a", "again"), "ALREADY_DONE");
  });

  it("rejects empty, blocked and out-of-place submissions", () => {
    const s = setup();
    expectError(act(s.game, "a", { type: "submit", text: "   " }), "INVALID_INPUT");
    expectError(act(s.game, "a", { type: "submit", text: "x".repeat(61) }), "INVALID_INPUT");
    expectError(submit(s, "a", "what the fuck"), "CONTENT_NOT_ALLOWED");
    expectError(act(s.game, "outsider", { type: "submit", text: "hi" }), "NOT_A_PARTICIPANT");
    expectError(choose(s, "a", "o1"), "WRONG_STEP");
  });

  it("moves on when everyone has written, or when time runs out", () => {
    const early = setup();
    submit(early, "a", "Gallium");
    submit(early, "b", "Sodium");
    submit(early, "c", "Lead");
    expect(early.game.viewFor("a").step).toBe("choosing");

    const late = setup();
    submit(late, "a", "Gallium");
    expect(late.advance(CONFIG.writingMs)).toBe(true);
    expect(late.game.viewFor("a").step).toBe("choosing");
  });

  it("does not wait for a player who is offline", () => {
    const s = setup();
    s.connected.delete("c");
    submit(s, "a", "Gallium");
    submit(s, "b", "Sodium");
    expect(s.game.viewFor("a").step).toBe("choosing");
  });
});

describe("building the options", () => {
  it("mixes the real answer with the fakes, hides your own fake, and says nothing about who wrote what", () => {
    const s = setup();
    submit(s, "a", "Gallium");
    submit(s, "b", "Sodium");
    submit(s, "c", "Lead");

    const forA = s.game.viewFor("a");
    expect(forA.options.map((o) => o.text).sort()).toEqual(["Lead", "Mercury", "Sodium"]);
    expect(s.game.viewFor("b").options.map((o) => o.text).sort()).toEqual(["Gallium", "Lead", "Mercury"]);
    for (const id of s.ids) {
      const json = JSON.stringify(s.game.viewFor(id));
      expect(json).not.toContain("isReal");
      expect(json).not.toContain("authorIds");
      expect(json).not.toContain("realAnswer");
    }
  });

  it("quietly sets aside a fake that matches the real answer, without telling the writer", () => {
    const s = setup(3, {}, [FLAMINGO]);
    expect(submit(s, "a", "the flamboyance").ok).toBe(true);
    submit(s, "b", "A pink parliament");
    submit(s, "c", "A squad");
    // a's matching fake is gone. b sees the real answer and c's fake only.
    expect(s.game.viewFor("b").options.map((o) => o.text).sort()).toEqual(["A flamboyance", "A squad"]);
    expect(s.game.viewFor("a").options).toHaveLength(3);
  });

  it("merges identical fakes into one option", () => {
    const s = setup();
    submit(s, "a", "Gallium");
    submit(s, "b", "gallium");
    submit(s, "c", "Lead");
    expect(s.game.viewFor("c").options.map((o) => o.text).sort()).toEqual(["Gallium", "Mercury"]);
  });

  it("with 2 players, each sees the real answer and the other player's fake", () => {
    const s = setup(2);
    submit(s, "a", "Gallium");
    submit(s, "b", "Sodium");
    expect(s.game.viewFor("a").options.map((o) => o.text).sort()).toEqual(["Mercury", "Sodium"]);
    expect(s.game.viewFor("b").options.map((o) => o.text).sort()).toEqual(["Gallium", "Mercury"]);
  });

  it("still works when nobody wrote a usable fake", () => {
    const s = setup();
    s.advance(CONFIG.writingMs);
    expect(s.game.viewFor("a").options.map((o) => o.text)).toEqual(["Mercury"]);
  });
});

describe("choosing", () => {
  function toChoosing(s: Setup) {
    submit(s, "a", "Gallium");
    submit(s, "b", "Sodium");
    submit(s, "c", "Lead");
  }

  it("has rules, and keeps choices secret until choosing closes", () => {
    const s = setup();
    toChoosing(s);
    const ownFake = optionId(s, "b", "Gallium");
    expectError(choose(s, "a", ownFake), "CANNOT_VOTE_SELF");
    expectError(choose(s, "a", "zzz"), "ANSWER_NOT_FOUND");
    expect(choose(s, "a", realOption(s, "a")).ok).toBe(true);
    expectError(choose(s, "a", realOption(s, "a")), "ALREADY_VOTED");
    expectError(submit(s, "b", "late"), "WRONG_STEP");

    const seenByB = s.game.viewFor("b");
    expect(seenByB.chosenIds).toEqual(["a"]);
    expect(seenByB.myChoiceId).toBeNull();
    expect(seenByB.reveal).toBeNull();
  });

  it("gives 2 points for the real answer and 1 for each player fooled by your fake", () => {
    const s = setup();
    toChoosing(s);
    choose(s, "a", realOption(s, "a")); // a is right: +2
    choose(s, "b", optionId(s, "b", "Lead")); // b is fooled by c's fake: c +1
    choose(s, "c", realOption(s, "c")); // c is right: +2

    const view = s.game.viewFor("a");
    expect(view.step).toBe("reveal");
    expect(view.reveal?.realAnswer).toBe("Mercury");
    expect(view.reveal?.pointsGained).toEqual({ a: 2, b: 0, c: 3 });
    expect(view.scores).toEqual({ a: 2, b: 0, c: 3 });
    const lead = view.reveal?.options.find((o) => o.text === "Lead");
    expect(lead).toMatchObject({ isReal: false, authorIds: ["c"], chooserIds: ["b"] });
    expect(view.reveal?.options.find((o) => o.isReal)?.chooserIds).toEqual(["a", "c"]);
  });

  it("credits every writer when identical fakes fool someone", () => {
    const s = setup();
    submit(s, "a", "Gallium");
    submit(s, "b", "Gallium");
    submit(s, "c", "Lead");
    choose(s, "c", optionId(s, "c", "Gallium")); // fooled by the merged fake: a +1 and b +1
    choose(s, "a", realOption(s, "a"));
    choose(s, "b", realOption(s, "b"));
    expect(s.game.viewFor("a").scores).toEqual({ a: 3, b: 3, c: 0 });
  });

  it("closes choosing when time runs out", () => {
    const s = setup();
    toChoosing(s);
    choose(s, "a", realOption(s, "a"));
    expect(s.advance(CONFIG.choosingMs)).toBe(true);
    expect(s.game.viewFor("c").step).toBe("reveal");
    expect(s.game.viewFor("c").scores).toEqual({ a: 2, b: 0, c: 0 });
  });

  it("does not wait for a player who is offline", () => {
    const s = setup();
    toChoosing(s);
    s.connected.delete("c");
    choose(s, "a", realOption(s, "a"));
    choose(s, "b", realOption(s, "b"));
    expect(s.game.viewFor("a").step).toBe("reveal");
  });
});

describe("reporting", () => {
  it("passes a report on once per fake, never for the real answer, and only while options are showing", () => {
    const s = setup();
    expectError(act(s.game, "a", { type: "report", optionId: "o1" }), "WRONG_STEP");
    submit(s, "a", "Gallium");
    submit(s, "b", "Sodium");
    submit(s, "c", "Lead");
    const fake = optionId(s, "a", "Sodium");
    expect(act(s.game, "a", { type: "report", optionId: fake, reason: "rude" }).ok).toBe(true);
    expectError(act(s.game, "a", { type: "report", optionId: fake }), "ALREADY_DONE");
    expectError(act(s.game, "a", { type: "report", optionId: realOption(s, "a") }), "ANSWER_NOT_FOUND");
    expect(s.reports).toEqual([{ game: "fake-answer", text: "Sodium", reason: "rude" }]);
  });
});

describe("the whole game", () => {
  it("runs every round, then ranks players, shares ties and gives awards", () => {
    const two = [MERCURY, { ...FLAMINGO, id: "q3" }];
    const s = setup(3, { rounds: 2 }, two);
    for (let round = 1; round <= 2; round++) {
      const view = s.game.viewFor("a");
      const q = two.find((x) => x.question === view.question);
      expect(q).toBeDefined();
      submit(s, "a", `fakeA${round}`);
      submit(s, "b", `fakeB${round}`);
      submit(s, "c", `fakeC${round}`);
      for (const id of s.ids) choose(s, id, realOption(s, id, q?.answer ?? ""));
      s.advance(CONFIG.revealMs);
    }
    const final = s.game.viewFor("a");
    expect(final.step).toBe("finished");
    expect(final.results?.ranking.map((r) => r.score)).toEqual([4, 4, 4]);
    expect(final.results?.ranking.map((r) => r.rank)).toEqual([1, 1, 1]);
    expect(final.results?.awards.map((a) => a.id)).toEqual(["truth-seeker"]);
    expect(final.results?.awards[0]?.playerIds.sort()).toEqual(["a", "b", "c"]);
  });

  it("names a Professional Liar when fakes fool people", () => {
    const s = setup();
    submit(s, "a", "Gallium");
    submit(s, "b", "Sodium");
    submit(s, "c", "Lead");
    choose(s, "b", optionId(s, "b", "Gallium"));
    choose(s, "c", optionId(s, "c", "Gallium"));
    choose(s, "a", realOption(s, "a"));
    s.advance(CONFIG.revealMs);
    const awards = s.game.viewFor("a").results?.awards ?? [];
    const liar = awards.find((a) => a.id === "professional-liar");
    expect(liar).toMatchObject({ playerIds: ["a"], value: 2 });
  });

  it("can be ended early", () => {
    const s = setup();
    s.game.forceFinish();
    expect(s.game.isFinished()).toBe(true);
    expect(s.game.viewFor("a").results?.endedEarly).toBe(true);
  });
});

describe("normalizeAnswer", () => {
  it("ignores capitals, punctuation, spaces and a leading article", () => {
    expect(normalizeAnswer("The Mariana Trench!")).toBe(normalizeAnswer("mariana  trench"));
    expect(normalizeAnswer("A flamboyance")).toBe("flamboyance");
  });
});
