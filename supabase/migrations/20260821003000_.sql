ALTER TABLE public.novels
  ADD COLUMN translation_title TEXT,
  ADD COLUMN translation_language TEXT,
  ADD COLUMN translator TEXT,
  ADD COLUMN translator_group TEXT;