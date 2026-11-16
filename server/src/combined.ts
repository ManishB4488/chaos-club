/**
 * Runs the website AND the game server as ONE program on ONE address. This is the production mode.
 * Before starting it, build the website once:  npm run build:prod
 * (For everyday development keep using the two separate programs, which is unchanged.)
 */
import { existsSync } from "node:fs";

// Must be set before the website code is loaded, so React uses its fast production build.
Object.assign(process.env, { NODE_ENV: "production" });

const { join, resolve } = await import("node:path");
const { default: next } = await import("next");
const { GAME_PLAYER_LIMITS, ROOM_MAX_PLAYERS } = await import("@chaos/shared");
const { createGameServer } = await import("./app");
const { env } = await import("./config/env");
const { loadImpostorWords } = await import("./content/loadImpostorWords");
const { loadMostLikelyToQuestions } = await import("./content/loadQuestions");
const { createGameFactories } = await import("./games/registry");

const webDir = resolve(import.meta.dirname, "../../web");
if (!existsSync(join(webDir, ".next"))) {
  console.error("The website has not been built yet. Run:  npm run build:prod");
  process.exit(1);
}

const website = next({ dev: false, dir: webDir, hostname: "0.0.0.0", port: env.port });
const handleWebsite = website.getRequestHandler();
await website.prepare();

const gameFactories = createGameFactories({
  mltQuestions: loadMostLikelyToQuestions(),
  mltConfig: { rounds: env.MLT_ROUNDS },
  impostorWords: loadImpostorWords(),
});

const server = createGameServer({
  webOrigins: env.WEB_ORIGIN,
  trustProxy: env.TRUST_PROXY,
  gameFactories,
  fallbackHandler: (req, res) => {
    void handleWebsite(req, res);
  },
});

server.httpServer.listen(env.port, () => {
  console.log(`CHAOS CLUB (website + game server) listening on http://localhost:${env.port}`);
  console.log(`Games that can be started: ${Object.keys(gameFactories).join(", ") || "none yet"}`);
  console.log(
    `Shared package OK: ${Object.keys(GAME_PLAYER_LIMITS).length} games, max ${ROOM_MAX_PLAYERS} players per room`,
  );
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}
