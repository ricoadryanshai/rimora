
-- Create a table to store site customization settings
CREATE TABLE public.site_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_name text NOT NULL DEFAULT 'RicoDev',
  site_logo_url text,
  primary_color text NOT NULL DEFAULT '#38bdf8',
  secondary_color text NOT NULL DEFAULT '#0f172a',
  background_color text NOT NULL DEFAULT '#f8fafc',
  text_color text NOT NULL DEFAULT '#1e293b',
  font_family text NOT NULL DEFAULT 'Inter',
  hero_title text NOT NULL DEFAULT 'Full Stack Developer',
  hero_subtitle text NOT NULL DEFAULT 'Building modern web applications with passion and precision',
  hero_description text NOT NULL DEFAULT 'I create beautiful, functional, and user-friendly web experiences using cutting-edge technologies.',
  about_content text,
  contact_email text,
  social_github text,
  social_linkedin text,
  social_twitter text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for site_settings
CREATE POLICY "Super users can view site settings" 
  ON public.site_settings 
  FOR SELECT 
  USING (has_role(auth.uid(), 'super_user'::app_role));

CREATE POLICY "Super users can update site settings" 
  ON public.site_settings 
  FOR UPDATE 
  USING (has_role(auth.uid(), 'super_user'::app_role));

CREATE POLICY "Super users can insert site settings" 
  ON public.site_settings 
  FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'super_user'::app_role));

CREATE POLICY "Anyone can view basic site settings for public display" 
  ON public.site_settings 
  FOR SELECT 
  USING (true);

-- Insert default settings
INSERT INTO public.site_settings (
  site_name, 
  primary_color, 
  secondary_color, 
  hero_title, 
  hero_subtitle, 
  hero_description
) VALUES (
  'RicoDev',
  '#38bdf8',
  '#0f172a', 
  'Full Stack Developer',
  'Building modern web applications with passion and precision',
  'I create beautiful, functional, and user-friendly web experiences using cutting-edge technologies.'
);
;
