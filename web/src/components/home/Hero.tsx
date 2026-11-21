import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { AvatarId, PlayerColor } from "@/lib/avatars";
import { HeroHeading } from "./HeroHeading";
import { RoomActions } from "./RoomActions";

const EXAMPLE_PLAYERS: { name: string; avatar: AvatarId; color: PlayerColor; host?: boolean }[] = [
  { name: "Priya", avatar: "rocket", color: "volt", host: true },
  { name: "Sam", avatar: "ghost", color: "grape" },
  { name: "Alex", avatar: "pizza", color: "tangerine" },
  { name: "Jo", avatar: "cat", color: "bubblegum" },
];

export function Hero() {
  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-[1.2fr_1fr] lg:py-24">
      <div className="flex flex-col gap-6">
        <HeroHeading />
        <p className="max-w-xl text-lg text-ink-soft sm:text-xl">
          Gather your friends, join a room and find out who is the funniest, smartest and biggest
          liar.
        </p>
        <RoomActions />
        <p className="text-sm text-ink-soft">No sign-up needed. Create a room, send the link, and pick a game together.</p>
      </div>

      <Card accent="grape" padding="lg" aria-label="Example room, for illustration only">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-ink-soft">Example room</p>
            <p className="font-display text-3xl font-bold tracking-widest">KX7M2Q</p>
          </div>
          <Badge tone="volt">4 of 4 players</Badge>
        </div>
        <ul className="mt-6 grid grid-cols-2 gap-4">
          {EXAMPLE_PLAYERS.map((player) => (
            <li key={player.name} className="flex items-center gap-3">
              <Avatar
                avatar={player.avatar}
                color={player.color}
                label={player.name}
                isHost={player.host}
                status="connected"
              />
              <span className="font-semibold">{player.name}</span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
