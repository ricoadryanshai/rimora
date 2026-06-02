-- Security Fix 1: Strengthen Role-Based Access Control
-- Drop existing policies that allow users to manage their own roles
DROP POLICY IF EXISTS "Super users can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super users can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Create more restrictive policies
-- Only super users can insert/update/delete roles
CREATE POLICY "Only super users can insert roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_user'::app_role));

CREATE POLICY "Only super users can update roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_user'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_user'::app_role));

CREATE POLICY "Only super users can delete roles" ON public.user_roles
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'super_user'::app_role));

-- Super users can view all roles, regular users can view their own
CREATE POLICY "Super users can view all roles" ON public.user_roles
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_user'::app_role));

CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id AND NOT has_role(auth.uid(), 'super_user'::app_role));

-- Security Fix 2: Secure Database Functions with proper search_path
-- Update has_role function with secure search_path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

-- Update get_current_user_role function with secure search_path
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$function$;

-- Security Fix 3: Add constraints to prevent privilege escalation
-- Add a constraint to ensure only super users can create super user roles
CREATE OR REPLACE FUNCTION public.validate_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- If trying to assign super_user role, only allow if current user is super_user
  IF NEW.role = 'super_user'::app_role THEN
    IF NOT has_role(auth.uid(), 'super_user'::app_role) THEN
      RAISE EXCEPTION 'Only super users can assign super user roles';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for role validation
DROP TRIGGER IF EXISTS validate_role_assignment_trigger ON public.user_roles;
CREATE TRIGGER validate_role_assignment_trigger
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_role_assignment();

-- Security Fix 4: Add audit logging for role changes
CREATE TABLE IF NOT EXISTS public.role_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  old_role app_role,
  new_role app_role NOT NULL,
  action text NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.role_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super users can view audit logs
CREATE POLICY "Super users can view audit logs" ON public.role_audit_log
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_user'::app_role));

-- Create audit trigger function
CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.role_audit_log (user_id, changed_by, new_role, action)
    VALUES (NEW.user_id, auth.uid(), NEW.role, 'INSERT');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.role_audit_log (user_id, changed_by, old_role, new_role, action)
    VALUES (NEW.user_id, auth.uid(), OLD.role, NEW.role, 'UPDATE');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.role_audit_log (user_id, changed_by, old_role, action)
    VALUES (OLD.user_id, auth.uid(), OLD.role, 'DELETE');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- Create audit trigger
DROP TRIGGER IF EXISTS audit_role_changes_trigger ON public.user_roles;
CREATE TRIGGER audit_role_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_role_changes();;
