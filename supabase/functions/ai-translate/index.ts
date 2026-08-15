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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text : "";
    const targetLanguage =
      typeof body?.targetLanguage === "string" && body.targetLanguage.trim()
        ? body.targetLanguage.trim().slice(0, 60)
        : "English";
    const modelRowId = typeof body?.modelRowId === "string" ? body.modelRowId : "";

    if (!text.trim()) return json({ error: "Text is required" }, 400);
    if (text.length > MAX_CHARS) {
      return json({ error: `Text exceeds ${MAX_CHARS} characters. Translate card by card.` }, 400);
    }
    if (!modelRowId) return json({ error: "No AI model selected" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: model } = await admin
      .from("ai_models")
      .select("id, user_id, model_id, provider_id")
      .eq("id", modelRowId)
      .maybeSingle();

    if (!model || model.user_id !== userId) return json({ error: "Model not found" }, 404);

    const { data: provider } = await admin
      .from("ai_providers")
      .select("id, api_url, api_key_encrypted")
      .eq("id", model.provider_id)
      .maybeSingle();

    if (!provider?.api_key_encrypted) {
      return json({ error: "Provider is missing an API key. Re-enter it in AI Providers." }, 400);
    }

    let apiKey: string;
    try {
      apiKey = await decryptSecret(provider.api_key_encrypted);
    } catch {
      return json({ error: "Could not read the stored API key. Please re-enter it." }, 400);
    }

    const baseUrl = provider.api_url.replace(/\/+$/, "");
    const endpoint = baseUrl.endsWith("/chat/completions")
      ? baseUrl
      : `${baseUrl}/chat/completions`;

    const systemPrompt = [
      `You are a professional literary translator. Translate the user's text into ${targetLanguage}.`,
      "Rules:",
      "- Output ONLY the translation. No preamble, no notes, no explanations.",
      "- Preserve paragraph breaks and overall structure exactly.",
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
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      console.error("upstream error", upstream.status, detail.slice(0, 500));
      return json(
        { error: `Provider error (${upstream.status}): ${detail.slice(0, 300) || "no details"}` },
        upstream.status === 429 ? 429 : 502,
      );
    }

    return new Response(upstream.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("ai-translate error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
