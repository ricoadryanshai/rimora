
-- Create a table to store find and replace word pairs
CREATE TABLE public.word_replacements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.chapter_sessions(id) ON DELETE CASCADE,
  original_word TEXT NOT NULL,
  replacement_word TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS)
ALTER TABLE public.word_replacements ENABLE ROW LEVEL SECURITY;

-- Create policy that allows users to view word replacements for their own sessions
CREATE POLICY "Users can view their own word replacements" 
  ON public.word_replacements 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.chapter_sessions cs 
      WHERE cs.id = word_replacements.session_id 
      AND cs.user_id = auth.uid()
    )
  );

-- Create policy that allows users to insert word replacements for their own sessions
CREATE POLICY "Users can create word replacements for their own sessions" 
  ON public.word_replacements 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chapter_sessions cs 
      WHERE cs.id = word_replacements.session_id 
      AND cs.user_id = auth.uid()
    )
  );

-- Create policy that allows users to update word replacements for their own sessions
CREATE POLICY "Users can update their own word replacements" 
  ON public.word_replacements 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.chapter_sessions cs 
      WHERE cs.id = word_replacements.session_id 
      AND cs.user_id = auth.uid()
    )
  );

-- Create policy that allows users to delete word replacements for their own sessions
CREATE POLICY "Users can delete their own word replacements" 
  ON public.word_replacements 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.chapter_sessions cs 
      WHERE cs.id = word_replacements.session_id 
      AND cs.user_id = auth.uid()
    )
  );
;
