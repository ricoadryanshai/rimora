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

const readProviderContent = async (response: Response): Promise<string> => {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const payload = await response.json();
    return payload.choices?.[0]?.message?.content ?? "";
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  const consumeEvents = (events: string[]) => {
    for (const event of events) {
      const data = event
        .split("\n")
        .find((line) => line.trimStart().startsWith("data:"))
        ?.replace(/^\s*data:\s?/, "")
        .trim();
      if (!data || data === "[DONE]") continue;
      try {
        const chunk = JSON.parse(data);
        const delta = chunk.choices?.[0]?.delta?.content;
        const message = chunk.choices?.[0]?.message?.content;
        if (typeof delta === "string") content += delta;
        else if (typeof message === "string") content += message;
      } catch {
        // Ignore provider comments or non-JSON SSE frames.
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    consumeEvents(events);
  }

  consumeEvents(buffer ? [buffer] : []);

  return content;
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
    const originalLanguage =
      typeof body?.originalLanguage === "string"
        ? body.originalLanguage
        : "original language";
    const translatedLanguage =
      typeof body?.translatedLanguage === "string"
        ? body.translatedLanguage
        : "translated language";
    if (!text.trim()) return json({ error: "Text is required" }, 400);
    if (text.length > MAX_CHARS)
      return json({ error: `Text exceeds ${MAX_CHARS} characters` }, 400);
    const apiKey = Deno.env.get("AI_API_KEY");
    const configuredEndpoint = Deno.env.get("AI_API_ENDPOINT");
    const model = Deno.env.get("AI_API_MODEL");
    if (!apiKey || !configuredEndpoint || !model)
      return json(
        { error: "AI glossary extraction is not configured on the server." },
        500,
      );

    const baseUrl = configuredEndpoint.replace(/\/+$/, "");
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
        model,
        stream: true,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `Extract recurring names, places, titles, organizations, fictional terms, and other translation-specific terms from the source text. The source/original term language is ${originalLanguage}; the translated/preferred term language is ${translatedLanguage}. Return ONLY a JSON array of objects with exactly original_word and replacement_word. Preserve original_word in ${originalLanguage} and provide replacement_word in ${translatedLanguage}. Do not include ordinary common words, full sentences, or explanations. Return [] when no glossary terms are useful.`,
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      let providerMessage = detail.slice(0, 300);
      try {
        const parsed = JSON.parse(detail);
        providerMessage =
          parsed?.error?.message ??
          parsed?.error ??
          parsed?.message ??
          providerMessage;
      } catch {
        // Keep the raw provider response when it is not JSON.
      }
      return json(
        {
          error: `Provider error (${upstream.status}): ${providerMessage}`,
        },
        upstream.status === 429 ? 429 : 502,
      );
    }

    const content = await readProviderContent(upstream);
    if (!content.trim())
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
