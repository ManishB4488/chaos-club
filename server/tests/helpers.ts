import { MLT_CATEGORIES } from "@chaos/shared";
import type { MltQuestion } from "../src/games/mostLikelyTo/MostLikelyToGame";

export function sampleQuestions(perCategory = 4): MltQuestion[] {
  const questions: MltQuestion[] = [];
  for (const category of MLT_CATEGORIES) {
    for (let i = 1; i <= perCategory; i++) {
      questions.push({
        id: `${category}-${i}`,
        category,
        text: `Who is most likely to do ${category} thing number ${i}?`,
      });
    }
  }
  return questions;
}

/** A repeatable pseudo-random generator, so tests do not depend on luck. */
export function seededRandom(seed = 1): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}
