import { useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useTimetable, blocksForDate, findConflicts, timeToMinutes, minutesToTime,
  formatTimeLabel, categoryColor, TIME_CATEGORIES, type TimeBlock,
} from "@/hooks/useTimetable";
import { useHabitData } from "@/hooks/useHabitData";
import { TimeBlockDialog } from "@/components/TimeBlockDialog";
import { Plus, ChevronLeft, ChevronRight, AlertTriangle, Check, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toISO } from "@/lib/habits";

const HOURS_START = 6;
const HOURS_END = 23;
const HOUR_HEIGHT = 56; // px
const SNAP_MIN = 15;

function dayName(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short" });
}
function dayLabel(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function TimetableTab() {
  const { blocks, createBlock, updateBlock, deleteBlock } = useTimetable();
  const { habits } = useHabitData();
  const [view, setView] = useState<"day" | "week">("day");
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });

  const weekDays = useMemo(() => {
    const monday = new Date(cursor);
    monday.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i); return d;
    });
  }, [cursor]);

  const days = view === "day" ? [cursor] : weekDays;

  const shift = (dir: number) => {
    const d = new Date(cursor);
    d.setDate(cursor.getDate() + dir * (view === "day" ? 1 : 7));
    setCursor(d);
  };

  return (
    <div className="space-y-6 animate-in-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl">Timetable</h2>
          <p className="text-sm text-muted-foreground">Plan your day with intention.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={view} onValueChange={(v) => setView(v as "day" | "week")}>
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setCursor(d); }}>Today</Button>
            <Button size="icon" variant="ghost" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <TimeBlockDialog
            defaultDate={toISO(cursor)}
            onSubmit={async (inputs) => {
              const results = await Promise.all(inputs.map(i => createBlock(i)));
              const errs = results.filter(r => r.error).length;
              if (errs) toast.error(`Couldn't create ${errs} block${errs > 1 ? "s" : ""}`);
              else toast.success(inputs.length > 1 ? `${inputs.length} blocks created` : "Block created");
            }}
            trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1.5" />New block</Button>}
          />
        </div>
      </div>

      {/* Date label */}
      <div className="text-sm text-muted-foreground">
        {view === "day"
          ? dayLabel(cursor)
          : `${weekDays[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} — ${weekDays[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
        }
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
        {TIME_CATEGORIES.map(c => (
          <span key={c.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `hsl(${c.color})` }} />
            {c.label}
          </span>
        ))}
      </div>

      {/* Grid */}
      <Card className="surface p-0 shadow-none border overflow-hidden">
        <div className="overflow-x-auto">
          <div className="grid" style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(160px, 1fr))` }}>
            {/* Top: empty cell + day headers */}
            <div className="border-b border-border/60 bg-muted/30" />
            {days.map(d => {
              const isToday = toISO(d) === toISO(new Date());
              return (
                <div
                  key={d.toISOString()}
                  className={cn(
                    "px-3 py-2 text-center border-b border-l border-border/60 bg-muted/30",
                    view === "day" && "text-left"
                  )}
                >
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{dayName(d)}</div>
                  <div className={cn("font-display text-base", isToday && "text-accent")}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}

            {/* Hour rows + day columns */}
            <HourColumn />
            {days.map(d => (
              <DayColumn
                key={d.toISOString()}
                date={d}
                blocks={blocksForDate(blocks, d)}
                onUpdate={(id, patch) => updateBlock(id, patch)}
                onDelete={(id) => deleteBlock(id)}
                onCreateAt={(start, end) => {
                  // Quick create from drag-on-empty (kept simple: open dialog instead)
                  return createBlock({
                    title: "New block",
                    type: "variable",
                    block_date: toISO(d),
                    day_of_week: null,
                    start_time: minutesToTime(start),
                    end_time: minutesToTime(end),
                    category: "personal",
                    habit_id: null,
                  });
                }}
                allHabits={habits}
              />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function HourColumn() {
  const hours = [];
  for (let h = HOURS_START; h <= HOURS_END; h++) hours.push(h);
  return (
    <div className="border-r border-border/60">
      {hours.map(h => (
        <div key={h} style={{ height: HOUR_HEIGHT }} className="px-2 pt-1 text-[10px] text-muted-foreground text-right tabular-nums">
          {h === 12 ? "12 PM" : h < 12 ? `${h} AM` : h === 0 ? "12 AM" : `${h - 12} PM`}
        </div>
      ))}
    </div>
  );
}

interface DayColumnProps {
  date: Date;
  blocks: TimeBlock[];
  onUpdate: (id: string, patch: Partial<TimeBlock>) => void;
  onDelete: (id: string) => void;
  onCreateAt: (startMin: number, endMin: number) => void;
  allHabits: { id: string; name: string }[];
}

function DayColumn({ date, blocks, onUpdate, onDelete }: DayColumnProps) {
  const colRef = useRef<HTMLDivElement>(null);
  const conflicts = findConflicts(blocks);
  const totalMin = (HOURS_END - HOURS_START + 1) * 60;
  const totalH = totalMin / 60 * HOUR_HEIGHT;

  const minutesFromY = (y: number) => HOURS_START * 60 + (y / HOUR_HEIGHT) * 60;
  const snap = (min: number) => Math.round(min / SNAP_MIN) * SNAP_MIN;

  // Drag state
  const dragRef = useRef<{
    id: string;
    mode: "move" | "resize-end";
    startY: number;
    origStart: number;
    origEnd: number;
  } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [tempBlock, setTempBlock] = useState<{ id: string; start: number; end: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent, b: TimeBlock, mode: "move" | "resize-end") => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      id: b.id, mode,
      startY: e.clientY,
      origStart: timeToMinutes(b.start_time),
      origEnd: timeToMinutes(b.end_time),
    };
    setDragging(b.id);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const deltaMin = ((e.clientY - d.startY) / HOUR_HEIGHT) * 60;
    if (d.mode === "move") {
      let s = snap(d.origStart + deltaMin);
      let en = s + (d.origEnd - d.origStart);
      if (s < HOURS_START * 60) { s = HOURS_START * 60; en = s + (d.origEnd - d.origStart); }
      if (en > (HOURS_END + 1) * 60) { en = (HOURS_END + 1) * 60; s = en - (d.origEnd - d.origStart); }
      setTempBlock({ id: d.id, start: s, end: en });
    } else {
      let en = snap(d.origEnd + deltaMin);
      en = Math.max(d.origStart + SNAP_MIN, Math.min((HOURS_END + 1) * 60, en));
      setTempBlock({ id: d.id, start: d.origStart, end: en });
    }
  };
  const onPointerUp = () => {
    const d = dragRef.current;
    const t = tempBlock;
    if (d && t) {
      onUpdate(d.id, { start_time: minutesToTime(t.start), end_time: minutesToTime(t.end) });
    }
    dragRef.current = null;
    setDragging(null);
    setTempBlock(null);
  };

  return (
    <div
      ref={colRef}
      className="relative border-l border-border/60"
      style={{ height: totalH }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Hour grid lines */}
      {Array.from({ length: HOURS_END - HOURS_START + 1 }, (_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-border/40"
          style={{ top: i * HOUR_HEIGHT }}
        />
      ))}

      {blocks.map(b => {
        const isTemp = tempBlock?.id === b.id;
        const startMin = isTemp ? tempBlock!.start : timeToMinutes(b.start_time);
        const endMin = isTemp ? tempBlock!.end : timeToMinutes(b.end_time);
        const top = ((startMin - HOURS_START * 60) / 60) * HOUR_HEIGHT;
        const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
        const conflict = conflicts.has(b.id);
        const color = categoryColor(b.category);
        const completed = b.is_completed;

        return (
          <div
            key={b.id}
            className={cn(
              "absolute left-1 right-1 rounded-lg p-2 text-xs cursor-grab select-none transition-shadow",
              "border backdrop-blur-sm",
              dragging === b.id && "cursor-grabbing shadow-lift z-20",
              conflict ? "ring-1 ring-destructive/60" : "",
            )}
            style={{
              top, height, minHeight: 24,
              backgroundColor: completed ? `${color}33` : `${color}22`,
              borderColor: color,
              color: "hsl(var(--foreground))",
            }}
            onPointerDown={(e) => onPointerDown(e, b, "move")}
          >
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0 flex-1">
                <div className={cn("font-medium truncate", completed && "line-through opacity-70")}>
                  {b.title}
                  {b.type === "fixed" && <span className="ml-1 text-[10px] opacity-60">↻</span>}
                </div>
                <div className="text-[10px] opacity-70 truncate">
                  {formatTimeLabel(b.start_time)} – {formatTimeLabel(b.end_time)}
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {conflict && <AlertTriangle className="h-3 w-3 text-destructive" />}
                <button
                  className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center transition shrink-0",
                    completed ? "bg-foreground border-foreground" : "border-border bg-background/50",
                  )}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onUpdate(b.id, { is_completed: !completed }); }}
                  title="Mark complete"
                >
                  {completed && <Check className="h-2.5 w-2.5 text-background" strokeWidth={3} />}
                </button>
                <BlockMenu block={b} onDelete={() => onDelete(b.id)} />
              </div>
            </div>
            {/* Resize handle */}
            <div
              className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize"
              onPointerDown={(e) => onPointerDown(e, b, "resize-end")}
            />
          </div>
        );
      })}

      {blocks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          No blocks
        </div>
      )}
    </div>
  );
}

function BlockMenu({ block, onDelete }: { block: TimeBlock; onDelete: () => void }) {
  const { updateBlock } = useTimetable();
  return (
    <div className="flex items-center gap-0.5">
      <TimeBlockDialog
        initial={block}
        onSubmit={async (inputs) => { await updateBlock(block.id, inputs[0] as Partial<TimeBlock>); }}
        trigger={
          <button
            className="h-4 w-4 flex items-center justify-center text-foreground/60 hover:text-foreground"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
        }
      />
      <button
        className="h-4 w-4 flex items-center justify-center text-foreground/60 hover:text-destructive"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
