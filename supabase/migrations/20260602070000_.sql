-- Keep privileged RLS helpers out of the API-exposed public schema.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE ALL ON FUNCTION private.has_role(UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(UUID, public.app_role) TO authenticated;

-- Preserve existing policy calls while avoiding an exposed SECURITY DEFINER RPC.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.has_role(_user_id, _role)
$$;

REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

-- Provision every new account with a least-privilege role exactly once.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Automated role creation has no authenticated request context.
CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.role_audit_log (user_id, changed_by, new_role, action)
    VALUES (NEW.user_id, COALESCE(auth.uid(), NEW.user_id), NEW.role, 'INSERT');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.role_audit_log (user_id, changed_by, old_role, new_role, action)
    VALUES (NEW.user_id, COALESCE(auth.uid(), NEW.user_id), OLD.role, NEW.role, 'UPDATE');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.role_audit_log (user_id, changed_by, old_role, new_role, action)
    VALUES (OLD.user_id, COALESCE(auth.uid(), OLD.user_id), OLD.role, OLD.role, 'DELETE');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Remove duplicate legacy trigger aliases so each write is validated and audited once.
DROP TRIGGER IF EXISTS trg_word_replacements_validate ON public.word_replacements;
DROP TRIGGER IF EXISTS trg_user_roles_validate ON public.user_roles;
DROP TRIGGER IF EXISTS trg_user_roles_audit ON public.user_roles;

-- Ensure every existing account has a least-privilege default role.
INSERT INTO public.user_roles (user_id, role)
SELECT users.id, 'user'::public.app_role
FROM auth.users AS users
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_roles AS roles
  WHERE roles.user_id = users.id
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Orphaned replacements cannot belong to a user and are not usable by the app.
DELETE FROM public.word_replacements
WHERE session_id IS NULL;

ALTER TABLE public.word_replacements
  ALTER COLUMN session_id SET NOT NULL;

-- Trigger-only and internal helpers must not be callable through the API.
REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_role_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_role_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_word_replacement_input(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_word_replacement_trigger() FROM PUBLIC, anon, authenticated;
