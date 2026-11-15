/** A bar that shrinks as time runs out. Purely visual; the number next to it is the readable version. */
export function TimerBar({
  remainingMs,
  totalMs,
}: {
  remainingMs: number | null;
  totalMs: number | null;
}) {
  const fraction = remainingMs === null || !totalMs ? 0 : Math.min(1, remainingMs / totalMs);
  return (
    <div aria-hidden className="h-3 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-linear-to-r from-bubblegum to-sunny transition-[width] duration-200 ease-linear"
        style={{ width: `${fraction * 100}%` }}
      />
    </div>
  );
}
