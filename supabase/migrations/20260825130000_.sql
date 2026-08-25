ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS author_thoughts TEXT NOT NULL DEFAULT '';
