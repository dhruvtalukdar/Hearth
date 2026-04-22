import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIME_CATEGORIES, type TimeBlock, type NewTimeBlock } from "@/hooks/useTimetable";
import { useHabitData } from "@/hooks/useHabitData";
import { cn } from "@/lib/utils";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  initial?: Partial<TimeBlock>;
  defaultDate?: string;
  trigger: React.ReactNode;
  /**
   * For recurring blocks the dialog can return MULTIPLE inputs (one per selected day).
   * For one-off and edits it returns one input.
   */
  onSubmit: (inputs: NewTimeBlock[]) => Promise<unknown> | void;
}

export function TimeBlockDialog({ initial, defaultDate, trigger, onSubmit }: Props) {
  const { habits } = useHabitData();
  const isEditing = !!initial?.id;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<"fixed" | "variable">((initial?.type as "fixed" | "variable") ?? "variable");
  const [date, setDate] = useState(initial?.block_date ?? defaultDate ?? new Date().toISOString().slice(0, 10));
  // Multi-day selection for recurring (only when creating). Edits keep a single day.
  const [dows, setDows] = useState<number[]>(
    initial?.day_of_week != null ? [initial.day_of_week] : [new Date().getDay()]
  );
  const [start, setStart] = useState((initial?.start_time ?? "09:00:00").slice(0, 5));
  const [end, setEnd] = useState((initial?.end_time ?? "10:00:00").slice(0, 5));
  const [category, setCategory] = useState(initial?.category ?? "work");
  const [habitId, setHabitId] = useState<string>(initial?.habit_id ?? "none");

  const toggleDow = (i: number) => {
    setDows(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i].sort());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (type === "fixed" && dows.length === 0) return;

    const base = {
      title: title.trim(),
      start_time: `${start}:00`,
      end_time: `${end}:00`,
      category,
      habit_id: habitId === "none" ? null : habitId,
    };

    let inputs: NewTimeBlock[];
    if (type === "variable") {
      inputs = [{ ...base, type: "variable", block_date: date, day_of_week: null }];
    } else if (isEditing) {
      // Editing a recurring block: keep it as a single row
      inputs = [{ ...base, type: "fixed", block_date: null, day_of_week: dows[0] }];
    } else {
      // Creating recurring: one block per selected weekday
      inputs = dows.map(d => ({ ...base, type: "fixed" as const, block_date: null, day_of_week: d }));
    }

    await onSubmit(inputs);
    setOpen(false);
    if (!initial) setTitle("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{isEditing ? "Edit block" : "New time block"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Title</Label>
            <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Deep work" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v: "fixed" | "variable") => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="variable">One-off</SelectItem>
                  <SelectItem value="fixed">Recurring weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIME_CATEGORIES.map(c => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === "variable" ? (
            <div className="space-y-1.5">
              <Label htmlFor="t-date">Date</Label>
              <Input id="t-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>{isEditing ? "Day of week" : "Days of week"}</Label>
              {isEditing ? (
                <Select value={String(dows[0] ?? 0)} onValueChange={(v) => setDows([Number(v)])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOW.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <div className="flex gap-1.5 flex-wrap">
                    {DOW.map((d, i) => {
                      const active = dows.includes(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleDow(i)}
                          className={cn(
                            "h-9 w-11 rounded-md border text-xs font-medium transition",
                            active
                              ? "bg-foreground text-background border-foreground"
                              : "bg-background text-muted-foreground border-border hover:border-foreground/40"
                          )}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {dows.length === 0
                      ? "Pick at least one day"
                      : `Repeats on ${dows.length} day${dows.length > 1 ? "s" : ""} per week`}
                  </p>
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-start">Start</Label>
              <Input id="t-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-end">End</Label>
              <Input id="t-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          {habits.length > 0 && (
            <div className="space-y-1.5">
              <Label>Linked habit (optional)</Label>
              <Select value={habitId} onValueChange={setHabitId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {habits.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={type === "fixed" && !isEditing && dows.length === 0}>
              {isEditing ? "Save" : dows.length > 1 && type === "fixed" ? `Create ${dows.length} blocks` : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
