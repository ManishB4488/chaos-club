"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Share2, Copy, Link as LinkIcon, LogOut } from "lucide-react";
import type { RoomView } from "@chaos/shared";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { copyText } from "@/lib/clipboard";
import { SITE_NAME } from "@/lib/site";

type LobbyProps = {
  room: RoomView;
  /** False while the connection is down and the page is trying to reconnect. */
  online: boolean;
  onLeave: () => Promise<void>;
};

const noopSubscribe = () => () => undefined;

export function Lobby({ room, online, onLeave }: LobbyProps) {
  // Browser-only values, read without touching the server render.
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  const [notice, setNotice] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

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
    await onLeave();
  }

  const waitingMessage =
    room.players.length < 2
      ? "Waiting for friends to join. Share the code or the link."
      : "Waiting for the host to pick a game.";

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
            <li key={player.id} className="flex items-center gap-4">
              <Avatar
                avatar={player.avatar}
                color={player.color}
                label={player.nickname}
                size="lg"
                isHost={player.isHost}
                status={player.connected ? "connected" : "disconnected"}
              />
              <span className="min-w-0 flex-1 truncate font-display text-xl font-semibold">
                {player.nickname}
              </span>
              <span className="flex flex-wrap justify-end gap-2">
                {player.isHost && <Badge tone="sunny">Host</Badge>}
                {player.id === room.selfId && <Badge tone="volt">You</Badge>}
                {!player.connected && <Badge>Offline</Badge>}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-ink-soft">{waitingMessage}</p>
      </Card>

      <div>
        <Button variant="danger" loading={leaving} onClick={leave}>
          <LogOut aria-hidden className="size-5" />
          Leave room
        </Button>
      </div>
    </main>
  );
}
