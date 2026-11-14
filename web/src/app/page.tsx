import { Sparkles } from "lucide-react";
import { AnimatedWordmark } from "@/components/ui/AnimatedWordmark";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

const ACCENT_DOTS = [
  { className: "bg-grape", delay: "0s" },
  { className: "bg-volt", delay: "0.4s" },
  { className: "bg-tangerine", delay: "0.8s" },
  { className: "bg-bubblegum", delay: "1.2s" },
  { className: "bg-sunny", delay: "1.6s" },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <span className="inline-flex items-center gap-2 rounded-pill border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-ink-soft">
        <Sparkles aria-hidden className="size-4 text-sunny" />
        Homepage build in progress
      </span>

      <AnimatedWordmark name={SITE_NAME} />

      <p className="max-w-md text-lg text-ink-soft sm:text-xl">{SITE_TAGLINE}</p>

      <ul aria-hidden className="flex gap-3">
        {ACCENT_DOTS.map((dot) => (
          <li
            key={dot.className}
            className={`size-4 animate-float rounded-full ${dot.className}`}
            style={{ animationDelay: dot.delay }}
          />
        ))}
      </ul>
    </main>
  );
}
