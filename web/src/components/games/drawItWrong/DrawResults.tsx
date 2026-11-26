"use client";

import { Award, RotateCcw, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DrawAward, DrawItWrongView, DrawStroke, RoomView } from "@chaos/shared";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DrawingStore } from "@/lib/drawingStore";
import { partialStrokes } from "@/lib/replay";
import type { DrawingResult } from "@/lib/roomClient";
import { CanvasSurface } from "./CanvasSurface";

const REPLAY_MS = 6_000;

/** Plays the best drawing back, line by line. */
function ReplayPanel({
  round,
  word,
  artistName,
  load,
}: {
  round: number;
  word: string;
  artistName: string;
  load: (round?: number) => Promise<DrawingResult>;
}) {
  const [store] = useState(() => new DrawingStore());
  const [strokes, setStrokes] = useState<DrawStroke[] | null>(null);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const play = useCallback(
    (list: DrawStroke[]) => {
      stop();
      store.replace([]);
      setPlaying(true);
      const startedAt = performance.now();
      timer.current = setInterval(() => {
        const fraction = (performance.now() - startedAt) / REPLAY_MS;
        store.replace(partialStrokes(list, fraction));
        if (fraction >= 1) {
          stop();
          setPlaying(false);
        }
      }, 50);
    },
    [store, stop],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await loadRef.current(round);
      if (cancelled || !("drawing" in result)) return;
      setStrokes(result.drawing.strokes);
      play(result.drawing.strokes);
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [round, play, stop]);

  useEffect(() => () => store.dispose(), [store]);

  return (
    <Card accent="tangerine" padding="lg" className="flex flex-col gap-3">
      <Badge tone="tangerine" className="self-start">
        Replay
      </Badge>
      <p className="text-ink-soft">
        {artistName} drew <span className="font-semibold text-ink">{word}</span>
      </p>
      <CanvasSurface store={store} label={`Replay of the drawing of ${word}`} />
      <Button size="sm" variant="secondary" disabled={!strokes || playing} onClick={() => strokes && play(strokes)} className="self-start">
        <RotateCcw aria-hidden className="size-4" />
        Watch again
      </Button>
    </Card>
  );
}

function awardUnit(award: DrawAward): string {
  if (award.id === "sharpest-eye") return award.value === 1 ? "first guess" : "first guesses";
  return award.value === 1 ? "correct guess" : "correct guesses";
}

type DrawResultsProps = {
  room: RoomView;
  game: DrawItWrongView;
  isHost: boolean;
  load: (round?: number) => Promise<DrawingResult>;
  onPlayAgain: () => Promise<string | null>;
  onBackToLobby: () => Promise<string | null>;
};

export function DrawResults({ room, game, isHost, load, onPlayAgain, onBackToLobby }: DrawResultsProps) {
  const [pending, setPending] = useState<"again" | "lobby" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const results = game.results;
  if (!results) return null;

  const byId = new Map(game.participants.map((player) => [player.id, player]));
  const winners = results.ranking.filter((entry) => entry.rank === 1);
  const winnerNames = winners.map((entry) => byId.get(entry.playerId)?.nickname ?? "Someone");
  const highlight = results.highlight;

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

      {highlight && (
        <ReplayPanel
          round={highlight.round}
          word={highlight.word}
          artistName={byId.get(highlight.artistId)?.nickname ?? "Someone"}
          load={load}
        />
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
                    {entry.firstGuesses} first, {entry.artistCorrect} drawn right
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
