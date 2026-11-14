import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import type { AccentColor } from "@/lib/theme";

const TONES: Record<AccentColor | "neutral", string> = {
  neutral: "border-white/15 bg-white/5",
  grape: "border-grape/50 bg-grape/25",
  volt: "border-volt/50 bg-volt/25",
  tangerine: "border-tangerine/50 bg-tangerine/25",
  bubblegum: "border-bubblegum/50 bg-bubblegum/25",
  sunny: "border-sunny/50 bg-sunny/25",
};

type BadgeProps = ComponentProps<"span"> & { tone?: AccentColor | "neutral" };

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-bold tracking-wide text-ink uppercase",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
