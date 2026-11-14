import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { RoomManager } from "./rooms/RoomManager";
import { createRoomGateway } from "./socket/roomGateway";

export type GameServerOptions = {
  /** Website addresses allowed to connect. */
  webOrigins: string[];
  trustProxy?: boolean;
  manager?: RoomManager;
  sweepIntervalMs?: number;
};

/** Builds the whole server without starting it, so tests can run it on any free port. */
export function createGameServer(options: GameServerOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: options.webOrigins }));

  // Simple check that the server is alive. Open http://localhost:4000/health
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "chaos-club-server",
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: options.webOrigins },
    // Reject oversized messages. Raise this when drawing strokes are added.
    maxHttpBufferSize: 10_000,
  });

  // No games can be started yet, so no game is listed as available.
  const manager = options.manager ?? new RoomManager({ availableGames: [] });
  const gateway = createRoomGateway(io, manager, {
    trustProxy: options.trustProxy,
    sweepIntervalMs: options.sweepIntervalMs,
  });

  return {
    httpServer,
    io,
    manager,
    close: () =>
      new Promise<void>((resolve) => {
        gateway.close();
        io.close(() => resolve());
      }),
  };
}
