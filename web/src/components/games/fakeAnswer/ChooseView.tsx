"use client";

import { Flag } from "lucide-react";
import { useState } from "react";
import type { FakeAnswerAction, FakeAnswerView } from "@chaos/shared";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type SendAction = (action: FakeAnswerAction) => Promise<string | null>;

/** Tells the site an answer is not okay. Looks and behaves the same for every answer. */
export function FakeReportButton({
  optionId,
  onSend,
  onError,
}: {
  optionId: string;
  onSend: SendAction;
  onError: (message: string) => void;
}) {
  const [reported, setReported] = useState(false);
  const [busy, setBusy] = useState(false);

  async function report() {
    setBusy(true);
    const message = await onSend({ type: "report", optionId });
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

export function ChooseView({ game, onSend }: { game: FakeAnswerView; onSend: SendAction }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasChosen = game.myChoiceId !== null;

  async function choose(optionId: string) {
    setPending(true);
    setError(null);
    const message = await onSend({ type: "choose", optionId });
    setPending(false);
    if (message) setError(message);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card accent="grape" padding="lg" className="flex flex-col gap-2">
        <p className="text-ink-soft">The question was</p>
        <h2 className="font-display text-2xl leading-tight font-bold sm:text-3xl">{game.question}</h2>
      </Card>

      <p className="text-lg text-ink-soft">
        {hasChosen
          ? "Locked in. Waiting for the others."
          : "Which one is the real answer? Your own fake is not shown."}
      </p>

      <ul className="flex flex-col gap-4">
        {game.options.map((option) => {
          const selected = game.myChoiceId === option.id;
          return (
            <li key={option.id}>
              <Card accent={selected ? "sunny" : undefined} padding="md" className="flex flex-col gap-4">
                <p className="font-display text-2xl leading-snug font-semibold">{option.text}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    variant={selected ? "primary" : "secondary"}
                    aria-pressed={selected}
                    disabled={hasChosen || pending}
                    onClick={() => choose(option.id)}
                  >
                    {selected ? "Your pick" : "This is the real one"}
                  </Button>
                  <FakeReportButton optionId={option.id} onSend={onSend} onError={setError} />
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
        {game.chosenIds.length} of {game.participants.length} chose
      </p>
    </div>
  );
}
