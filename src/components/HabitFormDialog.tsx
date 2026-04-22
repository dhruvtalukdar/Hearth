import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { HABIT_COLORS, HABIT_ICONS, colorVar } from "@/lib/habits";
import { Icon } from "@/components/Icon";
import type { Habit } from "@/hooks/useHabitData";
import { cn } from "@/lib/utils";

type Props = {
  trigger: React.ReactNode;
  initial?: Habit;
  onSubmit: (data: { name: string; icon: string; color: string; weekly_goal: number }) => Promise<any>;
  title?: string;
};

export function HabitFormDialog({ trigger, initial, onSubmit, title }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState<string>(initial?.icon ?? "sparkles");
  const [color, setColor] = useState<string>(initial?.color ?? "terracotta");
  const [goal, setGoal] = useState<number>(initial?.weekly_goal ?? 5);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName(initial?.name ?? "");
    setIcon(initial?.icon ?? "sparkles");
    setColor(initial?.color ?? "terracotta");
    setGoal(initial?.weekly_goal ?? 5);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const res = await onSubmit({ name: name.trim(), icon, color, weekly_goal: goal });
    setBusy(false);
    if (!res?.error) {
      setOpen(false);
      if (!initial) reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title ?? (initial ? "Edit habit" : "New habit")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="hname">Name</Label>
            <Input id="hname" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning meditation" />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {HABIT_COLORS.map(c => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setColor(c.key)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition",
                    color === c.key ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: `hsl(${c.hsl})` }}
                  aria-label={c.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {HABIT_ICONS.map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center transition",
                    icon === i ? "bg-foreground text-background" : "bg-muted hover:bg-secondary"
                  )}
                  aria-label={i}
                >
                  <Icon name={i} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Weekly goal</Label>
              <span className="text-sm font-medium" style={{ color: colorVar(color) }}>
                {goal}× / week
              </span>
            </div>
            <Slider min={1} max={7} step={1} value={[goal]} onValueChange={([v]) => setGoal(v)} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Saving..." : initial ? "Save changes" : "Create habit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
