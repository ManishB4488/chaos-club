"use client";

import { Crown } from "lucide-react";
import { useState } from "react";
import type { RoastAction, RoastView, RoomView } from "@chaos/shared";
import { ScoreboardCard } from "@/components/games/ScoreboardCard";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useCountdown } from "@/lib/useCountdown";
import { ReportButton } from "./RoastVoting";

export function RoastReveal({
  room,
  game,
  onSend,
}: {
  room: RoomView;
  game: RoastView;
  onSend: (action: RoastAction) => Promise<string | null>;
}) {
  const { seconds } = useCountdown(game.stepEndsAt, room.serverTime);
  const [error, setError] = useState<string | null>(null);
  const reveal = game.reveal;
  if (!reveal) return null;

  const byId = new Map(game.participants.map((player) => [player.id, player]));
  const winnerNames = reveal.roundWinnerIds.map((id) => byId.get(id)?.nickname ?? "Someone");
  const stars = game.mode === "stars";

  const headline =
    reveal.answers.length === 0
      ? "Nobody wrote an answer this round."
      : winnerNames.length === 0
        ? "No votes this round."
        : winnerNames.length === 1
          ? `${winnerNames[0]} wins the round!`
          : `A tie! ${winnerNames.join(" and ")} share it.`;

  return (
    <div className="flex flex-col gap-6">
      <Card padding="md" className="flex flex-col gap-2">
        <p className="text-ink-soft">{game.prompt}</p>
        <h2 className="font-display text-3xl font-bold">{headline}</h2>
        <p className="text-ink-soft" role="timer">
          {game.round < game.totalRounds ? "Next round" : "Final results"} in {seconds ?? "..."}s
        </p>
      </Card>

      <ul className="flex flex-col gap-4">
        {reveal.answers.map((answer) => {
          const author = byId.get(answer.authorId);
          const isMine = answer.authorId === room.selfId;
          return (
            <li key={answer.id}>
              <Card accent={answer.isWinner ? "sunny" : undefined} padding="md" className="flex flex-col gap-3">
                <p className="font-display text-2xl leading-snug font-semibold">{answer.text}</p>
                <div className="flex flex-wrap items-center gap-3">
                  {author && (
                    <Avatar avatar={author.avatar} color={author.color} label={author.nickname} size="sm" />
                  )}
                  <span className="font-semibold">
                    {author?.nickname ?? "Someone"}
                    {isMine ? " (you)" : ""}
                  </span>
                  {answer.isWinner && <Crown aria-label="Round winner" className="size-5 text-sunny" />}
                  <Badge tone={answer.pointsGained > 0 ? "sunny" : "neutral"} className="ml-auto">
                    +{answer.pointsGained}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ink-soft">
                    {answer.total} {stars ? (answer.total === 1 ? "star" : "stars") : answer.total === 1 ? "vote" : "votes"}
                  </span>
                  {!stars &&
                    answer.votes.map((vote) => {
                      const voter = byId.get(vote.voterId);
                      return voter ? (
                        <Avatar
                          key={vote.voterId}
                          avatar={voter.avatar}
                          color={voter.color}
                          label={`${voter.nickname} voted for this`}
                          size="sm"
                        />
                      ) : null;
                    })}
                  {!isMine && (
                    <span className="ml-auto">
                      <ReportButton answerId={answer.id} onSend={onSend} onError={setError} />
                    </span>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="font-semibold text-bubblegum">
          {error}
        </p>
      )}

      <ScoreboardCard participants={game.participants} scores={game.scores} selfId={room.selfId} />
    </div>
  );
}
