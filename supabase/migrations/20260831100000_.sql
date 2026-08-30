CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  requested_username TEXT;
  base_username TEXT;
  candidate_username TEXT;
  suffix INTEGER := 0;
BEGIN
  requested_username := lower(trim(NEW.raw_user_meta_data ->> 'username'));
  base_username := regexp_replace(
    lower(regexp_replace(
      COALESCE(requested_username, NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1), 'reader'),
      '[^a-zA-Z0-9_]+', '_', 'g'
    )),
    '^_+|_+$', '', 'g'
  );
  base_username := left(COALESCE(NULLIF(base_username, ''), 'reader'), 32);
  candidate_username := base_username;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate_username) LOOP
    suffix := suffix + 1;
    candidate_username := left(base_username, 40 - length(suffix::TEXT) - 1) || '_' || suffix::TEXT;
  END LOOP;

  INSERT INTO public.profiles (id, email, full_name, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    candidate_username
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;