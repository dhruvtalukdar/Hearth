import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type JournalEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  content: string;
  reflect_on_habits: boolean;
  created_at: string;
  updated_at: string;
};

export function useJournal() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .order("entry_date", { ascending: false });
    setEntries((data ?? []) as JournalEntry[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  /** upsert entry for a given date, returns the saved row */
  const upsertEntry = useCallback(async (
    entry_date: string,
    patch: { content?: string; reflect_on_habits?: boolean }
  ) => {
    if (!user) return null;
    const existing = entries.find(e => e.entry_date === entry_date);
    if (existing) {
      const { data, error } = await supabase
        .from("journal_entries")
        .update(patch)
        .eq("id", existing.id)
        .select()
        .single();
      if (!error && data) {
        setEntries(prev => prev.map(e => (e.id === existing.id ? (data as JournalEntry) : e)));
      }
      return data as JournalEntry | null;
    } else {
      const { data, error } = await supabase
        .from("journal_entries")
        .insert({
          user_id: user.id,
          entry_date,
          content: patch.content ?? "",
          reflect_on_habits: patch.reflect_on_habits ?? false,
        })
        .select()
        .single();
      if (!error && data) {
        setEntries(prev => [data as JournalEntry, ...prev]);
      }
      return data as JournalEntry | null;
    }
  }, [entries, user]);

  const deleteEntry = useCallback(async (id: string) => {
    const { error } = await supabase.from("journal_entries").delete().eq("id", id);
    if (!error) setEntries(prev => prev.filter(e => e.id !== id));
    return { error };
  }, []);

  const getEntry = useCallback(
    (date: string) => entries.find(e => e.entry_date === date) ?? null,
    [entries]
  );

  /** Debounced auto-save helper. Returns { save, flush } */
  const useAutoSave = (date: string, delay = 600) => {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingRef = useRef<{ content?: string; reflect_on_habits?: boolean }>({});
    const save = (patch: { content?: string; reflect_on_habits?: boolean }) => {
      pendingRef.current = { ...pendingRef.current, ...patch };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        upsertEntry(date, pendingRef.current);
        pendingRef.current = {};
      }, delay);
    };
    const flush = () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      if (Object.keys(pendingRef.current).length) {
        upsertEntry(date, pendingRef.current);
        pendingRef.current = {};
      }
    };
    return { save, flush };
  };

  return { entries, loading, refresh, upsertEntry, deleteEntry, getEntry, useAutoSave };
}
