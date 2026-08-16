import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decryptSecret } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MAX_CHARS = 60000;
const MAX_ENTRIES = 500;

type GlossaryEntry = {
  original_word: string;
  replacement_word: string;
};

const isGlossaryEntry = (value: unknown): value is GlossaryEntry => {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.original_word === "string" &&
    typeof entry.replacement_word === "string" &&
    entry.original_word.trim().length > 0 &&
    entry.original_word.trim().length <= 500 &&
    entry.replacement_word.trim().length > 0 &&
    entry.replacement_word.trim().length <= 500
  );
};

const parseEntries = (content: string): GlossaryEntry[] => {
  const normalizedContent = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed = JSON.parse(normalizedContent);
  const entries = Array.isArray(parsed) ? parsed : parsed?.entries;
  if (!Array.isArray(entries))
    throw new Error("AI returned an invalid glossary format");
  if (!entries.every(isGlossaryEntry))
    throw new Error("AI returned an invalid glossary entry");

  const seen = new Set<string>();
  return entries
    .filter(isGlossaryEntry)
    .map((entry) => ({
      original_word: entry.original_word.trim(),
      replacement_word: entry.replacement_word.trim(),
    }))
    .filter((entry) => {
      const key = entry.original_word.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_ENTRIES);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } =
      await userClient.auth.getUser();
    if (userError || !userData?.user)
      return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text : "";
    const modelRowId =
      typeof body?.modelRowId === "string" ? body.modelRowId : "";
    if (!text.trim()) return json({ error: "Text is required" }, 400);
    if (text.length > MAX_CHARS)
      return json({ error: `Text exceeds ${MAX_CHARS} characters` }, 400);
    if (!modelRowId) return json({ error: "No AI model selected" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: model } = await admin
      .from("ai_models")
      .select("id, user_id, model_id, provider_id")
      .eq("id", modelRowId)
      .maybeSingle();
    if (!model || model.user_id !== userData.user.id)
      return json({ error: "Model not found" }, 404);

    const { data: provider } = await admin
      .from("ai_providers")
      .select("api_url, api_key_encrypted")
      .eq("id", model.provider_id)
      .maybeSingle();
    if (!provider?.api_key_encrypted)
      return json({ error: "Provider is missing an API key" }, 400);

    let apiKey: string;
    try {
      apiKey = await decryptSecret(provider.api_key_encrypted);
    } catch {
      return json({ error: "Could not read the stored API key" }, 400);
    }

    const baseUrl = provider.api_url.replace(/\/+$/, "");
    const endpoint = baseUrl.endsWith("/chat/completions")
      ? baseUrl
      : `${baseUrl}/chat/completions`;
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model.model_id,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Extract recurring names, places, titles, organizations, fictional terms, and other translation-specific terms from the source text. Return ONLY a JSON array of objects with exactly original_word and replacement_word. original_word must be the source term and replacement_word must be its natural English translation or preferred spelling. Do not include ordinary common words, full sentences, or explanations. Return [] when no glossary terms are useful.",
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      return json(
        {
          error: `Provider error (${upstream.status}): ${detail.slice(0, 300)}`,
        },
        upstream.status === 429 ? 429 : 502,
      );
    }

    const response = await upstream.json();
    const content = response.choices?.[0]?.message?.content;
    if (typeof content !== "string")
      return json({ error: "AI returned no glossary content" }, 502);
    return json({ entries: parseEntries(content) });
  } catch (error) {
    console.error("ai-glossary-extract error", error);
    return json(
      {
        error:
          error instanceof Error ? error.message : "Glossary extraction failed",
      },
      500,
    );
  }
});
