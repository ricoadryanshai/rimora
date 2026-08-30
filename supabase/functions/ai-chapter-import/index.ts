import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAiProviders, providerEndpoint } from "../_shared/ai-provider.ts";

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
  try {
    if (!req.headers.get("Authorization"))
      return json({ success: false, error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
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
          { success: false, error: scraped?.error || "Firecrawl scrape failed." },
          502,
        );
      markdown = scraped?.data?.markdown || scraped?.markdown || "";
    }
    if (!markdown.trim())
      return json(
        { success: false, error: "No readable chapter content was found." },
        422,
      );
    const prompt = `Extract every chapter from this novel page. Return ONLY a JSON array. Each item must have chapter_number (positive integer), title (string, use empty string when absent), and content (string). Remove unrelated webpage content including advertisements, navigation, comments, recommendations, site controls, headers, footers, and metadata. Preserve only the actual chapter title and narrative content. Do not invent, summarize, translate, merge, or rewrite the story. Preserve paragraph boundaries and line breaks.\n\nSOURCE URL: ${normalizedUrl}\n\nPAGE CONTENT:\n${markdown}`;
    const aiResponse = await fetch(
      providerEndpoint(providers[0].endpoint),
      {
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
      },
    );
    clearTimeout(timeout);
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
    return json({
      success: true,
      chapters: Array.isArray(chapters) ? chapters : [],
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
  }
});
