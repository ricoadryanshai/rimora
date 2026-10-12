import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAiProviders, providerEndpoint } from "../_shared/ai-provider.ts";
import { createRequestAbort } from "../_shared/request-abort.ts";

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
const AI_TIMEOUT_MS = 3 * 60 * 1000;
const extractJson = (value: string) => {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  const candidate = fenced || value.match(/\[[\s\S]*\]/)?.[0];
  if (!candidate) throw new Error("AI returned no chapters.");
  return JSON.parse(candidate);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  const requestAbort = createRequestAbort(req, AI_TIMEOUT_MS);
  const { controller } = requestAbort;
  try {
    if (!req.headers.get("Authorization"))
      return json({ success: false, error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    const chapterFrom = Number.isInteger(body?.chapterFrom)
      ? body.chapterFrom
      : null;
    const chapterTo = Number.isInteger(body?.chapterTo) ? body.chapterTo : null;
    if (
      (chapterFrom !== null && chapterFrom < 1) ||
      (chapterTo !== null && chapterTo < 1) ||
      (chapterFrom !== null && chapterTo !== null && chapterTo < chapterFrom)
    )
      return json({ success: false, error: "Invalid chapter range" }, 400);
    const providedContent =
      typeof body?.content === "string" ? body.content.trim() : "";
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!providedContent && !url)
      return json({ success: false, error: "URL or content is required" }, 400);
    const normalizedUrl = url
      ? url.startsWith("http")
        ? url
        : `https://${url}`
      : "provided content";
    if (url) new URL(normalizedUrl);
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const providers = getAiProviders();
    if (!firecrawlKey || !providers.length)
      return json(
        { success: false, error: "AI import is not configured on the server." },
        500,
      );
    let markdown = providedContent;
    if (!markdown) {
      const scrape = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: normalizedUrl,
          formats: ["markdown"],
          onlyMainContent: true,
        }),
        signal: controller.signal,
      });
      const scraped = await scrape.json();
      if (!scrape.ok)
        return json(
          {
            success: false,
            error: scraped?.error || "Firecrawl scrape failed.",
          },
          502,
        );
      markdown = scraped?.data?.markdown || scraped?.markdown || "";
    }
    if (!markdown.trim())
      return json(
        { success: false, error: "No readable chapter content was found." },
        422,
      );
    const requestedChapters = chapterFrom !== null && chapterFrom === chapterTo
      ? `Extract only chapter ${chapterFrom}. Return exactly one item when that chapter is present, or [] if it is not present. Never substitute a different chapter.`
      : `Extract chapters ${chapterFrom ?? "from the beginning"} through ${chapterTo ?? "the end"} from this novel page.`;
    const prompt = `${requestedChapters} Return ONLY a JSON array. Each item must have chapter_number (positive integer), title (string, use empty string when absent), and content (string). Remove unrelated webpage content including advertisements, navigation, comments, recommendations, site controls, headers, footers, and metadata. Preserve only the actual chapter title and narrative content. Do not invent, summarize, translate, merge, or rewrite the story. Preserve paragraph boundaries and line breaks.\n\nSOURCE URL: ${normalizedUrl}\n\nRAW SCRAPED CONTENT:\n${markdown}`;
    const aiResponse = await fetch(providerEndpoint(providers[0].endpoint), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providers[0].apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: providers[0].model,
        stream: false,
        temperature: 0.1,
        messages: [
          { role: "system", content: "You extract chapter data accurately." },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    const aiData = await aiResponse.json();
    if (!aiResponse.ok)
      return json(
        { success: false, error: `AI provider error (${aiResponse.status}).` },
        502,
      );
    const chapters = extractJson(
      typeof aiData?.choices?.[0]?.message?.content === "string"
        ? aiData.choices[0].message.content
        : "",
    );
    const filteredChapters = Array.isArray(chapters)
      ? chapters.filter(
          (chapter) =>
            Number.isInteger(chapter?.chapter_number) &&
            chapter.chapter_number > 0 &&
            typeof chapter.title === "string" &&
            typeof chapter.content === "string" &&
            chapter.content.trim() &&
            (chapterFrom === null || chapter.chapter_number >= chapterFrom) &&
            (chapterTo === null || chapter.chapter_number <= chapterTo),
        )
      : [];
    return json({
      success: true,
      chapters: filteredChapters,
    });
  } catch (error) {
    return json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Chapter import failed.",
      },
      500,
    );
  } finally {
    requestAbort.dispose();
  }
});
