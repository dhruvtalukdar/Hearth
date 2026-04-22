import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useHabitData } from "@/hooks/useHabitData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { HabitFormDialog } from "@/components/HabitFormDialog";
import { Icon } from "@/components/Icon";
import { colorVar } from "@/lib/habits";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function ProfileTab() {
  const { user } = useAuth();
  const { habits, completions, createHabit, updateHabit, deleteHabit } = useHabitData();
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setDisplayName(data?.display_name ?? ""));
  }, [user]);

  const saveName = async () => {
    if (!user) return;
    setSavingName(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("user_id", user.id);
    setSavingName(false);
    if (error) toast.error("Couldn't save name");
    else toast.success("Saved");
  };

  const exportCSV = () => {
    const rows = [["habit", "completed_on"]];
    completions.forEach(c => {
      const h = habits.find(x => x.id === c.habit_id);
      rows.push([h?.name ?? "(deleted)", c.completed_on]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `hearth-export-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-in-up">
      {/* Profile */}
      <Card className="surface p-6 sm:p-8 shadow-none border">
        <h2 className="font-display text-2xl mb-1">Profile</h2>
        <p className="text-muted-foreground text-sm mb-6">Just a name, kept simple.</p>
        <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end max-w-lg">
          <div className="space-y-1.5">
            <Label htmlFor="dn">Display name</Label>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <Button onClick={saveName} disabled={savingName}>Save</Button>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Signed in as <span className="text-foreground">{user?.email}</span>
        </div>
      </Card>

      {/* Habits */}
      <Card className="surface p-6 sm:p-8 shadow-none border">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="font-display text-2xl mb-1">Habits</h2>
            <p className="text-muted-foreground text-sm">Add, edit, and tune weekly goals.</p>
          </div>
          <HabitFormDialog
            onSubmit={createHabit}
            trigger={<Button><Plus className="h-4 w-4 mr-1.5" />New habit</Button>}
          />
        </div>

        {habits.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="font-display text-lg mb-2">No habits yet</p>
            <p className="text-sm">Start with one. Small is enough.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {habits.map(h => (
              <div key={h.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/60 transition group">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-white"
                  style={{ backgroundColor: colorVar(h.color) }}
                >
                  <Icon name={h.icon} className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{h.name}</div>
                  <div className="text-xs text-muted-foreground">{h.weekly_goal}× per week</div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <HabitFormDialog
                    initial={h}
                    onSubmit={(d) => updateHabit(h.id, d)}
                    trigger={<Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>}
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{h.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes the habit and all its completion history. This can't be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteHabit(h.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Export */}
      <Card className="surface p-6 sm:p-8 shadow-none border">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-xl mb-1">Export your data</h2>
            <p className="text-muted-foreground text-sm">Download all completions as a CSV.</p>
          </div>
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
        </div>
      </Card>
    </div>
  );
}
