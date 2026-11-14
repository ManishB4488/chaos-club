import { GAME_PLAYER_LIMITS, ROOM_MAX_PLAYERS } from "@chaos/shared";
import { createGameServer } from "./app";
import { env } from "./config/env";

const server = createGameServer({
  webOrigins: env.WEB_ORIGIN,
  trustProxy: env.TRUST_PROXY,
});

server.httpServer.listen(env.SERVER_PORT, () => {
  console.log(`CHAOS CLUB server listening on http://localhost:${env.SERVER_PORT}`);
  console.log(`Accepting browsers from ${env.WEB_ORIGIN.join(", ")}`);
  console.log(
    `Shared package OK: ${Object.keys(GAME_PLAYER_LIMITS).length} games, max ${ROOM_MAX_PLAYERS} players per room`,
  );
});

// Shut down cleanly when stopped with Ctrl + C.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}
