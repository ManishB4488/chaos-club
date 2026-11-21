import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GAMES, playersLabel } from "@/lib/games";
import { cn } from "@/lib/cn";
import { ACCENT_BG, GAME_ICONS } from "./game-visuals";
import { PlayNowButton } from "./PlayNowButton";

export function GameCards() {
  const readyCount = GAMES.filter((game) => game.available).length;
  return (
    <section id="games" className="mx-auto w-full max-w-6xl scroll-mt-6 px-5 py-12">
      <h2 className="font-display text-4xl font-bold sm:text-5xl">Choose Your Chaos</h2>
      <p className="mt-3 max-w-xl text-lg text-ink-soft">
        Five games for two to four friends. {readyCount} {readyCount === 1 ? "is" : "are"} ready to play now,
        and the rest arrive one at a time.
      </p>

      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((game) => {
          const Icon = GAME_ICONS[game.id];
          return (
            <li key={game.id} className="flex">
              <Card accent={game.accent} className="flex w-full flex-col gap-4">
                <span
                  className={cn(
                    "flex size-14 items-center justify-center rounded-2xl",
                    ACCENT_BG[game.accent],
                  )}
                >
                  <Icon aria-hidden className="size-8 text-night-950" />
                </span>
                <h3 className="font-display text-2xl font-semibold">{game.name}</h3>
                <p className="text-ink-soft">{game.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge>{playersLabel(game)}</Badge>
                  <Badge>{game.duration}</Badge>
                  <Badge tone={game.available ? "sunny" : "neutral"}>
                    {game.available ? "Ready to play" : "Coming soon"}
                  </Badge>
                </div>
                {game.available ? (
                  <PlayNowButton className="mt-auto" />
                ) : (
                  <Button variant="secondary" fullWidth disabled className="mt-auto">
                    Coming soon
                  </Button>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
