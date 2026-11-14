import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function RoomLoading({ message = "Connecting to your room" }: { message?: string }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-10">
      <Card className="flex items-center gap-4" role="status">
        <Loader2 aria-hidden className="size-6 shrink-0 animate-spin text-sunny" />
        <p className="font-display text-xl font-semibold">{message}</p>
      </Card>
    </main>
  );
}
