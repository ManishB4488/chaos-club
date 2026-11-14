import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import type { AccentColor } from "@/lib/theme";

// Full class names are written out so Tailwind can find them.
const ACCENTS: Record<AccentColor, string> = {
  grape: "border-grape/50 shadow-[0_0_40px_-10px_rgb(139_92_246/0.55)]",
  volt: "border-volt/50 shadow-[0_0_40px_-10px_rgb(59_130_255/0.55)]",
  tangerine: "border-tangerine/50 shadow-[0_0_40px_-10px_rgb(255_138_61/0.55)]",
  bubblegum: "border-bubblegum/50 shadow-[0_0_40px_-10px_rgb(255_79_163/0.55)]",
  sunny: "border-sunny/50 shadow-[0_0_40px_-10px_rgb(255_210_63/0.55)]",
};

const PADDING = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
} as const;

type CardProps = ComponentProps<"div"> & {
  accent?: AccentColor;
  padding?: keyof typeof PADDING;
};

export function Card({ accent, padding = "md", className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border bg-night-900/80",
        accent ? ACCENTS[accent] : "border-white/10",
        PADDING[padding],
        className,
      )}
      {...props}
    />
  );
}
