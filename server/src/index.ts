import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { GAME_PLAYER_LIMITS, ROOM_MAX_PLAYERS } from "@chaos/shared";
import { env } from "./config/env";

const app = express();
app.use(cors({ origin: env.WEB_ORIGIN }));

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
  cors: { origin: env.WEB_ORIGIN },
});

// Foundation only: rooms and games are added in the next steps.
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${socket.id} (${reason})`);
  });
});

httpServer.listen(env.SERVER_PORT, () => {
  console.log(`CHAOS CLUB server listening on http://localhost:${env.SERVER_PORT}`);
  console.log(`Accepting browsers from ${env.WEB_ORIGIN}`);
  console.log(
    `Shared package OK: ${Object.keys(GAME_PLAYER_LIMITS).length} games, max ${ROOM_MAX_PLAYERS} players per room`,
  );
});
