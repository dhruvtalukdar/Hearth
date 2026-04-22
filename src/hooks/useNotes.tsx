import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  is_important: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export function useNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Failed to load notes");
    } else {
      setNotes((data ?? []) as Note[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const createNote = useCallback(async () => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("notes")
      .insert({ user_id: user.id, title: "", content: "" })
      .select()
      .single();
    if (error || !data) {
      toast.error("Failed to create note");
      return null;
    }
    setNotes((prev) => [data as Note, ...prev]);
    return data as Note;
  }, [user]);

  const updateNote = useCallback(
    async (id: string, patch: Partial<Pick<Note, "title" | "content" | "is_important" | "is_pinned">>) => {
      // Optimistic
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n)),
      );
      const { error } = await supabase.from("notes").update(patch).eq("id", id);
      if (error) {
        toast.error("Failed to save");
        load();
      }
    },
    [load],
  );

  const deleteNote = useCallback(
    async (id: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) {
        toast.error("Failed to delete");
        load();
      } else {
        toast.success("Note deleted");
      }
    },
    [load],
  );

  return { notes, loading, createNote, updateNote, deleteNote, reload: load };
}
