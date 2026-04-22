import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ProfileTab } from "@/components/tabs/ProfileTab";
import { CalendarTab } from "@/components/tabs/CalendarTab";
import { AnalysisTab } from "@/components/tabs/AnalysisTab";
import { JournalTab } from "@/components/tabs/JournalTab";
import { TimetableTab } from "@/components/tabs/TimetableTab";
import { GoalsTab } from "@/components/tabs/GoalsTab";
import { NotesTab } from "@/components/tabs/NotesTab";
import { TodoTab } from "@/components/tabs/TodoTab";
import { Flame, Moon, Sun, LogOut, User, Calendar, BarChart3, BookOpen, Clock, Target, StickyNote, CheckSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [name, setName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setName(data?.display_name ?? ""));
  }, [user]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/70 sticky top-0 z-30 backdrop-blur bg-background/80">
        <div className="container max-w-5xl flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center text-accent-foreground">
              <Flame className="h-4.5 w-4.5" />
            </div>
            <span className="font-display text-xl font-semibold">Hearth</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={signOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl py-8 sm:py-12">
        {/* Greeting */}
        <div className="mb-8">
          <p className="text-sm text-muted-foreground mb-1">{greeting()}</p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight">
            {name ? `Hello, ${name}.` : "Hello."}
          </h1>
        </div>

        <Tabs defaultValue="calendar" className="space-y-6">
          <TabsList className="bg-muted/60 p-1 rounded-xl h-auto flex-wrap justify-start">
            <TabsTrigger value="calendar" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-soft rounded-lg px-3 sm:px-4 py-2">
              <Calendar className="h-4 w-4" /> <span className="hidden sm:inline">Calendar</span>
            </TabsTrigger>
            <TabsTrigger value="journal" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-soft rounded-lg px-3 sm:px-4 py-2">
              <BookOpen className="h-4 w-4" /> <span className="hidden sm:inline">Journal</span>
            </TabsTrigger>
            <TabsTrigger value="timetable" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-soft rounded-lg px-3 sm:px-4 py-2">
              <Clock className="h-4 w-4" /> <span className="hidden sm:inline">Timetable</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-soft rounded-lg px-3 sm:px-4 py-2">
              <StickyNote className="h-4 w-4" /> <span className="hidden sm:inline">Notes</span>
            </TabsTrigger>
            <TabsTrigger value="todo" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-soft rounded-lg px-3 sm:px-4 py-2">
              <CheckSquare className="h-4 w-4" /> <span className="hidden sm:inline">To-Do</span>
            </TabsTrigger>
            <TabsTrigger value="goals" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-soft rounded-lg px-3 sm:px-4 py-2">
              <Target className="h-4 w-4" /> <span className="hidden sm:inline">Goals</span>
            </TabsTrigger>
            <TabsTrigger value="analysis" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-soft rounded-lg px-3 sm:px-4 py-2">
              <BarChart3 className="h-4 w-4" /> <span className="hidden sm:inline">Analysis</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-soft rounded-lg px-3 sm:px-4 py-2">
              <User className="h-4 w-4" /> <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar"><CalendarTab /></TabsContent>
          <TabsContent value="journal"><JournalTab /></TabsContent>
          <TabsContent value="timetable"><TimetableTab /></TabsContent>
          <TabsContent value="notes"><NotesTab /></TabsContent>
          <TabsContent value="todo"><TodoTab /></TabsContent>
          <TabsContent value="goals"><GoalsTab /></TabsContent>
          <TabsContent value="analysis"><AnalysisTab /></TabsContent>
          <TabsContent value="profile"><ProfileTab /></TabsContent>
        </Tabs>

        <footer className="text-center text-xs text-muted-foreground mt-16 pt-8 border-t border-border/60">
          Built gently. Small steps, every day.
        </footer>
      </main>
    </div>
  );
};

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

export default Index;
