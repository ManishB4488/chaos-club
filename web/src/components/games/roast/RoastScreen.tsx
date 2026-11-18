"use client";

import type { ReactNode } from "react";
import type { RoastAction, RoastView, RoomView } from "@chaos/shared";
import { TimerBar } from "@/components/games/mostLikelyTo/TimerBar";
import { Badge } from "@/components/ui/Badge";
import { useCountdown } from "@/lib/useCountdown";
import { RoastResults } from "./RoastResults";
import { RoastReveal } from "./RoastReveal";
import { RoastVoting } from "./RoastVoting";
import { WritingView } from "./WritingView";

export type RoastScreenActions = {
  send: (action: RoastAction) => Promise<string | null>;
  playAgain: () => Promise<string | null>;
  backToLobby: () => Promise<string | null>;
};

function StepHeader({ room, game }: { room: RoomView; game: RoastView }) {
  const { seconds, remainingMs } = useCountdown(game.stepEndsAt, room.serverTime);
  const label =
    game.step === "writing" ? "Write" : game.step === "voting" ? (game.mode === "stars" ? "Rate" : "Vote") : "Results";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="tangerine">
          Round {game.round} of {game.totalRounds}
        </Badge>
        <Badge tone="sunny">{label}</Badge>
        <span className="ml-auto font-display text-2xl font-bold" role="timer">
          {seconds ?? "..."}s
        </span>
      </div>
      <TimerBar remainingMs={remainingMs} totalMs={game.stepDurationMs} />
    </div>
  );
}

type RoastScreenProps = { room: RoomView; game: RoastView; actions: RoastScreenActions };

/** Picks the right screen for the current step of the round. */
export function RoastScreen({ room, game, actions }: RoastScreenProps) {
  const isHost = room.hostId === room.selfId;
  let content: ReactNode;

  switch (game.step) {
    case "writing":
      content = <WritingView game={game} onSend={actions.send} />;
      break;
    case "voting":
      content = <RoastVoting game={game} onSend={actions.send} />;
      break;
    case "reveal":
      content = <RoastReveal room={room} game={game} onSend={actions.send} />;
      break;
    case "finished":
      content = (
        <RoastResults
          room={room}
          game={game}
          isHost={isHost}
          onPlayAgain={actions.playAgain}
          onBackToLobby={actions.backToLobby}
        />
      );
      break;
  }

  return (
    <div className="flex flex-col gap-6">
      {game.step !== "finished" && <StepHeader room={room} game={game} />}
      {content}
    </div>
  );
}
