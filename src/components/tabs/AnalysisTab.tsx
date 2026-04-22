import { useMemo, useState } from "react";
import { useHabitData } from "@/hooks/useHabitData";
import { useGoals, computeGoalProgress, GOAL_CATEGORIES } from "@/hooks/useGoals";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { colorVar, computeStreaks, toISO, fromISO } from "@/lib/habits";
import { Icon } from "@/components/Icon";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { Flame, TrendingUp, Target, Calendar as CalIcon, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

type Range = "7d" | "1m" | "6m" | "1y";
const RANGE_DAYS: Record<Range, number> = { "7d": 7, "1m": 30, "6m": 182, "1y": 365 };

export function AnalysisTab() {
  const { habits, completions } = useHabitData();
  const { goals, linkedHabitIds } = useGoals();
  const [range, setRange] = useState<Range>("1m");

  const days = RANGE_DAYS[range];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - (days - 1) * 86400000);

  const dateList = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < days; i++) {
      arr.push(toISO(new Date(start.getTime() + i * 86400000)));
    }
    return arr;
  }, [days, start]);

  const inRange = useMemo(
    () => completions.filter(c => c.completed_on >= toISO(start) && c.completed_on <= toISO(today)),
    [completions, start, today]
  );

  // Per-habit stats
  const habitStats = habits.map(h => {
    const all = completions.filter(c => c.habit_id === h.id).map(c => c.completed_on);
    const inR = inRange.filter(c => c.habit_id === h.id);
    const expected = (days / 7) * h.weekly_goal;
    const rate = expected > 0 ? Math.min(100, Math.round((inR.length / expected) * 100)) : 0;
    const { current, longest } = computeStreaks(all);
    return { habit: h, count: inR.length, rate, current, longest };
  });

  const overall = habitStats.length
    ? Math.round(habitStats.reduce((a, b) => a + b.rate, 0) / habitStats.length)
    : 0;

  const totalThisWeek = completions.filter(c => {
    const d = fromISO(c.completed_on);
    const diff = (today.getTime() - d.getTime()) / 86400000;
    return diff >= 0 && diff < 7;
  }).length;

  // Trend chart data
  const trendData = useMemo(() => {
    const grouping = days <= 31 ? "day" : "week";
    if (grouping === "day") {
      return dateList.map(d => ({
        label: fromISO(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: inRange.filter(c => c.completed_on === d).length,
      }));
    }
    const buckets: Record<string, number> = {};
    const order: string[] = [];
    dateList.forEach(d => {
      const date = fromISO(d);
      const monday = new Date(date);
      monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      const key = toISO(monday);
      if (!(key in buckets)) { buckets[key] = 0; order.push(key); }
      buckets[key] += inRange.filter(c => c.completed_on === d).length;
    });
    return order.map(k => ({
      label: fromISO(k).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: buckets[k],
    }));
  }, [dateList, inRange, days]);

  // Heatmap
  const heatmap = useMemo(() => {
    const end = today;
    const startH = new Date(end.getTime() - 364 * 86400000);
    const startMonday = new Date(startH);
    startMonday.setDate(startH.getDate() - ((startH.getDay() + 6) % 7));
    const weeks: { date: Date; iso: string; count: number }[][] = [];
    const cursor = new Date(startMonday);
    while (cursor <= end) {
      const week: { date: Date; iso: string; count: number }[] = [];
      for (let i = 0; i < 7; i++) {
        const iso = toISO(cursor);
        const count = completions.filter(c => c.completed_on === iso).length;
        week.push({ date: new Date(cursor), iso, count });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  }, [completions, today]);

  const maxHeat = Math.max(1, ...heatmap.flat().map(d => d.count));
  const heatLevel = (n: number) => {
    if (n === 0) return 0;
    const r = n / maxHeat;
    if (r > 0.75) return 4;
    if (r > 0.5) return 3;
    if (r > 0.25) return 2;
    return 1;
  };

  // ======== Goals analytics ========
  const goalsWithProgress = useMemo(() => goals.map(g => {
    const linked = linkedHabitIds(g.id);
    const { progress } = computeGoalProgress(g, linked, completions);
    const pct = Math.min(100, Math.round((progress / Math.max(1, g.target_value)) * 100));
    return { goal: g, progress, pct };
  }), [goals, linkedHabitIds, completions]);

  const goalCompletionRate = goalsWithProgress.length
    ? Math.round(goalsWithProgress.reduce((a, b) => a + b.pct, 0) / goalsWithProgress.length)
    : 0;

  const byCategory = GOAL_CATEGORIES.map(c => {
    const inCat = goalsWithProgress.filter(g => g.goal.category === c.key);
    const avg = inCat.length ? Math.round(inCat.reduce((a, b) => a + b.pct, 0) / inCat.length) : 0;
    return { label: c.label, value: avg, count: inCat.length };
  });

  const bestCategory = [...byCategory].filter(c => c.count > 0).sort((a, b) => b.value - a.value)[0];
  const worstCategory = [...byCategory].filter(c => c.count > 0).sort((a, b) => a.value - b.value)[0];

  return (
    <div className="space-y-6 animate-in-up">
      {/* Range tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl">Your patterns</h2>
          <p className="text-sm text-muted-foreground">A gentle look at your consistency.</p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList>
            <TabsTrigger value="7d">7 days</TabsTrigger>
            <TabsTrigger value="1m">1 month</TabsTrigger>
            <TabsTrigger value="6m">6 months</TabsTrigger>
            <TabsTrigger value="1y">1 year</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI icon={<TrendingUp />} label="Consistency" value={`${overall}%`} hint="across all habits" />
        <KPI icon={<CalIcon />} label="This week" value={`${totalThisWeek}`} hint="completions" />
        <KPI icon={<Target />} label="Active habits" value={`${habits.length}`} hint="being tracked" />
        <KPI
          icon={<Flame />}
          label="Best streak"
          value={`${Math.max(0, ...habitStats.map(s => s.longest))}`}
          hint="days in a row"
          accent
        />
      </div>

      {/* Trend chart */}
      <Card className="surface p-6 shadow-none border">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="font-display text-xl">Completion trend</h3>
          <span className="text-xs text-muted-foreground">{days <= 31 ? "Daily" : "Weekly"}</span>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {days <= 31 ? (
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            ) : (
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="value" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Per-habit breakdown */}
      <Card className="surface p-6 shadow-none border">
        <h3 className="font-display text-xl mb-4">By habit</h3>
        {habits.length === 0 ? (
          <p className="text-sm text-muted-foreground">Create a habit to see analytics.</p>
        ) : (
          <div className="space-y-4">
            {habitStats.map(({ habit: h, count, rate, current, longest }) => (
              <div key={h.id} className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: colorVar(h.color) }}
                  >
                    <Icon name={h.icon} className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium truncate">{h.name}</span>
                      <span className="text-sm tabular-nums" style={{ color: colorVar(h.color) }}>{rate}%</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex gap-3">
                      <span>{count} done</span>
                      <span className="flex items-center gap-1"><Flame className="h-3 w-3" />{current} current</span>
                      <span>best {longest}</span>
                    </div>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${rate}%`, backgroundColor: colorVar(h.color) }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* GOALS ANALYTICS */}
      {goals.length > 0 && (
        <>
          <div className="flex items-baseline gap-3 mt-10">
            <h3 className="font-display text-xl">Goals</h3>
            <span className="text-xs text-muted-foreground">progress across categories</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPI icon={<Trophy />} label="Goal progress" value={`${goalCompletionRate}%`} hint="average" />
            <KPI icon={<Target />} label="Active goals" value={`${goals.length}`} hint="tracking" />
            <KPI
              icon={<TrendingUp />}
              label="Strongest"
              value={bestCategory ? `${bestCategory.value}%` : "—"}
              hint={bestCategory?.label.toLowerCase() ?? "no data"}
              accent
            />
            <KPI
              icon={<TrendingUp />}
              label="Needs work"
              value={worstCategory ? `${worstCategory.value}%` : "—"}
              hint={worstCategory?.label.toLowerCase() ?? "no data"}
            />
          </div>

          <Card className="surface p-6 shadow-none border">
            <h3 className="font-display text-xl mb-4">Performance by category</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number) => `${v}%`}
                  />
                  <Bar dataKey="value" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="surface p-6 shadow-none border">
            <h3 className="font-display text-xl mb-4">By goal</h3>
            <div className="space-y-3">
              {goalsWithProgress.map(({ goal, progress, pct }) => (
                <div key={goal.id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                        {goal.category}
                      </span>
                      <span className="font-medium truncate">{goal.title}</span>
                    </div>
                    <span className="text-sm text-muted-foreground tabular-nums shrink-0">
                      {progress}/{goal.target_value} · <span className="text-foreground">{pct}%</span>
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              ))}
            </div>
          </Card>

          {(bestCategory || worstCategory) && (
            <Card className="surface p-6 shadow-none border bg-accent-soft/30">
              <h3 className="font-display text-xl mb-3">Insights</h3>
              <ul className="space-y-2 text-sm text-foreground/80">
                {bestCategory && bestCategory.count > 0 && (
                  <li>You're most consistent with <span className="font-medium text-foreground">{bestCategory.label.toLowerCase()} goals</span> ({bestCategory.value}%).</li>
                )}
                {worstCategory && worstCategory.count > 0 && worstCategory.label !== bestCategory?.label && (
                  <li><span className="font-medium text-foreground">{worstCategory.label}</span> goals could use a little more attention ({worstCategory.value}%).</li>
                )}
              </ul>
            </Card>
          )}
        </>
      )}

      {/* Heatmap */}
      <Card className="surface p-6 shadow-none border overflow-x-auto">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="font-display text-xl">Activity (last year)</h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>less</span>
            {[0, 1, 2, 3, 4].map(l => (
              <span key={l} className={cn("h-3 w-3 rounded-sm", `heat-${l}`)} />
            ))}
            <span>more</span>
          </div>
        </div>
        <div className="flex gap-1 min-w-max">
          {heatmap.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((d) => (
                <div
                  key={d.iso}
                  title={`${d.iso} — ${d.count} completion${d.count === 1 ? "" : "s"}`}
                  className={cn("h-3 w-3 rounded-sm transition", `heat-${heatLevel(d.count)}`)}
                />
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function KPI({ icon, label, value, hint, accent }: { icon: React.ReactNode; label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <Card className={cn("surface p-5 shadow-none border", accent && "bg-accent text-accent-foreground border-transparent")}>
      <div className={cn("flex items-center gap-2 text-xs uppercase tracking-wider mb-2", accent ? "opacity-80" : "text-muted-foreground")}>
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        {label}
      </div>
      <div className="font-display text-3xl tabular-nums">{value}</div>
      <div className={cn("text-xs mt-0.5", accent ? "opacity-80" : "text-muted-foreground")}>{hint}</div>
    </Card>
  );
}
