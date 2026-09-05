CREATE TABLE public.chapter_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id UUID NOT NULL REFERENCES public.novels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  range_from INTEGER,
  range_to INTEGER,
  skip_glossary BOOLEAN NOT NULL DEFAULT false,
  skip_translation BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'discovering_links', 'processing', 'completed', 'completed_with_errors', 'cancelled')),
  total_chapters INTEGER NOT NULL DEFAULT 0,
  completed_chapters INTEGER NOT NULL DEFAULT 0,
  failed_chapters INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE public.chapter_import_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.chapter_import_jobs(id) ON DELETE CASCADE,
  novel_id UUID NOT NULL REFERENCES public.novels(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL CHECK (chapter_number > 0),
  source_url TEXT NOT NULL,
  discovered_title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (job_id, chapter_number),
  UNIQUE (job_id, source_url)
);

CREATE INDEX chapter_import_items_pending_idx ON public.chapter_import_items (job_id, status, chapter_number);

ALTER TABLE public.chapter_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_import_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own import jobs" ON public.chapter_import_jobs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own import items" ON public.chapter_import_items FOR ALL USING (EXISTS (SELECT 1 FROM public.chapter_import_jobs j WHERE j.id = job_id AND j.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.chapter_import_jobs j WHERE j.id = job_id AND j.user_id = auth.uid()));

CREATE TRIGGER chapter_import_jobs_updated_at BEFORE UPDATE ON public.chapter_import_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
