import type { AccentColor } from "./theme";

export type GameInfo = {
  id: "most-likely-to" | "impostor" | "roast" | "fake-answer" | "draw-it-wrong";
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  /** Target length, not yet measured in real games. */
  duration: string;
  accent: AccentColor;
  /** The two games being built first. */
  upFirst: boolean;
  rules: string[];
};

export const GAMES: GameInfo[] = [
  {
    id: "most-likely-to",
    name: "Who's Most Likely To?",
    description: "Secret votes, big reveals. Find out what your friends really think of you.",
    minPlayers: 2,
    maxPlayers: 4,
    duration: "About 10 minutes",
    accent: "bubblegum",
    upFirst: true,
    rules: [
      "A funny question appears on every screen.",
      "Everyone secretly votes for another player. You cannot vote for yourself.",
      "All votes are revealed together, and the most voted player takes the round.",
    ],
  },
  {
    id: "impostor",
    name: "Impostor Word Game",
    description: "Everyone knows the word except one player. Give clues and spot the impostor.",
    minPlayers: 3,
    maxPlayers: 4,
    duration: "About 15 minutes",
    accent: "volt",
    upFirst: true,
    rules: [
      "Everyone gets a secret word. The impostor gets a similar one and does not know it.",
      "Take turns giving a clue without giving the word away.",
      "Vote for the impostor. If they are caught, they get one guess at the real word.",
    ],
  },
  {
    id: "roast",
    name: "Roast Your Friends",
    description: "Write the funniest answer to a ridiculous situation. Friends vote for the best.",
    minPlayers: 2,
    maxPlayers: 4,
    duration: "About 10 minutes",
    accent: "tangerine",
    upFirst: false,
    rules: [
      "A funny situation appears.",
      "Everyone writes a secret answer.",
      "Answers are shown without names, and everyone votes for the funniest.",
    ],
  },
  {
    id: "fake-answer",
    name: "The Fake Answer",
    description: "Invent a believable lie for a strange trivia question, then spot the real answer.",
    minPlayers: 2,
    maxPlayers: 4,
    duration: "About 15 minutes",
    accent: "grape",
    upFirst: false,
    rules: [
      "A strange trivia question appears.",
      "Everyone writes a fake answer that sounds believable.",
      "All answers are shuffled with the real one. Pick the one you think is true.",
    ],
  },
  {
    id: "draw-it-wrong",
    name: "Draw It Wrong",
    description: "One player draws a secret word with silly limits while the others guess.",
    minPlayers: 2,
    maxPlayers: 4,
    duration: "About 15 minutes",
    accent: "sunny",
    upFirst: false,
    rules: [
      "One player secretly picks a word to draw.",
      "They draw it while everyone else types guesses.",
      "Correct guesses score points, and the artist changes every round.",
    ],
  },
];

export function playersLabel(game: GameInfo): string {
  return game.minPlayers === game.maxPlayers
    ? `${game.maxPlayers} players`
    : `${game.minPlayers} to ${game.maxPlayers} players`;
}
