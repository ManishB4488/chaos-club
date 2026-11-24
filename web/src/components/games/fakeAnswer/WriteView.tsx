"use client";

import { useId, useState, type FormEvent } from "react";
import { FAKE_ANSWER_MAX_LENGTH, type FakeAnswerAction, type FakeAnswerView } from "@chaos/shared";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function WriteView({
  game,
  onSend,
}: {
  game: FakeAnswerView;
  onSend: (action: FakeAnswerAction) => Promise<string | null>;
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
      setError("Write a fake answer first.");
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
      <Card accent="grape" padding="lg">
        <h2 className="font-display text-3xl leading-tight font-bold sm:text-4xl">{game.question}</h2>
      </Card>

      {mine ? (
        <Card padding="lg" className="flex flex-col gap-2">
          <p className="text-ink-soft">Your fake answer is locked in. Waiting for the others.</p>
          <p className="font-display text-2xl font-semibold">{mine}</p>
        </Card>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <label htmlFor={inputId} className="font-semibold">
            Write a believable fake answer
          </label>
          <p className="text-ink-soft">
            Short and serious works best. The others will try to spot the real one, and you earn a point every time
            someone picks yours.
          </p>
          <input
            id={inputId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={FAKE_ANSWER_MAX_LENGTH}
            autoComplete="off"
            spellCheck={false}
            placeholder="Your fake answer"
            className="min-h-12 w-full rounded-2xl border-2 border-white/15 bg-night-800 px-4 text-lg text-ink placeholder:text-ink-soft/70"
          />
          {error && (
            <p role="alert" className="font-semibold text-bubblegum">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" fullWidth loading={busy}>
            Lock it in
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
