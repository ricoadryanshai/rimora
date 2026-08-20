ALTER TABLE public.novels
  ADD COLUMN novel_type TEXT NOT NULL DEFAULT 'Novel',
  ADD COLUMN leading_gender TEXT NOT NULL DEFAULT 'Male-Oriented',
  ADD COLUMN genre TEXT NOT NULL DEFAULT 'Fantasy',
  ADD COLUMN length TEXT NOT NULL DEFAULT 'Novel',
  ADD COLUMN abbreviation TEXT NOT NULL DEFAULT '' CHECK (char_length(abbreviation) <= 15);

ALTER TABLE public.novels
  ADD CONSTRAINT novels_metadata_values_check CHECK (
    novel_type IN ('Novel', 'Fanfic', 'Translation')
    AND leading_gender IN ('Male-Oriented', 'Female-Oriented')
    AND length IN ('Novel', 'Short Story', 'Super-Short Story')
  );