ALTER TABLE public.word_replacements
  ADD COLUMN IF NOT EXISTS normalized_original_word TEXT
  GENERATED ALWAYS AS (LOWER(TRIM(original_word))) STORED;

WITH ranked_replacements AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY session_id, normalized_original_word
      ORDER BY created_at, id
    ) AS duplicate_rank
  FROM public.word_replacements
)
DELETE FROM public.word_replacements
WHERE id IN (
  SELECT id
  FROM ranked_replacements
  WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS word_replacements_session_normalized_word_key
  ON public.word_replacements (session_id, normalized_original_word);
