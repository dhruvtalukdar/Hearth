import { useMemo, useState } from "react";
import { useTasks, parseQuickAdd, type Task, type TaskPriority } from "@/hooks/useTasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Inbox,
  CalendarDays,
  Star,
  Clock,
  Plus,
  Search,
  Trash2,
  Tag,
  X,
  Pencil,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type FilterKey = string; // "all" | "today" | "upcoming" | "important" | `cat:${id}`

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-muted-foreground/40",
  normal: "bg-primary/60",
  high: "bg-destructive",
};

const todayStr = () => new Date().toISOString().slice(0, 10);

function formatDueBadge(due: string | null) {
  if (!due) return null;
  const t = todayStr();
  if (due === t) return { label: "Today", tone: "today" as const };
  const d = new Date(due);
  const today = new Date(t);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 1) return { label: "Tomorrow", tone: "soon" as const };
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, tone: "overdue" as const };
  if (diff < 7) return { label: d.toLocaleDateString(undefined, { weekday: "short" }), tone: "soon" as const };
  return { label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), tone: "later" as const };
}

export function TodoTab() {
  const { tasks, categories, createTask, updateTask, toggleComplete, deleteTask, createCategory, deleteCategory } =
    useTasks();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const counts = useMemo(() => {
    const t = todayStr();
    return {
      all: tasks.filter((x) => !x.is_completed).length,
      today: tasks.filter((x) => !x.is_completed && x.due_date === t).length,
      upcoming: tasks.filter((x) => !x.is_completed && x.due_date && x.due_date > t).length,
      important: tasks.filter((x) => !x.is_completed && x.is_important).length,
      byCat: Object.fromEntries(
        categories.map((c) => [c.id, tasks.filter((x) => !x.is_completed && x.category_id === c.id).length]),
      ) as Record<string, number>,
    };
  }, [tasks, categories]);

  const filtered = useMemo(() => {
    const t = todayStr();
    let list = tasks;
    if (filter === "today") list = list.filter((x) => x.due_date === t);
    else if (filter === "upcoming") list = list.filter((x) => x.due_date && x.due_date > t);
    else if (filter === "important") list = list.filter((x) => x.is_important);
    else if (filter.startsWith("cat:")) {
      const cid = filter.slice(4);
      list = list.filter((x) => x.category_id === cid);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((x) => x.title.toLowerCase().includes(q) || x.description.toLowerCase().includes(q));
    }
    return list;
  }, [tasks, filter, search]);

  const open = filtered.filter((t) => !t.is_completed);
  const done = filtered.filter((t) => t.is_completed);

  // Sort: priority high → normal → low, then due date
  const priorityRank: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };
  open.sort((a, b) => {
    if (a.is_important !== b.is_important) return a.is_important ? -1 : 1;
    if (a.priority !== b.priority) return priorityRank[a.priority] - priorityRank[b.priority];
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return b.created_at.localeCompare(a.created_at);
  });

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quick.trim()) return;
    const parsed = parseQuickAdd(quick);
    const cat = filter.startsWith("cat:") ? filter.slice(4) : null;
    await createTask({
      title: parsed.title,
      due_date: parsed.due_date ?? (filter === "today" ? todayStr() : null),
      is_important: filter === "important",
      category_id: cat,
    });
    setQuick("");
  };

  const sidebarBtn = (key: FilterKey, icon: React.ReactNode, label: string, count?: number) => (
    <button
      onClick={() => setFilter(key)}
      className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
        filter === key ? "bg-accent text-accent-foreground" : "hover:bg-muted/60"
      }`}
    >
      <span className="flex items-center gap-2.5">
        {icon}
        <span>{label}</span>
      </span>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      )}
    </button>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
      {/* Sidebar */}
      <aside className="space-y-1">
        {sidebarBtn("all", <Inbox className="h-4 w-4" />, "All Tasks", counts.all)}
        {sidebarBtn("today", <CalendarDays className="h-4 w-4" />, "Today", counts.today)}
        {sidebarBtn("upcoming", <Clock className="h-4 w-4" />, "Upcoming", counts.upcoming)}
        {sidebarBtn("important", <Star className="h-4 w-4" />, "Important", counts.important)}

        <div className="pt-4 pb-1 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Categories
        </div>
        {categories.map((c) => (
          <div key={c.id} className="group flex items-center">
            <div className="flex-1">
              {sidebarBtn(`cat:${c.id}`, <Tag className="h-4 w-4" />, c.name, counts.byCat[c.id] ?? 0)}
            </div>
            {!c.is_default && (
              <button
                onClick={() => deleteCategory(c.id)}
                className="opacity-0 group-hover:opacity-100 p-1 mr-1 text-muted-foreground hover:text-destructive transition-opacity"
                aria-label="Delete category"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        <Popover open={newCatOpen} onOpenChange={setNewCatOpen}>
          <PopoverTrigger asChild>
            <button className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 transition-colors">
              <Plus className="h-4 w-4" /> Add Category
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-60" align="start">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newCatName.trim()) return;
                await createCategory(newCatName);
                setNewCatName("");
                setNewCatOpen(false);
              }}
              className="space-y-2"
            >
              <Input
                autoFocus
                placeholder="Category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
              />
              <Button type="submit" size="sm" className="w-full">
                Create
              </Button>
            </form>
          </PopoverContent>
        </Popover>
      </aside>

      {/* Main */}
      <section className="space-y-4 min-w-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <form onSubmit={handleQuickAdd} className="flex gap-2">
          <Input
            placeholder='Add a task… try "Buy groceries tomorrow"'
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
          />
          <Button type="submit" size="icon" aria-label="Add task">
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <div className="space-y-2">
          {open.length === 0 && done.length === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground border-dashed">
              No tasks here yet. Add one above.
            </Card>
          )}

          {open.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              categoryName={categories.find((c) => c.id === t.category_id)?.name}
              onToggle={() => toggleComplete(t)}
              onStar={() => updateTask(t.id, { is_important: !t.is_important })}
              onEdit={() => setEditing(t)}
              onDelete={() => deleteTask(t.id)}
            />
          ))}

          {done.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setShowCompleted((s) => !s)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-1 py-1"
              >
                {showCompleted ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Completed · {done.length}
              </button>
              {showCompleted && (
                <div className="space-y-2 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  {done.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      categoryName={categories.find((c) => c.id === t.category_id)?.name}
                      onToggle={() => toggleComplete(t)}
                      onStar={() => updateTask(t.id, { is_important: !t.is_important })}
                      onEdit={() => setEditing(t)}
                      onDelete={() => deleteTask(t.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <TaskEditDialog
        task={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onSave={async (patch) => {
          if (editing) await updateTask(editing.id, patch);
          setEditing(null);
        }}
      />
    </div>
  );
}

function TaskRow({
  task,
  categoryName,
  onToggle,
  onStar,
  onEdit,
  onDelete,
}: {
  task: Task;
  categoryName?: string;
  onToggle: () => void;
  onStar: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const due = formatDueBadge(task.due_date);
  return (
    <Card
      className={`group flex items-center gap-3 px-4 py-3 transition-all hover:shadow-soft animate-in fade-in slide-in-from-top-1 duration-200 ${
        task.is_completed ? "opacity-60" : ""
      }`}
    >
      <Checkbox checked={task.is_completed} onCheckedChange={onToggle} className="h-5 w-5 rounded-full" />
      <span className={`h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`} aria-hidden />
      <button onClick={onEdit} className="flex-1 min-w-0 text-left">
        <div className={`text-sm truncate ${task.is_completed ? "line-through" : ""}`}>{task.title}</div>
        {(task.description || categoryName) && (
          <div className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-2">
            {categoryName && <span>{categoryName}</span>}
            {categoryName && task.description && <span>·</span>}
            {task.description && <span className="truncate">{task.description}</span>}
          </div>
        )}
      </button>
      {due && (
        <Badge
          variant="outline"
          className={`text-xs shrink-0 ${
            due.tone === "overdue"
              ? "border-destructive/40 text-destructive"
              : due.tone === "today"
                ? "border-primary/40 text-primary"
                : "text-muted-foreground"
          }`}
        >
          {due.label}
        </Badge>
      )}
      <button
        onClick={onStar}
        className={`p-1 transition-colors ${
          task.is_important ? "text-ochre" : "text-muted-foreground/40 hover:text-foreground"
        }`}
        aria-label="Toggle important"
      >
        <Star className={`h-4 w-4 ${task.is_important ? "fill-current" : ""}`} />
      </button>
      <button
        onClick={onEdit}
        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-opacity"
        aria-label="Edit"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
        aria-label="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </Card>
  );
}

function TaskEditDialog({
  task,
  categories,
  onClose,
  onSave,
}: {
  task: Task | null;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSave: (patch: Partial<Task>) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reminder, setReminder] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [categoryId, setCategoryId] = useState<string>("none");

  // Reset on open
  useMemo(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setDueDate(task.due_date ?? "");
      setReminder(task.reminder_time ?? "");
      setPriority(task.priority);
      setCategoryId(task.category_id ?? "none");
    }
  }, [task]);

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes (optional)"
            rows={3}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Due date</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Reminder</label>
              <Input type="time" value={reminder} onChange={(e) => setReminder(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                title,
                description,
                due_date: dueDate || null,
                reminder_time: reminder || null,
                priority,
                category_id: categoryId === "none" ? null : categoryId,
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
