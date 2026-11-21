"use client";

import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameSecret } from "@chaos/shared";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ImpostorSecretResult } from "@/lib/roomClient";

/** The secret hides itself after this long, in case a player forgets to hide it. */
const AUTO_HIDE_MS = 15_000;

/**
 * Shows the player's own secret, and only after the server has re-checked, right now, that it is theirs.
 *
 * - The secret is NOT part of the room updates. It is fetched when the button is pressed.
 * - It lives only in this component's memory: never in browser storage, never logged.
 * - Hide and Pass clears it. It also clears when the page goes into the background, after 15 seconds,
 *   and whenever the round moves to a new step (the parent changes this component's key).
 * - While hidden the secret is simply not in the page at all, so there is nothing to un-hide or inspect.
 */
export function SecretCard({ onReveal }: { onReveal: () => Promise<ImpostorSecretResult> }) {
  const [secret, setSecret] = useState<GameSecret | null>(null);
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

  if (!secret) {
    return (
      <Card accent="volt" padding="md" className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck aria-hidden className="size-6 shrink-0 text-volt" />
          <div>
            <p className="font-display text-xl font-semibold">Your secret is hidden</p>
            <p className="text-sm text-ink-soft">Make sure nobody is looking at your screen, then reveal it.</p>
          </div>
        </div>
        <Button size="lg" fullWidth variant="secondary" loading={busy} onClick={reveal}>
          <Eye aria-hidden className="size-5" />
          Reveal my secret
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
    <Card accent={secret.role === "impostor" ? "bubblegum" : "sunny"} padding="md" className="flex flex-col gap-3">
      {secret.role === "impostor" ? (
        <>
          <p className="font-display text-3xl font-bold">You are the IMPOSTOR</p>
          <p className="text-lg text-ink-soft">
            You do not get the word. Listen to the clues, blend in, and try not to get caught.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft">You are on the crew. The secret word is</p>
          <p className="font-display text-4xl font-bold">{secret.word}</p>
        </>
      )}
      <p className="text-sm text-ink-soft">This hides itself in 15 seconds.</p>
      <Button size="lg" fullWidth onClick={hide}>
        <EyeOff aria-hidden className="size-5" />
        {"Hide & Pass"}
      </Button>
    </Card>
  );
}
