ALTER TABLE public.chapters
  ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX chapters_deleted_idx ON public.chapters (novel_id, deleted_at)
  WHERE deleted_at IS NOT NULL;
