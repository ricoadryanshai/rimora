import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getAiProviders, providerEndpoint, type AiProvider } from "../_shared/ai-provider.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const TIMEOUT_MS = 3 * 60 * 1000;
type Chapter = { chapterNumber: number; title: string; content: string[]; authorThoughts: string };
const parseChapter = (value: string): Chapter => {
  const parsed = JSON.parse(value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  if (!parsed || !Number.isInteger(parsed.chapterNumber) || typeof parsed.title !== "string" || !Array.isArray(parsed.content) || !parsed.content.every((line: unknown) => typeof line === "string") || typeof parsed.authorThoughts !== "string") throw new Error("AI returned an invalid chapter structure");
  return parsed as Chapter;
};
const translate = async (provider: AiProvider, chapter: Chapter, originalLanguage: string, targetLanguage: string, signal: AbortSignal) => {
  const response = await fetch(providerEndpoint(provider.endpoint), {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` }, signal,
    body: JSON.stringify({ model: provider.model, stream: false, temperature: 0, messages: [
      { role: "system", content: `You are a professional literary translator. Translate this complete chapter from ${originalLanguage} into ${targetLanguage}. Return ONLY valid JSON with exactly chapterNumber, title, content, and authorThoughts. Keep chapterNumber unchanged. Translate the title using the story context in the full content. Preserve the exact content array length and order; never merge, split, omit, or add lines. Preserve empty lines. Translate authorThoughts when non-empty and preserve its paragraph breaks. Do not add explanations, markdown fences, or extra fields.` },
      { role: "user", content: JSON.stringify(chapter) },
    ] }),
  });
  if (!response.ok) throw new Error(`Provider error (${response.status})`);
  const payload = await response.json();
  return parseChapter(payload?.choices?.[0]?.message?.content ?? "");
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => null);
    const chapter: Chapter = { chapterNumber: body?.chapterNumber, title: body?.title, content: body?.content, authorThoughts: body?.authorThoughts ?? "" };
    if (!Number.isInteger(chapter.chapterNumber) || typeof chapter.title !== "string" || !Array.isArray(chapter.content) || !chapter.content.every((line: unknown) => typeof line === "string") || typeof chapter.authorThoughts !== "string" || !chapter.content.some((line) => line.trim())) return json({ error: "A valid chapter is required" }, 400);
    const originalLanguage = typeof body?.originalLanguage === "string" ? body.originalLanguage : "source language";
    const targetLanguage = typeof body?.targetLanguage === "string" && body.targetLanguage.trim() ? body.targetLanguage.trim() : "English";
    const providers = getAiProviders();
    if (!providers.length) return json({ error: "AI translation is not configured on the server." }, 500);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      let translated: Chapter;
      try { translated = await translate(providers[0], chapter, originalLanguage, targetLanguage, controller.signal); }
      catch (error) { if (!providers[1]) throw error; translated = await translate(providers[1], chapter, originalLanguage, targetLanguage, controller.signal); }
      if (translated.chapterNumber !== chapter.chapterNumber || translated.content.length !== chapter.content.length) return json({ error: "AI returned a different chapter structure or content line count." }, 502);
      return json({ chapter: translated });
    } finally { clearTimeout(timeout); }
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Translation failed" }, 500); }
});
