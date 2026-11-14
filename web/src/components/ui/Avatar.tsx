import {
  Bird,
  Bot,
  Cat,
  Crown,
  Dog,
  Fish,
  Ghost,
  Pizza,
  Rabbit,
  Rocket,
  Skull,
  type LucideIcon,
} from "lucide-react";
import type { AvatarId, PlayerColor } from "@/lib/avatars";
import { cn } from "@/lib/cn";

const ICONS: Record<AvatarId, LucideIcon> = {
  ghost: Ghost,
  cat: Cat,
  dog: Dog,
  bot: Bot,
  rocket: Rocket,
  pizza: Pizza,
  bird: Bird,
  fish: Fish,
  rabbit: Rabbit,
  skull: Skull,
};

const COLORS: Record<PlayerColor, string> = {
  grape: "bg-grape",
  volt: "bg-volt",
  tangerine: "bg-tangerine",
  bubblegum: "bg-bubblegum",
  sunny: "bg-sunny",
};

const SIZES = {
  sm: { box: "size-9", icon: "size-5" },
  md: { box: "size-12", icon: "size-6" },
  lg: { box: "size-16", icon: "size-8" },
  xl: { box: "size-24", icon: "size-12" },
} as const;

type AvatarProps = {
  avatar: AvatarId;
  color: PlayerColor;
  /** The player's nickname, used for screen readers. */
  label: string;
  size?: keyof typeof SIZES;
  isHost?: boolean;
  status?: "connected" | "disconnected";
  className?: string;
};

export function Avatar({
  avatar,
  color,
  label,
  size = "md",
  isHost = false,
  status,
  className,
}: AvatarProps) {
  const Icon = ICONS[avatar];
  const description = [label, isHost && "host", status].filter(Boolean).join(", ");

  return (
    <span
      role="img"
      aria-label={description}
      className={cn("relative inline-flex shrink-0", status === "disconnected" && "opacity-60", className)}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full ring-4 ring-night-900",
          SIZES[size].box,
          COLORS[color],
        )}
      >
        <Icon aria-hidden className={cn("text-night-950", SIZES[size].icon)} />
      </span>
      {isHost && (
        <span className="absolute -top-1 -right-1 rounded-full bg-night-950 p-1">
          <Crown aria-hidden className="size-3 text-sunny" />
        </span>
      )}
      {status && (
        <span
          className={cn(
            "absolute right-0 bottom-0 size-3.5 rounded-full border-2 border-night-900",
            status === "connected" ? "bg-emerald-400" : "bg-zinc-500",
          )}
        />
      )}
    </span>
  );
}
