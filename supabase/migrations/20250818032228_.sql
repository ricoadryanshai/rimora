-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Defense in depth: revoke any direct anon privileges on the table
REVOKE ALL ON TABLE public.profiles FROM anon;
-- Ensure authenticated role has required privileges
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

-- Recreate RLS policies with explicit role scoping to authenticated
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Super users can view all profiles" ON public.profiles;
CREATE POLICY "Super users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_user'::app_role));;
