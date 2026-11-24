import { afterEach, describe, expect, it } from "vitest";
import type { Socket } from "socket.io-client";
import {
  CLIENT_EVENTS,
  DRAW_COLORS,
  SERVER_EVENTS,
  type Ack,
  type DrawDelta,
  type DrawingSnapshot,
  type GameSecret,
  type JoinedPayload,
  type RoomView,
} from "@chaos/shared";
import { createGameFactories } from "../src/games/registry";
import { RoomManager } from "../src/rooms/RoomManager";
import { sampleQuestions } from "./helpers";
import { connectClient, mustJoin, profile, runCleanups, send, startServer, waitFor } from "./socketHelpers";

type JoinedAck = Ack<JoinedPayload>;
type SecretAck = Ack<{ secret: GameSecret }>;
type DrawingAck = Ack<{ drawing: DrawingSnapshot }>;

afterEach(runCleanups);

const WORDS = [
  ...["cat", "dog", "owl", "fish"].map((word, i) => ({ id: `a${i}`, category: "animals" as const, word })),
  ...["pizza", "apple", "cake", "bread"].map((word, i) => ({ id: `f${i}`, category: "food" as const, word })),
  ...["lamp", "chair", "key", "clock"].map((word, i) => ({ id: `o${i}`, category: "objects" as const, word })),
  ...["house", "moon", "tree", "bridge"].map((word, i) => ({ id: `p${i}`, category: "places" as const, word })),
  ...["running", "singing", "yawning", "waving"].map((word, i) => ({ id: `c${i}`, category: "actions" as const, word })),
];

const draw = (action: unknown) => ({ gameId: "draw-it-wrong", action });
const askSecret = (client: Socket) => send<SecretAck>(client, CLIENT_EVENTS.requestSecret, { gameId: "draw-it-wrong" });

async function startDrawingRoom() {
  const manager = new RoomManager({
    countdownMs: 100,
    gameFactories: createGameFactories({
      mltQuestions: sampleQuestions(),
      drawWords: WORDS,
      drawConfig: { modes: ["free"], choosingMs: 60_000, drawingMs: 60_000, revealMs: 60_000 },
    }),
  });
  const { url } = await startServer({ manager, tickIntervalMs: 20 });
  const clients = [await connectClient(url), await connectClient(url), await connectClient(url)] as const;
  const host = mustJoin(await send<JoinedAck>(clients[0], CLIENT_EVENTS.createRoom, profile("Priya")));
  const ids = [host.playerId];
  for (const [index, client] of [clients[1], clients[2]].entries()) {
    const joined = mustJoin(
      await send<JoinedAck>(client, CLIENT_EVENTS.joinRoom, { ...profile(`Guest${index}`, "volt"), code: host.code }),
    );
    ids.push(joined.playerId);
  }
  await send<Ack>(clients[0], CLIENT_EVENTS.selectGame, { gameId: "draw-it-wrong" });
  const choosing = Promise.all(
    clients.map((client) => waitFor<RoomView>(client, SERVER_EVENTS.roomState, (v) => v.game?.step === "choosing", 3_000)),
  );
  expect((await send<Ack>(clients[0], CLIENT_EVENTS.startGame)).ok).toBe(true);
  const views = await choosing;
  const state = views[0]?.game;
  if (state?.gameId !== "draw-it-wrong") throw new Error("Expected a Draw It Wrong game.");
  const artistIndex = ids.indexOf(state.artistId ?? "");
  return { url, clients, ids, host, artistIndex };
}

describe("live drawing over real connections", () => {
  it("sends each piece of a line to the other players only, and keeps the word from guessers", async () => {
    const { clients, artistIndex } = await startDrawingRoom();
    const artist = clients[artistIndex] as Socket;
    const guessers = clients.filter((_, index) => index !== artistIndex);

    // The artist asks for their private words and picks one. A guesser learns only that they are a guesser.
    const secret = await askSecret(artist);
    expect(secret.ok && secret.secret.role === "artist" && secret.secret.options.length).toBe(3);
    expect(await askSecret(guessers[0] as Socket)).toEqual({ ok: true, secret: { role: "guesser" } });

    const sawDrawing = Promise.all(
      clients.map((client) => waitFor<RoomView>(client, SERVER_EVENTS.roomState, (v) => v.game?.step === "drawing")),
    );
    expect(await send<Ack>(artist, CLIENT_EVENTS.gameAction, draw({ type: "pick", index: 0 }))).toMatchObject({ ok: true });
    await sawDrawing;

    const word = (await askSecret(artist)).ok ? ((await askSecret(artist)) as { secret: { word: string } }).secret.word : "";
    expect(word.length).toBeGreaterThan(0);

    // Record everything pushed to the guessers from now on.
    const pushed: string[] = [];
    for (const guesser of guessers) {
      guesser.onAny((event: string, ...args: unknown[]) => pushed.push(JSON.stringify({ event, args })));
    }
    const artistGotDelta: string[] = [];
    artist.on(SERVER_EVENTS.drawDelta, (delta: DrawDelta) => artistGotDelta.push(delta.type));

    const guesserSaw = guessers.map((guesser) => waitFor<DrawDelta>(guesser, SERVER_EVENTS.drawDelta, (d) => d.type === "stroke"));
    expect(
      await send<Ack>(
        artist,
        CLIENT_EVENTS.drawAction,
        draw({ type: "stroke", id: 1, color: DRAW_COLORS[0], size: 10, points: [[10, 10], [50, 50]], done: false }),
      ),
    ).toMatchObject({ ok: true });
    const deltas = await Promise.all(guesserSaw);
    for (const delta of deltas) {
      expect(delta).toMatchObject({ type: "stroke", append: false, stroke: { id: 1, kind: "path" } });
    }
    expect(artistGotDelta).toEqual([]);

    // A guesser cannot draw. Wrong event names and shapes are refused.
    expect(
      await send<Ack>(guessers[0] as Socket, CLIENT_EVENTS.drawAction, draw({ type: "stroke", id: 2, color: DRAW_COLORS[0], size: 10, points: [[1, 1]] })),
    ).toMatchObject({ ok: false, error: "NOT_YOUR_TURN" });
    expect(
      await send<Ack>(artist, CLIENT_EVENTS.drawAction, draw({ type: "stroke", id: 2, color: "#123456", size: 10, points: [[1, 1]] })),
    ).toMatchObject({ ok: false, error: "INVALID_INPUT" });

    // A guesser who joins late or refreshes can fetch the drawing, and it has no word in it.
    const drawing = await send<DrawingAck>(guessers[1] as Socket, CLIENT_EVENTS.requestDrawing, { gameId: "draw-it-wrong" });
    expect(drawing.ok && drawing.drawing.strokes).toHaveLength(1);
    expect(drawing.ok && drawing.drawing.word).toBeNull();

    // Nothing pushed to a guesser during the round contained the word or any options.
    for (const frame of pushed) {
      expect(frame).not.toContain(`"${word}"`);
      expect(frame).not.toContain("options");
    }
  });

  it("refuses a drawing request from someone outside the room", async () => {
    const { url } = await startDrawingRoom();
    const outsider = await connectClient(url);
    expect(await send<DrawingAck>(outsider, CLIENT_EVENTS.requestDrawing, { gameId: "draw-it-wrong" })).toMatchObject({
      ok: false,
      error: "NOT_IN_ROOM",
    });
    expect(await askSecret(outsider)).toMatchObject({ ok: false, error: "NOT_IN_ROOM" });
  });
});
