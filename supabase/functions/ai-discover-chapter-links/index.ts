import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getAiProviders,
  providerEndpoint,
  type AiProvider,
} from "../_shared/ai-provider.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
const TIMEOUT_MS = 3 * 60 * 1000;
const MAX_INDEX_CHARS = 120000;

type ChapterLink = { chapter_number: number; title: string; url: string };

const readAiContent = async (response: Response): Promise<string> => {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const payload = await response.json();
    return payload?.choices?.[0]?.message?.content ?? "";
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const consume = (events: string[]) => {
    for (const event of events) {
      const data = event
        .split("\n")
        .find((line) => line.trimStart().startsWith("data:"))
        ?.replace(/^\s*data:\s?/, "")
        .trim();
      if (!data || data === "[DONE]") continue;
      try {
        const payload = JSON.parse(data);
        const delta = payload?.choices?.[0]?.delta?.content;
        const message = payload?.choices?.[0]?.message?.content;
        if (typeof delta === "string") content += delta;
        else if (typeof message === "string") content += message;
      } catch {}
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    consume(events);
  }
  consume(buffer ? [buffer] : []);
  return content;
};

const parseLinks = (value: string): ChapterLink[] => {
  const cleaned = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned.match(/\[[\s\S]*\]/)?.[0] ?? "[]");
  const seen = new Set<string>();
  return (Array.isArray(parsed) ? parsed : [])
    .map((item: unknown) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      const chapterNumber = Number(raw.chapter_number ?? raw.chapterNumber);
      const url = typeof raw.url === "string" ? raw.url.trim() : "";
      const title = typeof raw.title === "string" ? raw.title.trim() : "";
      return { chapter_number: chapterNumber, title, url };
    })
    .filter((item: ChapterLink | null): item is ChapterLink => {
      if (!item) return false;
      if (
        !Number.isInteger(item.chapter_number) ||
        item.chapter_number < 1 ||
        !item.url
      )
        return false;
      const key = item.url;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => ({
      ...item,
      title: item.title || `Chapter ${item.chapter_number}`,
    }));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData.user)
      return json({ error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => null);
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const chapterFrom = Number.isInteger(body?.chapterFrom)
      ? body.chapterFrom
      : null;
    const chapterTo = Number.isInteger(body?.chapterTo) ? body.chapterTo : null;
    if (
      (chapterFrom !== null && chapterFrom < 1) ||
      (chapterTo !== null && chapterTo < 1) ||
      (chapterFrom !== null && chapterTo !== null && chapterTo < chapterFrom)
    )
      return json({ error: "Invalid chapter range" }, 400);
    if (!url) return json({ error: "URL is required" }, 400);
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const providers = getAiProviders();
    if (!firecrawlKey || !providers.length)
      return json({ error: "Import is not configured" }, 500);
    let normalizedUrl = url;
    if (!/^https?:\/\//i.test(normalizedUrl))
      normalizedUrl = `https://${normalizedUrl}`;
    new URL(normalizedUrl);
    const scrape = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: normalizedUrl,
        formats: ["markdown", "html"],
        onlyMainContent: false,
      }),
      signal: controller.signal,
    });
    const scrapedText = await scrape.text();
    let scraped: Record<string, unknown> = {};
    try {
      scraped = scrapedText ? JSON.parse(scrapedText) : {};
    } catch {
      return json(
        { error: `Firecrawl returned invalid JSON (${scrape.status})` },
        502,
      );
    }
    if (!scrape.ok)
      return json(
        {
          error: `Index page scraping failed (${scrape.status}): ${String(scraped.error || "unknown Firecrawl error")}`,
        },
        502,
      );
    const markdown = String(
      (scraped.data as Record<string, unknown>)?.markdown ||
        scraped.markdown ||
        "",
    );
    const html = String(
      (scraped.data as Record<string, unknown>)?.html || scraped.html || "",
    );
    if (!html.trim() && !markdown.trim())
      return json({ error: "Index page contained no readable content" }, 422);
    const prompt = `Extract every individual chapter link from the raw HTML of this novel index page. Return ONLY a JSON array with objects containing chapter_number (positive integer), title (string), and url (absolute URL copied from an anchor href). Read the actual <a href="..."> elements; never invent URLs. Include only links to individual chapters. Do not include navigation, metadata, advertisements, or unrelated links. ${chapterFrom !== null || chapterTo !== null ? `Only include chapters from ${chapterFrom ?? 1} to ${chapterTo ?? "the last chapter"}.` : "Include all chapters."}\n\nRAW INDEX HTML:\n${html.slice(0, MAX_INDEX_CHARS)}`;
    const requestAi = (provider: AiProvider) =>
      fetch(providerEndpoint(provider.endpoint), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          stream: false,
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                "You extract chapter links accurately and return valid JSON only.",
            },
            { role: "user", content: prompt },
          ],
        }),
        signal: controller.signal,
      });
    let ai = await requestAi(providers[0]);
    if (!ai.ok && providers[1]) ai = await requestAi(providers[1]);
    if (!ai.ok)
      return json({ error: `AI link extraction failed (${ai.status})` }, 502);
    const links = parseLinks(await readAiContent(ai)).filter(
      (link) =>
        (chapterFrom === null || link.chapter_number >= chapterFrom) &&
        (chapterTo === null || link.chapter_number <= chapterTo),
    );
    return json({ chapters: links });
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? "Chapter link discovery timed out after 3 minutes"
        : error instanceof Error
          ? error.message
          : "Link discovery failed";
    return json({ error: message }, 504);
  } finally {
    clearTimeout(timeout);
  }
});
