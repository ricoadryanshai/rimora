const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type FirecrawlResponse = {
  error?: unknown;
  markdown?: string;
  metadata?: { title?: string };
  data?: { markdown?: string; metadata?: { title?: string } };
};

const AI_CLEANUP_MAX_CHARS = 30000;
const AI_CLEANUP_TIMEOUT_MS = 30000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url, cleanWithAi } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Basic URL validation
    let formattedUrl = url.trim();
    if (
      !formattedUrl.startsWith("http://") &&
      !formattedUrl.startsWith("https://")
    ) {
      formattedUrl = `https://${formattedUrl}`;
    }

    try {
      new URL(formattedUrl);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid URL format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Firecrawl is not configured. Please connect the Firecrawl connector.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("Scraping URL:", formattedUrl);

    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    const responseText = await response.text();
    let data: FirecrawlResponse = {};
    try {
      data = responseText
        ? (JSON.parse(responseText) as FirecrawlResponse)
        : {};
    } catch {
      console.error(
        "Firecrawl returned a non-JSON response:",
        responseText.slice(0, 500),
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: `Firecrawl returned an invalid response (${response.status}).`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!response.ok) {
      console.error("Firecrawl API error:", data);
      const errorMsg =
        response.status === 402
          ? "Firecrawl credits exhausted. Please top up your Firecrawl plan."
          : typeof data.error === "string"
            ? data.error
            : `Scrape failed with status ${response.status}`;
      return new Response(JSON.stringify({ success: false, error: errorMsg }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let markdown = data?.data?.markdown || data?.markdown || "";
    const title = data?.data?.metadata?.title || data?.metadata?.title || "";

    if (cleanWithAi && markdown.trim()) {
      const aiKey = Deno.env.get("AI_API_KEY");
      const aiEndpoint = Deno.env.get("AI_API_ENDPOINT");
      const aiModel = Deno.env.get("AI_API_MODEL");
      if (!aiKey || !aiEndpoint || !aiModel) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "AI cleanup is not configured on the server.",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const baseEndpoint = aiEndpoint.replace(/\/+$/, "");
      const endpoint = baseEndpoint.endsWith("/chat/completions")
        ? baseEndpoint
        : `${baseEndpoint}/chat/completions`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_CLEANUP_TIMEOUT_MS);
      try {
        const aiResponse = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${aiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: aiModel,
            temperature: 0,
            max_tokens: 12000,
            messages: [
              {
                role: "system",
                content:
                  "Clean this scraped novel chapter. Remove navigation, ads, cookie notices, comments, recommendations, and unrelated site text. Keep the chapter title and narrative, preserve paragraph breaks, and return only cleaned text.",
              },
              { role: "user", content: markdown.slice(0, AI_CLEANUP_MAX_CHARS) },
            ],
          }),
        });
        const aiText = await aiResponse.text();
        if (!aiResponse.ok) {
          console.error("AI cleanup failed:", aiResponse.status, aiText.slice(0, 300));
        } else {
          try {
            const aiData = aiText ? JSON.parse(aiText) : null;
            const cleaned = aiData?.choices?.[0]?.message?.content;
            if (typeof cleaned === "string" && cleaned.trim()) markdown = cleaned.trim();
          } catch {
            console.error("AI cleanup returned invalid JSON");
          }
        }
      } catch (error) {
        console.error("AI cleanup timed out or failed:", error);
      } finally {
        clearTimeout(timeout);
      }
    }

    console.log("Scrape successful, content length:", markdown.length);

    return new Response(JSON.stringify({ success: true, markdown, title }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error scraping:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to scrape URL",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
