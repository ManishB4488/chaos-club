"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { roomClient } from "@/lib/roomClient";
import { Lobby } from "./Lobby";
import { ProfileForm } from "./ProfileForm";
import { RoomLoading } from "./RoomLoading";

function MessageCard({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-10">
      <Card padding="lg" className="flex flex-col items-start gap-4">
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="text-lg text-ink-soft">{message}</p>
        <ButtonLink href="/">Back to home</ButtonLink>
      </Card>
    </main>
  );
}

/** The whole room page: connecting, joining from an invite link, the lobby, and the problem screens. */
export function RoomScreen({ code }: { code: string }) {
  const router = useRouter();
  const state = useSyncExternalStore(
    roomClient.subscribe,
    roomClient.getSnapshot,
    roomClient.getServerSnapshot,
  );

  useEffect(() => {
    roomClient.openRoom(code);
    return () => roomClient.closeRoom();
  }, [code]);

  async function leave() {
    await roomClient.leaveActiveRoom();
    router.push("/");
  }

  switch (state.status) {
    case "connecting":
      return <RoomLoading message={`Connecting to room ${code}`} />;

    case "needs-join":
      return (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-10">
          <Card accent="grape" padding="lg" className="flex flex-col gap-5">
            <div>
              <p className="text-ink-soft">You are invited to room</p>
              <h1 className="font-display text-4xl font-bold tracking-widest">{code}</h1>
            </div>
            <ProfileForm
              mode="join"
              fixedCode={code}
              submitLabel="Join room"
              onSubmit={(profile) => roomClient.joinActiveRoom(profile)}
            />
            <Button variant="ghost" onClick={() => router.push("/")}>
              Back to home
            </Button>
          </Card>
        </main>
      );

    case "in-room":
      return (
        <Lobby
          room={state.room}
          online={state.online}
          actions={{
            leave,
            selectGame: roomClient.selectGame,
            start: roomClient.startGame,
            kick: roomClient.kickPlayer,
            vote: roomClient.voteInMostLikelyTo,
            impostor: roomClient.impostorAction,
            backToLobby: roomClient.returnToLobby,
            // Play again: back to the lobby, then straight into the same game.
            playAgain: async () => {
              const message = await roomClient.returnToLobby();
              return message ?? roomClient.startGame();
            },
          }}
        />
      );

    case "kicked":
      return (
        <MessageCard
          title="You were removed"
          message="The host removed you from the room. You can join another room or make your own."
        />
      );

    case "error":
      return <MessageCard title="Something went wrong" message={state.message} />;
  }
}
