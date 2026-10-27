import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCaller } from "../_shared/internal-auth.ts";
import { createRequestAbort } from "../_shared/request-abort.ts";
import { providerEndpoint, type AiProvider } from "../_shared/ai-provider.ts";

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

const EXTRACTION_TIMEOUT_MS = 3 * 60 * 1000;

const getGlossaryProviders = (): AiProvider[] => {
  const providers: AiProvider[] = [];
  for (const suffix of ["_2", "_1"]) {
    const endpoint = Deno.env.get(`AI_API_ENDPOINT${suffix}`);
    const apiKey = Deno.env.get(`AI_API_KEY${suffix}`);
    const model = Deno.env.get(`AI_API_MODEL${suffix}`);
    if (endpoint && apiKey && model)
      providers.push({ endpoint, apiKey, model });
  }
  return providers;
};

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
    entry.original_word.trim().length >= 2 &&
    entry.original_word.trim().length <= 6 &&
    entry.replacement_word.trim().length > 0
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
    });
};

const extractPart = async (
  providers: AiProvider[],
  text: string,
  originalLanguage: string,
  translatedLanguage: string,
  signal: AbortSignal,
): Promise<GlossaryEntry[]> => {
  const request = (provider: AiProvider) =>
    fetch(providerEndpoint(provider.endpoint), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      signal,
      body: JSON.stringify({
        model: provider.model,
        stream: true,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `Extract recurring names, places, titles, organizations, fictional terms, and other translation-specific terms from the source text. The source/original term language is ${originalLanguage}; the translated/preferred term language is ${translatedLanguage}. Return ONLY a JSON array of objects with exactly original_word and replacement_word. Only return original_word values with 2 to 6 characters inclusive. Preserve original_word in ${originalLanguage} and provide replacement_word in ${translatedLanguage}. For novel characters, append a gender tag to replacement_word in this exact format when the story clearly identifies the character's gender: "Name (Male)", "Name (Female)", or "Name (Unknown)" only when gender is genuinely unclear. Do not add gender tags to non-character terms. Do not guess gender from the name alone. Do not include ordinary common words, full sentences, or explanations. Return [] when no glossary terms are useful.`,
          },
          { role: "user", content: text },
        ],
      }),
    });
  let upstream = await request(providers[0]);
  if (!upstream.ok && providers[1]) upstream = await request(providers[1]);
  if (!upstream.ok) throw new Error(`Provider error (${upstream.status})`);
  const content = await readProviderContent(upstream);
  return parseEntries(content);
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
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } =
      await getCaller(req, userClient);
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
    const providers = getGlossaryProviders();
    if (!providers.length)
      return json(
        { error: "AI glossary extraction is not configured on the server." },
        500,
      );

    const lines = text.split(/\r?\n/);
    const parts = Array.from({ length: 3 }, (_, index) =>
      lines
        .slice(
          Math.floor((index * lines.length) / 3),
          Math.floor(((index + 1) * lines.length) / 3),
        )
        .join("\n"),
    ).filter((part) => part.trim());
    const requestAbort = createRequestAbort(req, EXTRACTION_TIMEOUT_MS);
    const { controller } = requestAbort;
    try {
      const results = await Promise.all(
        parts.map((part) =>
          extractPart(
            providers,
            part,
            originalLanguage,
            translatedLanguage,
            controller.signal,
          ),
        ),
      );
      const seen = new Set<string>();
      const entries = results.flat().filter((entry) => {
        const key = entry.original_word.toLocaleLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return json({ entries });
    } finally {
      requestAbort.dispose();
    }
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
