-- Remove unused portfolio tables to reduce attack surface
-- These tables appear to be remnants from a different application
-- and are not used in the current word replacement tool

DROP TABLE IF EXISTS public.portfolio_skills CASCADE;
DROP TABLE IF EXISTS public.portfolio_projects CASCADE; 
DROP TABLE IF EXISTS public.portfolio_profiles CASCADE;
DROP TABLE IF EXISTS public.portfolio_settings CASCADE;;
