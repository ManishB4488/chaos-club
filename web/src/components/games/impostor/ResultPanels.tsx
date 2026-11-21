"use client";

import { useState } from "react";
import { Award, Trophy } from "lucide-react";
import type { ImpostorAward, ImpostorView, RoomView } from "@chaos/shared";
import { ScoreboardCard } from "@/components/games/ScoreboardCard";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useCountdown } from "@/lib/useCountdown";

/** What happened this round: who the impostor was, both words, the votes and the points. */
export function RoundResult({ room, game }: { room: RoomView; game: ImpostorView }) {
  const { seconds } = useCountdown(game.stepEndsAt, room.serverTime);
  const outcome = game.outcome;
  if (!outcome) return null;

  const byId = new Map(game.participants.map((player) => [player.id, player]));
  const impostor = byId.get(outcome.impostorId);
  const guessLine =
    outcome.guess === null
      ? "They did not make a guess in time."
      : `They guessed "${outcome.guess}", which was ${outcome.guessCorrect ? "correct! They earn 2 bonus points." : "wrong."}`;

  return (
    <div className="flex flex-col gap-6">
      <Card accent={outcome.caught ? "sunny" : "bubblegum"} padding="lg" className="flex flex-col gap-3">
        <h2 className="font-display text-3xl font-bold">
          {impostor?.nickname ?? "Someone"} was the impostor!
        </h2>
        <p className="text-lg text-ink-soft">
          {outcome.caught ? "They were caught." : "They got away with it!"}
        </p>
        {outcome.caught && <p className="text-lg">{guessLine}</p>}
        <p className="text-ink-soft" role="timer">
          {game.round < game.totalRounds ? "Next round" : "Final results"} in {seconds ?? "..."}s
        </p>
      </Card>

      <Card padding="md">
        <p className="text-sm text-ink-soft">The secret crew word was</p>
        <p className="font-display text-3xl font-bold">{outcome.crewWord}</p>
      </Card>

      <Card padding="md" className="flex flex-col gap-3">
        <h3 className="font-display text-xl font-semibold">Votes</h3>
        {outcome.votes.length === 0 ? (
          <p className="text-ink-soft">Nobody voted.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {outcome.votes.map((vote) => {
              const voter = byId.get(vote.voterId);
              const target = byId.get(vote.targetId);
              if (!voter || !target) return null;
              return (
                <li key={vote.voterId} className="flex items-center gap-3">
                  <Avatar avatar={voter.avatar} color={voter.color} label={voter.nickname} size="sm" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold">{voter.nickname}</span> voted for{" "}
                    <span className="font-semibold">{target.nickname}</span>
                  </span>
                  <Avatar avatar={target.avatar} color={target.color} label={target.nickname} size="sm" />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card padding="md" className="flex flex-col gap-3">
        <h3 className="font-display text-xl font-semibold">Points this round</h3>
        <ul className="flex flex-col gap-3">
          {game.participants.map((player) => (
            <li key={player.id} className="flex items-center gap-3">
              <Avatar avatar={player.avatar} color={player.color} label={player.nickname} size="sm" />
              <span className="min-w-0 flex-1 truncate font-semibold">{player.nickname}</span>
              <Badge tone={(outcome.pointsGained?.[player.id] ?? 0) > 0 ? "sunny" : "neutral"}>
                +{outcome.pointsGained?.[player.id] ?? 0}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>

      <ScoreboardCard participants={game.participants} scores={game.scores} selfId={room.selfId} />
    </div>
  );
}

function awardUnit(award: ImpostorAward): string {
  if (award.id === "master-of-disguise") return award.value === 1 ? "round undetected" : "rounds undetected";
  if (award.id === "sharpest-detective") return award.value === 1 ? "correct vote" : "correct votes";
  return award.value === 1 ? "correct guess" : "correct guesses";
}

type FinalResultsProps = {
  room: RoomView;
  game: ImpostorView;
  isHost: boolean;
  onPlayAgain: () => Promise<string | null>;
  onBackToLobby: () => Promise<string | null>;
};

export function FinalResults({ room, game, isHost, onPlayAgain, onBackToLobby }: FinalResultsProps) {
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
                    {entry.survivals} {entry.survivals === 1 ? "disguise" : "disguises"}
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
