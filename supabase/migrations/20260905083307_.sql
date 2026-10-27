DELETE FROM public.glossary_entries duplicate
USING public.glossary_entries keeper
WHERE duplicate.novel_id IS NOT DISTINCT FROM keeper.novel_id
  AND lower(trim(duplicate.source_term)) = lower(trim(keeper.source_term))
  AND duplicate.id > keeper.id;

CREATE UNIQUE INDEX IF NOT EXISTS glossary_entries_novel_source_term_unique
  ON public.glossary_entries (novel_id, lower(trim(source_term)));