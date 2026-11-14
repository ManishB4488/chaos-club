import { Flame, Lightbulb, Pencil, Search, Users, type LucideIcon } from "lucide-react";
import type { GameInfo } from "@/lib/games";
import type { AccentColor } from "@/lib/theme";

export const GAME_ICONS: Record<GameInfo["id"], LucideIcon> = {
  "most-likely-to": Users,
  impostor: Search,
  roast: Flame,
  "fake-answer": Lightbulb,
  "draw-it-wrong": Pencil,
};

export const ACCENT_BG: Record<AccentColor, string> = {
  grape: "bg-grape",
  volt: "bg-volt",
  tangerine: "bg-tangerine",
  bubblegum: "bg-bubblegum",
  sunny: "bg-sunny",
};
