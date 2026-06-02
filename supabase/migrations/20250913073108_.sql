-- Enable and enforce RLS on critical tables
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.saved_glossaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saved_glossaries FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.chapter_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chapter_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.word_replacements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.word_replacements FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.role_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_audit_log FORCE ROW LEVEL SECURITY;

-- Add updated_at triggers where applicable
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_updated_at'
  ) THEN
    CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_saved_glossaries_updated_at'
  ) THEN
    CREATE TRIGGER trg_saved_glossaries_updated_at
    BEFORE UPDATE ON public.saved_glossaries
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_chapter_sessions_updated_at'
  ) THEN
    CREATE TRIGGER trg_chapter_sessions_updated_at
    BEFORE UPDATE ON public.chapter_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Validate inputs for word_replacements on write
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_word_replacements_validate'
  ) THEN
    CREATE TRIGGER trg_word_replacements_validate
    BEFORE INSERT OR UPDATE ON public.word_replacements
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_word_replacement_trigger();
  END IF;
END $$;

-- Enforce role assignment validation and audit changes in user_roles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_roles_validate'
  ) THEN
    CREATE TRIGGER trg_user_roles_validate
    BEFORE INSERT OR UPDATE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_role_assignment();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_roles_audit'
  ) THEN
    CREATE TRIGGER trg_user_roles_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_role_changes();
  END IF;
END $$;
;
