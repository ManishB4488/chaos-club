"use client";

import { useId, useState, type FormEvent } from "react";
import type { DrawItWrongAction, DrawItWrongView } from "@chaos/shared";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/** Blanks that show only how long the word is, for example "___ _____" for ice cream. Never the letters. */
export function WordShape({ shape }: { shape: number[] }) {
  return (
    <p
      className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-display text-3xl font-bold tracking-widest"
      aria-label={`A word with ${shape.join(" and ")} letters`}
    >
      {shape.map((length, index) => (
        <span key={index} aria-hidden>
          {"_".repeat(length).split("").join(" ")}
        </span>
      ))}
    </p>
  );
}

export function GuessBox({
  game,
  selfId,
  onSend,
}: {
  game: DrawItWrongView;
  selfId: string;
  onSend: (action: DrawItWrongAction) => Promise<string | null>;
}) {
  const inputId = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const gotIt = game.correctIds.includes(selfId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const guess = text.trim();
    if (!guess) return;
    setBusy(true);
    setError(null);
    const message = await onSend({ type: "guess", text: guess });
    setBusy(false);
    if (message) setError(message);
    else setText("");
  }

  if (gotIt) {
    return (
      <Card accent="sunny" padding="md">
        <p className="font-display text-2xl font-bold">You got it! Waiting for the round to finish.</p>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <label htmlFor={inputId} className="font-semibold">
        What is it?
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={40}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Type your guess"
          className="min-h-12 min-w-0 flex-1 rounded-2xl border-2 border-white/15 bg-night-800 px-4 text-lg text-ink placeholder:text-ink-soft/70"
        />
        <Button type="submit" size="md" loading={busy}>
          Guess
        </Button>
      </div>
      {error && (
        <p role="alert" className="font-semibold text-bubblegum">
          {error}
        </p>
      )}
    </form>
  );
}

/** Everyone's wrong guesses, live, and who has got it (never the guess itself). */
export function GuessFeed({ game }: { game: DrawItWrongView }) {
  const byId = new Map(game.participants.map((player) => [player.id, player]));
  return (
    <Card padding="md" className="flex flex-col gap-3">
      <h3 className="font-display text-xl font-semibold">Guesses</h3>
      {game.correctIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {game.correctIds.map((id) => (
            <Badge key={id} tone="sunny">
              {byId.get(id)?.nickname ?? "Someone"} got it!
            </Badge>
          ))}
        </div>
      )}
      {game.guesses.length === 0 ? (
        <p className="text-ink-soft">No wrong guesses yet.</p>
      ) : (
        <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
          {game.guesses.map((guess, index) => {
            const player = byId.get(guess.playerId);
            return (
              <li key={index} className="flex items-center gap-2">
                {player && <Avatar avatar={player.avatar} color={player.color} label={player.nickname} size="sm" />}
                <span className="font-semibold">{player?.nickname ?? "Someone"}</span>
                <span className="min-w-0 flex-1 truncate text-ink-soft">{guess.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
