"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Crown } from "lucide-react";
import type { MltView, RoomView } from "@chaos/shared";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useCountdown } from "@/lib/useCountdown";
import { Scoreboard } from "./Scoreboard";

export function RevealView({ room, game }: { room: RoomView; game: MltView }) {
  const reduceMotion = useReducedMotion();
  const { seconds } = useCountdown(game.stepEndsAt, room.serverTime);
  const reveal = game.reveal;
  if (!reveal) return null;

  const byId = new Map(game.participants.map((player) => [player.id, player]));
  const rows = [...game.participants].sort(
    (a, b) => (reveal.counts[b.id] ?? 0) - (reveal.counts[a.id] ?? 0),
  );
  const most = Math.max(1, ...Object.values(reveal.counts));
  const starNames = reveal.roundStarIds.map((id) => byId.get(id)?.nickname ?? "Someone");

  const headline =
    starNames.length === 0
      ? "Nobody voted this round."
      : starNames.length === 1
        ? `${starNames[0]} got the most votes!`
        : `A tie! ${starNames.join(" and ")} share the most votes.`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="volt">
          Round {game.round} of {game.totalRounds}
        </Badge>
        <span className="ml-auto text-ink-soft" role="timer">
          {game.round < game.totalRounds ? "Next question" : "Final results"} in {seconds ?? "..."}s
        </span>
      </div>

      <Card padding="md">
        <p className="text-ink-soft">{game.question}</p>
        <h2 className="mt-2 font-display text-3xl font-bold">{headline}</h2>
      </Card>

      <ul className="flex flex-col gap-4">
        {rows.map((player) => {
          const count = reveal.counts[player.id] ?? 0;
          const isStar = reveal.roundStarIds.includes(player.id);
          const gained = reveal.pointsGained[player.id] ?? 0;
          const voters = reveal.votes.flatMap((vote) => {
            const voter = byId.get(vote.voterId);
            return vote.targetId === player.id && voter ? [voter] : [];
          });
          return (
            <li key={player.id}>
              <Card accent={isStar ? "sunny" : undefined} padding="md" className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Avatar avatar={player.avatar} color={player.color} label={player.nickname} size="md" />
                  <span className="min-w-0 flex-1 truncate font-display text-xl font-semibold">
                    {player.nickname}
                    {isStar && <Crown aria-label="Round Star" className="ml-2 inline size-5 text-sunny" />}
                  </span>
                  <Badge tone={gained > 0 ? "sunny" : "neutral"}>+{gained}</Badge>
                </div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-linear-to-r from-bubblegum to-tangerine"
                    initial={reduceMotion ? false : { width: 0 }}
                    animate={{ width: `${(count / most) * 100}%` }}
                    transition={{ type: "spring", stiffness: 90, damping: 18 }}
                  />
                </div>
                <div className="flex min-h-9 flex-wrap items-center gap-2">
                  <span className="text-ink-soft">
                    {count} {count === 1 ? "vote" : "votes"}
                  </span>
                  {voters.map((voter) => (
                    <Avatar
                      key={voter.id}
                      avatar={voter.avatar}
                      color={voter.color}
                      label={`${voter.nickname} voted for ${player.nickname}`}
                      size="sm"
                    />
                  ))}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <Scoreboard game={game} selfId={room.selfId} />
    </div>
  );
}
