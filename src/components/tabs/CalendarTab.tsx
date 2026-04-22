import { useMemo, useState, useEffect } from "react";
import { useHabitData } from "@/hooks/useHabitData";
import { useJournal } from "@/hooks/useJournal";
import { useTimetable, blocksForDate, categoryColor, formatTimeLabel } from "@/hooks/useTimetable";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/components/Icon";
import { colorVar, toISO, fromISO, todayISO } from "@/lib/habits";
import { ChevronLeft, ChevronRight, Check, FileText, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return cells;
}

function stripHtml(html: string): string {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

export function CalendarTab() {
  const { user } = useAuth();
  const { habits, completions, toggleCompletion } = useHabitData();
  const { entries: journalEntries } = useJournal();
  const { blocks } = useTimetable();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(todayISO());
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const cells = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  const completionsByDate = useMemo(() => {
    const map = new Map<string, { habit_id: string }[]>();
    completions.forEach(c => {
      const arr = map.get(c.completed_on) ?? [];
      arr.push({ habit_id: c.habit_id });
      map.set(c.completed_on, arr);
    });
    return map;
  }, [completions]);

  const journalByDate = useMemo(() => {
    const m = new Map<string, string>();
    journalEntries.forEach(e => m.set(e.entry_date, e.content));
    return m;
  }, [journalEntries]);

  // Load note for selected date
  useEffect(() => {
    if (!user) return;
    supabase
      .from("day_notes")
      .select("content")
      .eq("user_id", user.id)
      .eq("note_date", selected)
      .maybeSingle()
      .then(({ data }) => setNote(data?.content ?? ""));
  }, [user, selected]);

  const saveNote = async () => {
    if (!user) return;
    setSavingNote(true);
    const { error } = await supabase
      .from("day_notes")
      .upsert({ user_id: user.id, note_date: selected, content: note }, { onConflict: "user_id,note_date" });
    setSavingNote(false);
    if (error) toast.error("Couldn't save note");
    else toast.success("Note saved");
  };

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const selectedDate = fromISO(selected);
  const completedOnSelected = completionsByDate.get(selected) ?? [];
  const completedHabitIds = new Set(completedOnSelected.map(c => c.habit_id));
  const journalPreview = stripHtml(journalByDate.get(selected) ?? "").slice(0, 180);
  const dayBlocks = blocksForDate(blocks, selectedDate).sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6 animate-in-up">
      {/* Calendar */}
      <Card className="surface p-5 sm:p-7 shadow-none border">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-2xl">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { const t = new Date(); setCursor(new Date(t.getFullYear(), t.getMonth(), 1)); setSelected(todayISO()); }}>
              Today
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-[11px] font-medium text-muted-foreground text-center uppercase tracking-wider">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((d) => {
            const iso = toISO(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const isToday = iso === todayISO();
            const isSelected = iso === selected;
            const dayComps = completionsByDate.get(iso) ?? [];
            const colors = dayComps
              .map(c => habits.find(h => h.id === c.habit_id)?.color)
              .filter(Boolean) as string[];
            const uniqueColors = Array.from(new Set(colors)).slice(0, 4);
            const hasJournal = journalByDate.has(iso) && stripHtml(journalByDate.get(iso) ?? "").length > 0;

            return (
              <button
                key={iso}
                onClick={() => setSelected(iso)}
                className={cn(
                  "aspect-square rounded-xl flex flex-col items-center justify-between p-1.5 transition border text-sm relative",
                  inMonth ? "bg-background hover:bg-muted" : "bg-transparent text-muted-foreground/50 hover:bg-muted/50",
                  isSelected ? "border-foreground shadow-soft" : "border-transparent",
                  isToday && !isSelected && "border-accent/60",
                )}
              >
                {hasJournal && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-foreground/40" title="Has journal entry" />
                )}
                <span className={cn("text-xs font-medium", isToday && "text-accent font-semibold")}>{d.getDate()}</span>
                <div className="flex gap-0.5 flex-wrap justify-center max-w-full">
                  {uniqueColors.map((c, i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colorVar(c) }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Day detail */}
      <Card className="surface p-5 sm:p-7 shadow-none border h-fit">
        <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
          {selectedDate.toLocaleDateString(undefined, { weekday: "long" })}
        </div>
        <h3 className="font-display text-2xl mb-5">
          {selectedDate.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
        </h3>

        {/* Habits */}
        <div className="space-y-1.5 mb-6">
          {habits.length === 0 && <p className="text-sm text-muted-foreground">Add habits to start tracking.</p>}
          {habits.map(h => {
            const done = completedHabitIds.has(h.id);
            return (
              <button
                key={h.id}
                onClick={() => toggleCompletion(h.id, selected)}
                className={cn(
                  "w-full flex items-center gap-3 p-2.5 rounded-xl transition text-left",
                  done ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-white"
                  style={{ backgroundColor: colorVar(h.color) }}
                >
                  <Icon name={h.icon} className="h-4 w-4" />
                </div>
                <span className={cn("flex-1 text-sm font-medium", done && "line-through text-muted-foreground")}>{h.name}</span>
                <div
                  className={cn(
                    "h-5 w-5 rounded-md border-2 flex items-center justify-center transition",
                    done ? "border-foreground bg-foreground check-pop" : "border-border"
                  )}
                >
                  {done && <Check className="h-3 w-3 text-background" strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Schedule preview */}
        {dayBlocks.length > 0 && (
          <div className="mb-6">
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Schedule
            </label>
            <div className="space-y-1">
              {dayBlocks.slice(0, 5).map(b => (
                <div key={b.id} className="flex items-center gap-2 text-xs p-1.5 rounded-md">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: categoryColor(b.category) }} />
                  <span className="text-muted-foreground tabular-nums shrink-0">{formatTimeLabel(b.start_time)}</span>
                  <span className={cn("truncate", b.is_completed && "line-through text-muted-foreground")}>{b.title}</span>
                </div>
              ))}
              {dayBlocks.length > 5 && (
                <p className="text-[11px] text-muted-foreground pl-4">+{dayBlocks.length - 5} more</p>
              )}
            </div>
          </div>
        )}

        {/* Journal preview */}
        {journalPreview && (
          <div className="mb-6">
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <FileText className="h-3 w-3" /> Journal
            </label>
            <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4 italic border-l-2 border-border pl-3">
              {journalPreview}{journalPreview.length >= 180 ? "…" : ""}
            </p>
          </div>
        )}

        {/* Quick note */}
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Quick note</label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="A quick line about the day…"
            className="min-h-[100px] resize-none"
          />
          <Button className="mt-3 w-full" variant="outline" onClick={saveNote} disabled={savingNote}>
            {savingNote ? "Saving..." : "Save note"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
