import { afterEach, describe, expect, it } from "vitest";
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type Ack,
  type JoinedPayload,
  type MltView,
  type RoomView,
} from "@chaos/shared";
import { createGameFactories } from "../src/games/registry";
import { RoomManager } from "../src/rooms/RoomManager";
import { sampleQuestions } from "./helpers";
import { connectClient, mustJoin, profile, runCleanups, send, startServer, waitFor } from "./socketHelpers";

type JoinedAck = Ack<JoinedPayload>;

afterEach(runCleanups);

/** The room can now run more than one game, so say which one this test expects. */
function mltView(view: RoomView): MltView {
  if (view.game?.gameId !== "most-likely-to") throw new Error("Expected a Who's Most Likely To game.");
  return view.game;
}

const vote = (targetId: string) => ({
  gameId: "most-likely-to",
  action: { type: "vote", targetId },
});

describe("a whole game over real connections", () => {
  it("plays Who's Most Likely To from the lobby to the results and back", async () => {
    const manager = new RoomManager({
      countdownMs: 100,
      gameFactories: createGameFactories({
        mltQuestions: sampleQuestions(),
        mltConfig: { rounds: 1, voteMs: 5_000, revealMs: 100 },
      }),
    });
    const { url } = await startServer({ manager, tickIntervalMs: 20 });
    const host = await connectClient(url);
    const guest = await connectClient(url);

    const created = mustJoin(await send<JoinedAck>(host, CLIENT_EVENTS.createRoom, profile("Priya")));
    const joined = mustJoin(
      await send<JoinedAck>(guest, CLIENT_EVENTS.joinRoom, { ...profile("Sam", "volt"), code: created.code }),
    );
    expect(await send<Ack>(host, CLIENT_EVENTS.selectGame, { gameId: "most-likely-to" })).toMatchObject({ ok: true });

    const guestSawVoting = waitFor<RoomView>(guest, SERVER_EVENTS.roomState, (v) => v.game?.step === "voting");
    expect((await send<Ack>(host, CLIENT_EVENTS.startGame)).ok).toBe(true);
    expect((await guestSawVoting).game?.round).toBe(1);

    // The host votes first. The guest may see THAT the host voted, but never WHO for.
    const guestSawOneVote = waitFor<RoomView>(guest, SERVER_EVENTS.roomState, (v) => v.game?.votedIds.length === 1);
    expect(await send<Ack>(host, CLIENT_EVENTS.gameAction, vote(joined.playerId))).toMatchObject({ ok: true });
    const partial = await guestSawOneVote;
    expect(mltView(partial).reveal).toBeNull();
    expect(JSON.stringify(partial)).not.toContain("targetId");

    const guestSawReveal = waitFor<RoomView>(guest, SERVER_EVENTS.roomState, (v) => v.game?.step === "reveal");
    const guestSawFinish = waitFor<RoomView>(guest, SERVER_EVENTS.roomState, (v) => v.game?.step === "finished", 3_000);
    expect(await send<Ack>(guest, CLIENT_EVENTS.gameAction, vote(created.playerId))).toMatchObject({ ok: true });
    expect(mltView(await guestSawReveal).reveal?.votes).toHaveLength(2);
    const finished = await guestSawFinish;
    expect(finished.game?.results?.ranking).toHaveLength(2);

    const hostSawLobby = waitFor<RoomView>(host, SERVER_EVENTS.roomState, (v) => v.phase === "lobby");
    expect(await send<Ack>(guest, CLIENT_EVENTS.returnToLobby)).toMatchObject({ ok: false, error: "NOT_HOST" });
    expect(await send<Ack>(host, CLIENT_EVENTS.returnToLobby)).toMatchObject({ ok: true });
    const lobby = await hostSawLobby;
    expect(lobby.game).toBeNull();
    expect(lobby.selectedGame).toBe("most-likely-to");
  });

  it("refuses game actions from outside a game and malformed wrappers", async () => {
    const { url } = await startServer();
    const client = await connectClient(url);
    expect(await send<Ack>(client, CLIENT_EVENTS.gameAction, vote("x"))).toMatchObject({
      ok: false,
      error: "NOT_IN_ROOM",
    });
    expect(await send<Ack>(client, CLIENT_EVENTS.gameAction, { gameId: "chess" })).toMatchObject({
      ok: false,
      error: "INVALID_INPUT",
    });
  });
});
