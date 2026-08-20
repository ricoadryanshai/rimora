CREATE TYPE public.novel_status AS ENUM ('draft', 'ongoing', 'completed', 'hiatus');
CREATE TYPE public.novel_visibility AS ENUM ('private', 'unlisted', 'public');
CREATE TYPE public.chapter_status AS ENUM ('draft', 'published');

CREATE TABLE public.novels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 160),
  description TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  status public.novel_status NOT NULL DEFAULT 'draft',
  visibility public.novel_visibility NOT NULL DEFAULT 'private',
  genres TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id UUID NOT NULL REFERENCES public.novels(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  chapter_number INTEGER NOT NULL CHECK (chapter_number > 0),
  content TEXT NOT NULL DEFAULT '',
  source_content TEXT,
  source_url TEXT,
  source_attribution TEXT,
  status public.chapter_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  UNIQUE (novel_id, chapter_number)
);

CREATE TABLE public.glossary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  novel_id UUID REFERENCES public.novels(id) ON DELETE CASCADE,
  source_term TEXT NOT NULL,
  preferred_term TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'term',
  definition TEXT NOT NULL DEFAULT '',
  source_language TEXT NOT NULL DEFAULT 'en',
  target_language TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.library_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  novel_id UUID NOT NULL REFERENCES public.novels(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('saved', 'favorite', 'followed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, novel_id, entry_type)
);

CREATE TABLE public.reading_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  novel_id UUID NOT NULL REFERENCES public.novels(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, novel_id)
);

CREATE INDEX novels_public_idx ON public.novels (updated_at DESC) WHERE visibility = 'public';
CREATE INDEX chapters_novel_idx ON public.chapters (novel_id, chapter_number);

ALTER TABLE public.novels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glossary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can discover public novels" ON public.novels FOR SELECT USING (visibility = 'public' OR auth.uid() = owner_id);
CREATE POLICY "Owners manage novels" ON public.novels FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Anyone can read published chapters" ON public.chapters FOR SELECT USING ((status = 'published' AND EXISTS (SELECT 1 FROM public.novels n WHERE n.id = novel_id AND n.visibility = 'public')) OR EXISTS (SELECT 1 FROM public.novels n WHERE n.id = novel_id AND n.owner_id = auth.uid()));
CREATE POLICY "Owners manage chapters" ON public.chapters FOR ALL USING (EXISTS (SELECT 1 FROM public.novels n WHERE n.id = novel_id AND n.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.novels n WHERE n.id = novel_id AND n.owner_id = auth.uid()));
CREATE POLICY "Users manage own glossary" ON public.glossary_entries FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users manage own library" ON public.library_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own progress" ON public.reading_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER novels_updated_at BEFORE UPDATE ON public.novels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER chapters_updated_at BEFORE UPDATE ON public.chapters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER glossary_entries_updated_at BEFORE UPDATE ON public.glossary_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();