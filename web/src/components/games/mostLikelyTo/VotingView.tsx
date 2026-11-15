"use client";

import { useState } from "react";
import type { MltView, RoomView } from "@chaos/shared";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { useCountdown } from "@/lib/useCountdown";
import { TimerBar } from "./TimerBar";

type VotingViewProps = {
  room: RoomView;
  game: MltView;
  onVote: (targetId: string) => Promise<string | null>;
};

export function VotingView({ room, game, onVote }: VotingViewProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { seconds, remainingMs } = useCountdown(game.stepEndsAt, room.serverTime);

  const stillHere = new Set(room.players.map((player) => player.id));
  const candidates = game.participants.filter(
    (player) => game.allowSelfVote || player.id !== room.selfId,
  );
  const hasVoted = game.myVote !== null;

  async function choose(playerId: string) {
    setPendingId(playerId);
    setError(null);
    const message = await onVote(playerId);
    setPendingId(null);
    if (message) setError(message);
  }

  const hint = hasVoted
    ? "Vote locked in. Waiting for the others."
    : game.allowSelfVote
      ? "Pick a player. In a 2 player game you can pick yourself."
      : "Pick a player. Your vote stays secret until everyone has voted.";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="volt">
          Round {game.round} of {game.totalRounds}
        </Badge>
        {game.category && <Badge>{game.category}</Badge>}
        <span className="ml-auto font-display text-2xl font-bold" role="timer">
          {seconds ?? "..."}s
        </span>
      </div>
      <TimerBar remainingMs={remainingMs} totalMs={game.stepDurationMs} />

      <Card accent="bubblegum" padding="lg">
        <h2 className="font-display text-3xl leading-tight font-bold sm:text-4xl">{game.question}</h2>
      </Card>

      <p className="text-lg text-ink-soft">{hint}</p>

      <ul className="grid gap-3 sm:grid-cols-2">
        {candidates.map((player) => {
          const selected = game.myVote === player.id;
          const present = stillHere.has(player.id);
          return (
            <li key={player.id}>
              <button
                type="button"
                aria-pressed={selected}
                disabled={hasVoted || pendingId !== null || !present}
                onClick={() => choose(player.id)}
                className={cn(
                  "flex min-h-20 w-full items-center gap-4 rounded-card border-2 p-4 text-left transition disabled:cursor-not-allowed",
                  selected
                    ? "border-sunny bg-sunny/15"
                    : "border-white/10 bg-night-900/80 enabled:hover:bg-white/5 enabled:active:scale-[0.98]",
                  hasVoted && !selected && "opacity-60",
                )}
              >
                <Avatar avatar={player.avatar} color={player.color} label={player.nickname} size="lg" />
                <span className="min-w-0 flex-1 truncate font-display text-xl font-semibold">
                  {player.nickname}
                </span>
                {selected && <Badge tone="sunny">Your vote</Badge>}
                {!present && <Badge>Left</Badge>}
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="font-semibold text-bubblegum">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3" role="status">
        <span className="text-ink-soft">
          {game.votedIds.length} of {game.participants.length} voted
        </span>
        {game.participants
          .filter((player) => game.votedIds.includes(player.id))
          .map((player) => (
            <Avatar
              key={player.id}
              avatar={player.avatar}
              color={player.color}
              label={`${player.nickname} has voted`}
              size="sm"
            />
          ))}
      </div>
    </div>
  );
}
