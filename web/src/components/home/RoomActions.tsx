"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CLIENT_EVENTS, type JoinedPayload } from "@chaos/shared";
import { ProfileForm } from "@/components/room/ProfileForm";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { request } from "@/lib/socket";
import { saveProfile, saveSession, type ProfileValues } from "@/lib/session";

type Dialog = "create" | "join" | null;

/** The three hero buttons, and the Create and Join windows behind them. */
export function RoomActions() {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);

  async function enterRoom(event: string, payload: object): Promise<string | null> {
    const ack = await request<JoinedPayload>(event, payload);
    if (!ack.ok) return ack.message;
    saveSession(ack.code, { playerId: ack.playerId, sessionToken: ack.sessionToken });
    setDialog(null);
    router.push(`/room/${ack.code}`);
    return null;
  }

  async function handleCreate(profile: ProfileValues): Promise<string | null> {
    saveProfile(profile);
    return enterRoom(CLIENT_EVENTS.createRoom, profile);
  }

  async function handleJoin(profile: ProfileValues, code: string): Promise<string | null> {
    saveProfile(profile);
    return enterRoom(CLIENT_EVENTS.joinRoom, { ...profile, code });
  }

  return (
    <>
      <div className="flex flex-wrap gap-4">
        <Button size="lg" onClick={() => setDialog("create")}>
          Create a Room
        </Button>
        <Button size="lg" variant="secondary" onClick={() => setDialog("join")}>
          Join a Room
        </Button>
        <ButtonLink href="#games" size="lg" variant="ghost">
          Explore Games
        </ButtonLink>
      </div>

      <Modal open={dialog === "create"} onClose={() => setDialog(null)} title="Create a room">
        <ProfileForm mode="create" submitLabel="Create room" onSubmit={handleCreate} />
      </Modal>
      <Modal open={dialog === "join"} onClose={() => setDialog(null)} title="Join a room">
        <ProfileForm mode="join" submitLabel="Join room" onSubmit={handleJoin} />
      </Modal>
    </>
  );
}
