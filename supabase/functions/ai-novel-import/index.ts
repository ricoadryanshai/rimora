import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const extractJson = (value: string) => {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  const candidate = fenced || value.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) throw new Error("AI returned no structured novel information.");
  return JSON.parse(candidate);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ success: false, error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ success: false, error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) return json({ success: false, error: "URL is required" }, 400);
    new URL(url);

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const endpoint = Deno.env.get("AI_API_ENDPOINT");
    const apiKey = Deno.env.get("AI_API_KEY");
    const model = Deno.env.get("AI_API_MODEL");
    if (!firecrawlKey || !endpoint || !apiKey || !model) {
      return json({ success: false, error: "AI import is not configured on the server." }, 500);
    }

    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    const scraped = await scrapeResponse.json();
    if (!scrapeResponse.ok) return json({ success: false, error: scraped?.error || "Firecrawl scrape failed." }, 502);

    const markdown = scraped?.data?.markdown || scraped?.markdown || "";
    if (!markdown.trim()) return json({ success: false, error: "No readable content was found at that URL." }, 422);

    const prompt = `Extract form data from the novel information page below. The user's system language is English. Return ONLY valid JSON with string fields title, translationTitle, author, originalLanguage, genre, coverUrl, originalPlatform, abbreviation, length, description, warningNotice, translationLanguage, translator, translatorGroup, plus a string array missingFields. Every field is optional: use an empty string when the page does not provide enough information, and add that field's exact name to missingFields. Never invent details.\n\nRules:\n- title: the title in the source language (Original Title).\n- translationTitle: translate the original title into English.\n- author: the author's name in the original language.\n- leadingGender: infer Male-Oriented or Female-Oriented only when the synopsis supports it; otherwise leave it empty.\n- coverUrl: extract the available book cover image URL.\n- abbreviation: create an abbreviation using translated-language characters, never original-language characters.\n- length: determine Novel, Short Story, or Super-Short Story from the chapter count when available; otherwise leave it empty.\n- description: translate the synopsis into English.\n- warningNotice: determine it from the synopsis only when supported; otherwise leave it empty.\n- originalLanguage, genre, translationLanguage, translator, translatorGroup, and originalPlatform: extract only when explicitly available.\n- Do not auto-submit or omit missingFields.\n\nSOURCE URL: ${url}\n\nPAGE CONTENT:\n${markdown.slice(0, 60000)}`;
    const aiResponse = await fetch(`${endpoint.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: false, temperature: 0.1, messages: [{ role: "system", content: "You extract structured novel metadata accurately." }, { role: "user", content: prompt }] }),
    });
    const aiData = await aiResponse.json();
    if (!aiResponse.ok) return json({ success: false, error: `AI provider error (${aiResponse.status}).` }, 502);

    const content = aiData?.choices?.[0]?.message?.content;
    const novel = extractJson(typeof content === "string" ? content : "");
    return json({
      success: true,
      novel: { ...novel, originalPlatform: novel.originalPlatform || url },
      missingFields: Array.isArray(novel.missingFields) ? novel.missingFields : [],
    });
  } catch (error) {
    console.error("ai-novel-import error", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Import failed." }, 500);
  }
});