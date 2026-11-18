"use client";

import { Award, Copy, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RoastView, RoomView } from "@chaos/shared";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { copyText } from "@/lib/clipboard";
import { SITE_NAME } from "@/lib/site";

type RoastResultsProps = {
  room: RoomView;
  game: RoastView;
  isHost: boolean;
  onPlayAgain: () => Promise<string | null>;
  onBackToLobby: () => Promise<string | null>;
};

export function RoastResults({ room, game, isHost, onPlayAgain, onBackToLobby }: RoastResultsProps) {
  const [pending, setPending] = useState<"again" | "lobby" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const results = game.results;
  if (!results) return null;

  const byId = new Map(game.participants.map((player) => [player.id, player]));
  const winners = results.ranking.filter((entry) => entry.rank === 1);
  const winnerNames = winners.map((entry) => byId.get(entry.playerId)?.nickname ?? "Someone");
  const best = results.bestAnswer;
  const bestAuthor = best ? byId.get(best.playerId) : undefined;

  async function run(kind: "again" | "lobby", action: () => Promise<string | null>) {
    setPending(kind);
    setError(null);
    const message = await action();
    setPending(null);
    if (message) setError(message);
  }

  async function copyBest() {
    if (!best) return;
    const copied = await copyText(`"${best.text}" (${best.prompt}) from ${SITE_NAME}`);
    setNotice(copied ? "Copied!" : "Could not copy. Select the text and copy it by hand.");
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2_500);
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

      {best && (
        <Card accent="tangerine" padding="lg" className="flex flex-col gap-3">
          <Badge tone="tangerine" className="self-start">
            Best answer
          </Badge>
          <p className="text-ink-soft">{best.prompt}</p>
          <p className="font-display text-3xl leading-snug font-bold">{best.text}</p>
          <div className="flex flex-wrap items-center gap-3">
            {bestAuthor && (
              <Avatar avatar={bestAuthor.avatar} color={bestAuthor.color} label={bestAuthor.nickname} size="sm" />
            )}
            <span className="font-semibold">{bestAuthor?.nickname ?? "Someone"}</span>
            <Button size="sm" variant="secondary" onClick={copyBest} className="ml-auto">
              <Copy aria-hidden className="size-4" />
              Copy
            </Button>
          </div>
          <p role="status" className="min-h-6 font-semibold text-sunny">
            {notice}
          </p>
        </Card>
      )}

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
                    {entry.roundWins} {entry.roundWins === 1 ? "round win" : "round wins"}
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
                    {award.value} {award.id === "crowd-favorite" ? (award.value === 1 ? "round win" : "round wins") : "points"}
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
