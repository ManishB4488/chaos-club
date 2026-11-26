"use client";

import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DrawItWrongAction, DrawSecret } from "@chaos/shared";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { DrawSecretResult } from "@/lib/roomClient";

const AUTO_HIDE_MS = 15_000;

/**
 * The artist's private words. Same rules as the Impostor secret: fetched only when the button is pressed (the
 * server re-checks every time), held only in this card's memory, and cleared by Hide and Pass, by the page going
 * to the background, after 15 seconds and whenever the round moves to a new step.
 */
export function DrawSecretCard({
  step,
  onReveal,
  onPick,
}: {
  step: "choosing" | "drawing";
  onReveal: () => Promise<DrawSecretResult>;
  onPick: (action: DrawItWrongAction) => Promise<string | null>;
}) {
  const [secret, setSecret] = useState<DrawSecret | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setSecret(null);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hide();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [hide]);

  async function reveal() {
    setBusy(true);
    setError(null);
    const result = await onReveal();
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setSecret(result.secret);
    timer.current = setTimeout(hide, AUTO_HIDE_MS);
  }

  async function pick(index: number) {
    setBusy(true);
    setError(null);
    const message = await onPick({ type: "pick", index });
    setBusy(false);
    if (message) setError(message);
    else hide();
  }

  if (!secret || secret.role !== "artist") {
    return (
      <Card accent="volt" padding="md" className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck aria-hidden className="size-6 shrink-0 text-volt" />
          <div>
            <p className="font-display text-xl font-semibold">
              {step === "choosing" ? "Your words are hidden" : "Your word is hidden"}
            </p>
            <p className="text-sm text-ink-soft">Make sure nobody is looking at your screen, then reveal it.</p>
          </div>
        </div>
        <Button size="lg" fullWidth variant="secondary" loading={busy} onClick={reveal}>
          <Eye aria-hidden className="size-5" />
          {step === "choosing" ? "Reveal my words" : "Reveal my word"}
        </Button>
        {error && (
          <p role="alert" className="font-semibold text-bubblegum">
            {error}
          </p>
        )}
      </Card>
    );
  }

  return (
    <Card accent="sunny" padding="md" className="flex flex-col gap-3">
      {secret.options.length > 0 ? (
        <>
          <p className="font-display text-2xl font-bold">Pick a word to draw</p>
          <div className="flex flex-col gap-2">
            {secret.options.map((option, index) => (
              <Button key={option} size="lg" variant="secondary" disabled={busy} onClick={() => pick(index)}>
                {option}
              </Button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft">Draw this word</p>
          <p className="font-display text-4xl font-bold">{secret.word}</p>
        </>
      )}
      {error && (
        <p role="alert" className="font-semibold text-bubblegum">
          {error}
        </p>
      )}
      <p className="text-sm text-ink-soft">This hides itself in 15 seconds.</p>
      <Button size="lg" fullWidth onClick={hide}>
        <EyeOff aria-hidden className="size-5" />
        {"Hide & Pass"}
      </Button>
    </Card>
  );
}
