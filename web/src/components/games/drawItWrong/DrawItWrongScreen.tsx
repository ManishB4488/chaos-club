"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { DrawItWrongAction, DrawItWrongView, RoomView } from "@chaos/shared";
import { ScoreboardCard } from "@/components/games/ScoreboardCard";
import { TimerBar } from "@/components/games/mostLikelyTo/TimerBar";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DrawingStore } from "@/lib/drawingStore";
import type { DrawSecretResult, DrawingResult } from "@/lib/roomClient";
import { useCountdown } from "@/lib/useCountdown";
import { useLiveDrawing } from "@/lib/useLiveDrawing";
import { ArtistPad } from "./ArtistPad";
import { CanvasSurface } from "./CanvasSurface";
import { DrawResults } from "./DrawResults";
import { DrawSecretCard } from "./DrawSecretCard";
import { GuessBox, GuessFeed, WordShape } from "./GuessPanel";

export type DrawItWrongScreenActions = {
  /** Picking a word and guessing. */
  send: (action: DrawItWrongAction) => Promise<string | null>;
  /** Lines, undo and clear. */
  move: (action: DrawItWrongAction) => Promise<string | null>;
  revealSecret: () => Promise<DrawSecretResult>;
  loadDrawing: (round?: number) => Promise<DrawingResult>;
  playAgain: () => Promise<string | null>;
  backToLobby: () => Promise<string | null>;
};

function StepHeader({ room, game }: { room: RoomView; game: DrawItWrongView }) {
  const { seconds, remainingMs } = useCountdown(game.stepEndsAt, room.serverTime);
  const artist = game.participants.find((player) => player.id === game.artistId);
  const label = game.step === "choosing" ? "Choosing a word" : game.step === "drawing" ? "Draw and guess" : "Results";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="sunny">
          Round {game.round} of {game.totalRounds}
        </Badge>
        <Badge tone="volt">{label}</Badge>
        {artist && (
          <span className="flex items-center gap-2">
            <Avatar avatar={artist.avatar} color={artist.color} label={artist.nickname} size="sm" />
            <span className="font-semibold">
              {artist.id === room.selfId ? "You are drawing" : `${artist.nickname} is drawing`}
            </span>
          </span>
        )}
        <span className="ml-auto font-display text-2xl font-bold" role="timer">
          {seconds ?? "..."}s
        </span>
      </div>
      <TimerBar remainingMs={remainingMs} totalMs={game.stepDurationMs} />
    </div>
  );
}

function ChallengeBanner({ game }: { game: DrawItWrongView }) {
  if (!game.rules) return null;
  return (
    <Card accent="tangerine" padding="md" className="flex flex-col gap-1">
      <p className="text-sm text-ink-soft">This round&apos;s challenge</p>
      <p className="font-display text-2xl font-bold">{game.rules.title}</p>
      <p className="text-ink-soft">{game.rules.description}</p>
    </Card>
  );
}

/** The drawing area: the artist draws, everyone else watches it appear live. */
function DrawingArea({
  room,
  game,
  actions,
}: {
  room: RoomView;
  game: DrawItWrongView;
  actions: DrawItWrongScreenActions;
}) {
  const [store] = useState(() => new DrawingStore());
  const isArtist = game.artistId === room.selfId;
  useEffect(() => () => store.dispose(), [store]);

  // The artist gets no live updates (they made the lines); everyone else does. Both load the current drawing.
  useLiveDrawing(store, actions.loadDrawing, { live: !isArtist });

  if (isArtist && game.rules) {
    return <ArtistPad rules={game.rules} store={store} onMove={actions.move} load={actions.loadDrawing} />;
  }
  return <CanvasSurface store={store} label="The drawing" />;
}

function RevealView({
  room,
  game,
  actions,
}: {
  room: RoomView;
  game: DrawItWrongView;
  actions: DrawItWrongScreenActions;
}) {
  const [store] = useState(() => new DrawingStore());
  const { seconds } = useCountdown(game.stepEndsAt, room.serverTime);
  useEffect(() => () => store.dispose(), [store]);
  useLiveDrawing(store, actions.loadDrawing, { live: false, round: game.round });

  const reveal = game.reveal;
  if (!reveal) return null;
  const byId = new Map(game.participants.map((player) => [player.id, player]));
  const artist = byId.get(reveal.artistId);

  return (
    <div className="flex flex-col gap-6">
      <Card accent="sunny" padding="lg" className="flex flex-col gap-2">
        {reveal.skipped || reveal.word === "" ? (
          <h2 className="font-display text-3xl font-bold">This round was skipped.</h2>
        ) : (
          <>
            <p className="text-sm text-ink-soft">The word was</p>
            <h2 className="font-display text-4xl font-bold">{reveal.word}</h2>
          </>
        )}
        <p className="text-ink-soft" role="timer">
          {game.round < game.totalRounds ? "Next round" : "Final results"} in {seconds ?? "..."}s
        </p>
      </Card>

      <CanvasSurface store={store} label="The finished drawing" />

      <Card padding="md" className="flex flex-col gap-3">
        <h3 className="font-display text-xl font-semibold">Points this round</h3>
        <ul className="flex flex-col gap-3">
          {game.participants.map((player) => (
            <li key={player.id} className="flex items-center gap-3">
              <Avatar avatar={player.avatar} color={player.color} label={player.nickname} size="sm" />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {player.nickname}
                {player.id === reveal.artistId ? " (artist)" : ""}
                {reveal.correctIds.includes(player.id) ? " (guessed it)" : ""}
              </span>
              <Badge tone={(reveal.pointsGained[player.id] ?? 0) > 0 ? "sunny" : "neutral"}>
                +{reveal.pointsGained[player.id] ?? 0}
              </Badge>
            </li>
          ))}
        </ul>
        {artist && reveal.correctIds.length === 0 && !reveal.skipped && (
          <p className="text-ink-soft">Nobody guessed it this time.</p>
        )}
      </Card>

      <ScoreboardCard participants={game.participants} scores={game.scores} selfId={room.selfId} />
    </div>
  );
}

type DrawItWrongScreenProps = { room: RoomView; game: DrawItWrongView; actions: DrawItWrongScreenActions };

/** Picks the right screen for the current step of the round. */
export function DrawItWrongScreen({ room, game, actions }: DrawItWrongScreenProps) {
  const isHost = room.hostId === room.selfId;
  const isArtist = game.artistId === room.selfId;
  const artist = game.participants.find((player) => player.id === game.artistId);
  let content: ReactNode;

  switch (game.step) {
    case "choosing":
      content = (
        <div className="flex flex-col gap-6">
          <ChallengeBanner game={game} />
          {isArtist ? (
            // The key makes the words disappear when the round moves to its next step.
            <DrawSecretCard key={`${game.round}-choosing`} step="choosing" onReveal={actions.revealSecret} onPick={actions.send} />
          ) : (
            <Card padding="lg">
              <p className="font-display text-2xl font-bold">
                {artist?.nickname ?? "The artist"} is choosing a word to draw.
              </p>
            </Card>
          )}
        </div>
      );
      break;
    case "drawing":
      content = (
        <div className="flex flex-col gap-6">
          <ChallengeBanner game={game} />
          {isArtist ? (
            <DrawSecretCard key={`${game.round}-drawing`} step="drawing" onReveal={actions.revealSecret} onPick={actions.send} />
          ) : (
            game.wordShape && <WordShape shape={game.wordShape} />
          )}
          <DrawingArea key={game.round} room={room} game={game} actions={actions} />
          {!isArtist && <GuessBox game={game} selfId={room.selfId} onSend={actions.send} />}
          <GuessFeed game={game} />
        </div>
      );
      break;
    case "reveal":
      content = <RevealView key={game.round} room={room} game={game} actions={actions} />;
      break;
    case "finished":
      content = (
        <DrawResults
          room={room}
          game={game}
          isHost={isHost}
          load={actions.loadDrawing}
          onPlayAgain={actions.playAgain}
          onBackToLobby={actions.backToLobby}
        />
      );
      break;
  }

  return (
    <div className="flex flex-col gap-6">
      {game.step !== "finished" && <StepHeader room={room} game={game} />}
      {content}
    </div>
  );
}
