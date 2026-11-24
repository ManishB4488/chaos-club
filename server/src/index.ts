import { GAME_PLAYER_LIMITS, ROOM_MAX_PLAYERS } from "@chaos/shared";
import { createGameServer } from "./app";
import { env } from "./config/env";
import { loadImpostorWords } from "./content/loadImpostorWords";
import { loadMostLikelyToQuestions } from "./content/loadQuestions";
import { loadRoastPrompts } from "./content/loadRoastPrompts";
import { loadTrivia } from "./content/loadTrivia";
import { createGameFactories } from "./games/registry";

const gameFactories = createGameFactories({
  mltQuestions: loadMostLikelyToQuestions(),
  mltConfig: { rounds: env.MLT_ROUNDS },
  impostorWords: loadImpostorWords(),
  roastPrompts: loadRoastPrompts(),
  triviaQuestions: loadTrivia(),
});

const server = createGameServer({
  webOrigins: env.WEB_ORIGIN,
  trustProxy: env.TRUST_PROXY,
  gameFactories,
});

server.httpServer.listen(env.port, () => {
  console.log(`CHAOS CLUB server listening on http://localhost:${env.port}`);
  console.log(`Accepting browsers from ${env.WEB_ORIGIN.join(", ")}`);
  console.log(`Games that can be started: ${Object.keys(gameFactories).join(", ") || "none yet"}`);
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
