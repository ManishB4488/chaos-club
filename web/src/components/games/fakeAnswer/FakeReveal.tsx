"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import type { FakeAnswerAction, FakeAnswerView, RoomView } from "@chaos/shared";
import { ScoreboardCard } from "@/components/games/ScoreboardCard";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useCountdown } from "@/lib/useCountdown";
import { FakeReportButton } from "./ChooseView";

export function FakeReveal({
  room,
  game,
  onSend,
}: {
  room: RoomView;
  game: FakeAnswerView;
  onSend: (action: FakeAnswerAction) => Promise<string | null>;
}) {
  const { seconds } = useCountdown(game.stepEndsAt, room.serverTime);
  const [error, setError] = useState<string | null>(null);
  const reveal = game.reveal;
  if (!reveal) return null;

  const byId = new Map(game.participants.map((player) => [player.id, player]));
  const options = [...reveal.options].sort(
    (a, b) => Number(b.isReal) - Number(a.isReal) || b.chooserIds.length - a.chooserIds.length,
  );

  return (
    <div className="flex flex-col gap-6">
      <Card accent="sunny" padding="lg" className="flex flex-col gap-2">
        <p className="text-ink-soft">{game.question}</p>
        <p className="text-sm text-ink-soft">The real answer was</p>
        <h2 className="font-display text-4xl font-bold">{reveal.realAnswer}</h2>
        <p className="text-ink-soft" role="timer">
          {game.round < game.totalRounds ? "Next round" : "Final results"} in {seconds ?? "..."}s
        </p>
      </Card>

      <ul className="flex flex-col gap-4">
        {options.map((option) => {
          const authors = option.authorIds.flatMap((id) => {
            const player = byId.get(id);
            return player ? [player] : [];
          });
          const choosers = option.chooserIds.flatMap((id) => {
            const player = byId.get(id);
            return player ? [player] : [];
          });
          const isMine = option.authorIds.includes(room.selfId);
          return (
            <li key={option.id}>
              <Card accent={option.isReal ? "sunny" : undefined} padding="md" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="min-w-0 flex-1 font-display text-2xl leading-snug font-semibold">{option.text}</p>
                  {option.isReal && (
                    <Badge tone="sunny">
                      <CheckCircle2 aria-hidden className="size-4" />
                      Real answer
                    </Badge>
                  )}
                </div>
                {!option.isReal && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-soft">Written by</span>
                    {authors.map((author) => (
                      <span key={author.id} className="flex items-center gap-2">
                        <Avatar avatar={author.avatar} color={author.color} label={author.nickname} size="sm" />
                        <span className="font-semibold">
                          {author.nickname}
                          {author.id === room.selfId ? " (you)" : ""}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ink-soft">
                    {option.chooserIds.length} {option.chooserIds.length === 1 ? "pick" : "picks"}
                  </span>
                  {choosers.map((chooser) => (
                    <Avatar
                      key={chooser.id}
                      avatar={chooser.avatar}
                      color={chooser.color}
                      label={`${chooser.nickname} picked this`}
                      size="sm"
                    />
                  ))}
                  {!isMine && !option.isReal && (
                    <span className="ml-auto">
                      <FakeReportButton optionId={option.id} onSend={onSend} onError={setError} />
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

      <Card padding="md" className="flex flex-col gap-3">
        <h3 className="font-display text-xl font-semibold">Points this round</h3>
        <ul className="flex flex-col gap-3">
          {game.participants.map((player) => (
            <li key={player.id} className="flex items-center gap-3">
              <Avatar avatar={player.avatar} color={player.color} label={player.nickname} size="sm" />
              <span className="min-w-0 flex-1 truncate font-semibold">{player.nickname}</span>
              <Badge tone={(reveal.pointsGained[player.id] ?? 0) > 0 ? "sunny" : "neutral"}>
                +{reveal.pointsGained[player.id] ?? 0}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>

      <ScoreboardCard participants={game.participants} scores={game.scores} selfId={room.selfId} />
    </div>
  );
}
