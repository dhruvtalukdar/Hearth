import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type TaskPriority = "low" | "normal" | "high";

export type TaskCategory = {
  id: string;
  name: string;
  color: string;
  is_default: boolean;
  sort_order: number;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  reminder_time: string | null;
  priority: TaskPriority;
  is_important: boolean;
  is_completed: boolean;
  completed_at: string | null;
  category_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
  { name: "Personal", color: "terracotta" },
  { name: "Work", color: "sage" },
  { name: "Errands", color: "ochre" },
];

const CACHE_KEY = "hearth.tasks.cache.v1";

export function useTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? (JSON.parse(raw) as Task[]) : [];
    } catch {
      return [];
    }
  });
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Persist cache
  useEffect(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(tasks));
    } catch {}
  }, [tasks]);

  const seedDefaults = useCallback(async (uid: string) => {
    const rows = DEFAULT_CATEGORIES.map((c, i) => ({
      user_id: uid,
      name: c.name,
      color: c.color,
      is_default: true,
      sort_order: i,
    }));
    const { data } = await supabase.from("task_categories").insert(rows).select();
    return (data ?? []) as TaskCategory[];
  }, []);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: cats }, { data: ts }] = await Promise.all([
      supabase.from("task_categories").select("*").eq("user_id", user.id).order("sort_order"),
      supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    let cs = (cats ?? []) as TaskCategory[];
    if (cs.length === 0) cs = await seedDefaults(user.id);
    setCategories(cs);
    setTasks((ts ?? []) as Task[]);
    setLoading(false);
  }, [user, seedDefaults]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("tasks-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === "INSERT") setTasks((p) => [payload.new as Task, ...p.filter((t) => t.id !== (payload.new as Task).id)]);
        if (payload.eventType === "UPDATE") setTasks((p) => p.map((t) => (t.id === (payload.new as Task).id ? (payload.new as Task) : t)));
        if (payload.eventType === "DELETE") setTasks((p) => p.filter((t) => t.id !== (payload.old as Task).id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_categories", filter: `user_id=eq.${user.id}` }, () => {
        loadAll();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, loadAll]);

  const createTask = useCallback(
    async (input: Partial<Task> & { title: string }) => {
      if (!user) return;
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          title: input.title,
          description: input.description ?? "",
          due_date: input.due_date ?? null,
          reminder_time: input.reminder_time ?? null,
          priority: input.priority ?? "normal",
          is_important: input.is_important ?? false,
          category_id: input.category_id ?? null,
        })
        .select()
        .single();
      if (!error && data) setTasks((p) => [data as Task, ...p.filter((t) => t.id !== data.id)]);
      return data as Task | undefined;
    },
    [user],
  );

  const updateTask = useCallback(async (id: string, patch: Partial<Task>) => {
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    await supabase.from("tasks").update(patch).eq("id", id);
  }, []);

  const toggleComplete = useCallback(
    async (t: Task) => {
      const next = !t.is_completed;
      await updateTask(t.id, { is_completed: next, completed_at: next ? new Date().toISOString() : null });
    },
    [updateTask],
  );

  const deleteTask = useCallback(async (id: string) => {
    setTasks((p) => p.filter((t) => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  }, []);

  const createCategory = useCallback(
    async (name: string, color = "terracotta") => {
      if (!user || !name.trim()) return;
      const { data } = await supabase
        .from("task_categories")
        .insert({ user_id: user.id, name: name.trim(), color, sort_order: categories.length })
        .select()
        .single();
      if (data) setCategories((p) => [...p, data as TaskCategory]);
      return data as TaskCategory | undefined;
    },
    [user, categories.length],
  );

  const deleteCategory = useCallback(async (id: string) => {
    setCategories((p) => p.filter((c) => c.id !== id));
    await supabase.from("task_categories").delete().eq("id", id);
  }, []);

  return useMemo(
    () => ({ tasks, categories, loading, createTask, updateTask, toggleComplete, deleteTask, createCategory, deleteCategory }),
    [tasks, categories, loading, createTask, updateTask, toggleComplete, deleteTask, createCategory, deleteCategory],
  );
}

// Natural language parser: extracts due date from phrases like "buy milk tomorrow" / "call mom monday"
export function parseQuickAdd(input: string): { title: string; due_date: string | null } {
  const lower = input.toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const matchAndStrip = (re: RegExp, dateFn: () => Date) => {
    const m = lower.match(re);
    if (!m) return null;
    const start = m.index ?? 0;
    const cleaned = (input.slice(0, start) + input.slice(start + m[0].length)).replace(/\s+/g, " ").trim();
    return { title: cleaned || input, due_date: fmt(dateFn()) };
  };

  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < days.length; i++) {
    const r = matchAndStrip(new RegExp(`\\b(next\\s+)?${days[i]}\\b`), () => {
      const d = new Date(today);
      const diff = (i - today.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      return d;
    });
    if (r) return r;
  }
  const tomorrow = matchAndStrip(/\btomorrow\b/, () => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  });
  if (tomorrow) return tomorrow;
  const todayMatch = matchAndStrip(/\btoday\b/, () => today);
  if (todayMatch) return todayMatch;

  return { title: input.trim(), due_date: null };
}
