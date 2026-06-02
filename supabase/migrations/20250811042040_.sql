-- Add card_count and separation_mode columns to chapter_sessions table
ALTER TABLE public.chapter_sessions 
ADD COLUMN card_count integer DEFAULT 10,
ADD COLUMN separation_mode text DEFAULT 'paragraph';;
