import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import type { GameFactories } from "./games/registry";
import { RoomManager } from "./rooms/RoomManager";
import { createRoomGateway } from "./socket/roomGateway";

export type GameServerOptions = {
  /** Website addresses allowed to connect. */
  webOrigins: string[];
  trustProxy?: boolean;
  manager?: RoomManager;
  /** The games that exist. Ignored when a manager is passed in. */
  gameFactories?: GameFactories;
  sweepIntervalMs?: number;
  tickIntervalMs?: number;
  /** Handles every request that is not /health or the live connection. Used to serve the website. */
  fallbackHandler?: (req: IncomingMessage, res: ServerResponse) => void;
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

  const fallback = options.fallbackHandler;
  if (fallback) {
    app.use((req, res) => fallback(req, res));
  }

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: options.webOrigins },
    // Reject oversized messages. Raise this when drawing strokes are added.
    maxHttpBufferSize: 10_000,
  });

  const manager = options.manager ?? new RoomManager({ gameFactories: options.gameFactories ?? {} });
  const gateway = createRoomGateway(io, manager, {
    trustProxy: options.trustProxy,
    sweepIntervalMs: options.sweepIntervalMs,
    tickIntervalMs: options.tickIntervalMs,
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
