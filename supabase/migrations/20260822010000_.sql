ALTER TABLE public.profiles
  ADD COLUMN profile_number BIGINT GENERATED ALWAYS AS IDENTITY,
  ADD COLUMN user_id TEXT;

UPDATE public.profiles
SET user_id = profile_number::TEXT || to_char(created_at AT TIME ZONE 'UTC', 'HH24MISS')
WHERE user_id IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id),
  ADD CONSTRAINT profiles_profile_number_key UNIQUE (profile_number);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );

  UPDATE public.profiles
  SET user_id = profile_number::TEXT || to_char(created_at AT TIME ZONE 'UTC', 'HH24MISS')
  WHERE id = NEW.id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;