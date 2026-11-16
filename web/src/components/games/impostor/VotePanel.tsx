"use client";

import { useId, useState, type FormEvent } from "react";
import type { ImpostorAction, ImpostorView, RoomView } from "@chaos/shared";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { ClueList } from "./CluePanel";

type SendAction = (action: ImpostorAction) => Promise<string | null>;

export function ImpostorVoting({
  room,
  game,
  onSend,
}: {
  room: RoomView;
  game: ImpostorView;
  onSend: SendAction;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stillHere = new Set(room.players.map((player) => player.id));
  const candidates = game.participants.filter((player) => player.id !== room.selfId);
  const hasVoted = game.myVote !== null;

  async function choose(playerId: string) {
    setPendingId(playerId);
    setError(null);
    const message = await onSend({ type: "vote", targetId: playerId });
    setPendingId(null);
    if (message) setError(message);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card accent="bubblegum" padding="lg" className="flex flex-col gap-2">
        <h2 className="font-display text-3xl font-bold">Who is the impostor?</h2>
        <p className="text-lg text-ink-soft">
          {hasVoted
            ? "Vote locked in. Waiting for the others."
            : "Pick the player whose word you think is different. Your vote stays secret until everyone has voted."}
        </p>
      </Card>

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

      <p role="status" className="text-ink-soft">
        {game.votedIds.length} of {game.participants.length} voted
      </p>

      <ClueList game={game} selfId={room.selfId} />
    </div>
  );
}

const inputClass =
  "min-h-12 w-full rounded-2xl border-2 border-white/15 bg-night-800 px-4 text-lg text-ink placeholder:text-ink-soft/70";

/** A caught impostor gets one guess at the crew word. Everyone else watches. */
export function GuessView({
  room,
  game,
  onSend,
}: {
  room: RoomView;
  game: ImpostorView;
  onSend: SendAction;
}) {
  const inputId = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const outcome = game.outcome;
  if (!outcome) return null;

  const impostor = game.participants.find((player) => player.id === outcome.impostorId);
  const iAmImpostor = outcome.impostorId === room.selfId;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const guess = text.trim();
    if (!guess) {
      setError("Type your guess first.");
      return;
    }
    setBusy(true);
    setError(null);
    const message = await onSend({ type: "guess", text: guess });
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <Card accent="sunny" padding="lg" className="flex flex-col gap-4">
      {iAmImpostor ? (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <label htmlFor={inputId} className="font-display text-3xl font-bold">
            You were caught!
          </label>
          <p className="text-lg text-ink-soft">
            You still have one chance. What was the crew word? A correct guess earns you 2 points.
          </p>
          <input
            id={inputId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={30}
            autoComplete="off"
            spellCheck={false}
            placeholder="The crew word"
            className={inputClass}
          />
          {error && (
            <p role="alert" className="font-semibold text-bubblegum">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" fullWidth loading={busy}>
            Send guess
          </Button>
        </form>
      ) : (
        <>
          <h2 className="font-display text-3xl font-bold">
            {impostor?.nickname ?? "Someone"} was caught!
          </h2>
          <p className="text-lg text-ink-soft">They get one guess at the crew word. Waiting for it.</p>
        </>
      )}
    </Card>
  );
}
