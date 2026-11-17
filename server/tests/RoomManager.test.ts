import { describe, expect, it } from "vitest";
import {
  ROOM_CODE_ALPHABET,
  roomCodeSchema,
  type AvatarId,
  type PlayerColor,
  type RoomErrorCode,
} from "@chaos/shared";
import { generateRoomCode } from "../src/rooms/codes";
import {
  BELOW_MIN_GRACE_MS,
  DISCONNECT_GRACE_MS,
  EMPTY_ROOM_TTL_MS,
  START_COUNTDOWN_MS,
} from "../src/rooms/constants";
import { createGameFactories } from "../src/games/registry";
import { sampleQuestions } from "./helpers";
import { RoomManager, type RoomManagerOptions } from "../src/rooms/RoomManager";
import type { PlayerProfile, Result } from "../src/rooms/types";

function profile(
  nickname: string,
  color: PlayerColor = "grape",
  avatar: AvatarId = "cat",
): PlayerProfile {
  return { nickname, avatar, color };
}

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`Expected success but got ${result.error}`);
  return result.value;
}

function expectError(result: Result<unknown>, error: RoomErrorCode): void {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe(error);
}

function setup(options: RoomManagerOptions = {}) {
  let time = 1_000_000;
  let idCounter = 0;
  let tokenCounter = 0;
  const manager = new RoomManager({
    now: () => time,
    generateId: () => `player-${++idCounter}`,
    generateToken: () => `token-${++tokenCounter}-xxxxxxxxxxxxxxxxxxxx`,
    ...options,
  });
  return {
    manager,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

/** Creates a room (socket s1 is the host) and joins the other names as sockets s2, s3, s4. */
function fillRoom(manager: RoomManager, names: string[]) {
  const colors: PlayerColor[] = ["grape", "volt", "tangerine", "bubblegum"];
  const created = unwrap(manager.createRoom(profile(names[0] ?? "Host", colors[0]), "s1"));
  const ids = [created.playerId];
  const tokens = [created.sessionToken];
  names.slice(1).forEach((name, index) => {
    const joined = unwrap(manager.joinRoom(created.code, profile(name, colors[index + 1]), `s${index + 2}`));
    ids.push(joined.playerId);
    tokens.push(joined.sessionToken);
  });
  return { code: created.code, ids, tokens };
}

describe("room codes", () => {
  it("are 6 characters from the safe alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(roomCodeSchema.safeParse(code).success).toBe(true);
      for (const char of code) expect(ROOM_CODE_ALPHABET).toContain(char);
    }
  });

  it("are retried when a random code is already taken", () => {
    const codes = ["SAMEAA", "SAMEAA", "OTHERR"];
    let index = 0;
    const { manager } = setup({ generateCode: () => codes[index++] ?? "ZZZZZZ" });
    const first = unwrap(manager.createRoom(profile("A"), "s1"));
    const second = unwrap(manager.createRoom(profile("B"), "s2"));
    expect(first.code).toBe("SAMEAA");
    expect(second.code).toBe("OTHERR");
  });
});

describe("creating and joining", () => {
  it("makes the creator the host of a new lobby", () => {
    const { manager } = setup();
    const created = unwrap(manager.createRoom(profile("Priya"), "s1"));
    expect(roomCodeSchema.safeParse(created.code).success).toBe(true);
    const view = manager.viewFor(created.code, created.playerId);
    expect(view?.phase).toBe("lobby");
    expect(view?.hostId).toBe(created.playerId);
    expect(view?.players).toHaveLength(1);
    expect(view?.players[0]?.isHost).toBe(true);
  });

  it("lets others join and keeps the first player as host", () => {
    const { manager } = setup();
    const { code, ids } = fillRoom(manager, ["Priya", "Sam"]);
    const view = manager.viewFor(code, ids[1] ?? "");
    expect(view?.players).toHaveLength(2);
    expect(view?.hostId).toBe(ids[0]);
    expect(view?.selfId).toBe(ids[1]);
  });

  it("rejects an unknown room", () => {
    const { manager } = setup();
    expectError(manager.joinRoom("ZZZZZZ", profile("Sam"), "s2"), "ROOM_NOT_FOUND");
  });

  it("rejects a nickname already used, ignoring case", () => {
    const { manager } = setup();
    const { code } = fillRoom(manager, ["Priya"]);
    expectError(manager.joinRoom(code, profile("pRiYa", "volt"), "s2"), "NICKNAME_TAKEN");
  });

  it("rejects a fifth player", () => {
    const { manager } = setup();
    const { code } = fillRoom(manager, ["A", "B", "C", "D"]);
    expectError(manager.joinRoom(code, profile("E"), "s5"), "ROOM_FULL");
  });

  it("gives a free color when the wanted one is taken", () => {
    const { manager } = setup();
    const { code, ids } = fillRoom(manager, ["A"]);
    unwrap(manager.joinRoom(code, profile("B", "grape"), "s2"));
    const colors = manager.viewFor(code, ids[0] ?? "")?.players.map((p) => p.color) ?? [];
    expect(new Set(colors).size).toBe(2);
  });

  it("does not let one socket be in two rooms", () => {
    const { manager } = setup();
    unwrap(manager.createRoom(profile("A"), "s1"));
    expectError(manager.createRoom(profile("B"), "s1"), "ALREADY_IN_ROOM");
  });

  it("stops creating rooms at the room limit", () => {
    const { manager } = setup({ maxRooms: 1 });
    unwrap(manager.createRoom(profile("A"), "s1"));
    expectError(manager.createRoom(profile("B"), "s2"), "SERVER_BUSY");
  });
});

describe("reconnecting", () => {
  it("marks a dropped player disconnected and restores them with their token", () => {
    const { manager } = setup();
    const { code, ids, tokens } = fillRoom(manager, ["A", "B"]);
    manager.disconnect("s2");
    expect(manager.viewFor(code, ids[0] ?? "")?.players[1]?.connected).toBe(false);

    const rejoined = unwrap(manager.rejoinRoom(code, tokens[1] ?? "", "s9"));
    expect(rejoined.playerId).toBe(ids[1]);
    expect(manager.viewFor(code, ids[0] ?? "")?.players[1]?.connected).toBe(true);
    expect(manager.identify("s9")?.playerId).toBe(ids[1]);
  });

  it("rejects a wrong token", () => {
    const { manager } = setup();
    const { code } = fillRoom(manager, ["A"]);
    expectError(manager.rejoinRoom(code, "not-the-right-token-at-all", "s9"), "INVALID_SESSION");
  });

  it("treats a repeated rejoin from the same connection as a harmless success", () => {
    const { manager } = setup();
    const { code, ids, tokens } = fillRoom(manager, ["A"]);
    const again = unwrap(manager.rejoinRoom(code, tokens[0] ?? "", "s1"));
    expect(again.playerId).toBe(ids[0]);
    expect(again.replacedSocketId).toBeNull();
    expectError(manager.rejoinRoom(code, "some-other-token-entirely", "s1"), "ALREADY_IN_ROOM");
  });

  it("reports the old socket when the same player reconnects from a new one", () => {
    const { manager } = setup();
    const { code, tokens } = fillRoom(manager, ["A", "B"]);
    const rejoined = unwrap(manager.rejoinRoom(code, tokens[1] ?? "", "s9"));
    expect(rejoined.replacedSocketId).toBe("s2");
    expect(manager.identify("s2")).toBeNull();
  });

  it("does not move the host just because the host disconnected", () => {
    const { manager } = setup();
    const { code, ids } = fillRoom(manager, ["A", "B"]);
    manager.disconnect("s1");
    expect(manager.viewFor(code, ids[1] ?? "")?.hostId).toBe(ids[0]);
  });
});

describe("leaving and kicking", () => {
  it("passes the host role to the longest-present connected player", () => {
    const { manager } = setup();
    const { code, ids } = fillRoom(manager, ["A", "B", "C"]);
    manager.disconnect("s2");
    unwrap(manager.leave("s1"));
    expect(manager.viewFor(code, ids[2] ?? "")?.hostId).toBe(ids[2]);
  });

  it("deletes the room when the last player leaves", () => {
    const { manager } = setup();
    const { code } = fillRoom(manager, ["A"]);
    const result = unwrap(manager.leave("s1"));
    expect(result.roomDeleted).toBe(true);
    expect(manager.viewFor(code, "player-1")).toBeNull();
    expect(manager.roomCount()).toBe(0);
  });

  it("lets only the host kick, and tells which socket to disconnect", () => {
    const { manager } = setup();
    const { code, ids } = fillRoom(manager, ["A", "B", "C"]);
    expectError(manager.kick("s2", ids[2] ?? ""), "NOT_HOST");
    expectError(manager.kick("s1", ids[0] ?? ""), "CANNOT_KICK_SELF");
    expectError(manager.kick("s1", "nobody"), "PLAYER_NOT_FOUND");

    const kicked = unwrap(manager.kick("s1", ids[1] ?? ""));
    expect(kicked.kickedSocketId).toBe("s2");
    expect(manager.identify("s2")).toBeNull();
    expect(manager.viewFor(code, ids[0] ?? "")?.players).toHaveLength(2);
  });
});

describe("choosing and starting a game", () => {
  it("tells every player which games can be started", () => {
    const { manager } = setup({ availableGames: ["impostor"] });
    const { code, ids } = fillRoom(manager, ["A"]);
    expect(manager.viewFor(code, ids[0] ?? "")?.availableGames).toEqual(["impostor"]);
  });

  it("lets only the host pick a game", () => {
    const { manager } = setup();
    const { code, ids } = fillRoom(manager, ["A", "B"]);
    expectError(manager.selectGame("s2", "roast"), "NOT_HOST");
    unwrap(manager.selectGame("s1", "impostor"));
    const view = manager.viewFor(code, ids[0] ?? "");
    expect(view?.selectedGame).toBe("impostor");
    expect(view?.minPlayersForGame).toBe(3);
  });

  it("refuses to start without a game, with an unavailable game, or without enough players", () => {
    const { manager } = setup({ availableGames: ["impostor", "most-likely-to"] });
    fillRoom(manager, ["A", "B"]);
    expectError(manager.start("s1"), "NO_GAME_SELECTED");

    unwrap(manager.selectGame("s1", "roast"));
    expectError(manager.start("s1"), "GAME_NOT_AVAILABLE");

    unwrap(manager.selectGame("s1", "impostor"));
    expectError(manager.start("s1"), "NOT_ENOUGH_PLAYERS");
    expectError(manager.start("s2"), "NOT_HOST");
  });

  it("starts a countdown, locks the room, then enters the game", () => {
    const { manager } = setup({ availableGames: ["most-likely-to"] });
    const { code, ids } = fillRoom(manager, ["A", "B"]);
    unwrap(manager.selectGame("s1", "most-likely-to"));
    const started = unwrap(manager.start("s1"));
    expect(started.countdownEndsAt).toBe(1_000_000 + START_COUNTDOWN_MS);
    expect(manager.viewFor(code, ids[0] ?? "")?.phase).toBe("starting");
    expectError(manager.joinRoom(code, profile("C", "sunny"), "s3"), "ROOM_LOCKED");

    expect(manager.completeCountdown(code)).toBe("in-game");
    expect(manager.viewFor(code, ids[0] ?? "")?.phase).toBe("in-game");
  });

  it("cancels the start if too many players leave during the countdown", () => {
    const { manager } = setup({ availableGames: ["most-likely-to"] });
    const { code, ids } = fillRoom(manager, ["A", "B"]);
    unwrap(manager.selectGame("s1", "most-likely-to"));
    unwrap(manager.start("s1"));
    unwrap(manager.leave("s2"));
    const view = manager.viewFor(code, ids[0] ?? "");
    expect(view?.phase).toBe("lobby");
    expect(view?.countdownEndsAt).toBeNull();
  });
});

describe("cleanup", () => {
  it("removes a player who stays disconnected too long", () => {
    const { manager, advance } = setup();
    const { code, ids } = fillRoom(manager, ["A", "B"]);
    manager.disconnect("s2");

    advance(DISCONNECT_GRACE_MS - 1_000);
    manager.sweep();
    expect(manager.viewFor(code, ids[0] ?? "")?.players).toHaveLength(2);

    advance(2_000);
    const result = manager.sweep();
    expect(result.changedRooms).toEqual([code]);
    expect(manager.viewFor(code, ids[0] ?? "")?.players).toHaveLength(1);
  });

  it("deletes a lobby once everyone has been gone past the grace period", () => {
    const { manager, advance } = setup();
    const { code } = fillRoom(manager, ["A"]);
    manager.disconnect("s1");
    advance(DISCONNECT_GRACE_MS + 1_000);
    expect(manager.sweep().deletedRooms).toEqual([code]);
    expect(manager.roomCount()).toBe(0);
  });

  it("deletes an abandoned in-game room only after the empty-room time limit", () => {
    const { manager, advance } = setup({ availableGames: ["most-likely-to"] });
    const { code } = fillRoom(manager, ["A", "B"]);
    unwrap(manager.selectGame("s1", "most-likely-to"));
    unwrap(manager.start("s1"));
    manager.completeCountdown(code);
    manager.disconnect("s1");
    manager.disconnect("s2");

    advance(EMPTY_ROOM_TTL_MS - 60_000);
    expect(manager.sweep().deletedRooms).toEqual([]);
    expect(manager.roomCount()).toBe(1);

    advance(61_000);
    expect(manager.sweep().deletedRooms).toEqual([code]);
    expect(manager.roomCount()).toBe(0);
  });
});

describe("secrets", () => {
  it("never puts a session token in any player's view", () => {
    const { manager } = setup();
    const { code, ids, tokens } = fillRoom(manager, ["A", "B", "C"]);
    for (const id of ids) {
      const json = JSON.stringify(manager.viewFor(code, id));
      for (const token of tokens) expect(json).not.toContain(token);
    }
  });

  it("ignores actions from sockets that are not in a room", () => {
    const { manager } = setup();
    expectError(manager.leave("ghost"), "NOT_IN_ROOM");
    expectError(manager.start("ghost"), "NOT_IN_ROOM");
    expectError(manager.kick("ghost", "x"), "NOT_IN_ROOM");
    expectError(manager.selectGame("ghost", "roast"), "NOT_IN_ROOM");
  });
});

describe("running a game inside a room", () => {
  function gameSetup(mltConfig = { rounds: 1, voteMs: 1_000, revealMs: 500 }) {
    const { manager, advance } = setup({
      gameFactories: createGameFactories({ mltQuestions: sampleQuestions(), mltConfig }),
    });
    const room = fillRoom(manager, ["A", "B"]);
    unwrap(manager.selectGame("s1", "most-likely-to"));
    unwrap(manager.start("s1"));
    manager.completeCountdown(room.code);
    return { manager, advance, ...room };
  }

  const voteFor = (targetId: string) => ({ type: "vote", targetId });

  it("offers exactly the games that exist, and starts one when the countdown ends", () => {
    const { manager, code, ids } = gameSetup();
    const view = manager.viewFor(code, ids[0] ?? "");
    expect(view?.availableGames).toEqual(["most-likely-to"]);
    expect(view?.phase).toBe("in-game");
    expect(view?.game?.gameId).toBe("most-likely-to");
  });

  it("passes votes to the game and keeps them secret from the others", () => {
    const { manager, code, ids } = gameSetup();
    unwrap(manager.gameAction("s1", "most-likely-to", voteFor(ids[1] ?? "")));
    const seenByOther = manager.viewFor(code, ids[1] ?? "");
    expect(seenByOther?.game?.votedIds).toEqual([ids[0]]);
    expect(JSON.stringify(seenByOther)).not.toContain("targetId");
    unwrap(manager.gameAction("s2", "most-likely-to", voteFor(ids[0] ?? "")));
    expect(manager.viewFor(code, ids[0] ?? "")?.game?.step).toBe("reveal");
  });

  it("refuses game actions when no matching game is running", () => {
    const { manager } = setup({ availableGames: ["most-likely-to"] });
    fillRoom(manager, ["A", "B"]);
    expectError(manager.gameAction("s1", "most-likely-to", voteFor("x")), "NO_GAME_RUNNING");

    const running = gameSetup();
    expectError(running.manager.gameAction("s1", "impostor", voteFor("x")), "NO_GAME_RUNNING");
    expectError(running.manager.gameAction("ghost", "most-likely-to", voteFor("x")), "NOT_IN_ROOM");
  });

  it("only lets the host go back to the lobby, and only when the game is over", () => {
    const { manager, advance, code, ids } = gameSetup();
    expectError(manager.returnToLobby("s1"), "ROOM_LOCKED");

    unwrap(manager.gameAction("s1", "most-likely-to", voteFor(ids[1] ?? "")));
    unwrap(manager.gameAction("s2", "most-likely-to", voteFor(ids[0] ?? "")));
    advance(500);
    manager.tick();
    expect(manager.viewFor(code, ids[0] ?? "")?.game?.step).toBe("finished");

    expectError(manager.returnToLobby("s2"), "NOT_HOST");
    unwrap(manager.returnToLobby("s1"));
    const view = manager.viewFor(code, ids[0] ?? "");
    expect(view?.phase).toBe("lobby");
    expect(view?.game).toBeNull();
    expect(view?.selectedGame).toBe("most-likely-to");
  });

  it("does not wait for a player who is offline", () => {
    const { manager, code, ids } = gameSetup({ rounds: 1, voteMs: 600_000, revealMs: 500 });
    manager.disconnect("s2");
    unwrap(manager.gameAction("s1", "most-likely-to", voteFor(ids[1] ?? "")));
    expect(manager.viewFor(code, ids[0] ?? "")?.game?.step).toBe("reveal");
  });

  it("ends the game early if too few players stay connected for a minute", () => {
    const { manager, advance, code, ids } = gameSetup({ rounds: 1, voteMs: 600_000, revealMs: 500 });
    manager.disconnect("s2");
    // The real server checks four times a second, so the one-minute clock starts straight away.
    manager.tick();

    advance(BELOW_MIN_GRACE_MS - 1_000);
    expect(manager.tick()).toEqual([]);
    expect(manager.viewFor(code, ids[0] ?? "")?.game?.step).toBe("voting");

    advance(2_000);
    expect(manager.tick()).toEqual([code]);
    const game = manager.viewFor(code, ids[0] ?? "")?.game;
    expect(game?.step).toBe("finished");
    expect(game?.results?.endedEarly).toBe(true);
  });
});

describe("reports from a game", () => {
  it("keeps a player's report, with the room code, for later review", () => {
    const roastPrompts = [
      { id: "r1", category: "general" as const, text: "What is the worst name for a superhero?" },
      { id: "r2", category: "general" as const, text: "What is the worst thing to say on a first date?" },
    ];
    const { manager } = setup({
      gameFactories: createGameFactories({
        mltQuestions: sampleQuestions(),
        roastPrompts,
        roastConfig: { rounds: 1, writingMs: 600_000, votingMs: 600_000, revealMs: 500 },
      }),
    });
    const room = fillRoom(manager, ["A", "B", "C"]);
    unwrap(manager.selectGame("s1", "roast"));
    unwrap(manager.start("s1"));
    manager.completeCountdown(room.code);

    ["s1", "s2", "s3"].forEach((socket, i) =>
      unwrap(manager.gameAction(socket, "roast", { type: "submit", text: `answer ${i}` })),
    );
    const view = manager.viewFor(room.code, room.ids[0] ?? "");
    const game = view?.game;
    expect(game?.gameId).toBe("roast");
    if (game?.gameId !== "roast") return;
    const target = game.answers.find((a) => !a.mine);
    unwrap(manager.gameAction("s1", "roast", { type: "report", answerId: target?.id ?? "", reason: "rude" }));

    const reports = manager.listReports();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ game: "roast", text: target?.text, reason: "rude", roomCode: room.code });
  });
});
