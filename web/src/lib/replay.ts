import type { DrawStroke } from "@chaos/shared";

/** The first part of a drawing, for the replay. `fraction` runs from 0 (nothing) to 1 (everything). */
export function partialStrokes(strokes: readonly DrawStroke[], fraction: number): DrawStroke[] {
  const units = strokes.map((stroke) => (stroke.kind === "path" ? stroke.points.length : 12));
  const total = units.reduce((sum, unit) => sum + unit, 0);
  let budget = Math.max(0, Math.min(1, fraction)) * total;

  const shown: DrawStroke[] = [];
  strokes.forEach((stroke, index) => {
    if (budget <= 0) return;
    const unit = units[index] ?? 1;
    if (stroke.kind === "path") {
      const take = Math.min(stroke.points.length, Math.max(1, Math.ceil(budget)));
      shown.push({ ...stroke, points: stroke.points.slice(0, take) });
    } else {
      shown.push({ ...stroke, r: Math.max(1, Math.round(stroke.r * Math.min(1, budget / unit))) });
    }
    budget -= unit;
  });
  return shown;
}
