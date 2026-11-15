import type { GameId } from "@chaos/shared";
import { MostLikelyToGame, type MltConfig, type MltQuestion } from "./mostLikelyTo/MostLikelyToGame";
import type { GameContext, GameInstance } from "./types";

export type GameFactory = (context: GameContext) => GameInstance;
export type GameFactories = Partial<Record<GameId, GameFactory>>;

export type GameContent = {
  mltQuestions: MltQuestion[];
  /** Overrides for tests, such as shorter timers. */
  mltConfig?: Partial<MltConfig>;
};

/** Every game that really exists. A game missing here cannot be started. */
export function createGameFactories(content: GameContent): GameFactories {
  return {
    "most-likely-to": (context) =>
      new MostLikelyToGame({ ...context, questions: content.mltQuestions, config: content.mltConfig }),
  };
}
