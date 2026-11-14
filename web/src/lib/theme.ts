/** The five arcade accent colors (defined in globals.css). */
export const ACCENT_COLORS = ["grape", "volt", "tangerine", "bubblegum", "sunny"] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];
