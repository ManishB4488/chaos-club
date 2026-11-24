"use client";

import { Award, Trophy } from "lucide-react";
import { useState } from "react";
import type { FakeAnswerAward, FakeAnswerView, RoomView } from "@chaos/shared";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type FakeResultsProps = {
  room: RoomView;
  game: FakeAnswerView;
  isHost: boolean;
  onPlayAgain: () => Promise<string | null>;
  onBackToLobby: () => Promise<string | null>;
};

function awardUnit(award: FakeAnswerAward): string {
  if (award.id === "professional-liar") return award.value === 1 ? "player fooled" : "players fooled";
  return award.value === 1 ? "correct pick" : "correct picks";
}

export function FakeResults({ room, game, isHost, onPlayAgain, onBackToLobby }: FakeResultsProps) {
  const [pending, setPending] = useState<"again" | "lobby" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const results = game.results;
  if (!results) return null;

  const byId = new Map(game.participants.map((player) => [player.id, player]));
  const winners = results.ranking.filter((entry) => entry.rank === 1);
  const winnerNames = winners.map((entry) => byId.get(entry.playerId)?.nickname ?? "Someone");

  async function run(kind: "again" | "lobby", action: () => Promise<string | null>) {
    setPending(kind);
    setError(null);
    const message = await action();
    setPending(null);
    if (message) setError(message);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card accent="sunny" padding="lg" className="flex flex-col items-center gap-3 text-center">
        <Trophy aria-hidden className="size-12 text-sunny" />
        <h2 className="font-display text-4xl font-bold">
          {winnerNames.length === 1 ? `${winnerNames[0]} wins!` : `A tie: ${winnerNames.join(" and ")}`}
        </h2>
        {results.endedEarly && (
          <p className="text-ink-soft">The game ended early because too many players left.</p>
        )}
      </Card>

      <Card padding="lg" className="flex flex-col gap-4">
        <h3 className="font-display text-2xl font-semibold">Final ranking</h3>
        <ol className="flex flex-col gap-4">
          {results.ranking.map((entry) => {
            const player = byId.get(entry.playerId);
            if (!player) return null;
            return (
              <li key={entry.playerId} className="flex items-center gap-3">
                <span className="w-8 font-display text-2xl font-bold text-ink-soft">{entry.rank}</span>
                <Avatar avatar={player.avatar} color={player.color} label={player.nickname} size="md" />
                <span className="min-w-0 flex-1 truncate font-display text-xl font-semibold">
                  {player.nickname}
                  {player.id === room.selfId ? " (you)" : ""}
                </span>
                <span className="text-right">
                  <span className="block font-display text-2xl font-bold">{entry.score}</span>
                  <span className="block text-sm text-ink-soft">
                    {entry.correct} right, {entry.fooled} fooled
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </Card>

      {results.awards.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-2xl font-semibold">Awards</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {results.awards.map((award) => (
              <li key={award.id}>
                <Card accent="grape" padding="md" className="flex h-full flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Award aria-hidden className="size-6 text-sunny" />
                    <span className="font-display text-lg font-semibold">{award.title}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {award.playerIds.map((id) => {
                      const player = byId.get(id);
                      return player ? (
                        <span key={id} className="flex items-center gap-2">
                          <Avatar avatar={player.avatar} color={player.color} label={player.nickname} size="sm" />
                          <span className="font-semibold">{player.nickname}</span>
                        </span>
                      ) : null;
                    })}
                  </div>
                  <Badge className="self-start">
                    {award.value} {awardUnit(award)}
                  </Badge>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isHost ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <Button size="lg" loading={pending === "again"} disabled={pending !== null} onClick={() => run("again", onPlayAgain)}>
              Play again
            </Button>
            <Button
              size="lg"
              variant="secondary"
              loading={pending === "lobby"}
              disabled={pending !== null}
              onClick={() => run("lobby", onBackToLobby)}
            >
              Back to lobby
            </Button>
          </div>
          {error && (
            <p role="alert" className="font-semibold text-bubblegum">
              {error}
            </p>
          )}
        </div>
      ) : (
        <p className="text-ink-soft">Waiting for the host to start another game or go back to the lobby.</p>
      )}
    </div>
  );
}
