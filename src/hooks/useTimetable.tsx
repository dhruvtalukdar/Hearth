import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type TimeBlock = {
  id: string;
  user_id: string;
  title: string;
  type: "fixed" | "variable";
  block_date: string | null;
  day_of_week: number | null;
  start_time: string; // "HH:MM:SS"
  end_time: string;
  category: string;
  habit_id: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type NewTimeBlock = Omit<TimeBlock, "id" | "user_id" | "created_at" | "updated_at" | "is_completed"> & {
  is_completed?: boolean;
};

export const TIME_CATEGORIES = [
  { key: "work", label: "Work", color: "var(--indigo)" },
  { key: "health", label: "Health", color: "var(--sage)" },
  { key: "study", label: "Study", color: "var(--plum)" },
  { key: "personal", label: "Personal", color: "var(--accent)" },
  { key: "rest", label: "Rest", color: "var(--olive)" },
  { key: "social", label: "Social", color: "var(--sand)" },
] as const;

export function categoryColor(key: string) {
  const c = TIME_CATEGORIES.find(c => c.key === key);
  return `hsl(${c?.color ?? "var(--accent)"})`;
}

export function useTimetable() {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("time_blocks")
      .select("*")
      .order("start_time");
    setBlocks((data ?? []) as TimeBlock[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const createBlock = async (input: NewTimeBlock) => {
    if (!user) return { data: null, error: new Error("not signed in") };
    const { data, error } = await supabase
      .from("time_blocks")
      .insert({ ...input, user_id: user.id })
      .select()
      .single();
    if (!error && data) setBlocks(prev => [...prev, data as TimeBlock]);
    return { data, error };
  };

  const updateBlock = async (id: string, patch: Partial<TimeBlock>) => {
    // optimistic
    setBlocks(prev => prev.map(b => (b.id === id ? { ...b, ...patch } as TimeBlock : b)));
    const { data, error } = await supabase
      .from("time_blocks")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) refresh();
    else if (data) setBlocks(prev => prev.map(b => (b.id === id ? (data as TimeBlock) : b)));
    return { data, error };
  };

  const deleteBlock = async (id: string) => {
    const { error } = await supabase.from("time_blocks").delete().eq("id", id);
    if (!error) setBlocks(prev => prev.filter(b => b.id !== id));
    return { error };
  };

  return { blocks, loading, refresh, createBlock, updateBlock, deleteBlock };
}

/** "HH:MM:SS" -> minutes since midnight */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
/** minutes -> "HH:MM:SS" */
export function minutesToTime(min: number): string {
  const m = Math.max(0, Math.min(24 * 60, Math.round(min)));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}
export function formatTimeLabel(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const am = h < 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

/** Returns blocks visible on a given date (variable-on-date OR fixed-on-dow) */
export function blocksForDate(blocks: TimeBlock[], date: Date): TimeBlock[] {
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const dow = date.getDay();
  return blocks.filter(b =>
    (b.type === "variable" && b.block_date === iso) ||
    (b.type === "fixed" && b.day_of_week === dow)
  );
}

/** Given blocks for a single day, returns ids that overlap with at least one other */
export function findConflicts(dayBlocks: TimeBlock[]): Set<string> {
  const conflicts = new Set<string>();
  for (let i = 0; i < dayBlocks.length; i++) {
    for (let j = i + 1; j < dayBlocks.length; j++) {
      const a = dayBlocks[i], b = dayBlocks[j];
      const aS = timeToMinutes(a.start_time), aE = timeToMinutes(a.end_time);
      const bS = timeToMinutes(b.start_time), bE = timeToMinutes(b.end_time);
      if (aS < bE && bS < aE) {
        conflicts.add(a.id); conflicts.add(b.id);
      }
    }
  }
  return conflicts;
}
