import { useState, useMemo, useEffect, useRef } from "react";
import { useJournal } from "@/hooks/useJournal";
import { useHabitData } from "@/hooks/useHabitData";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RichEditor } from "@/components/RichEditor";
import { Icon } from "@/components/Icon";
import { colorVar, todayISO, fromISO } from "@/lib/habits";
import { Plus, Search, Trash2, FileText, Save, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const PAGE_SIZE = 5;

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

export function JournalTab() {
  const { entries, loading, upsertEntry, deleteEntry, getEntry, useAutoSave } = useJournal();
  const { habits, completions } = useHabitData();
  const [selected, setSelected] = useState<string>(todayISO());
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState<string>(""); // YYYY-MM
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const current = getEntry(selected);
  const [content, setContent] = useState<string>("");
  const [reflect, setReflect] = useState<boolean>(false);
  const { save, flush } = useAutoSave(selected, 700);

  // Track which entry we've hydrated the editor from so we re-sync
  // when entries finish loading after a remount.
  const hydratedKeyRef = useRef<string>("");

  useEffect(() => {
    if (loading) return;
    const key = `${selected}::${current?.id ?? "new"}`;
    if (hydratedKeyRef.current === key) return;
    flush();
    setContent(current?.content ?? "");
    setReflect(current?.reflect_on_habits ?? false);
    hydratedKeyRef.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, current?.id, loading]);

  // Flush on unmount
  useEffect(() => () => flush(), []);

  // Reset visible count when filter/search changes
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, filterMonth]);

  const filteredEntries = useMemo(() => {
    let list = entries;
    if (filterMonth) list = list.filter(e => e.entry_date.startsWith(filterMonth));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => stripHtml(e.content).toLowerCase().includes(q));
    }
    return list;
  }, [entries, search, filterMonth]);

  const visibleEntries = filteredEntries.slice(0, visibleCount);
  const hasMore = filteredEntries.length > visibleCount;

  const todaysCompletions = useMemo(
    () => completions.filter(c => c.completed_on === selected),
    [completions, selected]
  );
  const completedHabits = habits.filter(h => todaysCompletions.some(c => c.habit_id === h.id));

  const handleNewToday = () => {
    setSelected(todayISO());
    if (!getEntry(todayISO())) {
      upsertEntry(todayISO(), { content: "" });
    }
  };

  const handleManualSave = async () => {
    setSaving(true);
    flush();
    await upsertEntry(selected, { content, reflect_on_habits: reflect });
    setSaving(false);
    setJustSaved(true);
    toast.success("Entry saved");
    setTimeout(() => setJustSaved(false), 1500);
  };

  const handleDelete = async () => {
    if (current) {
      await deleteEntry(current.id);
      setContent("");
      setReflect(false);
      hydratedKeyRef.current = "";
    }
  };

  const selectedDate = fromISO(selected);

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-6 animate-in-up">
      {/* Sidebar */}
      <Card className="surface p-4 shadow-none border h-fit lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg">Journal</h2>
          <Button size="icon" variant="ghost" onClick={handleNewToday} title="Today">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative mb-3">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entries"
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="h-9 text-sm mb-4"
          placeholder="Filter by month"
        />

        <div className="space-y-1">
          {filteredEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              {entries.length === 0 ? "No entries yet." : "Nothing matches."}
            </p>
          ) : (
            <>
              {visibleEntries.map(e => {
                const d = fromISO(e.entry_date);
                const preview = stripHtml(e.content).slice(0, 60) || "(empty)";
                const active = e.entry_date === selected;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setSelected(e.entry_date)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg transition border cursor-pointer",
                      active ? "bg-muted border-border" : "border-transparent hover:bg-muted/60"
                    )}
                  >
                    <div className="text-xs font-medium text-foreground">
                      {d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{preview}</div>
                  </button>
                );
              })}
              {hasMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-xs text-muted-foreground"
                  onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                >
                  Load more ({filteredEntries.length - visibleCount} remaining)
                </Button>
              )}
              {!hasMore && filteredEntries.length > PAGE_SIZE && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-xs text-muted-foreground"
                  onClick={() => setVisibleCount(PAGE_SIZE)}
                >
                  Show less
                </Button>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Editor */}
      <Card className="surface p-6 sm:p-8 shadow-none border min-h-[60vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              {selectedDate.toLocaleDateString(undefined, { weekday: "long" })}
            </div>
            <h1 className="font-display text-3xl">
              {selectedDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="h-9 w-auto"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualSave}
              disabled={saving}
              className="gap-1.5"
            >
              {justSaved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {justSaved ? "Saved" : saving ? "Saving…" : "Save"}
            </Button>
            {current && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                    <AlertDialogDescription>The note for this day will be removed.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 mb-4 pb-4 border-b border-border/60">
          <Switch
            id="reflect"
            checked={reflect}
            onCheckedChange={(v) => { setReflect(v); save({ reflect_on_habits: v }); }}
          />
          <Label htmlFor="reflect" className="text-xs text-muted-foreground cursor-pointer">
            Reflect on habits today
          </Label>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
            Auto-saves while you type
          </span>
        </div>

        {reflect && (
          <div className="mb-5 p-4 rounded-xl bg-muted/40 border border-border/50">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <FileText className="h-3 w-3" />
              Today's habits
            </div>
            {habits.length === 0 ? (
              <p className="text-xs text-muted-foreground">No habits to reflect on.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {habits.map(h => {
                  const done = completedHabits.some(c => c.id === h.id);
                  return (
                    <span
                      key={h.id}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs",
                        done ? "text-white" : "bg-background text-muted-foreground border border-border"
                      )}
                      style={done ? { backgroundColor: colorVar(h.color) } : {}}
                    >
                      <Icon name={h.icon} className="h-3 w-3" />
                      {h.name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <RichEditor
          value={content}
          onChange={(html) => { setContent(html); save({ content: html }); }}
          placeholder="What's on your mind today?"
          className="flex-1"
        />
      </Card>
    </div>
  );
}
