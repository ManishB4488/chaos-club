"use client";

import type { ReactNode } from "react";
import type { FakeAnswerAction, FakeAnswerView, RoomView } from "@chaos/shared";
import { TimerBar } from "@/components/games/mostLikelyTo/TimerBar";
import { Badge } from "@/components/ui/Badge";
import { useCountdown } from "@/lib/useCountdown";
import { ChooseView } from "./ChooseView";
import { FakeResults } from "./FakeResults";
import { FakeReveal } from "./FakeReveal";
import { WriteView } from "./WriteView";

export type FakeAnswerScreenActions = {
  send: (action: FakeAnswerAction) => Promise<string | null>;
  playAgain: () => Promise<string | null>;
  backToLobby: () => Promise<string | null>;
};

function StepHeader({ room, game }: { room: RoomView; game: FakeAnswerView }) {
  const { seconds, remainingMs } = useCountdown(game.stepEndsAt, room.serverTime);
  const label = game.step === "writing" ? "Write a fake" : game.step === "choosing" ? "Pick the real one" : "Results";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="grape">
          Round {game.round} of {game.totalRounds}
        </Badge>
        {game.category && <Badge>{game.category}</Badge>}
        <Badge tone="sunny">{label}</Badge>
        <span className="ml-auto font-display text-2xl font-bold" role="timer">
          {seconds ?? "..."}s
        </span>
      </div>
      <TimerBar remainingMs={remainingMs} totalMs={game.stepDurationMs} />
    </div>
  );
}

type FakeAnswerScreenProps = { room: RoomView; game: FakeAnswerView; actions: FakeAnswerScreenActions };

/** Picks the right screen for the current step of the round. */
export function FakeAnswerScreen({ room, game, actions }: FakeAnswerScreenProps) {
  const isHost = room.hostId === room.selfId;
  let content: ReactNode;

  switch (game.step) {
    case "writing":
      content = <WriteView game={game} onSend={actions.send} />;
      break;
    case "choosing":
      content = <ChooseView game={game} onSend={actions.send} />;
      break;
    case "reveal":
      content = <FakeReveal room={room} game={game} onSend={actions.send} />;
      break;
    case "finished":
      content = (
        <FakeResults
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
