import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { todayISO } from "@/lib/habits";

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  weekly_goal: number;
  archived: boolean;
  sort_order: number;
  created_at: string;
};

export type Completion = {
  id: string;
  habit_id: string;
  completed_on: string; // ISO date
};

export function useHabitData() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: h }, { data: c }] = await Promise.all([
      supabase.from("habits").select("*").eq("archived", false).order("sort_order"),
      supabase.from("habit_completions").select("id, habit_id, completed_on"),
    ]);
    setHabits((h ?? []) as Habit[]);
    setCompletions((c ?? []) as Completion[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const createHabit = async (input: { name: string; icon: string; color: string; weekly_goal: number }) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("habits")
      .insert({ ...input, user_id: user.id, sort_order: habits.length })
      .select()
      .single();
    if (!error && data) setHabits(prev => [...prev, data as Habit]);
    return { data, error };
  };

  const updateHabit = async (id: string, patch: Partial<Habit>) => {
    const { data, error } = await supabase.from("habits").update(patch).eq("id", id).select().single();
    if (!error && data) setHabits(prev => prev.map(h => (h.id === id ? (data as Habit) : h)));
    return { data, error };
  };

  const deleteHabit = async (id: string) => {
    const { error } = await supabase.from("habits").delete().eq("id", id);
    if (!error) {
      setHabits(prev => prev.filter(h => h.id !== id));
      setCompletions(prev => prev.filter(c => c.habit_id !== id));
    }
    return { error };
  };

  const toggleCompletion = async (habit_id: string, date: string = todayISO()) => {
    if (!user) return;
    const existing = completions.find(c => c.habit_id === habit_id && c.completed_on === date);
    if (existing) {
      setCompletions(prev => prev.filter(c => c.id !== existing.id));
      const { error } = await supabase.from("habit_completions").delete().eq("id", existing.id);
      if (error) refresh();
    } else {
      // optimistic
      const tempId = `temp-${Date.now()}`;
      setCompletions(prev => [...prev, { id: tempId, habit_id, completed_on: date }]);
      const { data, error } = await supabase
        .from("habit_completions")
        .insert({ user_id: user.id, habit_id, completed_on: date })
        .select()
        .single();
      if (error) {
        setCompletions(prev => prev.filter(c => c.id !== tempId));
      } else if (data) {
        setCompletions(prev => prev.map(c => (c.id === tempId ? (data as Completion) : c)));
      }
    }
  };

  return { habits, completions, loading, refresh, createHabit, updateHabit, deleteHabit, toggleCompletion };
}
