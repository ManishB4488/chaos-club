"use client";

import { Flag, Star } from "lucide-react";
import { useState } from "react";
import type { RoastAction, RoastView } from "@chaos/shared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type SendAction = (action: RoastAction) => Promise<string | null>;

/** Reporting is available on every answer that is not yours. Remembers which ones you reported. */
export function ReportButton({
  answerId,
  onSend,
  onError,
}: {
  answerId: string;
  onSend: SendAction;
  onError: (message: string) => void;
}) {
  const [reported, setReported] = useState(false);
  const [busy, setBusy] = useState(false);

  async function report() {
    setBusy(true);
    const message = await onSend({ type: "report", answerId });
    setBusy(false);
    if (message) onError(message);
    else setReported(true);
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={reported}
      loading={busy}
      aria-label="Report this answer"
      onClick={report}
    >
      <Flag aria-hidden className="size-4" />
      {reported ? "Reported" : "Report"}
    </Button>
  );
}

export function RoastVoting({ game, onSend }: { game: RoastView; onSend: SendAction }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasVoted = game.myVoteAnswerId !== null;
  const rating = game.mode === "stars";

  async function send(action: RoastAction) {
    setPending(true);
    setError(null);
    const message = await onSend(action);
    setPending(false);
    if (message) setError(message);
  }

  const hint = hasVoted
    ? "Locked in. Waiting for the others."
    : rating
      ? "Rate the other answer from 1 to 3 stars."
      : "Pick the funniest answer. You cannot pick your own. Names appear after voting.";

  return (
    <div className="flex flex-col gap-6">
      <Card accent="tangerine" padding="lg" className="flex flex-col gap-2">
        <p className="text-ink-soft">The question was</p>
        <h2 className="font-display text-2xl leading-tight font-bold sm:text-3xl">{game.prompt}</h2>
      </Card>

      <p className="text-lg text-ink-soft">{hint}</p>

      <ul className="flex flex-col gap-4">
        {game.answers.map((answer) => {
          const selected = game.myVoteAnswerId === answer.id;
          return (
            <li key={answer.id}>
              <Card accent={selected ? "sunny" : undefined} padding="md" className="flex flex-col gap-4">
                <p className="font-display text-2xl leading-snug font-semibold">{answer.text}</p>
                <div className="flex flex-wrap items-center gap-3">
                  {answer.mine ? (
                    <Badge tone="volt">Your answer</Badge>
                  ) : rating ? (
                    [1, 2, 3].map((value) => (
                      <Button
                        key={value}
                        size="sm"
                        variant={game.myStars === value ? "primary" : "secondary"}
                        disabled={hasVoted || pending}
                        onClick={() => send({ type: "rate", answerId: answer.id, stars: value })}
                      >
                        <Star aria-hidden className="size-4" />
                        {value} {value === 1 ? "star" : "stars"}
                      </Button>
                    ))
                  ) : (
                    <Button
                      size="sm"
                      variant={selected ? "primary" : "secondary"}
                      aria-pressed={selected}
                      disabled={hasVoted || pending}
                      onClick={() => send({ type: "vote", answerId: answer.id })}
                    >
                      {selected ? "Your vote" : "This is the funniest"}
                    </Button>
                  )}
                  {!answer.mine && <ReportButton answerId={answer.id} onSend={onSend} onError={setError} />}
                </div>
              </Card>
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
    </div>
  );
}
