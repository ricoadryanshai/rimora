ALTER TABLE public.chapter_sessions
ADD COLUMN IF NOT EXISTS title TEXT;

ALTER TABLE public.chapter_sessions
ADD CONSTRAINT chapter_sessions_title_length
CHECK (title IS NULL OR char_length(title) <= 100);
