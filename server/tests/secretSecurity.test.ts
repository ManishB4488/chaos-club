import { afterEach, describe, expect, it, vi } from "vitest";
import type { Socket } from "socket.io-client";
import {
  CLIENT_EVENTS,
  type Ack,
  type GameSecret,
  type JoinedPayload,
} from "@chaos/shared";
import { createGameFactories } from "../src/games/registry";
import type { ImpostorWordPair } from "../src/games/impostor/ImpostorGame";
import { RoomManager } from "../src/rooms/RoomManager";
import { sampleQuestions } from "./helpers";
import { connectClient, mustJoin, profile, runCleanups, send, startServer, waitFor } from "./socketHelpers";

type JoinedAck = Ack<JoinedPayload>;
type SecretAck = Ack<{ secret: GameSecret }>;

afterEach(runCleanups);

// Unusual words, so a leak cannot be mistaken for ordinary text.
const PAIRS: ImpostorWordPair[] = [
  { id: "s1", category: "food", crew: "Zorblax", impostor: "Quibbot" },
  { id: "s2", category: "animals", crew: "Wumpusel", impostor: "Grindlefax" },
  { id: "s3", category: "places", crew: "Flibberton", impostor: "Snazzlewick" },
  { id: "s4", category: "objects", crew: "Gronkleboard", impostor: "Plimbus" },
  { id: "s5", category: "entertainment", crew: "Yarbleflot", impostor: "Dribbleton" },
];
const ALL_TOKENS = PAIRS.flatMap((pair) => [pair.crew, pair.impostor]);

/** Records EVERYTHING the server pushes to one browser session, like the Network tab would. */
function recordPushes(client: Socket): string[] {
  const frames: string[] = [];
  client.onAny((event: string, ...args: unknown[]) => {
    frames.push(JSON.stringify({ event, args }));
  });
  return frames;
}

const askSecret = (client: Socket) => send<SecretAck>(client, CLIENT_EVENTS.requestSecret, { gameId: "impostor" });

async function startImpostorRoom() {
  const manager = new RoomManager({
    countdownMs: 100,
    gameFactories: createGameFactories({
      mltQuestions: sampleQuestions(),
      impostorWords: PAIRS,
      impostorConfig: { wordsMs: 60_000, clueMs: 60_000, discussionMs: 60_000, voteMs: 60_000 },
    }),
  });
  const { url } = await startServer({ manager, tickIntervalMs: 20 });
  const clients = [await connectClient(url), await connectClient(url), await connectClient(url)] as const;
  const pushes = clients.map((client) => recordPushes(client));

  const host = mustJoin(await send<JoinedAck>(clients[0], CLIENT_EVENTS.createRoom, profile("Priya")));
  const guest1 = mustJoin(
    await send<JoinedAck>(clients[1], CLIENT_EVENTS.joinRoom, { ...profile("Sam", "volt"), code: host.code }),
  );
  const guest2 = mustJoin(
    await send<JoinedAck>(clients[2], CLIENT_EVENTS.joinRoom, { ...profile("Alex", "tangerine"), code: host.code }),
  );
  await send<Ack>(clients[0], CLIENT_EVENTS.selectGame, { gameId: "impostor" });
  const allInWords = Promise.all(
    clients.map((client) =>
      waitFor<{ game?: { step: string } | null }>(client, "room:state", (v) => v.game?.step === "words", 3_000),
    ),
  );
  expect((await send<Ack>(clients[0], CLIENT_EVENTS.startGame)).ok).toBe(true);
  await allInWords;
  return { url, clients, pushes, host, guests: [guest1, guest2] };
}

describe("private secrets, tested with several real sessions", () => {
  it("gives each player only their own role, and never sends a secret in any shared update", async () => {
    const logged: string[] = [];
    const spies = (["log", "info", "warn", "error"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logged.push(args.map(String).join(" "));
      }),
    );

    try {
      const { clients, pushes } = await startImpostorRoom();

      // 1. Before anybody asks, NOTHING the server has pushed contains any word or any role.
      for (const frames of pushes) {
        for (const frame of frames) {
          for (const token of ALL_TOKENS) expect(frame).not.toContain(token);
          expect(frame).not.toContain("myWord");
          expect(frame).not.toContain('"role"');
        }
      }

      // 2. Each player asks for their own secret.
      const acks = await Promise.all(clients.map((client) => askSecret(client)));
      const secrets = acks.map((ack) => {
        if (!ack.ok) throw new Error(`Expected a secret but got ${ack.error}`);
        return ack.secret;
      });
      const impostorIndex = secrets.findIndex((secret) => secret.role === "impostor");
      const crewIndexes = secrets.map((_, index) => index).filter((index) => index !== impostorIndex);
      expect(secrets.filter((secret) => secret.role === "impostor")).toHaveLength(1);

      // 3. The impostor got their role and NO word. The crew got the same word.
      expect(secrets[impostorIndex]).toEqual({ role: "impostor", word: null });
      const crewWords = crewIndexes.map((index) => secrets[index]?.word);
      expect(new Set(crewWords).size).toBe(1);
      const crewWord = String(crewWords[0]);
      expect(ALL_TOKENS).toContain(crewWord);

      // 4. The impostor's browser never received the crew word, in any push.
      for (const frame of pushes[impostorIndex] ?? []) expect(frame).not.toContain(crewWord);
      expect(JSON.stringify(acks[impostorIndex])).not.toContain(crewWord);

      // 5. Nobody's pushed updates, crew or impostor, ever contain a word. Only the reply to their own request does.
      for (const frames of pushes) {
        for (const frame of frames) {
          for (const token of ALL_TOKENS) expect(frame).not.toContain(token);
          expect(frame).not.toContain('"role"');
        }
      }

      // 6. Nothing the server printed contains a word.
      for (const line of logged) for (const token of ALL_TOKENS) expect(line).not.toContain(token);
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });

  it("refuses anyone who is not in the room, and a request for the wrong game", async () => {
    const { url, clients } = await startImpostorRoom();
    const outsider = await connectClient(url);
    const outsiderPushes = recordPushes(outsider);

    expect(await askSecret(outsider)).toMatchObject({ ok: false, error: "NOT_IN_ROOM" });
    expect(
      await send<SecretAck>(clients[0], CLIENT_EVENTS.requestSecret, { gameId: "most-likely-to" }),
    ).toMatchObject({ ok: false, error: "NO_GAME_RUNNING" });
    expect(await send<SecretAck>(outsider, CLIENT_EVENTS.requestSecret, { gameId: "impostor", playerId: "x" })).toMatchObject({
      ok: false,
      error: "INVALID_INPUT",
    });
    expect(outsiderPushes).toEqual([]);
  });

  it("checks again on every request: a stale connection gets nothing until it truly rejoins", async () => {
    const { url, clients, host, guests } = await startImpostorRoom();
    const guest = guests[0];
    const before = await askSecret(clients[1]);
    expect(before.ok).toBe(true);

    // The player's connection drops. A brand new connection must not be able to read their secret.
    clients[1].disconnect();
    const fresh = await connectClient(url);
    const freshPushes = recordPushes(fresh);
    expect(await askSecret(fresh)).toMatchObject({ ok: false, error: "NOT_IN_ROOM" });

    // A wrong session code does not help either.
    const wrong = await send<JoinedAck>(fresh, CLIENT_EVENTS.rejoinRoom, {
      code: host.code,
      sessionToken: "wrong-token-wrong-token",
    });
    expect(wrong).toMatchObject({ ok: false, error: "INVALID_SESSION" });
    expect(await askSecret(fresh)).toMatchObject({ ok: false, error: "NOT_IN_ROOM" });

    // With the real private session code, the player gets their seat back and the SAME secret, re-authorized.
    const back = await send<JoinedAck>(fresh, CLIENT_EVENTS.rejoinRoom, {
      code: host.code,
      sessionToken: guest?.sessionToken ?? "",
    });
    expect(back.ok).toBe(true);
    const after = await askSecret(fresh);
    expect(after).toEqual(before);

    // Rejoining itself pushed no secret.
    for (const frame of freshPushes) for (const token of ALL_TOKENS) expect(frame).not.toContain(token);
  });

  it("stops serving a secret to a player who has left the room", async () => {
    const { clients } = await startImpostorRoom();
    expect((await askSecret(clients[2])).ok).toBe(true);
    expect((await send<Ack>(clients[2], CLIENT_EVENTS.leaveRoom)).ok).toBe(true);
    expect(await askSecret(clients[2])).toMatchObject({ ok: false, error: "NOT_IN_ROOM" });
  });
});
