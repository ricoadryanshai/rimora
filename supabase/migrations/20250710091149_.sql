
-- Add hero content fields to the site_settings table
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS hero_name TEXT NOT NULL DEFAULT 'John Doe',
ADD COLUMN IF NOT EXISTS hero_role TEXT NOT NULL DEFAULT 'Web Developer',
ADD COLUMN IF NOT EXISTS hero_intro TEXT NOT NULL DEFAULT 'A passionate Web Developer building modern and user-friendly experiences.';

-- Update existing row if it exists, or insert a new one
INSERT INTO public.site_settings (id, hero_name, hero_role, hero_intro)
VALUES (gen_random_uuid(), 'John Doe', 'Web Developer', 'A passionate Web Developer building modern and user-friendly experiences.')
ON CONFLICT (id) DO UPDATE SET
  hero_name = EXCLUDED.hero_name,
  hero_role = EXCLUDED.hero_role,
  hero_intro = EXCLUDED.hero_intro;
;
