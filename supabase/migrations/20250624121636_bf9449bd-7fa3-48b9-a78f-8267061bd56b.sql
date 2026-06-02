
-- Create a table for storing chapter separation data
CREATE TABLE public.chapter_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  original_text TEXT NOT NULL,
  paragraph_count INTEGER NOT NULL DEFAULT 5,
  separated_cards JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.chapter_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chapter_sessions
CREATE POLICY "Users can view their own chapter sessions" 
  ON public.chapter_sessions 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chapter sessions" 
  ON public.chapter_sessions 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chapter sessions" 
  ON public.chapter_sessions 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chapter sessions" 
  ON public.chapter_sessions 
  FOR DELETE 
  USING (auth.uid() = user_id);

CREATE POLICY "Super users can view all chapter sessions" 
  ON public.chapter_sessions 
  FOR SELECT 
  USING (public.has_role(auth.uid(), 'super_user'));
;
