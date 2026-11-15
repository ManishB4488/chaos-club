"use client";

import type { MltView, RoomView } from "@chaos/shared";
import { RevealView } from "./RevealView";
import { ResultsView } from "./ResultsView";
import { VotingView } from "./VotingView";

export type MostLikelyToActions = {
  vote: (targetId: string) => Promise<string | null>;
  playAgain: () => Promise<string | null>;
  backToLobby: () => Promise<string | null>;
};

type MostLikelyToScreenProps = {
  room: RoomView;
  game: MltView;
  actions: MostLikelyToActions;
};

/** Picks the right screen for the current step of the game. */
export function MostLikelyToScreen({ room, game, actions }: MostLikelyToScreenProps) {
  const isHost = room.hostId === room.selfId;

  switch (game.step) {
    case "voting":
      return <VotingView room={room} game={game} onVote={actions.vote} />;
    case "reveal":
      return <RevealView room={room} game={game} />;
    case "finished":
      return (
        <ResultsView
          room={room}
          game={game}
          isHost={isHost}
          onPlayAgain={actions.playAgain}
          onBackToLobby={actions.backToLobby}
        />
      );
  }
}
