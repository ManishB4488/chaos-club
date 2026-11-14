import { ChevronDown } from "lucide-react";
import { GAMES } from "@/lib/games";

export function HowToPlay() {
  return (
    <section id="how-to-play" className="mx-auto w-full max-w-6xl scroll-mt-6 px-5 py-12">
      <h2 className="font-display text-4xl font-bold sm:text-5xl">How to play</h2>
      <p className="mt-3 max-w-3xl text-lg text-ink-soft">Tap a game to read its rules. Scoring is added when each game launches.</p>

      <div className="mt-8 flex max-w-3xl flex-col gap-3">
        {GAMES.map((game) => (
          <details
            key={game.id}
            className="group rounded-card border border-white/10 bg-night-900/80 p-5"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-display text-xl font-semibold">
              {game.name}
              <ChevronDown
                aria-hidden
                className="size-6 shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <ol className="mt-3 list-decimal space-y-2 pl-6 text-ink-soft">
              {game.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </section>
  );
}
