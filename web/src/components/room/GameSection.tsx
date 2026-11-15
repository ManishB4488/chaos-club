"use client";

import { useState } from "react";
import type { GameId, RoomView } from "@chaos/shared";
import { ACCENT_BG, GAME_ICONS } from "@/components/home/game-visuals";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { GAMES, playersLabel } from "@/lib/games";
import { useCountdown } from "@/lib/useCountdown";

type GameSectionProps = {
  room: RoomView;
  isHost: boolean;
  online: boolean;
  onSelect: (gameId: GameId) => Promise<string | null>;
  onStart: () => Promise<string | null>;
};

export function GameSection({ room, isHost, online, onSelect, onStart }: GameSectionProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"select" | "start" | null>(null);
  const { seconds: secondsLeft } = useCountdown(room.countdownEndsAt, room.serverTime);

  const selected = GAMES.find((game) => game.id === room.selectedGame) ?? null;
  const connectedCount = room.players.filter((player) => player.connected).length;

  function startBlockedReason(): string | null {
    if (!selected) return "Pick a game first.";
    if (!room.availableGames.includes(selected.id)) return `${selected.name} is not available yet.`;
    const needed = room.minPlayersForGame ?? 2;
    if (connectedCount < needed) {
      return `${selected.name} needs at least ${needed} connected players. ${connectedCount} here now.`;
    }
    return null;
  }

  async function run(kind: "select" | "start", action: () => Promise<string | null>) {
    setPending(kind);
    setError(null);
    const message = await action();
    setPending(null);
    if (message) setError(message);
  }

  if (room.phase === "starting" && selected) {
    return (
      <Card accent="sunny" padding="lg" className="flex flex-col items-center gap-2 text-center">
        <p className="text-ink-soft">Get ready! {selected.name} starts in</p>
        <p className="font-display text-8xl font-bold">{secondsLeft ?? "..."}</p>
      </Card>
    );
  }

  if (room.phase === "in-game") {
    // The game screens take over. This only shows for a moment while the game is being set up.
    return (
      <Card padding="lg">
        <p className="text-ink-soft">Setting up the game...</p>
      </Card>
    );
  }

  const blocked = startBlockedReason();

  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <h2 className="font-display text-2xl font-semibold">{isHost ? "Choose a game" : "Game"}</h2>

      {isHost ? (
        <ul className="flex flex-col gap-3">
          {GAMES.map((game) => {
            const Icon = GAME_ICONS[game.id];
            const isSelected = game.id === room.selectedGame;
            return (
              <li key={game.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  disabled={pending !== null}
                  onClick={() => run("select", () => onSelect(game.id))}
                  className={cn(
                    "flex min-h-16 w-full items-center gap-4 rounded-2xl border-2 p-3 text-left transition disabled:opacity-60",
                    isSelected ? "border-sunny bg-sunny/10" : "border-white/10 hover:bg-white/5",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-12 shrink-0 items-center justify-center rounded-xl",
                      ACCENT_BG[game.accent],
                    )}
                  >
                    <Icon aria-hidden className="size-6 text-night-950" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-semibold">{game.name}</span>
                    <span className="block text-sm text-ink-soft">{playersLabel(game)}</span>
                  </span>
                  {!room.availableGames.includes(game.id) && <Badge>Not available yet</Badge>}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-lg">
          {selected ? (
            <>
              The host picked <strong>{selected.name}</strong>.
            </>
          ) : (
            "The host is choosing a game."
          )}
        </p>
      )}

      {isHost ? (
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            fullWidth
            disabled={blocked !== null || !online}
            loading={pending === "start"}
            onClick={() => run("start", onStart)}
          >
            Start game
          </Button>
          {blocked && <p className="text-ink-soft">{blocked}</p>}
        </div>
      ) : (
        selected && <p className="text-ink-soft">Waiting for the host to start the game.</p>
      )}

      {error && (
        <p role="alert" className="font-semibold text-bubblegum">
          {error}
        </p>
      )}
    </Card>
  );
}
