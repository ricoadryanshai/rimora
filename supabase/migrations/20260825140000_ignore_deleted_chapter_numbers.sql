ALTER TABLE public.chapters
  DROP CONSTRAINT IF EXISTS chapters_novel_id_chapter_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS chapters_active_number_key
  ON public.chapters (novel_id, chapter_number)
  WHERE deleted_at IS NULL;