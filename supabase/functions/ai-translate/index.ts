import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => null);
    const lines = Array.isArray(body?.lines) ? body.lines.filter((line: unknown): line is string => typeof line === "string") : [];
    const text = lines.join("\n");
    const originalLanguage = typeof body?.originalLanguage === "string" ? body.originalLanguage : "source language";
    const targetLanguage =
      typeof body?.targetLanguage === "string" && body.targetLanguage.trim()
        ? body.targetLanguage.trim().slice(0, 60)
        : "English";

    if (!text.trim()) return json({ error: "Text is required" }, 400);
    if (text.length > MAX_CHARS) {
      return json({ error: `Text exceeds ${MAX_CHARS} characters. Translate card by card.` }, 400);
    }
    if (!lines.length) return json({ error: "At least one line is required" }, 400);
    const apiKey = Deno.env.get("AI_API_KEY");
    const configuredEndpoint = Deno.env.get("AI_API_ENDPOINT");
    const model = Deno.env.get("AI_API_MODEL");
    if (!apiKey || !configuredEndpoint || !model) return json({ error: "AI translation is not configured on the server." }, 500);
    const baseUrl = configuredEndpoint.replace(/\/+$/, "");
    const endpoint = baseUrl.endsWith("/chat/completions")
      ? baseUrl
      : `${baseUrl}/chat/completions`;

    const systemPrompt = [
      `You are a professional literary translator. Translate each input line from ${originalLanguage} into ${targetLanguage}.`,
      "Rules:",
      "- Output ONLY the translation. No preamble, no notes, no explanations.",
      `- Return exactly ${lines.length} lines, one translation for each input line in the same order.`,
      "- Never merge, split, reorder, omit, or add lines. Preserve empty lines as empty lines.",
      "- Use previous lines as context, but output only the translations.",
      "- Keep names and already-translated terms exactly as written in the input.",
      "- Remove artifacts such as gender tags, TL notes, ads, and chapter navigation text.",
      "- Produce natural, fluent prose suitable for reading.",
    ].join("\n");

    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model.model_id,
        stream: false,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: lines.map((line, index) => `${index + 1}\t${line}`).join("\n") },
        ],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error("upstream error", upstream.status, detail.slice(0, 500));
      return json(
        { error: `Provider error (${upstream.status}): ${detail.slice(0, 300) || "no details"}` },
        upstream.status === 429 ? 429 : 502,
      );
    }

    const payload = await upstream.json();
    const translated = payload?.choices?.[0]?.message?.content;
    if (typeof translated !== "string") return json({ error: "AI returned no translation" }, 502);
    const translations = translated.replace(/^```(?:text)?\s*/i, "").replace(/\s*```$/, "").split("\n").map((line: string) => line.replace(/^\s*\d+[.)]\s*/, ""));
    if (translations.length !== lines.length) return json({ error: `AI returned ${translations.length} lines instead of ${lines.length}.` }, 502);
    return json({ translations });
  } catch (error) {
    console.error("ai-translate error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
