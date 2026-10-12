import { rimora } from "@/lib/rimora";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

export type PublishedNovel = {
  id: string;
  title: string;
  translation_title: string | null;
  novel_type: string;
  cover_url: string | null;
  description: string | null;
  status: string;
};

export const EXPLORE_PAGE_SIZE = 24;

export const fetchPublishedNovels = async (page: number) => {
  if (!isSupabaseConfigured) {
    throw new Error("The story shelf is temporarily unavailable. Please try again later.");
  }
  const { data, error, count } = await rimora
    .from("novels")
    .select("id,title,translation_title,novel_type,cover_url,description,status", { count: "exact" })
    .eq("visibility", "public")
    .neq("status", "draft")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .order("id", { ascending: true })
    .range(page * EXPLORE_PAGE_SIZE, (page + 1) * EXPLORE_PAGE_SIZE - 1);

  if (error) throw error;
  return { novels: (data ?? []) as PublishedNovel[], total: count ?? 0 };
};
