import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const extractJson = (value: string) => {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  const candidate = fenced || value.match(/\[[\s\S]*\]/)?.[0];
  if (!candidate) throw new Error("AI returned no chapters.");
  return JSON.parse(candidate);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!req.headers.get("Authorization")) return json({ success: false, error: "Unauthorized" }, 401);
    const { url } = await req.json().catch(() => ({}));
    if (typeof url !== "string" || !url.trim()) return json({ success: false, error: "URL is required" }, 400);
    const normalizedUrl = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
    new URL(normalizedUrl);
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const endpoint = Deno.env.get("AI_API_ENDPOINT");
    const apiKey = Deno.env.get("AI_API_KEY");
    const model = Deno.env.get("AI_API_MODEL");
    if (!firecrawlKey || !endpoint || !apiKey || !model) return json({ success: false, error: "AI import is not configured on the server." }, 500);
    const scrape = await fetch("https://api.firecrawl.dev/v1/scrape", { method: "POST", headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ url: normalizedUrl, formats: ["markdown"], onlyMainContent: true }) });
    const scraped = await scrape.json();
    if (!scrape.ok) return json({ success: false, error: scraped?.error || "Firecrawl scrape failed." }, 502);
    const markdown = scraped?.data?.markdown || scraped?.markdown || "";
    if (!markdown.trim()) return json({ success: false, error: "No readable chapter content was found." }, 422);
    const prompt = `Extract every chapter from this novel page. Return ONLY a JSON array. Each item must have chapter_number (positive integer), title (string, use empty string when absent), and content (string). Do not invent chapters. Preserve the source text in content and omit navigation, comments, and metadata.\n\nSOURCE URL: ${normalizedUrl}\n\nPAGE CONTENT:\n${markdown.slice(0, 100000)}`;
    const aiResponse = await fetch(`${endpoint.replace(/\/+$/, "")}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, stream: false, temperature: 0.1, messages: [{ role: "system", content: "You extract chapter data accurately." }, { role: "user", content: prompt }] }) });
    const aiData = await aiResponse.json();
    if (!aiResponse.ok) return json({ success: false, error: `AI provider error (${aiResponse.status}).` }, 502);
    const chapters = extractJson(typeof aiData?.choices?.[0]?.message?.content === "string" ? aiData.choices[0].message.content : "");
    return json({ success: true, chapters: Array.isArray(chapters) ? chapters : [] });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Chapter import failed." }, 500);
  }
});
