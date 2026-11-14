import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { roomCodeSchema } from "@chaos/shared";
import { RoomLoading } from "@/components/room/RoomLoading";
import { RoomScreen } from "@/components/room/RoomScreen";

export const metadata: Metadata = {
  title: "Room",
  // Rooms are private, so search engines should not list them.
  robots: { index: false, follow: false },
};

// The room code is only known when someone visits, so it is read inside Suspense.
async function RoomLoader({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const parsed = roomCodeSchema.safeParse(code);
  if (!parsed.success) notFound();
  return <RoomScreen code={parsed.data} />;
}

export default function RoomPage({ params }: PageProps<"/room/[code]">) {
  return (
    <Suspense fallback={<RoomLoading />}>
      <RoomLoader params={params} />
    </Suspense>
  );
}
