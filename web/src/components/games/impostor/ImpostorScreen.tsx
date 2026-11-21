"use client";

import type { ReactNode } from "react";
import type { ImpostorAction, ImpostorView, RoomView } from "@chaos/shared";
import { TimerBar } from "@/components/games/mostLikelyTo/TimerBar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { ImpostorSecretResult } from "@/lib/roomClient";
import { useCountdown } from "@/lib/useCountdown";
import { CluesView, DiscussionView } from "./CluePanel";
import { FinalResults, RoundResult } from "./ResultPanels";
import { SecretCard } from "./SecretCard";
import { GuessView, ImpostorVoting } from "./VotePanel";

export type ImpostorScreenActions = {
  send: (action: ImpostorAction) => Promise<string | null>;
  /** Asks the server for this player's own secret. Never part of the shared room updates. */
  revealSecret: () => Promise<ImpostorSecretResult>;
  playAgain: () => Promise<string | null>;
  backToLobby: () => Promise<string | null>;
};

const STEP_LABELS: Record<string, string> = {
  words: "Your secret",
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

type ImpostorScreenProps = {
  room: RoomView;
  game: ImpostorView;
  actions: ImpostorScreenActions;
};

/** Picks the right screen for the current step of the round. */
export function ImpostorScreen({ room, game, actions }: ImpostorScreenProps) {
  const isHost = room.hostId === room.selfId;
  const secretsAvailable = ["words", "clues", "discussion", "voting", "guess"].includes(game.step);
  let content: ReactNode;

  switch (game.step) {
    case "words":
      content = (
        <Card padding="lg" className="flex flex-col gap-3">
          <h2 className="font-display text-3xl font-bold">Check your secret</h2>
          <p className="text-lg text-ink-soft">
            Reveal your secret privately, then hide it again before anyone sees. The crew all share one secret
            word. One player is the impostor and does not get the word. Give clues to find out who.
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
      {secretsAvailable && (
        // The key makes the secret disappear every time the round moves to a new step or round.
        <SecretCard key={`${game.round}-${game.step}`} onReveal={actions.revealSecret} />
      )}
      {content}
    </div>
  );
}
