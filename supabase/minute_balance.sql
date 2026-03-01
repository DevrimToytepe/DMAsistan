CREATE TABLE IF NOT EXISTS public.minute_balance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  total_minutes integer DEFAULT 0,
  used_minutes integer DEFAULT 0,
  last_updated timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.minute_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own minute balance"
  ON public.minute_balance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own minute balance"
  ON public.minute_balance FOR UPDATE
  USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own minute balance"
  ON public.minute_balance FOR INSERT
  WITH CHECK (auth.uid() = user_id);
