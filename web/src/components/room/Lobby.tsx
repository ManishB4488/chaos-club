"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Copy, Link as LinkIcon, LogOut, Share2, UserX } from "lucide-react";
import type {
  DrawItWrongAction,
  FakeAnswerAction,
  GameId,
  ImpostorAction,
  RoastAction,
  RoomView,
} from "@chaos/shared";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { copyText } from "@/lib/clipboard";
import type { DrawSecretResult, DrawingResult, ImpostorSecretResult } from "@/lib/roomClient";
import { SITE_NAME } from "@/lib/site";
import { DrawItWrongScreen } from "@/components/games/drawItWrong/DrawItWrongScreen";
import { FakeAnswerScreen } from "@/components/games/fakeAnswer/FakeAnswerScreen";
import { ImpostorScreen } from "@/components/games/impostor/ImpostorScreen";
import { MostLikelyToScreen } from "@/components/games/mostLikelyTo/MostLikelyToScreen";
import { RoastScreen } from "@/components/games/roast/RoastScreen";
import { GameSection } from "./GameSection";

export type LobbyActions = {
  leave: () => Promise<void>;
  selectGame: (gameId: GameId) => Promise<string | null>;
  start: () => Promise<string | null>;
  kick: (playerId: string) => Promise<string | null>;
  vote: (targetId: string) => Promise<string | null>;
  playAgain: () => Promise<string | null>;
  backToLobby: () => Promise<string | null>;
  impostor: (action: ImpostorAction) => Promise<string | null>;
  roast: (action: RoastAction) => Promise<string | null>;
  impostorSecret: () => Promise<ImpostorSecretResult>;
  fakeAnswer: (action: FakeAnswerAction) => Promise<string | null>;
  drawSend: (action: DrawItWrongAction) => Promise<string | null>;
  drawMove: (action: DrawItWrongAction) => Promise<string | null>;
  drawSecret: () => Promise<DrawSecretResult>;
  drawLoad: (round?: number) => Promise<DrawingResult>;
};

type LobbyProps = {
  room: RoomView;
  /** False while the connection is down and the page is trying to reconnect. */
  online: boolean;
  actions: LobbyActions;
};

const noopSubscribe = () => () => undefined;

export function Lobby({ room, online, actions }: LobbyProps) {
  // Browser-only values, read without touching the server render.
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  const [notice, setNotice] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [kickError, setKickError] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const isHost = room.hostId === room.selfId;
  const inviteUrl = `${origin}/room/${room.code}`;
  const shareText = `Join my ${SITE_NAME} room! Code: ${room.code}`;

  function flash(message: string) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2_500);
  }

  async function copy(text: string, success: string) {
    const copied = await copyText(text);
    flash(copied ? success : "Could not copy. Select it and copy it by hand.");
  }

  async function share() {
    if (canShare) {
      try {
        await navigator.share({ title: SITE_NAME, text: shareText, url: inviteUrl });
      } catch {
        /* the person closed the share sheet */
      }
      return;
    }
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${shareText} ${inviteUrl}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function leave() {
    setLeaving(true);
    await actions.leave();
  }

  async function kick(playerId: string) {
    setKickError(null);
    const message = await actions.kick(playerId);
    if (message) setKickError(message);
  }

  const canKick = isHost && room.phase === "lobby";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-10">
      {!online && (
        <div
          role="status"
          className="rounded-card border border-tangerine/50 bg-tangerine/15 p-4 font-semibold"
        >
          Connection lost. Reconnecting...
        </div>
      )}

      {room.game ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-ink-soft">
              Room <span className="font-display font-bold tracking-widest text-ink">{room.code}</span>
            </span>
            <Badge tone="volt">
              {room.players.filter((player) => player.connected).length} online
            </Badge>
          </div>
          {room.game.gameId === "most-likely-to" ? (
            <MostLikelyToScreen
              room={room}
              game={room.game}
              actions={{
                vote: actions.vote,
                playAgain: actions.playAgain,
                backToLobby: actions.backToLobby,
              }}
            />
          ) : room.game.gameId === "impostor" ? (
            <ImpostorScreen
              room={room}
              game={room.game}
              actions={{
                send: actions.impostor,
                revealSecret: actions.impostorSecret,
                playAgain: actions.playAgain,
                backToLobby: actions.backToLobby,
              }}
            />
          ) : room.game.gameId === "roast" ? (
            <RoastScreen
              room={room}
              game={room.game}
              actions={{
                send: actions.roast,
                playAgain: actions.playAgain,
                backToLobby: actions.backToLobby,
              }}
            />
          ) : room.game.gameId === "fake-answer" ? (
            <FakeAnswerScreen
              room={room}
              game={room.game}
              actions={{
                send: actions.fakeAnswer,
                playAgain: actions.playAgain,
                backToLobby: actions.backToLobby,
              }}
            />
          ) : (
            <DrawItWrongScreen
              room={room}
              game={room.game}
              actions={{
                send: actions.drawSend,
                move: actions.drawMove,
                revealSecret: actions.drawSecret,
                loadDrawing: actions.drawLoad,
                playAgain: actions.playAgain,
                backToLobby: actions.backToLobby,
              }}
            />
          )}
        </>
      ) : (
        <>
      <Card accent="grape" padding="lg" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-ink-soft">Room code</p>
            <p className="font-display text-5xl font-bold tracking-widest">{room.code}</p>
          </div>
          <Badge tone="volt">
            {room.players.length} of {room.maxPlayers} players
          </Badge>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button size="sm" variant="secondary" onClick={() => copy(room.code, "Room code copied")}>
            <Copy aria-hidden className="size-4" />
            Copy code
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!origin}
            onClick={() => copy(inviteUrl, "Invite link copied")}
          >
            <LinkIcon aria-hidden className="size-4" />
            Copy invite link
          </Button>
          <Button size="sm" disabled={!origin} onClick={share}>
            <Share2 aria-hidden className="size-4" />
            Share
          </Button>
        </div>
        <p role="status" className="min-h-6 font-semibold text-sunny">
          {notice}
        </p>
      </Card>

      <Card padding="lg" className="flex flex-col gap-5">
        <h2 className="font-display text-2xl font-semibold">Players</h2>
        <ul className="flex flex-col gap-4">
          {room.players.map((player) => (
            <li key={player.id} className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Avatar
                avatar={player.avatar}
                color={player.color}
                label={player.nickname}
                size="lg"
                isHost={player.isHost}
                status={player.connected ? "connected" : "disconnected"}
              />
              <span className="min-w-0 flex-1 basis-32 truncate font-display text-xl font-semibold">
                {player.nickname}
              </span>
              <span className="flex flex-wrap justify-end gap-2">
                {player.isHost && <Badge tone="sunny">Host</Badge>}
                {player.id === room.selfId && <Badge tone="volt">You</Badge>}
                {!player.connected && <Badge>Offline</Badge>}
              </span>
              {canKick && player.id !== room.selfId && (
                <Button
                  size="sm"
                  variant="danger"
                  aria-label={`Remove ${player.nickname}`}
                  onClick={() => kick(player.id)}
                >
                  <UserX aria-hidden className="size-4" />
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
        {room.players.length < 2 && room.phase === "lobby" && (
          <p className="text-ink-soft">Waiting for friends to join. Share the code or the link.</p>
        )}
        {kickError && (
          <p role="alert" className="font-semibold text-bubblegum">
            {kickError}
          </p>
        )}
      </Card>

      <GameSection
        room={room}
        isHost={isHost}
        online={online}
        onSelect={actions.selectGame}
        onStart={actions.start}
      />

        </>
      )}

      <div>
        <Button variant="danger" loading={leaving} onClick={leave}>
          <LogOut aria-hidden className="size-5" />
          Leave room
        </Button>
      </div>
    </main>
  );
}
