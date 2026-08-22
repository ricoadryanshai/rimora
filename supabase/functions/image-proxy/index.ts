import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => null);
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) return json({ error: "URL is required" }, 400);
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return json({ error: "Only HTTP and HTTPS URLs are supported" }, 400);
    const response = await fetch(url, { headers: { Accept: "image/*" } });
    if (!response.ok) return json({ error: `Image fetch failed (${response.status})` }, 502);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return json({ error: "URL does not point to an image" }, 415);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 10 * 1024 * 1024) return json({ error: "Image is larger than 10 MB" }, 413);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return json({ dataUrl: `data:${contentType};base64,${btoa(binary)}` });
  } catch (error) {
    console.error("image-proxy error", error);
    return json({ error: error instanceof Error ? error.message : "Could not fetch image" }, 500);
  }
});