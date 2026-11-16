"use client";

import { useId, useState, type FormEvent } from "react";
import type { ImpostorAction, ImpostorView, RoomView } from "@chaos/shared";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type SendAction = (action: ImpostorAction) => Promise<string | null>;

/** Every clue given so far, in speaking order. Clues are public. */
export function ClueList({ game, selfId }: { game: ImpostorView; selfId: string }) {
  const byId = new Map(game.participants.map((player) => [player.id, player]));
  const clueBy = new Map(game.clues.map((clue) => [clue.playerId, clue.text]));
  const currentIndex = game.currentSpeakerId
    ? game.clueOrder.indexOf(game.currentSpeakerId)
    : game.clueOrder.length;

  if (game.clueOrder.length === 0) return null;
  return (
    <Card padding="md" className="flex flex-col gap-3">
      <h3 className="font-display text-xl font-semibold">Clues</h3>
      <ol className="flex flex-col gap-3">
        {game.clueOrder.map((id, index) => {
          const player = byId.get(id);
          if (!player) return null;
          const clue = clueBy.get(id);
          const speaking = id === game.currentSpeakerId;
          const skipped = !clue && !speaking && index < currentIndex;
          return (
            <li key={id} className="flex items-center gap-3">
              <Avatar avatar={player.avatar} color={player.color} label={player.nickname} size="sm" />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {player.nickname}
                {id === selfId ? " (you)" : ""}
              </span>
              {clue ? (
                <span className="rounded-pill border border-sunny/50 bg-sunny/20 px-3 py-1 font-display text-lg font-semibold">
                  {clue}
                </span>
              ) : speaking ? (
                <Badge tone="volt">Speaking now</Badge>
              ) : skipped ? (
                <Badge>Skipped</Badge>
              ) : (
                <Badge>Waiting</Badge>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

const inputClass =
  "min-h-12 w-full rounded-2xl border-2 border-white/15 bg-night-800 px-4 text-lg text-ink placeholder:text-ink-soft/70";

export function CluesView({
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

  const isMyTurn = game.currentSpeakerId === room.selfId;
  const speaker = game.participants.find((player) => player.id === game.currentSpeakerId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const clue = text.trim();
    if (!/^\S+$/.test(clue)) {
      setError("Use exactly one word, with no spaces.");
      return;
    }
    setBusy(true);
    setError(null);
    const message = await onSend({ type: "clue", text: clue });
    setBusy(false);
    if (message) setError(message);
    else setText("");
  }

  return (
    <div className="flex flex-col gap-6">
      <Card accent={isMyTurn ? "sunny" : undefined} padding="lg" className="flex flex-col gap-4">
        {isMyTurn ? (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <label htmlFor={inputId} className="font-display text-2xl font-bold">
              Your turn: give one clue
            </label>
            <p className="text-ink-soft">One word that hints at your secret word without saying it.</p>
            <input
              id={inputId}
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={24}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="One word"
              className={inputClass}
            />
            {error && (
              <p role="alert" className="font-semibold text-bubblegum">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" fullWidth loading={busy}>
              Send clue
            </Button>
          </form>
        ) : (
          <p className="font-display text-2xl font-bold">
            Waiting for {speaker?.nickname ?? "the next player"} to give a clue.
          </p>
        )}
      </Card>
      <ClueList game={game} selfId={room.selfId} />
    </div>
  );
}

export function DiscussionView({
  room,
  game,
  onSend,
}: {
  room: RoomView;
  game: ImpostorView;
  onSend: SendAction;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const iAmReady = game.readyIds.includes(room.selfId);

  async function ready() {
    setBusy(true);
    setError(null);
    const message = await onSend({ type: "ready" });
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <div className="flex flex-col gap-6">
      <ClueList game={game} selfId={room.selfId} />
      <Card padding="lg" className="flex flex-col gap-4">
        <h2 className="font-display text-3xl font-bold">Who is the odd one out?</h2>
        <p className="text-lg text-ink-soft">
          Talk it over out loud. Whose clues do not fit? When you are ready, move on to the secret vote.
        </p>
        <Button size="lg" fullWidth disabled={iAmReady} loading={busy} onClick={ready}>
          {iAmReady ? "Waiting for the others" : "I am ready to vote"}
        </Button>
        {error && (
          <p role="alert" className="font-semibold text-bubblegum">
            {error}
          </p>
        )}
        <p role="status" className="text-ink-soft">
          {game.readyIds.length} of {game.participants.length} ready
        </p>
      </Card>
    </div>
  );
}
