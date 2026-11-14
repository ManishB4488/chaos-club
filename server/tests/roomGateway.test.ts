import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type Ack,
  type JoinedPayload,
  type RoomView,
} from "@chaos/shared";
import { createGameServer } from "../src/app";
import { RoomManager, type RoomManagerOptions } from "../src/rooms/RoomManager";

type JoinedAck = Ack<JoinedPayload>;

const profile = (nickname: string, color = "grape") => ({ nickname, avatar: "cat", color });

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function startServer(managerOptions: RoomManagerOptions = {}) {
  const manager = new RoomManager(managerOptions);
  const server = createGameServer({
    webOrigins: ["http://localhost:3000"],
    manager,
    sweepIntervalMs: 60_000,
  });
  await new Promise<void>((resolve) => server.httpServer.listen(0, "127.0.0.1", resolve));
  const port = (server.httpServer.address() as AddressInfo).port;
  cleanups.push(() => server.close());
  return { url: `http://127.0.0.1:${port}` };
}

async function connectClient(url: string): Promise<Socket> {
  const client = connect(url, { transports: ["websocket"], forceNew: true, reconnection: false });
  cleanups.push(() => {
    client.disconnect();
  });
  await new Promise<void>((resolve, reject) => {
    client.once("connect", () => resolve());
    client.once("connect_error", reject);
  });
  return client;
}

async function send<T>(client: Socket, event: string, payload?: unknown): Promise<T> {
  return (await client.timeout(2_000).emitWithAck(event, payload)) as T;
}

/** Waits for the next matching server event. Call it BEFORE the action that causes the event. */
function waitFor<T>(
  client: Socket,
  event: string,
  predicate: (value: T) => boolean = () => true,
  timeoutMs = 2_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const handler = (value: T) => {
      if (predicate(value)) {
        clearTimeout(timer);
        client.off(event, handler);
        resolve(value);
      }
    };
    const timer = setTimeout(() => {
      client.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    client.on(event, handler);
  });
}

function mustJoin(ack: JoinedAck): JoinedPayload {
  if (!ack.ok) throw new Error(`Expected success but got ${ack.error}`);
  return ack;
}

describe("room events over a real connection", () => {
  it("creates a room and lets a second client join, with private snapshots", async () => {
    const { url } = await startServer();
    const host = await connectClient(url);
    const guest = await connectClient(url);

    const created = mustJoin(await send<JoinedAck>(host, CLIENT_EVENTS.createRoom, profile("Priya")));
    const hostSees = waitFor<RoomView>(host, SERVER_EVENTS.roomState, (v) => v.players.length === 2);
    const joined = mustJoin(
      await send<JoinedAck>(guest, CLIENT_EVENTS.joinRoom, { ...profile("Sam", "volt"), code: created.code }),
    );

    expect(joined.room.players).toHaveLength(2);
    expect(joined.room.selfId).toBe(joined.playerId);

    const hostView = await hostSees;
    expect(hostView.hostId).toBe(created.playerId);
    expect(hostView.selfId).toBe(created.playerId);
    expect(JSON.stringify(hostView)).not.toContain(joined.sessionToken);
  });

  it("rejects invalid input and unexpected fields", async () => {
    const { url } = await startServer();
    const client = await connectClient(url);

    expect(await send<Ack>(client, CLIENT_EVENTS.createRoom, profile("<b>"))).toMatchObject({
      ok: false,
      error: "INVALID_INPUT",
    });
    expect(
      await send<Ack>(client, CLIENT_EVENTS.createRoom, { ...profile("Priya"), isHost: true }),
    ).toMatchObject({ ok: false, error: "INVALID_INPUT" });
    expect(await send<Ack>(client, CLIENT_EVENTS.createRoom, "nonsense")).toMatchObject({
      ok: false,
      error: "INVALID_INPUT",
    });
  });

  it("refuses room actions from someone who is not in a room", async () => {
    const { url } = await startServer();
    const client = await connectClient(url);
    expect(await send<Ack>(client, CLIENT_EVENTS.startGame)).toMatchObject({
      ok: false,
      error: "NOT_IN_ROOM",
    });
    expect(await send<Ack>(client, CLIENT_EVENTS.leaveRoom)).toMatchObject({
      ok: false,
      error: "NOT_IN_ROOM",
    });
  });

  it("lets only the host kick, and tells the kicked player", async () => {
    const { url } = await startServer();
    const host = await connectClient(url);
    const guest = await connectClient(url);
    const created = mustJoin(await send<JoinedAck>(host, CLIENT_EVENTS.createRoom, profile("Priya")));
    const joined = mustJoin(
      await send<JoinedAck>(guest, CLIENT_EVENTS.joinRoom, { ...profile("Sam", "volt"), code: created.code }),
    );

    const denied = await send<Ack>(guest, CLIENT_EVENTS.kickPlayer, { playerId: created.playerId });
    expect(denied).toMatchObject({ ok: false, error: "NOT_HOST" });

    const kickedNotice = waitFor<{ reason: string }>(guest, SERVER_EVENTS.kicked);
    const hostSees = waitFor<RoomView>(host, SERVER_EVENTS.roomState, (v) => v.players.length === 1);
    const kicked = await send<Ack>(host, CLIENT_EVENTS.kickPlayer, { playerId: joined.playerId });
    expect(kicked.ok).toBe(true);
    expect((await kickedNotice).reason).toBe("kicked");
    await hostSees;

    expect(await send<Ack>(guest, CLIENT_EVENTS.leaveRoom)).toMatchObject({
      ok: false,
      error: "NOT_IN_ROOM",
    });
  });

  it("restores a seat after a dropped connection, and rejects a wrong token", async () => {
    const { url } = await startServer();
    const host = await connectClient(url);
    const guest = await connectClient(url);
    const created = mustJoin(await send<JoinedAck>(host, CLIENT_EVENTS.createRoom, profile("Priya")));
    const joined = mustJoin(
      await send<JoinedAck>(guest, CLIENT_EVENTS.joinRoom, { ...profile("Sam", "volt"), code: created.code }),
    );

    const sawOffline = waitFor<RoomView>(host, SERVER_EVENTS.roomState, (v) =>
      v.players.some((p) => !p.connected),
    );
    guest.disconnect();
    await sawOffline;

    const returning = await connectClient(url);
    const wrong = await send<JoinedAck>(returning, CLIENT_EVENTS.rejoinRoom, {
      code: created.code,
      sessionToken: "wrong-token-wrong-token",
    });
    expect(wrong).toMatchObject({ ok: false, error: "INVALID_SESSION" });

    const sawBack = waitFor<RoomView>(host, SERVER_EVENTS.roomState, (v) =>
      v.players.every((p) => p.connected),
    );
    const restored = mustJoin(
      await send<JoinedAck>(returning, CLIENT_EVENTS.rejoinRoom, {
        code: created.code,
        sessionToken: joined.sessionToken,
      }),
    );
    expect(restored.playerId).toBe(joined.playerId);
    await sawBack;
  });

  it("slows down a client that guesses room codes", async () => {
    const { url } = await startServer();
    const client = await connectClient(url);
    const errors: string[] = [];
    for (let attempt = 0; attempt < 9; attempt++) {
      const ack = await send<JoinedAck>(client, CLIENT_EVENTS.joinRoom, {
        ...profile("Guesser"),
        code: "ZZZZZZ",
      });
      if (!ack.ok) errors.push(ack.error);
    }
    expect(errors[0]).toBe("ROOM_NOT_FOUND");
    expect(errors).toContain("RATE_LIMITED");
  });

  it("refuses to start a game that is not available yet", async () => {
    const { url } = await startServer();
    const host = await connectClient(url);
    await send<JoinedAck>(host, CLIENT_EVENTS.createRoom, profile("Priya"));
    expect(await send<Ack>(host, CLIENT_EVENTS.selectGame, { gameId: "roast" })).toMatchObject({
      ok: true,
    });
    expect(await send<Ack>(host, CLIENT_EVENTS.startGame)).toMatchObject({
      ok: false,
      error: "GAME_NOT_AVAILABLE",
    });
  });

  it("runs the start countdown and then enters the game", async () => {
    const { url } = await startServer({ availableGames: ["most-likely-to"], countdownMs: 150 });
    const host = await connectClient(url);
    const guest = await connectClient(url);
    const created = mustJoin(await send<JoinedAck>(host, CLIENT_EVENTS.createRoom, profile("Priya")));
    mustJoin(
      await send<JoinedAck>(guest, CLIENT_EVENTS.joinRoom, { ...profile("Sam", "volt"), code: created.code }),
    );
    await send<Ack>(host, CLIENT_EVENTS.selectGame, { gameId: "most-likely-to" });

    const sawStarting = waitFor<RoomView>(guest, SERVER_EVENTS.roomState, (v) => v.phase === "starting");
    const sawGame = waitFor<RoomView>(guest, SERVER_EVENTS.roomState, (v) => v.phase === "in-game", 3_000);
    const started = await send<Ack>(host, CLIENT_EVENTS.startGame);
    expect(started.ok).toBe(true);

    const startingView = await sawStarting;
    expect(startingView.countdownEndsAt).not.toBeNull();
    expect((await sawGame).phase).toBe("in-game");
  });
});
