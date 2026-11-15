import type { Server, Socket } from "socket.io";
import type { ZodType } from "zod";
import {
  CLIENT_EVENTS,
  ROOM_ERROR_MESSAGES,
  SERVER_EVENTS,
  createRoomSchema,
  gameActionSchema,
  joinRoomSchema,
  kickPlayerSchema,
  rejoinRoomSchema,
  selectGameSchema,
  type AckError,
  type JoinedPayload,
  type RoomErrorCode,
} from "@chaos/shared";
import type { RoomManager } from "../rooms/RoomManager";
import { KeyedLimiter, TokenBucket } from "./rateLimiter";

export type GatewayOptions = {
  now?: () => number;
  sweepIntervalMs?: number;
  /** How often running games are moved along. */
  tickIntervalMs?: number;
  trustProxy?: boolean;
};

type Reply = (response: unknown) => void;

const failure = (error: RoomErrorCode): AckError => ({
  ok: false,
  error,
  message: ROOM_ERROR_MESSAGES[error],
});

function clientIp(socket: Socket, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = socket.handshake.headers["x-forwarded-for"];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
    if (first) return first;
  }
  return socket.handshake.address;
}

/**
 * Connects browsers to the RoomManager. Every message is rate limited and validated before it
 * reaches the room rules, and every player only ever receives their own private snapshot.
 */
export function createRoomGateway(io: Server, manager: RoomManager, options: GatewayOptions = {}) {
  const now = options.now ?? (() => Date.now());
  const ipJoinLimiter = new KeyedLimiter(20, 0.5, now);
  const countdownTimers = new Set<NodeJS.Timeout>();

  /** Sends each connected player in the room their own snapshot. */
  const broadcast = (code: string): void => {
    for (const { playerId, socketId } of manager.recipients(code)) {
      const view = manager.viewFor(code, playerId);
      if (view) io.to(socketId).emit(SERVER_EVENTS.roomState, view);
    }
  };

  const joinedReply = (
    code: string,
    playerId: string,
    sessionToken: string,
  ): ({ ok: true } & JoinedPayload) | AckError => {
    const room = manager.viewFor(code, playerId);
    if (!room) return failure("ROOM_NOT_FOUND");
    return { ok: true, code, playerId, sessionToken, room };
  };

  io.on("connection", (socket) => {
    const generalLimit = new TokenBucket(30, 10, now);
    const joinLimit = new TokenBucket(5, 0.5, now);
    const ip = clientIp(socket, options.trustProxy ?? false);

    /** Registers one event with rate limiting, validation and error handling around it. */
    function listen<T>(
      event: string,
      schema: ZodType<T> | null,
      isJoinAttempt: boolean,
      run: (input: T, reply: Reply) => void,
    ): void {
      socket.on(event, (payload: unknown, ack: unknown) => {
        const reply: Reply = typeof ack === "function" ? (ack as Reply) : () => undefined;

        if (!generalLimit.take()) return reply(failure("RATE_LIMITED"));
        if (isJoinAttempt && !(joinLimit.take() && ipJoinLimiter.take(ip))) {
          return reply(failure("RATE_LIMITED"));
        }

        let input = undefined as T;
        if (schema) {
          const parsed = schema.safeParse(payload);
          if (!parsed.success) return reply(failure("INVALID_INPUT"));
          input = parsed.data;
        }

        try {
          run(input, reply);
        } catch (error) {
          console.error(`Error while handling ${event}:`, error);
          reply(failure("SERVER_BUSY"));
        }
      });
    }

    listen(CLIENT_EVENTS.createRoom, createRoomSchema, true, (input, reply) => {
      const result = manager.createRoom(input, socket.id);
      if (!result.ok) return reply(failure(result.error));
      const { code, playerId, sessionToken } = result.value;
      reply(joinedReply(code, playerId, sessionToken));
      broadcast(code);
    });

    listen(CLIENT_EVENTS.joinRoom, joinRoomSchema, true, (input, reply) => {
      const { code, ...profile } = input;
      const result = manager.joinRoom(code, profile, socket.id);
      if (!result.ok) return reply(failure(result.error));
      reply(joinedReply(code, result.value.playerId, result.value.sessionToken));
      broadcast(code);
    });

    listen(CLIENT_EVENTS.rejoinRoom, rejoinRoomSchema, true, (input, reply) => {
      const result = manager.rejoinRoom(input.code, input.sessionToken, socket.id);
      if (!result.ok) return reply(failure(result.error));
      if (result.value.replacedSocketId) {
        io.sockets.sockets.get(result.value.replacedSocketId)?.disconnect(true);
      }
      reply(joinedReply(input.code, result.value.playerId, input.sessionToken));
      broadcast(input.code);
    });

    listen<void>(CLIENT_EVENTS.leaveRoom, null, false, (_input, reply) => {
      const result = manager.leave(socket.id);
      if (!result.ok) return reply(failure(result.error));
      reply({ ok: true });
      if (!result.value.roomDeleted) broadcast(result.value.code);
    });

    listen(CLIENT_EVENTS.kickPlayer, kickPlayerSchema, false, (input, reply) => {
      const result = manager.kick(socket.id, input.playerId);
      if (!result.ok) return reply(failure(result.error));
      if (result.value.kickedSocketId) {
        io.to(result.value.kickedSocketId).emit(SERVER_EVENTS.kicked, { reason: "kicked" });
      }
      reply({ ok: true });
      broadcast(result.value.code);
    });

    listen(CLIENT_EVENTS.selectGame, selectGameSchema, false, (input, reply) => {
      const result = manager.selectGame(socket.id, input.gameId);
      if (!result.ok) return reply(failure(result.error));
      reply({ ok: true });
      broadcast(result.value.code);
    });

    listen<void>(CLIENT_EVENTS.startGame, null, false, (_input, reply) => {
      const result = manager.start(socket.id);
      if (!result.ok) return reply(failure(result.error));
      const { code, countdownEndsAt } = result.value;
      reply({ ok: true, countdownEndsAt });
      broadcast(code);

      const timer: NodeJS.Timeout = setTimeout(() => {
        countdownTimers.delete(timer);
        if (manager.completeCountdown(code)) broadcast(code);
      }, Math.max(0, countdownEndsAt - now()));
      countdownTimers.add(timer);
    });

    listen(CLIENT_EVENTS.gameAction, gameActionSchema, false, (input, reply) => {
      const result = manager.gameAction(socket.id, input.gameId, input.action);
      if (!result.ok) return reply(failure(result.error));
      reply({ ok: true });
      broadcast(result.value.code);
    });

    listen<void>(CLIENT_EVENTS.returnToLobby, null, false, (_input, reply) => {
      const result = manager.returnToLobby(socket.id);
      if (!result.ok) return reply(failure(result.error));
      reply({ ok: true });
      broadcast(result.value.code);
    });

    socket.on("disconnect", () => {
      const result = manager.disconnect(socket.id);
      if (result) broadcast(result.code);
    });
  });

  // Every few seconds: drop players gone too long, delete abandoned rooms, tidy the limiter.
  const sweepTimer = setInterval(() => {
    const { changedRooms } = manager.sweep();
    for (const code of changedRooms) broadcast(code);
    ipJoinLimiter.prune();
  }, options.sweepIntervalMs ?? 5_000);
  sweepTimer.unref();

  // Several times a second: move running games along (timers, reveals, early endings).
  const tickTimer = setInterval(() => {
    for (const code of manager.tick()) broadcast(code);
  }, options.tickIntervalMs ?? 250);
  tickTimer.unref();

  return {
    close(): void {
      clearInterval(sweepTimer);
      clearInterval(tickTimer);
      for (const timer of countdownTimers) clearTimeout(timer);
      countdownTimers.clear();
    },
  };
}
