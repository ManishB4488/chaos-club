import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import {
  GAME_PLAYER_LIMITS,
  PLAYER_COLORS,
  ROOM_MAX_PLAYERS,
  type GameId,
  type RoomErrorCode,
  type RoomPhase,
  type RoomView,
} from "@chaos/shared";
import type { GameFactories } from "../games/registry";
import type { GameInstance } from "../games/types";
import { InMemoryRoomStore, type RoomStore } from "../storage/roomStore";
import { generateRoomCode } from "./codes";
import {
  BELOW_MIN_GRACE_MS,
  CODE_ATTEMPTS,
  DISCONNECT_GRACE_MS,
  EMPTY_ROOM_TTL_MS,
  MAX_ROOMS,
  START_COUNTDOWN_MS,
} from "./constants";
import type { Player, PlayerProfile, Result, Room } from "./types";

export type RoomManagerOptions = {
  store?: RoomStore;
  now?: () => number;
  generateCode?: () => string;
  generateId?: () => string;
  generateToken?: () => string;
  /** The games that really exist. Their ids are the games that can be started. */
  gameFactories?: GameFactories;
  random?: () => number;
  /** Overrides which games can be started. Only for tests of the room rules. */
  availableGames?: readonly GameId[];
  maxRooms?: number;
  countdownMs?: number;
};

type Located = { room: Room; player: Player };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: RoomErrorCode): Result<never> => ({ ok: false, error });

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * All room rules in one place. It knows nothing about sockets or the network: callers pass in the
 * socket id of whoever is acting. Who someone is comes from the socket they are connected with,
 * never from ids the browser sends, so one player cannot act as another.
 */
export class RoomManager {
  private readonly store: RoomStore;
  private readonly now: () => number;
  private readonly generateCode: () => string;
  private readonly generateId: () => string;
  private readonly generateToken: () => string;
  private readonly availableGames: readonly GameId[];
  private readonly gameFactories: GameFactories;
  private readonly random: () => number;
  private readonly maxRooms: number;
  private readonly countdownMs: number;
  /** socket id -> which player that socket is. */
  private readonly sockets = new Map<string, { code: string; playerId: string }>();

  constructor(options: RoomManagerOptions = {}) {
    this.store = options.store ?? new InMemoryRoomStore();
    this.now = options.now ?? (() => Date.now());
    this.generateCode = options.generateCode ?? generateRoomCode;
    this.generateId = options.generateId ?? (() => randomUUID());
    this.generateToken = options.generateToken ?? (() => randomBytes(32).toString("base64url"));
    this.gameFactories = options.gameFactories ?? {};
    this.random = options.random ?? Math.random;
    this.availableGames = options.availableGames ?? (Object.keys(this.gameFactories) as GameId[]);
    this.maxRooms = options.maxRooms ?? MAX_ROOMS;
    this.countdownMs = options.countdownMs ?? START_COUNTDOWN_MS;
  }

  // ---------- joining and leaving ----------

  createRoom(
    profile: PlayerProfile,
    socketId: string,
  ): Result<{ code: string; playerId: string; sessionToken: string }> {
    if (this.sockets.has(socketId)) return fail("ALREADY_IN_ROOM");
    if (this.store.size() >= this.maxRooms) return fail("SERVER_BUSY");
    const code = this.uniqueCode();
    if (!code) return fail("SERVER_BUSY");

    const player = this.newPlayer(profile, [], socketId);
    const room: Room = {
      code,
      phase: "lobby",
      hostId: player.id,
      players: [player],
      selectedGame: null,
      countdownEndsAt: null,
      createdAt: this.now(),
      emptySince: null,
      game: null,
      belowMinSince: null,
    };
    this.store.set(room);
    this.sockets.set(socketId, { code, playerId: player.id });
    return ok({ code, playerId: player.id, sessionToken: player.sessionToken });
  }

  joinRoom(
    code: string,
    profile: PlayerProfile,
    socketId: string,
  ): Result<{ code: string; playerId: string; sessionToken: string }> {
    if (this.sockets.has(socketId)) return fail("ALREADY_IN_ROOM");
    const room = this.store.get(code);
    if (!room) return fail("ROOM_NOT_FOUND");
    if (room.phase !== "lobby") return fail("ROOM_LOCKED");
    if (room.players.length >= ROOM_MAX_PLAYERS) return fail("ROOM_FULL");

    const wanted = profile.nickname.trim().toLowerCase();
    if (room.players.some((p) => p.nickname.trim().toLowerCase() === wanted)) {
      return fail("NICKNAME_TAKEN");
    }

    const player = this.newPlayer(profile, room.players, socketId);
    room.players.push(player);
    room.emptySince = null;
    this.sockets.set(socketId, { code, playerId: player.id });
    return ok({ code, playerId: player.id, sessionToken: player.sessionToken });
  }

  /** Restores a seat after a refresh or a dropped connection, using the player's private token. */
  rejoinRoom(
    code: string,
    sessionToken: string,
    socketId: string,
  ): Result<{ code: string; playerId: string; replacedSocketId: string | null }> {
    const existing = this.sockets.get(socketId);
    if (existing) {
      // The same connection asking again with its own valid token (for example right after
      // creating the room and opening its page) is fine and changes nothing.
      const current = this.store.get(existing.code);
      const self = current?.players.find((p) => p.id === existing.playerId);
      if (current && self && current.code === code && safeEqual(self.sessionToken, sessionToken)) {
        return ok({ code, playerId: self.id, replacedSocketId: null });
      }
      return fail("ALREADY_IN_ROOM");
    }
    const room = this.store.get(code);
    if (!room) return fail("ROOM_NOT_FOUND");
    const player = room.players.find((p) => safeEqual(p.sessionToken, sessionToken));
    if (!player) return fail("INVALID_SESSION");

    let replacedSocketId: string | null = null;
    if (player.socketId && player.socketId !== socketId) {
      replacedSocketId = player.socketId;
      this.sockets.delete(player.socketId);
    }
    player.socketId = socketId;
    player.connected = true;
    player.disconnectedAt = null;
    room.emptySince = null;
    this.sockets.set(socketId, { code, playerId: player.id });
    return ok({ code, playerId: player.id, replacedSocketId });
  }

  leave(socketId: string): Result<{ code: string; roomDeleted: boolean }> {
    const located = this.locate(socketId);
    if (!located) return fail("NOT_IN_ROOM");
    this.sockets.delete(socketId);
    const roomDeleted = this.removePlayer(located.room, located.player.id);
    return ok({ code: located.room.code, roomDeleted });
  }

  kick(socketId: string, targetId: string): Result<{ code: string; kickedSocketId: string | null }> {
    const located = this.locate(socketId);
    if (!located) return fail("NOT_IN_ROOM");
    const { room, player } = located;
    if (room.hostId !== player.id) return fail("NOT_HOST");
    if (targetId === player.id) return fail("CANNOT_KICK_SELF");
    if (room.phase !== "lobby") return fail("ROOM_LOCKED");
    const target = room.players.find((p) => p.id === targetId);
    if (!target) return fail("PLAYER_NOT_FOUND");

    const kickedSocketId = target.socketId;
    this.removePlayer(room, target.id);
    return ok({ code: room.code, kickedSocketId });
  }

  /** The socket dropped. The player keeps their seat for a while so they can come back. */
  disconnect(socketId: string): { code: string } | null {
    const ref = this.sockets.get(socketId);
    if (!ref) return null;
    this.sockets.delete(socketId);
    const room = this.store.get(ref.code);
    const player = room?.players.find((p) => p.id === ref.playerId);
    if (!room || !player) return null;

    player.connected = false;
    player.socketId = null;
    player.disconnectedAt = this.now();
    this.refreshEmpty(room);
    return { code: room.code };
  }

  // ---------- lobby actions (host only) ----------

  selectGame(socketId: string, gameId: GameId): Result<{ code: string }> {
    const located = this.locate(socketId);
    if (!located) return fail("NOT_IN_ROOM");
    const { room, player } = located;
    if (room.hostId !== player.id) return fail("NOT_HOST");
    if (room.phase !== "lobby") return fail("ROOM_LOCKED");
    if (room.players.length > GAME_PLAYER_LIMITS[gameId].max) return fail("TOO_MANY_PLAYERS");

    room.selectedGame = gameId;
    return ok({ code: room.code });
  }

  start(socketId: string): Result<{ code: string; countdownEndsAt: number }> {
    const located = this.locate(socketId);
    if (!located) return fail("NOT_IN_ROOM");
    const { room, player } = located;
    if (room.hostId !== player.id) return fail("NOT_HOST");
    if (room.phase !== "lobby") return fail("ROOM_LOCKED");
    if (!room.selectedGame) return fail("NO_GAME_SELECTED");
    if (!this.availableGames.includes(room.selectedGame)) return fail("GAME_NOT_AVAILABLE");
    if (this.connectedCount(room) < GAME_PLAYER_LIMITS[room.selectedGame].min) {
      return fail("NOT_ENOUGH_PLAYERS");
    }

    room.phase = "starting";
    room.countdownEndsAt = this.now() + this.countdownMs;
    return ok({ code: room.code, countdownEndsAt: room.countdownEndsAt });
  }

  /** Called when the countdown timer fires. Returns the new phase, or null if nothing to do. */
  completeCountdown(code: string): RoomPhase | null {
    const room = this.store.get(code);
    if (!room || room.phase !== "starting" || !room.selectedGame) return null;

    if (this.connectedCount(room) < GAME_PLAYER_LIMITS[room.selectedGame].min) {
      room.phase = "lobby";
      room.countdownEndsAt = null;
      return "lobby";
    }
    room.phase = "in-game";
    room.countdownEndsAt = null;
    room.belowMinSince = null;
    room.game = this.createGameInstance(room);
    return "in-game";
  }

  // ---------- during a game ----------

  /** Passes a player's action to the running game. The game checks and applies it. */
  gameAction(socketId: string, gameId: GameId, action: unknown): Result<{ code: string }> {
    const located = this.locate(socketId);
    if (!located) return fail("NOT_IN_ROOM");
    const { room, player } = located;
    if (room.phase !== "in-game" || !room.game || room.game.id !== gameId) {
      return fail("NO_GAME_RUNNING");
    }
    const result = room.game.handleAction(player.id, action);
    return result.ok ? ok({ code: room.code }) : result;
  }

  /** After a game is over, the host can bring everyone back to the lobby (also used for a rematch). */
  returnToLobby(socketId: string): Result<{ code: string }> {
    const located = this.locate(socketId);
    if (!located) return fail("NOT_IN_ROOM");
    const { room, player } = located;
    if (room.hostId !== player.id) return fail("NOT_HOST");
    if (room.phase !== "in-game" || (room.game && !room.game.isFinished())) return fail("ROOM_LOCKED");

    room.phase = "lobby";
    room.game = null;
    room.countdownEndsAt = null;
    room.belowMinSince = null;
    return ok({ code: room.code });
  }

  /** Run several times a second. Moves running games along and ends games that lost too many players. */
  tick(): string[] {
    const changed: string[] = [];
    const now = this.now();
    for (const room of this.store.list()) {
      const game = room.game;
      if (room.phase !== "in-game" || !game || game.isFinished()) {
        room.belowMinSince = null;
        continue;
      }
      let dirty = game.tick(now);
      if (game.isFinished()) {
        room.belowMinSince = null;
      } else if (this.connectedCount(room) < GAME_PLAYER_LIMITS[game.id].min) {
        room.belowMinSince ??= now;
        if (now - room.belowMinSince >= BELOW_MIN_GRACE_MS) {
          game.forceFinish();
          room.belowMinSince = null;
          dirty = true;
        }
      } else {
        room.belowMinSince = null;
      }
      if (dirty) changed.push(room.code);
    }
    return changed;
  }

  // ---------- housekeeping ----------

  /** Run on a timer. Removes players who stayed disconnected too long and deletes abandoned rooms. */
  sweep(): { changedRooms: string[]; deletedRooms: string[] } {
    const now = this.now();
    const changed = new Set<string>();
    const deleted: string[] = [];

    for (const room of this.store.list()) {
      if (room.phase !== "in-game") {
        const expired = room.players.filter(
          (p) =>
            !p.connected &&
            p.disconnectedAt !== null &&
            now - p.disconnectedAt >= DISCONNECT_GRACE_MS,
        );
        let roomGone = false;
        for (const player of expired) {
          changed.add(room.code);
          roomGone = this.removePlayer(room, player.id);
          if (roomGone) break;
        }
        if (roomGone) {
          changed.delete(room.code);
          deleted.push(room.code);
          continue;
        }
      }

      if (room.emptySince !== null && now - room.emptySince >= EMPTY_ROOM_TTL_MS) {
        this.dropRoom(room);
        changed.delete(room.code);
        deleted.push(room.code);
      }
    }
    return { changedRooms: [...changed], deletedRooms: deleted };
  }

  // ---------- reading state ----------

  /** Which player and room a socket belongs to. */
  identify(socketId: string): { code: string; playerId: string } | null {
    const located = this.locate(socketId);
    return located ? { code: located.room.code, playerId: located.player.id } : null;
  }

  /** The private snapshot for one player. Never includes session tokens. */
  viewFor(code: string, playerId: string): RoomView | null {
    const room = this.store.get(code);
    if (!room) return null;
    const game = room.selectedGame;
    return {
      code: room.code,
      phase: room.phase,
      hostId: room.hostId,
      selfId: playerId,
      players: room.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        color: p.color,
        isHost: p.id === room.hostId,
        connected: p.connected,
      })),
      selectedGame: game,
      availableGames: [...this.availableGames],
      game: room.game ? room.game.viewFor(playerId) : null,
      minPlayersForGame: game ? GAME_PLAYER_LIMITS[game].min : null,
      maxPlayers: ROOM_MAX_PLAYERS,
      countdownEndsAt: room.countdownEndsAt,
      serverTime: this.now(),
    };
  }

  /** Everyone currently connected in a room, so the caller knows who to send updates to. */
  recipients(code: string): { playerId: string; socketId: string }[] {
    const room = this.store.get(code);
    if (!room) return [];
    return room.players.flatMap((p) =>
      p.socketId ? [{ playerId: p.id, socketId: p.socketId }] : [],
    );
  }

  roomCount(): number {
    return this.store.size();
  }

  // ---------- internals ----------

  private createGameInstance(room: Room): GameInstance | null {
    const gameId = room.selectedGame;
    const factory = gameId ? this.gameFactories[gameId] : undefined;
    if (!factory) return null;
    return factory({
      players: room.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        color: p.color,
      })),
      now: this.now,
      random: this.random,
      isConnected: (playerId) => room.players.some((p) => p.id === playerId && p.connected),
    });
  }

  private locate(socketId: string): Located | null {
    const ref = this.sockets.get(socketId);
    if (!ref) return null;
    const room = this.store.get(ref.code);
    const player = room?.players.find((p) => p.id === ref.playerId);
    if (!room || !player) {
      this.sockets.delete(socketId);
      return null;
    }
    return { room, player };
  }

  private uniqueCode(): string | null {
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const code = this.generateCode();
      if (!this.store.get(code)) return code;
    }
    return null;
  }

  /** If the wanted color is already taken in this room, quietly give the player a free one. */
  private newPlayer(profile: PlayerProfile, existing: Player[], socketId: string): Player {
    const taken = new Set(existing.map((p) => p.color));
    const color = taken.has(profile.color)
      ? (PLAYER_COLORS.find((c) => !taken.has(c)) ?? profile.color)
      : profile.color;
    return {
      id: this.generateId(),
      nickname: profile.nickname,
      avatar: profile.avatar,
      color,
      sessionToken: this.generateToken(),
      socketId,
      connected: true,
      disconnectedAt: null,
    };
  }

  private connectedCount(room: Room): number {
    return room.players.filter((p) => p.connected).length;
  }

  /** Removes a player. Returns true if that emptied (and deleted) the room. */
  private removePlayer(room: Room, playerId: string): boolean {
    const index = room.players.findIndex((p) => p.id === playerId);
    if (index < 0) return false;
    const [removed] = room.players.splice(index, 1);
    if (removed?.socketId) this.sockets.delete(removed.socketId);

    if (room.players.length === 0) {
      this.store.delete(room.code);
      return true;
    }
    if (room.hostId === playerId) {
      const nextHost = room.players.find((p) => p.connected) ?? room.players[0];
      if (nextHost) room.hostId = nextHost.id;
    }
    if (room.phase === "starting" && room.selectedGame) {
      if (this.connectedCount(room) < GAME_PLAYER_LIMITS[room.selectedGame].min) {
        room.phase = "lobby";
        room.countdownEndsAt = null;
      }
    }
    this.refreshEmpty(room);
    return false;
  }

  private refreshEmpty(room: Room): void {
    if (this.connectedCount(room) > 0) {
      room.emptySince = null;
    } else if (room.emptySince === null) {
      room.emptySince = this.now();
    }
  }

  private dropRoom(room: Room): void {
    for (const player of room.players) {
      if (player.socketId) this.sockets.delete(player.socketId);
    }
    this.store.delete(room.code);
  }
}
