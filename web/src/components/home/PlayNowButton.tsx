"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CLIENT_EVENTS, type JoinedPayload } from "@chaos/shared";
import { ProfileForm } from "@/components/room/ProfileForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { request } from "@/lib/socket";
import { saveProfile, saveSession, type ProfileValues } from "@/lib/session";

/** Opens the Create a Room window. The host picks the game inside the room. */
export function PlayNowButton({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleCreate(profile: ProfileValues): Promise<string | null> {
    saveProfile(profile);
    const ack = await request<JoinedPayload>(CLIENT_EVENTS.createRoom, profile);
    if (!ack.ok) return ack.message;
    saveSession(ack.code, { playerId: ack.playerId, sessionToken: ack.sessionToken });
    setOpen(false);
    router.push(`/room/${ack.code}`);
    return null;
  }

  return (
    <>
      <Button fullWidth className={className} onClick={() => setOpen(true)}>
        Play now
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Create a room">
        <ProfileForm mode="create" submitLabel="Create room" onSubmit={handleCreate} />
      </Modal>
    </>
  );
}
