import { useEffect, useState } from "react";

/**
 * Time left until a moment on the SERVER clock. The browser clock can be wrong, so the difference
 * between the two clocks is measured once and corrected for.
 */
export function useCountdown(
  endsAt: number | null,
  serverTime: number,
): { seconds: number | null; remainingMs: number | null } {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    if (endsAt === null) return;
    const offset = serverTime - Date.now();
    const tick = () => {
      setRemainingMs(Math.max(0, endsAt - (Date.now() + offset)));
    };
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, 200);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [endsAt, serverTime]);

  if (endsAt === null || remainingMs === null) return { seconds: null, remainingMs: null };
  return { seconds: Math.ceil(remainingMs / 1_000), remainingMs };
}
