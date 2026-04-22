import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useGoals, GOAL_CATEGORIES, computeGoalProgress, type Goal, type GoalCategory } from "@/hooks/useGoals";
import { useHabitData } from "@/hooks/useHabitData";
import { GoalFormDialog } from "@/components/GoalFormDialog";
import { Icon } from "@/components/Icon";
import { colorVar } from "@/lib/habits";
import { Plus, Pencil, Trash2, Minus, Plus as PlusSm, CheckCircle2, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function GoalsTab() {
  const { goals, createGoal, updateGoal, deleteGoal, setGoalHabitLinks, linkedHabitIds } = useGoals();
  const { habits, completions } = useHabitData();
  const [tab, setTab] = useState<GoalCategory | "all">("all");

  const grouped = useMemo(() => {
    const filtered = tab === "all" ? goals : goals.filter(g => g.category === tab);
    return GOAL_CATEGORIES.map(c => ({
      ...c,
      goals: filtered.filter(g => g.category === c.key),
    }));
  }, [goals, tab]);

  const visible = tab === "all" ? grouped : grouped.filter(g => g.key === tab);

  return (
    <div className="space-y-6 animate-in-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl">Goals</h2>
          <p className="text-sm text-muted-foreground">What you're working toward, across time.</p>
        </div>
        <div className="flex items-center gap-2">
          <GoalFormDialog
            onSubmit={async (g, habitIds) => {
              const { error } = await createGoal(g, habitIds);
              if (error) toast.error("Couldn't create goal");
              else toast.success("Goal added");
            }}
            trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1.5" />New goal</Button>}
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as GoalCategory | "all")}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {GOAL_CATEGORIES.map(c => (
            <TabsTrigger key={c.key} value={c.key}>{c.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className="space-y-8 mt-6">
          {goals.length === 0 ? (
            <Card className="surface p-12 text-center shadow-none border">
              <p className="font-display text-lg text-muted-foreground mb-2">No goals yet</p>
              <p className="text-sm text-muted-foreground">Set one. Make it small enough to start, big enough to matter.</p>
            </Card>
          ) : (
            visible.map(group => group.goals.length > 0 && (
              <section key={group.key} className="space-y-3">
                <h3 className="font-display text-lg text-muted-foreground">{group.label}</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {group.goals.map(goal => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      linkedIds={linkedHabitIds(goal.id)}
                      habits={habits}
                      completions={completions}
                      onUpdate={(patch) => updateGoal(goal.id, patch)}
                      onDelete={() => deleteGoal(goal.id)}
                      onLinks={(ids) => setGoalHabitLinks(goal.id, ids)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface GoalCardProps {
  goal: Goal;
  linkedIds: string[];
  habits: { id: string; name: string; color: string; icon: string }[];
  completions: { habit_id: string; completed_on: string }[];
  onUpdate: (patch: Partial<Goal>) => void;
  onDelete: () => void;
  onLinks: (ids: string[]) => void;
}

function GoalCard({ goal, linkedIds, habits, completions, onUpdate, onDelete, onLinks }: GoalCardProps) {
  const { progress } = computeGoalProgress(goal, linkedIds, completions);
  const pct = Math.min(100, Math.round((progress / Math.max(1, goal.target_value)) * 100));
  const completed = pct >= 100;
  const linkedHabits = habits.filter(h => linkedIds.includes(h.id));

  // Auto-mark completed if hitting target
  if (completed && !goal.is_completed) {
    onUpdate({ is_completed: true });
  }

  return (
    <Card className={cn(
      "surface p-5 shadow-none border transition",
      completed && "border-accent/50 bg-accent-soft/40",
    )}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium truncate">{goal.title}</h4>
            {completed && <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />}
          </div>
          {goal.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{goal.description}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-60 hover:opacity-100 transition shrink-0">
          <GoalFormDialog
            initial={goal}
            initialHabitIds={linkedIds}
            onSubmit={async (g, habitIds) => {
              await onUpdate(g);
              await onLinks(habitIds);
            }}
            trigger={<Button size="icon" variant="ghost" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{goal.title}"?</AlertDialogTitle>
                <AlertDialogDescription>This goal will be removed permanently.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">{progress} / {goal.target_value}</span>
          <span className="font-display text-base tabular-nums">{pct}%</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>

      {linkedIds.length === 0 ? (
        <div className="flex items-center gap-1 mt-3">
          <Button
            size="icon" variant="ghost" className="h-7 w-7"
            onClick={() => onUpdate({ current_progress: Math.max(0, goal.current_progress - 1) })}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            size="icon" variant="ghost" className="h-7 w-7"
            onClick={() => onUpdate({ current_progress: goal.current_progress + 1 })}
          >
            <PlusSm className="h-3 w-3" />
          </Button>
          <span className="text-[11px] text-muted-foreground ml-1">manual progress</span>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          <Link2 className="h-3 w-3 text-muted-foreground" />
          {linkedHabits.map(h => (
            <span
              key={h.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-white"
              style={{ backgroundColor: colorVar(h.color) }}
            >
              <Icon name={h.icon} className="h-2.5 w-2.5" />
              {h.name}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
