import { supabase } from "@/integrations/supabase/client";

export type WordReplacement = {
  id?: string;
  original_word: string;
  replacement_word: string;
};

export type SavedGlossaryRecord = {
  id: string;
  user_id: string;
  name: string;
  glossary_data: WordReplacement[];
  created_at: string;
  updated_at: string;
};

export async function listSavedGlossaries(): Promise<SavedGlossaryRecord[]> {
  const { data, error } = await supabase
    .from('saved_glossaries')
    .select('id, user_id, name, glossary_data, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as SavedGlossaryRecord[];
}

export async function createSavedGlossary(
  userId: string,
  name: string,
  glossaryData: WordReplacement[]
): Promise<SavedGlossaryRecord> {
  const { data, error } = await supabase
    .from('saved_glossaries')
    .insert({ user_id: userId, name, glossary_data: glossaryData })
    .select('id, user_id, name, glossary_data, created_at, updated_at')
    .single();

  if (error) throw error;
  return data as SavedGlossaryRecord;
}

export async function deleteSavedGlossary(id: string): Promise<void> {
  const { error } = await supabase.from('saved_glossaries').delete().eq('id', id);
  if (error) throw error;
}
