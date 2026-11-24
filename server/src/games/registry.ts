import type { GameId } from "@chaos/shared";
import { DrawItWrongGame, type DrawConfig, type DrawWord } from "./drawItWrong/DrawItWrongGame";
import { FakeAnswerGame, type FakeAnswerConfig, type FakeAnswerQuestion } from "./fakeAnswer/FakeAnswerGame";
import { ImpostorGame, type ImpostorConfig, type ImpostorWordPair } from "./impostor/ImpostorGame";
import { RoastGame, type RoastConfig, type RoastPrompt } from "./roast/RoastGame";
import { MostLikelyToGame, type MltConfig, type MltQuestion } from "./mostLikelyTo/MostLikelyToGame";
import type { GameContext, GameInstance } from "./types";

export type GameFactory = (context: GameContext) => GameInstance;
export type GameFactories = Partial<Record<GameId, GameFactory>>;

export type GameContent = {
  mltQuestions: MltQuestion[];
  /** Overrides for tests, such as shorter timers. */
  mltConfig?: Partial<MltConfig>;
  /** Word pairs for the Impostor game. The game only exists when these are given. */
  impostorWords?: ImpostorWordPair[];
  impostorConfig?: Partial<ImpostorConfig>;
  /** Prompts for Roast Your Friends. The game only exists when these are given. */
  roastPrompts?: RoastPrompt[];
  roastConfig?: Partial<RoastConfig>;
  /** Trivia for The Fake Answer. The game only exists when these are given. */
  triviaQuestions?: FakeAnswerQuestion[];
  fakeAnswerConfig?: Partial<FakeAnswerConfig>;
  /** Words for Draw It Wrong. The game only exists when these are given. */
  drawWords?: DrawWord[];
  drawConfig?: Partial<DrawConfig>;
};

/** Every game that really exists. A game missing here cannot be started. */
export function createGameFactories(content: GameContent): GameFactories {
  const factories: GameFactories = {
    "most-likely-to": (context) =>
      new MostLikelyToGame({ ...context, questions: content.mltQuestions, config: content.mltConfig }),
  };

  const words = content.impostorWords;
  if (words) {
    factories.impostor = (context) =>
      new ImpostorGame({ ...context, words, config: content.impostorConfig });
  }
  const prompts = content.roastPrompts;
  if (prompts) {
    factories.roast = (context) => new RoastGame({ ...context, prompts, config: content.roastConfig });
  }
  const trivia = content.triviaQuestions;
  if (trivia) {
    factories["fake-answer"] = (context) =>
      new FakeAnswerGame({ ...context, questions: trivia, config: content.fakeAnswerConfig });
  }
  const drawWords = content.drawWords;
  if (drawWords) {
    factories["draw-it-wrong"] = (context) =>
      new DrawItWrongGame({ ...context, words: drawWords, config: content.drawConfig });
  }
  return factories;
}
