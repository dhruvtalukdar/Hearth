import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { GOAL_CATEGORIES, type Goal, type GoalCategory } from "@/hooks/useGoals";
import { useHabitData } from "@/hooks/useHabitData";
import { Icon } from "@/components/Icon";
import { colorVar } from "@/lib/habits";

interface Props {
  initial?: Goal;
  initialHabitIds?: string[];
  trigger: React.ReactNode;
  onSubmit: (
    g: {
      title: string; description: string; category: GoalCategory;
      target_value: number; start_date: string; end_date: string | null;
    },
    habitIds: string[]
  ) => Promise<unknown> | void;
}

export function GoalFormDialog({ initial, initialHabitIds = [], trigger, onSubmit }: Props) {
  const { habits } = useHabitData();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState<GoalCategory>(initial?.category ?? "weekly");
  const [target, setTarget] = useState<number>(initial?.target_value ?? 5);
  const [startDate, setStartDate] = useState(initial?.start_date ?? new Date().toISOString().slice(0,10));
  const [endDate, setEndDate] = useState<string>(initial?.end_date ?? "");
  const [habitIds, setHabitIds] = useState<string[]>(initialHabitIds);

  const toggleHabit = (id: string) =>
    setHabitIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      category,
      target_value: Math.max(1, target),
      start_date: startDate,
      end_date: endDate || null,
    }, habitIds);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{initial ? "Edit goal" : "New goal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="g-title">Title</Label>
            <Input id="g-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Read 4 books" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-desc">Description</Label>
            <Textarea
              id="g-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why does this matter?"
              className="min-h-[60px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v: GoalCategory) => setCategory(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOAL_CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-target">Target</Label>
              <Input id="g-target" type="number" min={1} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-start">Start</Label>
              <Input id="g-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-end">End <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="g-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {habits.length > 0 && (
            <div className="space-y-2">
              <Label>Linked habits <span className="text-muted-foreground font-normal">— progress auto-updates</span></Label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {habits.map(h => (
                  <label key={h.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/60 cursor-pointer">
                    <Checkbox checked={habitIds.includes(h.id)} onCheckedChange={() => toggleHabit(h.id)} />
                    <span
                      className="h-6 w-6 rounded-md flex items-center justify-center text-white"
                      style={{ backgroundColor: colorVar(h.color) }}
                    >
                      <Icon name={h.icon} className="h-3 w-3" />
                    </span>
                    <span className="text-sm">{h.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{initial ? "Save" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
