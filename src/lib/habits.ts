export const HABIT_COLORS = [
  { key: 'terracotta', label: 'Terracotta', hsl: 'var(--accent)' },
  { key: 'olive',      label: 'Olive',      hsl: 'var(--olive)' },
  { key: 'sand',       label: 'Sand',       hsl: 'var(--sand)' },
  { key: 'clay',       label: 'Clay',       hsl: 'var(--clay)' },
  { key: 'sage',       label: 'Sage',       hsl: 'var(--sage)' },
  { key: 'plum',       label: 'Plum',       hsl: 'var(--plum)' },
  { key: 'indigo',     label: 'Indigo',     hsl: 'var(--indigo)' },
] as const;

export type HabitColorKey = typeof HABIT_COLORS[number]['key'];

export function colorVar(key: string): string {
  const found = HABIT_COLORS.find(c => c.key === key);
  return `hsl(${found?.hsl ?? 'var(--accent)'})`;
}

export const HABIT_ICONS = [
  'sparkles', 'dumbbell', 'book-open', 'brain', 'droplet', 'moon',
  'sun', 'heart', 'leaf', 'pen-line', 'music', 'footprints',
  'bike', 'apple', 'coffee', 'flame',
] as const;

export type HabitIcon = typeof HABIT_ICONS[number];

export function todayISO(): string {
  return toISO(new Date());
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(a: Date, b: Date): number {
  const ms = 1000 * 60 * 60 * 24;
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((db - da) / ms);
}

/** Compute current and longest streak from an array of ISO date strings (any order). */
export function computeStreaks(dates: string[]): { current: number; longest: number } {
  if (!dates.length) return { current: 0, longest: 0 };
  const set = new Set(dates);
  const sorted = [...set].sort();
  // longest
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = fromISO(sorted[i - 1]);
    const cur = fromISO(sorted[i]);
    if (daysBetween(prev, cur) === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  // current: count back from today (or yesterday if today not present)
  const today = new Date();
  let cursor = set.has(toISO(today)) ? today : new Date(today.getTime() - 86400000);
  let current = 0;
  while (set.has(toISO(cursor))) {
    current += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return { current, longest };
}
