import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type SeparationMode = "paragraph" | "card";

export interface ChapterSession {
  id: string;
  user_id: string;
  title: string | null;
  original_text: string;
  paragraph_count: number;
  card_count: number | null;
  separation_mode: string | null;
  separated_cards: Json | null;
  created_at: string;
  updated_at: string;
}

export interface SessionPayload {
  title?: string | null;
  user_id: string;
  original_text: string;
  paragraph_count: number;
  card_count: number;
  separation_mode: SeparationMode;
  separated_cards: string[];
}

export const normalizeCards = (cards: Json | null): string[] => {
  if (!Array.isArray(cards)) return [];
  return cards.filter((card): card is string => typeof card === "string");
};

export const getSessionTitle = (session: Pick<ChapterSession, "title" | "original_text" | "updated_at">) => {
  if (session.title?.trim()) return session.title.trim();
  const firstLine = session.original_text.split("\n").find((line) => line.trim());
  if (firstLine) return firstLine.trim().slice(0, 60);
  return `Session ${new Date(session.updated_at).toLocaleDateString()}`;
};

export const listChapterSessions = async (userId: string) => {
  const { data, error } = await supabase
    .from("chapter_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []) as ChapterSession[];
};

export const getLatestChapterSession = async (userId: string) => {
  const { data, error } = await supabase
    .from("chapter_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as ChapterSession | null;
};

export const saveChapterSession = async (sessionId: string | null, payload: SessionPayload) => {
  const data = {
    ...payload,
    title: payload.title?.trim() || null,
    separated_cards: payload.separated_cards,
    updated_at: new Date().toISOString(),
  };

  const result = sessionId
    ? await supabase
        .from("chapter_sessions")
        .update(data)
        .eq("id", sessionId)
        .eq("user_id", payload.user_id)
        .select()
        .single()
    : await supabase
        .from("chapter_sessions")
        .insert(data)
        .select()
        .single();

  if (result.error) throw result.error;
  return result.data as ChapterSession;
};

export const renameChapterSession = async (id: string, userId: string, title: string) => {
  const { data, error } = await supabase
    .from("chapter_sessions")
    .update({ title: title.trim(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as ChapterSession;
};

export const deleteChapterSession = async (id: string, userId: string) => {
  const { error } = await supabase
    .from("chapter_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
};

export const duplicateChapterSession = async (session: ChapterSession, userId: string) => {
  const title = `${getSessionTitle(session)} copy`.slice(0, 100);
  return saveChapterSession(null, {
    title,
    user_id: userId,
    original_text: session.original_text,
    paragraph_count: session.paragraph_count,
    card_count: session.card_count || session.paragraph_count || 10,
    separation_mode: (session.separation_mode as SeparationMode) || "paragraph",
    separated_cards: normalizeCards(session.separated_cards),
  });
};
