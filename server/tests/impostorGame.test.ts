import { describe, expect, it } from "vitest";
import type { RoomErrorCode } from "@chaos/shared";
import {
  ImpostorGame,
  normalizeWord,
  type ImpostorConfig,
  type ImpostorWordPair,
} from "../src/games/impostor/ImpostorGame";
import type { Result } from "../src/rooms/types";
import { seededRandom } from "./helpers";

const CONFIG: ImpostorConfig = {
  wordsMs: 1_000,
  clueMs: 2_000,
  discussionMs: 3_000,
  voteMs: 4_000,
  guessMs: 5_000,
  resultMs: 6_000,
};

const PAIRS: ImpostorWordPair[] = [
  { id: "p1", category: "food", crew: "Pizza", impostor: "Burger" },
  { id: "p2", category: "animals", crew: "Zebra", impostor: "Horse" },
  { id: "p3", category: "places", crew: "Beach", impostor: "Island" },
  { id: "p4", category: "objects", crew: "Spoon", impostor: "Fork" },
  { id: "p5", category: "entertainment", crew: "Chess", impostor: "Ludo" },
];

function expectError(result: Result<void>, error: RoomErrorCode): void {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe(error);
}

function setup(playerCount = 3) {
  let time = 1_000_000;
  const ids = ["a", "b", "c", "d"].slice(0, playerCount);
  const players = ids.map((id) => ({
    id,
    nickname: id.toUpperCase(),
    avatar: "cat" as const,
    color: "grape" as const,
  }));
  const connected = new Set(ids);
  const game = new ImpostorGame({
    players,
    words: PAIRS,
    now: () => time,
    random: seededRandom(11),
    isConnected: (id) => connected.has(id),
    config: CONFIG,
  });
  return {
    game,
    ids,
    connected,
    advance: (ms: number) => {
      time += ms;
      return game.tick(time);
    },
  };
}

type Setup = ReturnType<typeof setup>;

/** Works out who the impostor is from what each player is shown: they hold the only word nobody else has. */
function roles(game: ImpostorGame, ids: string[]) {
  const words = ids.map((id) => ({ id, word: game.viewFor(id).myWord ?? "" }));
  const impostor = words.find((entry) => words.filter((other) => other.word === entry.word).length === 1);
  const crew = words.filter((entry) => entry.id !== impostor?.id);
  if (!impostor || !crew[0]) throw new Error("Could not tell the roles apart.");
  return {
    impostorId: impostor.id,
    impostorWord: impostor.word,
    crewWord: crew[0].word,
    crewIds: crew.map((entry) => entry.id),
  };
}

const act = (game: ImpostorGame, id: string, action: unknown) => game.handleAction(id, action);
const speaker = (game: ImpostorGame, ids: string[]) => game.viewFor(ids[0] ?? "").currentSpeakerId ?? "";

function toClues(s: Setup) {
  s.advance(CONFIG.wordsMs);
}

function toDiscussion(s: Setup) {
  toClues(s);
  for (let i = 0; i < s.ids.length; i++) {
    expect(act(s.game, speaker(s.game, s.ids), { type: "clue", text: "hint" }).ok).toBe(true);
  }
}

function toVoting(s: Setup) {
  toDiscussion(s);
  for (const id of s.ids) act(s.game, id, { type: "ready" });
}

const vote = (s: Setup, voter: string, target: string) => act(s.game, voter, { type: "vote", targetId: target });

describe("starting a round", () => {
  it("gives each player only their own secret word, with no role shown", () => {
    const s = setup();
    const view = s.game.viewFor("a");
    expect(view.step).toBe("words");
    expect(view.round).toBe(1);
    expect(view.totalRounds).toBe(3);
    expect(view.category).not.toBeNull();
    expect(view.outcome).toBeNull();

    const r = roles(s.game, s.ids);
    const pair = PAIRS.find((p) => [p.crew, p.impostor].includes(r.crewWord));
    expect([pair?.crew, pair?.impostor].sort()).toEqual([r.crewWord, r.impostorWord].sort());
    expect(r.crewIds).toHaveLength(2);
  });

  it("never shows one player another player's word before the result", () => {
    const s = setup();
    const r = roles(s.game, s.ids);
    const crewView = JSON.stringify(s.game.viewFor(r.crewIds[0] ?? ""));
    const impostorView = JSON.stringify(s.game.viewFor(r.impostorId));
    expect(crewView).not.toContain(r.impostorWord);
    expect(impostorView).not.toContain(r.crewWord);

    toVoting(s);
    expect(JSON.stringify(s.game.viewFor(r.crewIds[0] ?? ""))).not.toContain(r.impostorWord);
    expect(s.game.viewFor(r.impostorId).outcome).toBeNull();
  });

  it("makes every player the impostor exactly once", () => {
    const s = setup();
    const seen: string[] = [];
    for (let round = 1; round <= 3; round++) {
      seen.push(roles(s.game, s.ids).impostorId);
      toVoting(s);
      // A ring of votes (each player votes for the next) always ties, so nobody is caught.
      s.ids.forEach((id, i) => vote(s, id, s.ids[(i + 1) % s.ids.length] ?? ""));
      s.advance(CONFIG.resultMs);
    }
    expect([...seen].sort()).toEqual(["a", "b", "c"]);
    expect(s.game.isFinished()).toBe(true);
  });
});

describe("clues", () => {
  it("moves from the words step to the clues step", () => {
    const s = setup();
    expect(s.advance(CONFIG.wordsMs - 1)).toBe(false);
    expect(s.advance(1)).toBe(true);
    const view = s.game.viewFor("a");
    expect(view.step).toBe("clues");
    expect(view.clueOrder.sort()).toEqual(["a", "b", "c"]);
    expect(view.currentSpeakerId).not.toBeNull();
  });

  it("only accepts a clue from the player whose turn it is", () => {
    const s = setup();
    toClues(s);
    const current = speaker(s.game, s.ids);
    const other = s.ids.find((id) => id !== current) ?? "";
    expectError(act(s.game, other, { type: "clue", text: "hint" }), "NOT_YOUR_TURN");
  });

  it("rejects clues that are not one word, contain your own word, or are blocked", () => {
    const s = setup();
    toClues(s);
    const current = speaker(s.game, s.ids);
    const own = s.game.viewFor(current).myWord ?? "";
    expectError(act(s.game, current, { type: "clue", text: "red hot" }), "CLUE_NOT_ALLOWED");
    expectError(act(s.game, current, { type: "clue", text: `${own.toLowerCase()}s` }), "CLUE_NOT_ALLOWED");
    expectError(act(s.game, current, { type: "clue", text: "shit" }), "CLUE_NOT_ALLOWED");
    expect(act(s.game, current, { type: "clue", text: "hint" }).ok).toBe(true);
  });

  it("shows every clue to everyone, with who gave it, and moves to the next speaker", () => {
    const s = setup();
    toClues(s);
    const first = speaker(s.game, s.ids);
    act(s.game, first, { type: "clue", text: "hint" });
    const view = s.game.viewFor("a");
    expect(view.clues).toEqual([{ playerId: first, text: "hint" }]);
    expect(view.currentSpeakerId).not.toBe(first);
  });

  it("skips a speaker who runs out of time, or who is offline", () => {
    const s = setup();
    toClues(s);
    const first = speaker(s.game, s.ids);
    s.advance(CONFIG.clueMs);
    const second = speaker(s.game, s.ids);
    expect(second).not.toBe(first);
    expect(s.game.viewFor("a").clues).toEqual([]);

    s.connected.delete(second);
    s.advance(0);
    expect(speaker(s.game, s.ids)).not.toBe(second);
  });

  it("moves on to the discussion after the last clue", () => {
    const s = setup();
    toDiscussion(s);
    expect(s.game.viewFor("a").step).toBe("discussion");
    expect(s.game.viewFor("a").clues).toHaveLength(3);
  });
});

describe("discussion", () => {
  it("starts voting when everyone is ready, or when time runs out", () => {
    const s = setup();
    toDiscussion(s);
    expect(act(s.game, "a", { type: "ready" }).ok).toBe(true);
    expectError(act(s.game, "a", { type: "ready" }), "ALREADY_DONE");
    act(s.game, "b", { type: "ready" });
    expect(s.game.viewFor("a").step).toBe("discussion");
    act(s.game, "c", { type: "ready" });
    expect(s.game.viewFor("a").step).toBe("voting");

    const timed = setup();
    toDiscussion(timed);
    timed.advance(CONFIG.discussionMs);
    expect(timed.game.viewFor("a").step).toBe("voting");
  });

  it("refuses actions that do not belong to the current step", () => {
    const s = setup();
    toClues(s);
    expectError(act(s.game, "a", { type: "ready" }), "WRONG_STEP");
    expectError(vote(s, "a", "b"), "WRONG_STEP");
    expectError(act(s.game, "a", { type: "guess", text: "x" }), "WRONG_STEP");
  });
});

describe("voting", () => {
  it("has rules, and keeps votes secret until it closes", () => {
    const s = setup();
    toVoting(s);
    expectError(vote(s, "a", "a"), "CANNOT_VOTE_SELF");
    expectError(vote(s, "a", "nobody"), "PLAYER_NOT_FOUND");
    expect(vote(s, "a", "b").ok).toBe(true);
    expectError(vote(s, "a", "c"), "ALREADY_VOTED");

    const seenByB = s.game.viewFor("b");
    expect(seenByB.votedIds).toEqual(["a"]);
    expect(seenByB.myVote).toBeNull();
    expect(seenByB.outcome).toBeNull();
    expect(JSON.stringify(seenByB)).not.toContain("targetId");
  });
});

describe("scoring a round", () => {
  it("catches the impostor when they alone have the most votes, then lets them guess", () => {
    const s = setup();
    const r = roles(s.game, s.ids);
    toVoting(s);
    for (const id of r.crewIds) vote(s, id, r.impostorId);
    vote(s, r.impostorId, r.crewIds[0] ?? "");

    const view = s.game.viewFor(r.impostorId);
    expect(view.step).toBe("guess");
    expect(view.outcome?.caught).toBe(true);
    expect(view.outcome?.impostorId).toBe(r.impostorId);
    expect(view.outcome?.crewWord).toBeNull();
    expect(view.scores[r.crewIds[0] ?? ""]).toBe(2);
    expect(view.scores[r.impostorId]).toBe(0);
    expectError(act(s.game, r.crewIds[0] ?? "", { type: "guess", text: "x" }), "NOT_YOUR_TURN");
  });

  it("gives a caught impostor 2 points for guessing the crew's word, ignoring capitals", () => {
    const s = setup();
    const r = roles(s.game, s.ids);
    toVoting(s);
    for (const id of r.crewIds) vote(s, id, r.impostorId);
    vote(s, r.impostorId, r.crewIds[0] ?? "");
    expect(act(s.game, r.impostorId, { type: "guess", text: ` ${r.crewWord.toUpperCase()} ` }).ok).toBe(true);

    const view = s.game.viewFor("a");
    expect(view.step).toBe("result");
    expect(view.outcome?.guessCorrect).toBe(true);
    expect(view.outcome?.crewWord).toBe(r.crewWord);
    expect(view.scores[r.impostorId]).toBe(2);
  });

  it("gives nothing for a wrong guess or no guess", () => {
    const wrong = setup();
    const r = roles(wrong.game, wrong.ids);
    toVoting(wrong);
    for (const id of r.crewIds) vote(wrong, id, r.impostorId);
    vote(wrong, r.impostorId, r.crewIds[0] ?? "");
    act(wrong.game, r.impostorId, { type: "guess", text: "banana" });
    expect(wrong.game.viewFor("a").outcome?.guessCorrect).toBe(false);
    expect(wrong.game.viewFor("a").scores[r.impostorId]).toBe(0);

    const silent = setup();
    const r2 = roles(silent.game, silent.ids);
    toVoting(silent);
    for (const id of r2.crewIds) vote(silent, id, r2.impostorId);
    vote(silent, r2.impostorId, r2.crewIds[0] ?? "");
    silent.advance(CONFIG.guessMs);
    expect(silent.game.viewFor("a").step).toBe("result");
    expect(silent.game.viewFor("a").outcome?.guess).toBeNull();
  });

  it("lets the impostor survive a tie, scoring 3 for them and 2 for the one who suspected them", () => {
    const s = setup();
    const r = roles(s.game, s.ids);
    const [c1, c2] = [r.crewIds[0] ?? "", r.crewIds[1] ?? ""];
    toVoting(s);
    vote(s, c1, r.impostorId);
    vote(s, c2, c1);
    vote(s, r.impostorId, c2);

    const view = s.game.viewFor("a");
    expect(view.step).toBe("result");
    expect(view.outcome?.caught).toBe(false);
    expect(view.outcome?.crewWord).toBe(r.crewWord);
    expect(view.outcome?.impostorWord).toBe(r.impostorWord);
    expect(view.scores).toEqual({ [r.impostorId]: 3, [c1]: 2, [c2]: 0 });
    expect(view.outcome?.pointsGained).toEqual({ [r.impostorId]: 3, [c1]: 2, [c2]: 0 });
  });

  it("lets the impostor survive when an innocent player gets the most votes", () => {
    const s = setup();
    const r = roles(s.game, s.ids);
    const [c1, c2] = [r.crewIds[0] ?? "", r.crewIds[1] ?? ""];
    toVoting(s);
    vote(s, c2, c1);
    vote(s, r.impostorId, c1);
    vote(s, c1, c2);
    const view = s.game.viewFor("a");
    expect(view.outcome?.caught).toBe(false);
    expect(view.scores).toEqual({ [r.impostorId]: 3, [c1]: 0, [c2]: 0 });
  });
});

describe("the whole game", () => {
  it("ranks players, shares ties, and gives awards", () => {
    const s = setup();
    for (let round = 1; round <= 3; round++) {
      toVoting(s);
      s.ids.forEach((id, i) => vote(s, id, s.ids[(i + 1) % s.ids.length] ?? ""));
      s.advance(CONFIG.resultMs);
    }
    const view = s.game.viewFor("a");
    expect(view.step).toBe("finished");
    expect(view.myWord).toBeNull();
    expect(view.results?.endedEarly).toBe(false);
    // Each player was the impostor once (+3) and suspected the impostor once (+2).
    expect(view.results?.ranking.map((entry) => entry.score)).toEqual([5, 5, 5]);
    expect(view.results?.ranking.map((entry) => entry.rank)).toEqual([1, 1, 1]);
    const awardIds = view.results?.awards.map((award) => award.id);
    expect(awardIds).toEqual(["master-of-disguise", "sharpest-detective"]);
    expect(view.results?.awards[0]?.playerIds.sort()).toEqual(["a", "b", "c"]);
  });

  it("can be ended early", () => {
    const s = setup();
    toClues(s);
    s.game.forceFinish();
    expect(s.game.isFinished()).toBe(true);
    expect(s.game.viewFor("a").results?.endedEarly).toBe(true);
  });
});

describe("normalizeWord", () => {
  it("ignores capitals, spaces, punctuation and a final s", () => {
    expect(normalizeWord("Ice Cream")).toBe(normalizeWord("icecreams"));
    expect(normalizeWord("Café")).toBe("cafe");
  });
});
