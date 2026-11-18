"use client";

import { useId, useState, type FormEvent } from "react";
import { ROAST_ANSWER_MAX_LENGTH, type RoastAction, type RoastView } from "@chaos/shared";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function WritingView({
  game,
  onSend,
}: {
  game: RoastView;
  onSend: (action: RoastAction) => Promise<string | null>;
}) {
  const inputId = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mine = game.mySubmission;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const answer = text.trim();
    if (!answer) {
      setError("Write something first.");
      return;
    }
    setBusy(true);
    setError(null);
    const message = await onSend({ type: "submit", text: answer });
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card accent="tangerine" padding="lg">
        <h2 className="font-display text-3xl leading-tight font-bold sm:text-4xl">{game.prompt}</h2>
      </Card>

      {mine ? (
        <Card padding="lg" className="flex flex-col gap-2">
          <p className="text-ink-soft">Your answer is locked in. Waiting for the others.</p>
          <p className="font-display text-2xl font-semibold">{mine}</p>
        </Card>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <label htmlFor={inputId} className="font-semibold">
            Your answer
          </label>
          <textarea
            id={inputId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={ROAST_ANSWER_MAX_LENGTH}
            rows={3}
            placeholder="Make it funny, and keep it friendly"
            className="w-full resize-none rounded-2xl border-2 border-white/15 bg-night-800 p-4 text-lg text-ink placeholder:text-ink-soft/70"
          />
          <p className="text-right text-sm text-ink-soft">
            {text.length} / {ROAST_ANSWER_MAX_LENGTH}
          </p>
          {error && (
            <p role="alert" className="font-semibold text-bubblegum">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" fullWidth loading={busy}>
            Send answer
          </Button>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3" role="status">
        <span className="text-ink-soft">
          {game.submittedIds.length} of {game.participants.length} answered
        </span>
        {game.participants
          .filter((player) => game.submittedIds.includes(player.id))
          .map((player) => (
            <Avatar
              key={player.id}
              avatar={player.avatar}
              color={player.color}
              label={`${player.nickname} has answered`}
              size="sm"
            />
          ))}
      </div>
    </div>
  );
}
