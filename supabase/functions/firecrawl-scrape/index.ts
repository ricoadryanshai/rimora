import {
  getAiProviders,
  providerEndpoint,
  type AiProvider,
} from "../_shared/ai-provider.ts";
import { createRequestAbort } from "../_shared/request-abort.ts";

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

const chapterHeadingPattern =
  /^(?:#{1,6}\s*)?(?:chapter|ch\.?)[\s#.:_-]*(\d+)(?:\s*[:.)-]\s*|\s+)(.+?)\s*$/i;
const extractChapterMetadata = (value: string) => {
  const lines = value.split(/\r?\n/);
  const index = lines.findIndex((line) =>
    chapterHeadingPattern.test(line.trim()),
  );
  if (index < 0)
    return { chapterNumber: null, chapterTitle: "", content: value.trim() };
  const match = lines[index].trim().match(chapterHeadingPattern);
  return {
    chapterNumber: match ? Number(match[1]) : null,
    chapterTitle: match?.[2]?.trim() || "",
    content: lines
      .filter((_, lineIndex) => lineIndex !== index)
      .join("\n")
      .trim(),
  };
};
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
      } catch {
        // Ignore incomplete or non-JSON SSE frames.
      }
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

const trimChunk = async (providers: AiProvider[], chunk: string, signal: AbortSignal) => {
  const request = (provider: AiProvider) =>
    fetch(providerEndpoint(provider.endpoint), {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Remove ads, navigation, and unrelated website text from this novel chapter section. Preserve the chapter heading, story content, and paragraph breaks. Return only the cleaned text.",
          },
          { role: "user", content: chunk },
        ],
      }),
    });
  let response = await request(providers[0]);
  if (!response.ok && providers[1]) response = await request(providers[1]);
  if (!response.ok) throw new Error(`AI cleanup failed (${response.status})`);
  const result = await readAiContent(response);
  if (typeof result !== "string" || !result.trim())
    throw new Error("AI returned empty cleanup");
  return result.trim();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestAbort = createRequestAbort(req, 3 * 60 * 1000);
  const signal = requestAbort.controller.signal;
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
      signal,
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
    let metadata = extractChapterMetadata(markdown.slice(0, 10000));

    if (cleanWithAi && markdown.trim()) {
      const providers = getAiProviders();
      if (!providers.length) {
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
      const firstChunk = markdown.slice(0, 10000);
      const remainingContent = markdown.slice(10000);
      const requestCleanup = (provider: AiProvider) =>
        fetch(providerEndpoint(provider.endpoint), {
          method: "POST",
          signal,
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: provider.model,
            temperature: 0,
            messages: [
              {
                role: "system",
                content:
                  "Clean scraped web content for a novel chapter. Remove advertisements, navigation, menus, cookie notices, comments, recommendations, author/site tools, and unrelated page text. Preserve only the chapter title and chapter narrative. Preserve paragraph boundaries and line breaks. Return only the cleaned chapter text, with no explanation.",
              },
              { role: "user", content: firstChunk },
            ],
          }),
        });
      let aiResponse = await requestCleanup(providers[0]);
      if (!aiResponse.ok && providers[1])
        aiResponse = await requestCleanup(providers[1]);
      if (!aiResponse.ok)
        return new Response(
          JSON.stringify({
            success: false,
            error: `AI cleanup failed (${aiResponse.status}).`,
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      const cleaned = await readAiContent(aiResponse);
      if (typeof cleaned === "string" && cleaned.trim()) {
        const cleanedFirstChunk = cleaned.trim();
        metadata = extractChapterMetadata(cleanedFirstChunk);
        const firstChunkContent =
          metadata.chapterNumber !== null
            ? metadata.content
            : cleanedFirstChunk;
        const remainingChunks =
          remainingContent.match(/[\s\S]{1,10000}(?:\n|$)/g) ?? [];
        const cleanedRemaining = [];
        for (const chunk of remainingChunks)
          cleanedRemaining.push(await trimChunk(providers, chunk, signal));
        markdown = [firstChunkContent, ...cleanedRemaining]
          .filter(Boolean)
          .join("\n\n");
      }
    }

    console.log("Scrape successful, content length:", markdown.length);

    return new Response(
      JSON.stringify({
        success: true,
        markdown,
        content: markdown,
        chapterNumber: metadata.chapterNumber,
        chapterTitle: metadata.chapterTitle || title,
        title,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
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
  } finally {
    requestAbort.dispose();
  }
});
