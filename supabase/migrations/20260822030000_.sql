ALTER TABLE public.profiles
  ADD COLUMN username TEXT;

UPDATE public.profiles
SET username = lower(regexp_replace(COALESCE(full_name, split_part(email, '@', 1), 'reader'), '[^a-zA-Z0-9_]+', '_', 'g'))
WHERE username IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN username SET NOT NULL,
  ADD CONSTRAINT profiles_username_key UNIQUE (username),
  ADD CONSTRAINT profiles_username_format_check CHECK (username ~ '^[a-zA-Z0-9_]{1,40}$');