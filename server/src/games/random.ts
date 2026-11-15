/** A shuffled copy. Uses the given random function so tests can be repeatable. */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a === undefined || b === undefined) continue;
    copy[i] = b;
    copy[j] = a;
  }
  return copy;
}

/** Picks items so the categories take turns, giving variety without repeating anything. */
export function pickRoundRobin<T extends { category: string }>(
  items: readonly T[],
  count: number,
  random: () => number,
): T[] {
  const byCategory = new Map<string, T[]>();
  for (const item of items) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }
  const order = shuffle([...byCategory.keys()], random);
  const pools = new Map<string, T[]>();
  for (const category of order) pools.set(category, shuffle(byCategory.get(category) ?? [], random));

  const picked: T[] = [];
  let cursor = 0;
  let emptyStreak = 0;
  while (picked.length < count && emptyStreak < order.length) {
    const category = order[cursor % order.length];
    cursor++;
    const next = category === undefined ? undefined : pools.get(category)?.pop();
    if (next) {
      picked.push(next);
      emptyStreak = 0;
    } else {
      emptyStreak++;
    }
  }
  return picked;
}
