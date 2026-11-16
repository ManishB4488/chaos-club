"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { ImpostorAction, ImpostorView, RoomView } from "@chaos/shared";
import { TimerBar } from "@/components/games/mostLikelyTo/TimerBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useCountdown } from "@/lib/useCountdown";
import { CluesView, DiscussionView } from "./CluePanel";
import { FinalResults, RoundResult } from "./ResultPanels";
import { GuessView, ImpostorVoting } from "./VotePanel";

export type ImpostorScreenActions = {
  send: (action: ImpostorAction) => Promise<string | null>;
  playAgain: () => Promise<string | null>;
  backToLobby: () => Promise<string | null>;
};

const STEP_LABELS: Record<string, string> = {
  words: "Read your word",
  clues: "Clues",
  discussion: "Discussion",
  voting: "Vote",
  guess: "Final guess",
  result: "Result",
};

function StepHeader({ room, game }: { room: RoomView; game: ImpostorView }) {
  const { seconds, remainingMs } = useCountdown(game.stepEndsAt, room.serverTime);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="volt">
          Round {game.round} of {game.totalRounds}
        </Badge>
        {game.category && <Badge>{game.category}</Badge>}
        <Badge tone="sunny">{STEP_LABELS[game.step] ?? ""}</Badge>
        <span className="ml-auto font-display text-2xl font-bold" role="timer">
          {seconds ?? "..."}s
        </span>
      </div>
      <TimerBar remainingMs={remainingMs} totalMs={game.stepDurationMs} />
    </div>
  );
}

/** The player's own word. Hidden until they tap, so nobody reads it over their shoulder. */
function MyWord({ word }: { word: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <Card accent="volt" padding="md" className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-ink-soft">Your secret word</p>
        <p className="truncate font-display text-3xl font-bold">
          {visible ? word : "\u2022\u2022\u2022\u2022\u2022\u2022"}
        </p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        {visible ? "Hide" : "Show"}
      </Button>
    </Card>
  );
}

type ImpostorScreenProps = {
  room: RoomView;
  game: ImpostorView;
  actions: ImpostorScreenActions;
};

/** Picks the right screen for the current step of the round. */
export function ImpostorScreen({ room, game, actions }: ImpostorScreenProps) {
  const isHost = room.hostId === room.selfId;
  let content: ReactNode;

  switch (game.step) {
    case "words":
      content = (
        <Card padding="lg" className="flex flex-col gap-3">
          <h2 className="font-display text-3xl font-bold">Read your word</h2>
          <p className="text-lg text-ink-soft">
            Tap Show to see your secret word, then hide it again. Most players have the same word, but one
            player has a different one. You are not told which you are. Give clues to find out.
          </p>
        </Card>
      );
      break;
    case "clues":
      content = <CluesView room={room} game={game} onSend={actions.send} />;
      break;
    case "discussion":
      content = <DiscussionView room={room} game={game} onSend={actions.send} />;
      break;
    case "voting":
      content = <ImpostorVoting room={room} game={game} onSend={actions.send} />;
      break;
    case "guess":
      content = <GuessView room={room} game={game} onSend={actions.send} />;
      break;
    case "result":
      content = <RoundResult room={room} game={game} />;
      break;
    case "finished":
      content = (
        <FinalResults
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
      {game.step !== "finished" && game.myWord && <MyWord word={game.myWord} />}
      {content}
    </div>
  );
}
