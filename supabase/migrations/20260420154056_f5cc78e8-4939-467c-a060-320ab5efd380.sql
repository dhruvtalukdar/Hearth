-- =========================================
-- JOURNAL ENTRIES
-- =========================================
CREATE TABLE public.journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entry_date DATE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  reflect_on_habits BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own journal" ON public.journal_entries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own journal" ON public.journal_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own journal" ON public.journal_entries
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own journal" ON public.journal_entries
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_journal_entries_updated
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_journal_entries_user_date ON public.journal_entries (user_id, entry_date DESC);

-- =========================================
-- TIME BLOCKS
-- =========================================
CREATE TABLE public.time_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'variable', -- 'fixed' | 'variable'
  block_date DATE,                        -- for variable
  day_of_week SMALLINT,                   -- 0-6 (Sun..Sat) for fixed/recurring
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  category TEXT NOT NULL DEFAULT 'work',
  habit_id UUID REFERENCES public.habits(id) ON DELETE SET NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.time_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own blocks" ON public.time_blocks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own blocks" ON public.time_blocks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own blocks" ON public.time_blocks
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own blocks" ON public.time_blocks
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_time_blocks_updated
  BEFORE UPDATE ON public.time_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Validation trigger: end_time > start_time, and exactly one of block_date / day_of_week
CREATE OR REPLACE FUNCTION public.validate_time_block()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'end_time must be after start_time';
  END IF;
  IF NEW.type = 'fixed' AND NEW.day_of_week IS NULL THEN
    RAISE EXCEPTION 'fixed blocks require day_of_week';
  END IF;
  IF NEW.type = 'variable' AND NEW.block_date IS NULL THEN
    RAISE EXCEPTION 'variable blocks require block_date';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_time_blocks_validate
  BEFORE INSERT OR UPDATE ON public.time_blocks
  FOR EACH ROW EXECUTE FUNCTION public.validate_time_block();

CREATE INDEX idx_time_blocks_user_date ON public.time_blocks (user_id, block_date);
CREATE INDEX idx_time_blocks_user_dow ON public.time_blocks (user_id, day_of_week);

-- =========================================
-- GOALS
-- =========================================
CREATE TABLE public.goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'weekly', -- daily|weekly|monthly|quarterly
  target_value INTEGER NOT NULL DEFAULT 1,
  current_progress INTEGER NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own goals" ON public.goals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own goals" ON public.goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own goals" ON public.goals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own goals" ON public.goals
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_goals_updated
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- GOAL_HABITS join table
-- =========================================
CREATE TABLE public.goal_habits (
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (goal_id, habit_id)
);

ALTER TABLE public.goal_habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own goal_habits" ON public.goal_habits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own goal_habits" ON public.goal_habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own goal_habits" ON public.goal_habits
  FOR DELETE USING (auth.uid() = user_id);