import { rimora } from "@/lib/rimora";

export type NovelGlossaryEntry = {
  id: string;
  source_term: string;
  preferred_term: string;
};

// Supabase caps each response, so load every batch rather than assuming
// a single select contains the whole glossary.
export const fetchNovelGlossary = async (novelId: string, signal?: AbortSignal) => {
  const entries: NovelGlossaryEntry[] = [];
  const batchSize = 500;
  while (true) {
    let query = rimora
      .from("glossary_entries")
      .select("id,source_term,preferred_term", { count: "exact" })
      .eq("novel_id", novelId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(entries.length, entries.length + batchSize - 1);
    if (signal) query = query.abortSignal(signal);
    const { data, error, count } = await query;
    if (error) throw error;
    const batch = (data ?? []) as NovelGlossaryEntry[];
    entries.push(...batch);
    if (batch.length === 0 || (count !== null && entries.length >= count)) break;
  }
  return entries;
};
