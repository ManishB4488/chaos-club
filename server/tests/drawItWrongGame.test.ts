import { describe, expect, it } from "vitest";
import { DRAW_COLORS, type DrawMode, type RoomErrorCode } from "@chaos/shared";
import {
  DrawItWrongGame,
  normalizeGuess,
  type DrawConfig,
  type DrawWord,
} from "../src/games/drawItWrong/DrawItWrongGame";
import type { ContentReportEntry } from "../src/games/types";
import type { Result } from "../src/rooms/types";
import { seededRandom } from "./helpers";

const WORDS: DrawWord[] = [
  ...["cat", "dog", "owl", "fish"].map((word, i) => ({ id: `a${i}`, category: "animals" as const, word })),
  ...["pizza", "apple", "ice cream", "cake"].map((word, i) => ({ id: `f${i}`, category: "food" as const, word })),
  ...["lamp", "chair", "key", "clock"].map((word, i) => ({ id: `o${i}`, category: "objects" as const, word })),
  ...["house", "moon", "tree", "bridge"].map((word, i) => ({ id: `p${i}`, category: "places" as const, word })),
  ...["running", "singing", "yawning", "waving"].map((word, i) => ({ id: `c${i}`, category: "actions" as const, word })),
];

const CONFIG: DrawConfig = {
  roundsPerPlayer: 1,
  choosingMs: 4_000,
  drawingMs: 10_000,
  revealMs: 3_000,
  modes: ["free"],
};

function expectError(result: Result<unknown>, error: RoomErrorCode): void {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe(error);
}

function setup(playerCount = 3, config: Partial<DrawConfig> = {}) {
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
  const game = new DrawItWrongGame({
    players,
    words: WORDS,
    now: () => time,
    random: seededRandom(9),
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

const act = (game: DrawItWrongGame, id: string, action: unknown) => game.handleAction(id, action);
const artistOf = (s: Setup) => s.game.viewFor(s.ids[0] ?? "").artistId ?? "";
const guessersOf = (s: Setup) => s.ids.filter((id) => id !== artistOf(s));

/** The artist asks for their private words, exactly as the server does, and picks one. */
function pickWord(s: Setup, index = 0): string {
  const artist = artistOf(s);
  const secret = s.game.secretFor(artist);
  if (!secret.ok || secret.value.role !== "artist") throw new Error("Expected the artist's words.");
  const word = secret.value.options[index] ?? "";
  expect(act(s.game, artist, { type: "pick", index }).ok).toBe(true);
  return word;
}

const line = (id: number, overrides: Record<string, unknown> = {}) => ({
  type: "stroke",
  id,
  color: DRAW_COLORS[0],
  size: 10,
  points: [
    [10, 10],
    [200, 200],
  ],
  done: true,
  ...overrides,
});

describe("secret words", () => {
  it("offers the artist three words from different categories, and tells guessers nothing", () => {
    const s = setup();
    const artist = artistOf(s);
    expect(s.ids).toContain(artist);

    const secret = s.game.secretFor(artist);
    expect(secret.ok).toBe(true);
    if (secret.ok && secret.value.role === "artist") {
      expect(secret.value.options).toHaveLength(3);
      expect(new Set(secret.value.options).size).toBe(3);
      expect(secret.value.word).toBeNull();
    }
    for (const id of guessersOf(s)) expect(s.game.secretFor(id)).toEqual({ ok: true, value: { role: "guesser" } });
    expectError(s.game.secretFor("outsider"), "NOT_A_PARTICIPANT");
  });

  it("never puts the offered words or the chosen word in any shared view", () => {
    const s = setup();
    const secret = s.game.secretFor(artistOf(s));
    const offered = secret.ok && secret.value.role === "artist" ? secret.value.options : [];
    for (const id of s.ids) for (const word of offered) expect(JSON.stringify(s.game.viewFor(id))).not.toContain(`"${word}"`);

    const chosen = pickWord(s);
    for (const id of s.ids) {
      const json = JSON.stringify(s.game.viewFor(id));
      expect(json).not.toContain(`"${chosen}"`);
      expect(json).not.toContain("options");
    }
    expect(s.game.viewFor("a").wordShape).toEqual(chosen.split(" ").map((part) => part.length));
  });

  it("serves the artist's word only while the round is being played", () => {
    const s = setup();
    pickWord(s);
    const artist = artistOf(s);
    const secret = s.game.secretFor(artist);
    expect(secret.ok && secret.value.role === "artist" ? secret.value.word : null).not.toBeNull();
    s.advance(CONFIG.drawingMs);
    expect(s.game.viewFor("a").step).toBe("reveal");
    expectError(s.game.secretFor(artist), "WRONG_STEP");
  });
});

describe("choosing the word", () => {
  it("lets only the artist pick, and picks for them when time runs out", () => {
    const s = setup();
    const guesser = guessersOf(s)[0] ?? "";
    expectError(act(s.game, guesser, { type: "pick", index: 0 }), "NOT_YOUR_TURN");
    expect(s.advance(CONFIG.choosingMs)).toBe(true);
    expect(s.game.viewFor("a").step).toBe("drawing");
    const secret = s.game.secretFor(artistOf(s));
    expect(secret.ok && secret.value.role === "artist" ? secret.value.word : null).not.toBeNull();
  });

  it("skips the round when the artist is offline", () => {
    const s = setup();
    s.connected.delete(artistOf(s));
    expect(s.advance(0)).toBe(true);
    const view = s.game.viewFor("a");
    expect(view.step).toBe("reveal");
    expect(view.reveal?.skipped).toBe(true);
    expect(view.scores).toEqual({ a: 0, b: 0, c: 0 });
  });
});

describe("drawing rules", () => {
  it("lets only the artist draw, only while drawing", () => {
    const s = setup();
    const artist = artistOf(s);
    expectError(act(s.game, artist, line(1)), "WRONG_STEP");
    pickWord(s);
    expectError(act(s.game, guessersOf(s)[0] ?? "", line(1)), "NOT_YOUR_TURN");
    expect(act(s.game, artist, line(1)).ok).toBe(true);
  });

  it("joins pieces of one line, and refuses to extend a finished line or reuse an id", () => {
    const s = setup();
    pickWord(s);
    const artist = artistOf(s);
    expect(act(s.game, artist, line(1, { done: false })).ok).toBe(true);
    expect(act(s.game, artist, line(1, { points: [[300, 300]], done: true })).ok).toBe(true);
    expectError(act(s.game, artist, line(1, { points: [[400, 400]] })), "DRAWING_RULE");
    expectError(act(s.game, artist, line(1)), "DRAWING_RULE");
    expect(act(s.game, artist, line(2)).ok).toBe(true);
    expectError(act(s.game, artist, line(2)), "DRAWING_RULE");
    const drawing = s.game.drawingFor(guessersOf(s)[0] ?? "", undefined);
    expect(drawing.ok && drawing.value.strokes.map((stroke) => stroke.id)).toEqual([1, 2]);
  });

  it("sends only small updates to the other players, and does not re-send the room update for them", () => {
    const s = setup();
    pickWord(s);
    const artist = artistOf(s);
    act(s.game, artist, line(1, { done: false }));
    const batch = s.game.drainStream();
    expect(batch.silent).toBe(true);
    expect(batch.events).toHaveLength(1);
    expect(batch.events[0]).toMatchObject({ event: "draw:delta", exceptPlayerId: artist });
    expect(s.game.drainStream()).toEqual({ events: [], silent: false });

    act(s.game, guessersOf(s)[0] ?? "", { type: "guess", text: "banana" });
    expect(s.game.drainStream()).toEqual({ events: [], silent: false });
  });

  const modeCase = (mode: DrawMode) => {
    const s = setup(3, { modes: [mode] });
    pickWord(s);
    return { s, artist: artistOf(s) };
  };

  it("free draw allows undo and clear", () => {
    const { s, artist } = modeCase("free");
    act(s.game, artist, line(1));
    act(s.game, artist, line(2));
    expect(act(s.game, artist, { type: "undo" }).ok).toBe(true);
    expect(act(s.game, artist, { type: "clear" }).ok).toBe(true);
    const guesser = guessersOf(s)[0] ?? "";
    const drawing = s.game.drawingFor(guesser);
    expect(drawing.ok && drawing.value.strokes).toEqual([]);
  });

  it("only circles refuses lines", () => {
    const { s, artist } = modeCase("circles");
    expect(s.game.viewFor("a").rules?.mode).toBe("circles");
    expectError(act(s.game, artist, line(1)), "DRAWING_RULE");
    expect(
      act(s.game, artist, { type: "circle", id: 1, color: DRAW_COLORS[1], size: 10, cx: 500, cy: 500, r: 100 }).ok,
    ).toBe(true);
  });

  it("circles are refused in the other modes", () => {
    const { s, artist } = modeCase("free");
    expectError(
      act(s.game, artist, { type: "circle", id: 1, color: DRAW_COLORS[1], size: 10, cx: 500, cy: 500, r: 100 }),
      "DRAWING_RULE",
    );
  });

  it("one color allows only the given color", () => {
    const { s, artist } = modeCase("one-color");
    const allowed = s.game.viewFor("a").rules?.allowedColors ?? [];
    expect(allowed).toHaveLength(1);
    expect(allowed).not.toContain("#ffffff");
    const other = DRAW_COLORS.find((color) => color !== allowed[0]) ?? DRAW_COLORS[0];
    expectError(act(s.game, artist, line(1, { color: other })), "DRAWING_RULE");
    expect(act(s.game, artist, line(1, { color: allowed[0] })).ok).toBe(true);
  });

  it("one line allows a single line, and no undo or clear", () => {
    const { s, artist } = modeCase("one-stroke");
    expect(act(s.game, artist, line(1)).ok).toBe(true);
    expectError(act(s.game, artist, line(2)), "DRAWING_RULE");
    expectError(act(s.game, artist, { type: "undo" }), "DRAWING_RULE");
    expectError(act(s.game, artist, { type: "clear" }), "DRAWING_RULE");
  });

  it("five lines allows five, and no more", () => {
    const { s, artist } = modeCase("five-strokes");
    for (let id = 1; id <= 5; id++) expect(act(s.game, artist, line(id)).ok).toBe(true);
    expectError(act(s.game, artist, line(6)), "DRAWING_RULE");
  });

  it("eyes closed hides the canvas from the artist but still takes the drawing", () => {
    const { s, artist } = modeCase("eyes-closed");
    expect(s.game.viewFor("a").rules?.hideCanvasFromArtist).toBe(true);
    expect(act(s.game, artist, line(1)).ok).toBe(true);
    expectError(act(s.game, artist, { type: "undo" }), "DRAWING_RULE");
  });
});

describe("guessing", () => {
  function start() {
    const s = setup();
    const word = pickWord(s);
    return { s, word, guessers: guessersOf(s), artist: artistOf(s) };
  }

  it("shows wrong guesses to everyone and never shows a correct guess", () => {
    const { s, word, guessers } = start();
    const [g1, g2] = [guessers[0] ?? "", guessers[1] ?? ""];
    act(s.game, g1, { type: "guess", text: "banana" });
    act(s.game, g2, { type: "guess", text: ` ${word.toUpperCase()} ` });
    const view = s.game.viewFor("a");
    expect(view.guesses).toEqual([{ playerId: g1, text: "banana" }]);
    expect(view.correctIds).toEqual([g2]);
    expect(JSON.stringify(view)).not.toContain(`"${word}"`);
  });

  it("has rules: the artist cannot guess, blocked words are refused, and guesses cannot come too fast", () => {
    const { s, artist, guessers } = start();
    const g1 = guessers[0] ?? "";
    expectError(act(s.game, artist, { type: "guess", text: "cat" }), "NOT_YOUR_TURN");
    expectError(act(s.game, g1, { type: "guess", text: "what the fuck" }), "CONTENT_NOT_ALLOWED");
    expectError(act(s.game, g1, { type: "guess", text: "   " }), "INVALID_INPUT");
    expect(act(s.game, g1, { type: "guess", text: "banana" }).ok).toBe(true);
    expectError(act(s.game, g1, { type: "guess", text: "grape" }), "RATE_LIMITED");
    s.advance(900);
    expect(act(s.game, g1, { type: "guess", text: "grape" }).ok).toBe(true);
  });

  it("scores 3, 2 and 1 for the first three correct guessers, and 1 for the artist per correct guess", () => {
    const s = setup(4);
    const word = pickWord(s);
    const [g1, g2, g3] = guessersOf(s);
    act(s.game, g1 ?? "", { type: "guess", text: word });
    act(s.game, g2 ?? "", { type: "guess", text: word });
    expectError(act(s.game, g2 ?? "", { type: "guess", text: word }), "ALREADY_DONE");
    act(s.game, g3 ?? "", { type: "guess", text: word });

    const view = s.game.viewFor("a");
    expect(view.step).toBe("reveal");
    expect(view.reveal?.correctIds).toEqual([g1, g2, g3]);
    expect(view.reveal?.pointsGained[g1 ?? ""]).toBe(3);
    expect(view.reveal?.pointsGained[g2 ?? ""]).toBe(2);
    expect(view.reveal?.pointsGained[g3 ?? ""]).toBe(1);
    expect(view.reveal?.pointsGained[artistOf(s)]).toBe(3);
    expect(view.reveal?.word).toBe(word);
  });

  it("ends the round when time runs out, with points only for those who guessed", () => {
    const { s, word, guessers, artist } = start();
    act(s.game, guessers[0] ?? "", { type: "guess", text: word });
    expect(s.advance(CONFIG.drawingMs)).toBe(true);
    const view = s.game.viewFor("a");
    expect(view.step).toBe("reveal");
    expect(view.scores[guessers[0] ?? ""]).toBe(3);
    expect(view.scores[guessers[1] ?? ""]).toBe(0);
    expect(view.scores[artist]).toBe(1);
  });

  it("ignores capitals, spaces and a final s, so 'icecreams' is right for ice cream", () => {
    expect(normalizeGuess("Ice Cream")).toBe(normalizeGuess("icecreams"));
  });
});

describe("drawings", () => {
  it("gives guessers the drawing without the word, and the word once the round is over", () => {
    const s = setup();
    const word = pickWord(s);
    act(s.game, artistOf(s), line(1));
    const guesser = guessersOf(s)[0] ?? "";
    const live = s.game.drawingFor(guesser);
    expect(live.ok && live.value.word).toBeNull();
    expect(live.ok && live.value.strokes).toHaveLength(1);

    s.advance(CONFIG.drawingMs);
    const after = s.game.drawingFor(guesser, 1);
    expect(after.ok && after.value.word).toBe(word);
    expect(after.ok && after.value.strokes).toHaveLength(1);
    expectError(s.game.drawingFor(guesser, 5), "WRONG_STEP");
    expectError(s.game.drawingFor("outsider"), "NOT_A_PARTICIPANT");
  });
});

describe("the whole game", () => {
  it("gives everyone a turn as the artist, then ranks players, names awards and picks a drawing to replay", () => {
    const s = setup(3);
    const artists: string[] = [];
    for (let round = 1; round <= 3; round++) {
      const artist = artistOf(s);
      artists.push(artist);
      const word = pickWord(s);
      act(s.game, artist, line(1));
      const first = guessersOf(s)[0] ?? "";
      act(s.game, first, { type: "guess", text: word });
      s.advance(CONFIG.drawingMs);
      s.advance(CONFIG.revealMs);
    }
    expect([...artists].sort()).toEqual(["a", "b", "c"]);

    const view = s.game.viewFor("a");
    expect(view.step).toBe("finished");
    expect(view.results?.endedEarly).toBe(false);
    expect(view.results?.ranking).toHaveLength(3);
    expect(view.results?.awards.map((award) => award.id)).toEqual(["sharpest-eye", "artist-of-the-chaos"]);
    expect(view.results?.highlight).not.toBeNull();
    expect(view.results?.highlight?.correctCount).toBe(1);
  });

  it("can be ended early", () => {
    const s = setup();
    s.game.forceFinish();
    expect(s.game.isFinished()).toBe(true);
    expect(s.game.viewFor("a").results?.endedEarly).toBe(true);
  });
});
