import type { MltView } from "@chaos/shared";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";

/** Everyone's total points, highest first. */
export function Scoreboard({ game, selfId }: { game: MltView; selfId: string }) {
  const rows = [...game.participants].sort(
    (a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0),
  );
  return (
    <Card padding="md" className="flex flex-col gap-3">
      <h3 className="font-display text-xl font-semibold">Scoreboard</h3>
      <ul className="flex flex-col gap-3">
        {rows.map((player) => (
          <li key={player.id} className="flex items-center gap-3">
            <Avatar avatar={player.avatar} color={player.color} label={player.nickname} size="sm" />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {player.nickname}
              {player.id === selfId ? " (you)" : ""}
            </span>
            <span className="font-display text-xl font-bold">{game.scores[player.id] ?? 0}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
