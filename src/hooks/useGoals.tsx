import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type GoalCategory = "daily" | "weekly" | "monthly" | "quarterly";

export type Goal = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: GoalCategory;
  target_value: number;
  current_progress: number;
  start_date: string;
  end_date: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type GoalHabit = {
  goal_id: string;
  habit_id: string;
  user_id: string;
};

export const GOAL_CATEGORIES: { key: GoalCategory; label: string }[] = [
  { key: "daily",     label: "Daily" },
  { key: "weekly",    label: "Weekly" },
  { key: "monthly",   label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
];

export function useGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalHabits, setGoalHabits] = useState<GoalHabit[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: g }, { data: gh }] = await Promise.all([
      supabase.from("goals").select("*").order("created_at", { ascending: false }),
      supabase.from("goal_habits").select("*"),
    ]);
    setGoals((g ?? []) as Goal[]);
    setGoalHabits((gh ?? []) as GoalHabit[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const createGoal = async (
    input: Omit<Goal, "id" | "user_id" | "created_at" | "updated_at" | "current_progress" | "is_completed"> & { current_progress?: number },
    linkedHabitIds: string[] = []
  ) => {
    if (!user) return { data: null, error: new Error("not signed in") };
    const { data, error } = await supabase
      .from("goals")
      .insert({ ...input, user_id: user.id })
      .select()
      .single();
    if (error || !data) return { data, error };
    setGoals(prev => [data as Goal, ...prev]);
    if (linkedHabitIds.length) {
      const rows = linkedHabitIds.map(habit_id => ({ goal_id: data.id, habit_id, user_id: user.id }));
      const { data: gh } = await supabase.from("goal_habits").insert(rows).select();
      if (gh) setGoalHabits(prev => [...prev, ...(gh as GoalHabit[])]);
    }
    return { data, error: null };
  };

  const updateGoal = async (id: string, patch: Partial<Goal>) => {
    const { data, error } = await supabase.from("goals").update(patch).eq("id", id).select().single();
    if (!error && data) setGoals(prev => prev.map(g => (g.id === id ? (data as Goal) : g)));
    return { data, error };
  };

  const deleteGoal = async (id: string) => {
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (!error) {
      setGoals(prev => prev.filter(g => g.id !== id));
      setGoalHabits(prev => prev.filter(gh => gh.goal_id !== id));
    }
    return { error };
  };

  const setGoalHabitLinks = async (goal_id: string, habitIds: string[]) => {
    if (!user) return;
    const existing = goalHabits.filter(gh => gh.goal_id === goal_id).map(gh => gh.habit_id);
    const toAdd = habitIds.filter(id => !existing.includes(id));
    const toRemove = existing.filter(id => !habitIds.includes(id));
    if (toRemove.length) {
      await supabase.from("goal_habits").delete().eq("goal_id", goal_id).in("habit_id", toRemove);
    }
    if (toAdd.length) {
      await supabase.from("goal_habits").insert(
        toAdd.map(habit_id => ({ goal_id, habit_id, user_id: user.id }))
      );
    }
    setGoalHabits(prev => [
      ...prev.filter(gh => gh.goal_id !== goal_id),
      ...habitIds.map(habit_id => ({ goal_id, habit_id, user_id: user.id })),
    ]);
  };

  const linkedHabitIds = (goal_id: string) =>
    goalHabits.filter(gh => gh.goal_id === goal_id).map(gh => gh.habit_id);

  return {
    goals, goalHabits, loading, refresh,
    createGoal, updateGoal, deleteGoal,
    setGoalHabitLinks, linkedHabitIds,
  };
}

/** Compute auto progress: sum of habit completions linked to this goal within [start, end] window. */
export function computeGoalProgress(
  goal: Goal,
  linkedIds: string[],
  completions: { habit_id: string; completed_on: string }[]
): { progress: number; window: { start: string; end: string } } {
  const window = goalWindow(goal);
  if (linkedIds.length === 0) {
    return { progress: goal.current_progress, window };
  }
  const linked = new Set(linkedIds);
  const progress = completions.filter(c =>
    linked.has(c.habit_id) &&
    c.completed_on >= window.start &&
    c.completed_on <= window.end
  ).length;
  return { progress, window };
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function isoOf(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

/** Resolves the active window for a goal based on category (or explicit start/end). */
export function goalWindow(goal: Goal): { start: string; end: string } {
  if (goal.end_date) return { start: goal.start_date, end: goal.end_date };
  const now = new Date(); now.setHours(0,0,0,0);
  let start = new Date(now), end = new Date(now);
  switch (goal.category) {
    case "daily": break;
    case "weekly": {
      const dow = (now.getDay() + 6) % 7; // Mon=0
      start = new Date(now); start.setDate(now.getDate() - dow);
      end = new Date(start); end.setDate(start.getDate() + 6);
      break;
    }
    case "monthly": {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    }
    case "quarterly": {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      end = new Date(now.getFullYear(), q * 3 + 3, 0);
      break;
    }
  }
  return { start: isoOf(start), end: isoOf(end) };
}
