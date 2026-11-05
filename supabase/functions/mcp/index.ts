// Rimora MCP server (Streamable HTTP, stateless JSON responses) for Claude custom connectors.
// Auth: personal access token created in Rimora Settings, sent as `Authorization: Bearer <token>`
// or, for clients that cannot set headers (claude.ai connector dialog), as `?token=<token>`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { findReplaceMode, replaceLiteral, validateReplacement } from "./find-replace.ts";

const PROTOCOL_VERSION = "2025-06-18";
const MAX_TEXT = 200_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type Json = Record<string, unknown>;
type Tool = {
  name: string;
  title: string;
  description: string;
  readOnly: boolean;
  destructive?: boolean;
  openWorld?: boolean;
  inputSchema: Json;
  run: (userId: string, args: Json) => Promise<unknown>;
};

class ToolError extends Error {}

const str = (v: unknown, field: string, max = 500, required = true) => {
  if (v === undefined || v === null || v === "") {
    if (required) throw new ToolError(`${field} is required`);
    return undefined;
  }
  if (typeof v !== "string") throw new ToolError(`${field} must be a string`);
  if (v.length > max) throw new ToolError(`${field} is too long (max ${max} characters)`);
  return v;
};
const uuid = (v: unknown, field: string) => {
  const s = str(v, field, 36)!;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    throw new ToolError(`${field} must be a UUID`);
  }
  return s;
};
const int = (v: unknown, field: string, min: number, max: number, required = true) => {
  if (v === undefined || v === null) {
    if (required) throw new ToolError(`${field} is required`);
    return undefined;
  }
  if (!Number.isInteger(v) || (v as number) < min || (v as number) > max) {
    throw new ToolError(`${field} must be an integer between ${min} and ${max}`);
  }
  return v as number;
};
const oneOf = <T extends string>(v: unknown, field: string, allowed: readonly T[]) => {
  if (v === undefined || v === null) return undefined;
  if (!allowed.includes(v as T)) throw new ToolError(`${field} must be one of: ${allowed.join(", ")}`);
  return v as T;
};
const strArray = (v: unknown, field: string) => {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v) || v.length > 30 || v.some((x) => typeof x !== "string" || x.length > 60)) {
    throw new ToolError(`${field} must be an array of up to 30 short strings`);
  }
  return v as string[];
};
const check = (error: { message: string } | null) => {
  if (error) throw new ToolError(error.message);
};

async function assertOwnsNovel(userId: string, novelId: string) {
  const { data, error } = await admin
    .from("novels")
    .select("id")
    .eq("id", novelId)
    .eq("owner_id", userId)
    .maybeSingle();
  check(error);
  if (!data) throw new ToolError("Novel not found");
}


type NovelContext = {
  id: string;
  title: string;
  language: string | null;
  original_language: string | null;
  translation_language: string | null;
};

async function getNovelContext(userId: string, novelId: string): Promise<NovelContext> {
  const { data, error } = await admin
    .from("novels")
    .select("id,title,language,original_language,translation_language")
    .eq("id", novelId)
    .eq("owner_id", userId)
    .maybeSingle();
  check(error);
  if (!data) throw new ToolError("Novel not found");
  return data as NovelContext;
}

const originalLanguageOf = (n: NovelContext) => n.original_language || n.language || "original language";
const translatedLanguageOf = (n: NovelContext) => n.translation_language || "translated language";

// Calls another Rimora edge function as an already-verified connector user.
async function callFunction(name: string, body: Json, timeoutMs = 140_000): Promise<Json> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  let response: Response;
  try {
    response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ToolError(`${name} timed out. Try a smaller piece of work.`);
    }
    throw new ToolError(`${name} could not be reached`);
  }
  const text = await response.text();
  let data: Json = {};
  try {
    data = text ? (JSON.parse(text) as Json) : {};
  } catch {
    throw new ToolError(`${name} returned an invalid response (${response.status})`);
  }
  if (!response.ok || data.success === false || (typeof data.error === "string" && data.error)) {
    throw new ToolError(typeof data.error === "string" ? data.error : `${name} failed (${response.status})`);
  }
  return data;
}

const stripHtml = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

// Chapters are stored as HTML with <br> line breaks (what the editor produces).
// Plain text with newlines is converted; text that already contains tags is kept.
const toChapterHtml = (value: string, knownPlain = false) =>
  !knownPlain && /<\/?[a-z][^>]*>/i.test(value)
    ? value
    : value
        .split(/\r?\n/)
        .map((line) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
        .join("<br>");

const CHAPTER_COLUMNS = "id,chapter_number,title,status,updated_at";

async function upsertChapter(novelId: string, number: number, patch: Json) {
  const { data: existing, error: findError } = await admin
    .from("chapters")
    .select("id")
    .eq("novel_id", novelId)
    .eq("chapter_number", number)
    .is("deleted_at", null)
    .maybeSingle();
  check(findError);
  if (existing) {
    if (Object.keys(patch).length === 0) throw new ToolError("Nothing to update");
    const { data, error } = await admin.from("chapters").update(patch).eq("id", existing.id).select(CHAPTER_COLUMNS).single();
    check(error);
    return { created: false, chapter: data };
  }
  if (!patch.title) throw new ToolError("title is required when creating a chapter");
  const { data, error } = await admin
    .from("chapters")
    .insert({ novel_id: novelId, chapter_number: number, ...patch })
    .select(CHAPTER_COLUMNS)
    .single();
  check(error);
  return { created: true, chapter: data };
}

async function loadChapter(userId: string, novelId: string, number: number) {
  await assertOwnsNovel(userId, novelId);
  const { data, error } = await admin
    .from("chapters")
    .select("id,chapter_number,title,content,source_content,source_url,status")
    .eq("novel_id", novelId)
    .eq("chapter_number", number)
    .is("deleted_at", null)
    .maybeSingle();
  check(error);
  if (!data) throw new ToolError("Chapter not found");
  return data;
}

async function extractAndSaveGlossary(userId: string, novel: NovelContext, text: string) {
  const extracted = await callFunction("ai-glossary-extract", {
    text,
    originalLanguage: originalLanguageOf(novel),
    translatedLanguage: translatedLanguageOf(novel),
  });
  const entries = (Array.isArray(extracted.entries) ? extracted.entries : [])
    .filter(
      (e: { original_word?: unknown; replacement_word?: unknown }) =>
        typeof e.original_word === "string" &&
        typeof e.replacement_word === "string" &&
        e.original_word.trim().length >= 2 &&
        e.original_word.trim().length <= 6 &&
        e.replacement_word.trim(),
    )
    .map((e: { original_word: string; replacement_word: string }) => ({
      source_term: e.original_word.trim(),
      preferred_term: e.replacement_word.trim(),
    }));
  let saved = 0;
  for (const entry of entries) {
    const { error } = await admin.from("glossary_entries").insert({
      owner_id: userId,
      novel_id: novel.id,
      ...entry,
      source_language: originalLanguageOf(novel),
      target_language: translatedLanguageOf(novel),
    });
    if (!error) saved += 1;
    else if (error.code !== "23505") throw new ToolError(error.message);
  }
  return { found: entries.length, saved, already_existed: entries.length - saved, entries };
}

async function translateText(novel: NovelContext, number: number, title: string, text: string) {
  const lines = stripHtml(text).split("\n");
  if (!lines.some((line) => line.trim())) throw new ToolError("The chapter has no text to translate");
  const result = await callFunction("ai-translate", {
    chapterNumber: number,
    title,
    content: lines,
    authorThoughts: "",
    originalLanguage: originalLanguageOf(novel),
    targetLanguage: translatedLanguageOf(novel) === "translated language" ? "English" : translatedLanguageOf(novel),
  }, 170_000);
  const chapter = result.chapter as { title: string; content: string[] } | undefined;
  if (!chapter || !Array.isArray(chapter.content)) throw new ToolError("Translation returned no chapter");
  return { title: chapter.title, content: chapter.content.join("\n") };
}

async function importChapter(
  userId: string,
  novel: NovelContext,
  opts: { url: string; chapterNumber?: number; discoveredTitle?: string; extractGlossary: boolean; translate: boolean },
) {
  const scraped = await callFunction("firecrawl-scrape", { url: opts.url, cleanWithAi: false });
  const number = opts.chapterNumber ?? (Number.isInteger(scraped.chapterNumber) ? (scraped.chapterNumber as number) : undefined);
  if (!number || number < 1) throw new ToolError("Could not detect the chapter number; pass chapter_number");
  const structured = await callFunction("ai-chapter-import", {
    content: String(scraped.content || scraped.markdown || ""),
    url: opts.url,
    chapterFrom: number,
    chapterTo: number,
  });
  const found = (Array.isArray(structured.chapters) ? structured.chapters : []).find(
    (c: { chapter_number?: number }) => c.chapter_number === number,
  ) as { title: string; content: string } | undefined;
  if (!found || !found.content?.trim()) throw new ToolError(`The page did not contain chapter ${number}`);
  const sourceContent = found.content;
  let title = found.title || opts.discoveredTitle || `Chapter ${number}`;
  let content = sourceContent;
  const steps: Json = {};
  if (opts.extractGlossary) {
    const g = await extractAndSaveGlossary(userId, novel, sourceContent);
    steps.glossary = { found: g.found, saved: g.saved };
  }
  if (opts.translate) {
    const t = await translateText(novel, number, title, sourceContent);
    title = t.title;
    content = t.content;
    steps.translated = true;
  }
  const saved = await upsertChapter(novel.id, number, {
    title,
    content: toChapterHtml(content, true),
    source_content: sourceContent,
    source_url: opts.url,
    status: "draft",
    published_at: null,
  });
  return { chapter_number: number, title, ...steps, ...saved };
}

const NOVEL_COLUMNS =
  "id,title,translation_title,novel_type,description,language,status,visibility,genre,tags,author,original_title,original_language,created_at,updated_at";
const NOVEL_TYPES = ["Novel", "Fanfic", "Translation"] as const;
const STATUSES = ["draft", "ongoing", "completed", "hiatus"] as const;
const VISIBILITY = ["private", "unlisted", "public"] as const;

const idProp = (description: string) => ({ type: "string", description });
const schema = (properties: Json, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const tools: Tool[] = [
  {
    name: "list_novels",
    title: "List my novels",
    description: "List novels you own in Rimora (newest first), without chapter text.",
    readOnly: true,
    inputSchema: schema({ limit: { type: "integer", minimum: 1, maximum: 100, default: 50 } }),
    run: async (userId, a) => {
      const { data, error } = await admin
        .from("novels")
        .select(`${NOVEL_COLUMNS},chapters(count)`)
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false })
        .limit(int(a.limit, "limit", 1, 100, false) ?? 50);
      check(error);
      return data;
    },
  },
  {
    name: "get_novel",
    title: "Get novel details",
    description: "Get one of your novels by id, including its description, tags and chapter count.",
    readOnly: true,
    inputSchema: schema({ novel_id: idProp("Novel UUID") }, ["novel_id"]),
    run: async (userId, a) => {
      const { data, error } = await admin
        .from("novels")
        .select(`${NOVEL_COLUMNS},chapters(count)`)
        .eq("id", uuid(a.novel_id, "novel_id"))
        .eq("owner_id", userId)
        .maybeSingle();
      check(error);
      if (!data) throw new ToolError("Novel not found");
      return data;
    },
  },
  {
    name: "list_chapters",
    title: "List chapters",
    description: "List chapters of a novel in order (number, title, status, length) without full text.",
    readOnly: true,
    inputSchema: schema({ novel_id: idProp("Novel UUID") }, ["novel_id"]),
    run: async (userId, a) => {
      const novelId = uuid(a.novel_id, "novel_id");
      await assertOwnsNovel(userId, novelId);
      const { data, error } = await admin
        .from("chapters")
        .select("id,chapter_number,title,status,source_url,updated_at,content,source_content")
        .eq("novel_id", novelId)
        .is("deleted_at", null)
        .order("chapter_number");
      check(error);
      return (data ?? []).map(({ content, source_content, ...rest }) => ({
        ...rest,
        content_length: content?.length ?? 0,
        source_length: source_content?.length ?? 0,
      }));
    },
  },
  {
    name: "get_chapter",
    title: "Read a chapter",
    description:
      "Read a chapter's full translated/working text and its original source text (if stored).",
    readOnly: true,
    inputSchema: schema(
      { novel_id: idProp("Novel UUID"), chapter_number: { type: "integer", minimum: 1 } },
      ["novel_id", "chapter_number"],
    ),
    run: async (userId, a) => {
      const novelId = uuid(a.novel_id, "novel_id");
      await assertOwnsNovel(userId, novelId);
      const { data, error } = await admin
        .from("chapters")
        .select("id,chapter_number,title,content,source_content,source_url,status,updated_at")
        .eq("novel_id", novelId)
        .is("deleted_at", null)
        .eq("chapter_number", int(a.chapter_number, "chapter_number", 1, 100000)!)
        .maybeSingle();
      check(error);
      if (!data) throw new ToolError("Chapter not found");
      return data;
    },
  },
  {
    name: "list_glossary",
    title: "List glossary",
    description:
      "List glossary terms (source term to preferred translation). Omit novel_id for your global glossary.",
    readOnly: true,
    inputSchema: schema({ novel_id: idProp("Novel UUID; omit for global terms") }),
    run: async (userId, a) => {
      let q = admin
        .from("glossary_entries")
        .select("id,novel_id,source_term,preferred_term,category,definition,updated_at")
        .eq("owner_id", userId)
        .order("source_term")
        .limit(1000);
      if (a.novel_id) {
        const novelId = uuid(a.novel_id, "novel_id");
        await assertOwnsNovel(userId, novelId);
        q = q.eq("novel_id", novelId);
      } else {
        q = q.is("novel_id", null);
      }
      const { data, error } = await q;
      check(error);
      return data;
    },
  },
  {
    name: "list_library",
    title: "List my library",
    description: "List novels you saved, favorited or followed, with your last-read chapter.",
    readOnly: true,
    inputSchema: schema({
      entry_type: { type: "string", enum: ["saved", "favorite", "followed"], default: "saved" },
    }),
    run: async (userId, a) => {
      const type = oneOf(a.entry_type, "entry_type", ["saved", "favorite", "followed"] as const) ?? "saved";
      const { data, error } = await admin
        .from("library_entries")
        .select("created_at,novels(id,title,translation_title,novel_type,status)")
        .eq("user_id", userId)
        .eq("entry_type", type)
        .order("created_at", { ascending: false })
        .limit(200);
      check(error);
      return data;
    },
  },
  {
    name: "create_novel",
    title: "Create novel",
    description: "Create a new novel (private draft by default).",
    readOnly: false,
    inputSchema: schema(
      {
        title: { type: "string", maxLength: 160 },
        translation_title: { type: "string", maxLength: 160 },
        novel_type: { type: "string", enum: [...NOVEL_TYPES] },
        description: { type: "string", maxLength: 5000 },
        language: { type: "string", maxLength: 10 },
        status: { type: "string", enum: [...STATUSES] },
        visibility: { type: "string", enum: [...VISIBILITY] },
        genre: { type: "string", maxLength: 80 },
        tags: { type: "array", items: { type: "string" } },
        author: { type: "string", maxLength: 200 },
        cover_url: { type: "string", maxLength: 2000 },
        abbreviation: { type: "string", maxLength: 15 },
        original_language: { type: "string", maxLength: 40, description: "Translation novels: language of the source text" },
        translation_language: { type: "string", maxLength: 40, description: "Translation novels: language you translate into" },
        original_platform: { type: "string", maxLength: 2000 },
        translator: { type: "string", maxLength: 200 },
        translator_group: { type: "string", maxLength: 200 },
        warning_notice: { type: "string", maxLength: 100 },
      },
      ["title"],
    ),
    run: async (userId, a) => {
      const novelType = oneOf(a.novel_type, "novel_type", NOVEL_TYPES) ?? "Novel";
      const translationLanguage = str(a.translation_language, "translation_language", 40, false);
      const { data, error } = await admin
        .from("novels")
        .insert({
          owner_id: userId,
          title: str(a.title, "title", 160)!.trim(),
          translation_title: str(a.translation_title, "translation_title", 160, false) ?? null,
          novel_type: novelType,
          description: str(a.description, "description", 5000, false) ?? "",
          language: str(a.language, "language", 40, false) ?? "en",
          status: oneOf(a.status, "status", STATUSES) ?? "draft",
          visibility: oneOf(a.visibility, "visibility", VISIBILITY) ?? "private",
          genre: str(a.genre, "genre", 80, false), // NOT NULL column: omit to use its default
          tags: strArray(a.tags, "tags") ?? [],
          author: str(a.author, "author", 200, false), // NOT NULL column: omit to use its default
          cover_url: str(a.cover_url, "cover_url", 2000, false) ?? null,
          abbreviation: str(a.abbreviation, "abbreviation", 15, false), // NOT NULL column: omit to use its default
          warning_notice: str(a.warning_notice, "warning_notice", 100, false), // NOT NULL column: omit to use its default
          ...(novelType === "Translation"
            ? {
                original_title: str(a.title, "title", 160)!.trim(),
                original_language: str(a.original_language, "original_language", 40, false) ?? null,
                translation_language: translationLanguage ?? null,
                language: translationLanguage ?? str(a.language, "language", 10, false) ?? "en",
                original_platform: str(a.original_platform, "original_platform", 2000, false) ?? null,
                translator: str(a.translator, "translator", 200, false) ?? null,
                translator_group: str(a.translator_group, "translator_group", 200, false) ?? null,
              }
            : {}),
        })
        .select(NOVEL_COLUMNS)
        .single();
      check(error);
      return data;
    },
  },
  {
    name: "update_novel",
    title: "Update novel",
    description: "Update metadata of one of your novels. Only the fields you pass are changed.",
    readOnly: false,
    inputSchema: schema(
      {
        novel_id: idProp("Novel UUID"),
        title: { type: "string", maxLength: 160 },
        translation_title: { type: "string", maxLength: 160 },
        description: { type: "string", maxLength: 5000 },
        status: { type: "string", enum: [...STATUSES] },
        visibility: { type: "string", enum: [...VISIBILITY] },
        genre: { type: "string", maxLength: 80 },
        tags: { type: "array", items: { type: "string" } },
      },
      ["novel_id"],
    ),
    run: async (userId, a) => {
      const novelId = uuid(a.novel_id, "novel_id");
      const patch: Json = {};
      if (a.title !== undefined) patch.title = str(a.title, "title", 160)!.trim();
      if (a.translation_title !== undefined) patch.translation_title = str(a.translation_title, "translation_title", 160, false) ?? null;
      if (a.description !== undefined) patch.description = str(a.description, "description", 5000, false) ?? "";
      if (a.status !== undefined) patch.status = oneOf(a.status, "status", STATUSES);
      if (a.visibility !== undefined) patch.visibility = oneOf(a.visibility, "visibility", VISIBILITY);
      if (a.genre !== undefined) patch.genre = str(a.genre, "genre", 80);
      if (a.tags !== undefined) patch.tags = strArray(a.tags, "tags");
      if (Object.keys(patch).length === 0) throw new ToolError("Nothing to update");
      const { data, error } = await admin
        .from("novels")
        .update(patch)
        .eq("id", novelId)
        .eq("owner_id", userId)
        .select(NOVEL_COLUMNS)
        .maybeSingle();
      check(error);
      if (!data) throw new ToolError("Novel not found");
      return data;
    },
  },
  {
    name: "save_chapter",
    title: "Create or update chapter",
    description:
      "Create the chapter if that number does not exist yet, otherwise overwrite the provided fields. " +
      "content is the translated/working text; source_content is the original text. Plain-text newlines in content are stored as <br> line breaks.",
    readOnly: false,
    destructive: true,
    inputSchema: schema(
      {
        novel_id: idProp("Novel UUID"),
        chapter_number: { type: "integer", minimum: 1 },
        title: { type: "string", maxLength: 200 },
        content: { type: "string" },
        source_content: { type: "string" },
        source_url: { type: "string" },
        status: { type: "string", enum: ["draft", "published"] },
      },
      ["novel_id", "chapter_number"],
    ),
    run: async (userId, a) => {
      const novelId = uuid(a.novel_id, "novel_id");
      await assertOwnsNovel(userId, novelId);
      const number = int(a.chapter_number, "chapter_number", 1, 100000)!;
      const patch: Json = {};
      if (a.title !== undefined) patch.title = str(a.title, "title", 200)!.trim();
      if (a.content !== undefined) patch.content = toChapterHtml(str(a.content, "content", MAX_TEXT, false) ?? "");
      if (a.source_content !== undefined) patch.source_content = str(a.source_content, "source_content", MAX_TEXT, false) ?? null;
      if (a.source_url !== undefined) patch.source_url = str(a.source_url, "source_url", 2000, false) ?? null;
      if (a.status !== undefined) {
        patch.status = oneOf(a.status, "status", ["draft", "published"] as const);
        patch.published_at = patch.status === "published" ? new Date().toISOString() : null;
      }
      return await upsertChapter(novelId, number, patch);
    },
  },
  {
    name: "save_glossary_term",
    title: "Add or update glossary term",
    description:
      "Add a glossary term, or update it if the same source_term already exists in that scope. Omit novel_id for a global term.",
    readOnly: false,
    inputSchema: schema(
      {
        novel_id: idProp("Novel UUID; omit for global"),
        source_term: { type: "string", maxLength: 200 },
        preferred_term: { type: "string", maxLength: 200 },
        category: { type: "string", maxLength: 40 },
        definition: { type: "string", maxLength: 1000 },
      },
      ["source_term", "preferred_term"],
    ),
    run: async (userId, a) => {
      const novelId = a.novel_id ? uuid(a.novel_id, "novel_id") : null;
      if (novelId) await assertOwnsNovel(userId, novelId);
      const source = str(a.source_term, "source_term", 200)!.trim();
      const row = {
        owner_id: userId,
        novel_id: novelId,
        source_term: source,
        preferred_term: str(a.preferred_term, "preferred_term", 200)!.trim(),
        category: str(a.category, "category", 40, false) ?? "term",
        definition: str(a.definition, "definition", 1000, false) ?? "",
      };
      let find = admin
        .from("glossary_entries")
        .select("id")
        .eq("owner_id", userId)
        .ilike("source_term", source.replace(/[%_\\]/g, "\\$&"));
      find = novelId ? find.eq("novel_id", novelId) : find.is("novel_id", null);
      const { data: existing, error: findError } = await find.limit(1).maybeSingle();
      check(findError);
      const columns = "id,novel_id,source_term,preferred_term,category,definition";
      if (existing) {
        const { data, error } = await admin.from("glossary_entries").update(row).eq("id", existing.id).select(columns).single();
        check(error);
        return { created: false, entry: data };
      }
      const { data, error } = await admin.from("glossary_entries").insert(row).select(columns).single();
      check(error);
      return { created: true, entry: data };
    },
  },
  {
    name: "delete_glossary_term",
    title: "Delete glossary term",
    description: "Delete one of your glossary terms by id.",
    readOnly: false,
    destructive: true,
    inputSchema: schema({ entry_id: idProp("Glossary entry UUID") }, ["entry_id"]),
    run: async (userId, a) => {
      const { data, error } = await admin
        .from("glossary_entries")
        .delete()
        .eq("id", uuid(a.entry_id, "entry_id"))
        .eq("owner_id", userId)
        .select("id");
      check(error);
      if (!data?.length) throw new ToolError("Glossary term not found");
      return { deleted: true };
    },
  },

  {
    name: "scrape_url",
    title: "Fetch a webpage as text",
    description:
      "Fetch a chapter webpage with Firecrawl and return its readable text. Set clean_with_ai to strip ads/navigation with the server's AI.",
    readOnly: true,
    openWorld: true,
    inputSchema: schema(
      { url: { type: "string" }, clean_with_ai: { type: "boolean", default: false } },
      ["url"],
    ),
    run: async (_userId, a) => {
      const r = await callFunction("firecrawl-scrape", {
        url: str(a.url, "url", 2000),
        cleanWithAi: a.clean_with_ai === true,
      }, 170_000);
      return {
        title: r.title,
        chapter_number: r.chapterNumber,
        chapter_title: r.chapterTitle,
        content: r.content,
      };
    },
  },
  {
    name: "extract_novel_metadata",
    title: "Extract novel info from a URL",
    description:
      "Read a novel's information page and return structured metadata (title, translated title, author, genre, synopsis, cover...). Does not create anything: pass the result to create_novel.",
    readOnly: true,
    openWorld: true,
    inputSchema: schema({ url: { type: "string" } }, ["url"]),
    run: async (_userId, a) => {
      const r = await callFunction("ai-novel-import", { url: str(a.url, "url", 2000) });
      return { novel: r.novel, missing_fields: r.missingFields };
    },
  },
  {
    name: "discover_chapter_links",
    title: "Find chapter links on an index page",
    description: "List the individual chapter links on a novel's index/table-of-contents page, optionally within a chapter range.",
    readOnly: true,
    openWorld: true,
    inputSchema: schema(
      {
        url: { type: "string" },
        chapter_from: { type: "integer", minimum: 1 },
        chapter_to: { type: "integer", minimum: 1 },
      },
      ["url"],
    ),
    run: async (_userId, a) => {
      const r = await callFunction("ai-discover-chapter-links", {
        url: str(a.url, "url", 2000),
        chapterFrom: int(a.chapter_from, "chapter_from", 1, 100000, false) ?? null,
        chapterTo: int(a.chapter_to, "chapter_to", 1, 100000, false) ?? null,
      }, 170_000);
      return { chapter_count: r.chapter_count, chapters: r.chapters };
    },
  },
  {
    name: "import_chapter_from_url",
    title: "Import a chapter from a webpage",
    description:
      "Fetch one chapter page, extract the chapter text, and save it as a draft (replacing that chapter number if it exists). " +
      "Optionally extract glossary terms and translate it. Translation makes this slow, so keep chapters to one per call.",
    readOnly: false,
    destructive: true,
    openWorld: true,
    inputSchema: schema(
      {
        novel_id: idProp("Novel UUID"),
        url: { type: "string" },
        chapter_number: { type: "integer", minimum: 1, description: "Detected from the page when omitted" },
        extract_glossary: { type: "boolean", default: false },
        translate: { type: "boolean", default: false },
      },
      ["novel_id", "url"],
    ),
    run: async (userId, a) => {
      const novel = await getNovelContext(userId, uuid(a.novel_id, "novel_id"));
      return await importChapter(userId, novel, {
        url: str(a.url, "url", 2000)!,
        chapterNumber: int(a.chapter_number, "chapter_number", 1, 100000, false),
        extractGlossary: a.extract_glossary === true,
        translate: a.translate === true,
      });
    },
  },
  {
    name: "import_novel_chapters",
    title: "Import a range of chapters",
    description:
      "Find chapter links on an index page and import up to 3 chapters per call as drafts (replacing existing numbers). " +
      "Glossary extraction and translation are skipped by default. Call again with the returned next_chapter_from to continue.",
    readOnly: false,
    destructive: true,
    openWorld: true,
    inputSchema: schema(
      {
        novel_id: idProp("Novel UUID"),
        index_url: { type: "string", description: "Novel page listing the chapters" },
        chapter_from: { type: "integer", minimum: 1 },
        chapter_to: { type: "integer", minimum: 1 },
        skip_glossary_extraction: { type: "boolean", default: true },
        skip_translation: { type: "boolean", default: true },
      },
      ["novel_id", "index_url", "chapter_from", "chapter_to"],
    ),
    run: async (userId, a) => {
      const novel = await getNovelContext(userId, uuid(a.novel_id, "novel_id"));
      const from = int(a.chapter_from, "chapter_from", 1, 100000)!;
      const to = int(a.chapter_to, "chapter_to", 1, 100000)!;
      if (to < from) throw new ToolError("chapter_to must be >= chapter_from");
      const discovered = await callFunction("ai-discover-chapter-links", {
        url: str(a.index_url, "index_url", 2000),
        chapterFrom: from,
        chapterTo: to,
      }, 170_000);
      const links = (Array.isArray(discovered.chapters) ? discovered.chapters : []) as {
        chapter_number: number;
        title?: string;
        url: string;
      }[];
      if (!links.length) throw new ToolError("No chapter links were found in that range");
      const batch = links.slice(0, 3);
      const results: Json[] = [];
      for (const link of batch) {
        try {
          results.push({
            ok: true,
            ...(await importChapter(userId, novel, {
              url: link.url,
              chapterNumber: link.chapter_number,
              discoveredTitle: link.title,
              extractGlossary: a.skip_glossary_extraction === false,
              translate: a.skip_translation === false,
            })),
          });
        } catch (error) {
          results.push({
            ok: false,
            chapter_number: link.chapter_number,
            error: error instanceof ToolError ? error.message : "Chapter import failed",
          });
        }
      }
      return {
        imported: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
        remaining: links.length - batch.length,
        next_chapter_from: links.length > batch.length ? links[batch.length].chapter_number : null,
      };
    },
  },
  {
    name: "translate_chapter",
    title: "Translate a chapter",
    description:
      "Translate a chapter with the server's AI into the novel's translation language, preserving line count, and save it. " +
      "The original text is kept in source_content. Overwrites the chapter's current content.",
    readOnly: false,
    destructive: true,
    inputSchema: schema(
      {
        novel_id: idProp("Novel UUID"),
        chapter_number: { type: "integer", minimum: 1 },
        save: { type: "boolean", default: true, description: "false returns the translation without saving" },
      },
      ["novel_id", "chapter_number"],
    ),
    run: async (userId, a) => {
      const novelId = uuid(a.novel_id, "novel_id");
      const number = int(a.chapter_number, "chapter_number", 1, 100000)!;
      const novel = await getNovelContext(userId, novelId);
      const chapter = await loadChapter(userId, novelId, number);
      const original = chapter.source_content?.trim() ? chapter.source_content : chapter.content;
      const translated = await translateText(novel, number, chapter.title, original);
      if (a.save === false) return { saved: false, ...translated };
      await upsertChapter(novelId, number, {
        title: translated.title,
        content: toChapterHtml(translated.content, true),
        source_content: chapter.source_content?.trim() ? chapter.source_content : stripHtml(chapter.content),
      });
      return { saved: true, chapter_number: number, title: translated.title, content_length: translated.content.length };
    },
  },
  {
    name: "extract_glossary",
    title: "Extract glossary terms with AI",
    description:
      "Run AI glossary extraction on a chapter's original text and add the new terms to the novel's glossary (existing terms are skipped).",
    readOnly: false,
    inputSchema: schema(
      { novel_id: idProp("Novel UUID"), chapter_number: { type: "integer", minimum: 1 } },
      ["novel_id", "chapter_number"],
    ),
    run: async (userId, a) => {
      const novelId = uuid(a.novel_id, "novel_id");
      const novel = await getNovelContext(userId, novelId);
      const chapter = await loadChapter(userId, novelId, int(a.chapter_number, "chapter_number", 1, 100000)!);
      const text = stripHtml(chapter.source_content?.trim() ? chapter.source_content : chapter.content);
      return await extractAndSaveGlossary(userId, novel, text);
    },
  },
  {
    name: "find_replace_chapter",
    title: "Find and replace in a chapter",
    description:
      "Replace all exact, case-sensitive literal matches in one chapter. Provide text for an unsaved draft (returned without saving), or novel_id and chapter_number for a saved chapter (saved unless dry_run is true).",
    readOnly: false,
    destructive: true,
    inputSchema: schema(
      {
        novel_id: idProp("Novel UUID; use with chapter_number for a saved chapter"),
        chapter_number: { type: "integer", minimum: 1, description: "Chapter number for saved mode" },
        text: { type: "string", description: "Unsaved chapter draft text for draft mode" },
        find: { type: "string", minLength: 1 },
        replace: { type: "string" },
        dry_run: { type: "boolean", default: false, description: "For saved mode, report count without saving" },
      },
      ["find", "replace"],
    ),
    run: async (userId, a) => {
      const mode = (() => {
        try {
          return findReplaceMode(a);
        } catch (error) {
          throw new ToolError(error instanceof Error ? error.message : "Invalid mode arguments");
        }
      })();
      const find = str(a.find, "find", MAX_TEXT)!;
      let replacement: string;
      try {
        replacement = validateReplacement(a.replace);
      } catch (error) {
        throw new ToolError(error instanceof Error ? error.message : "replace must be a string");
      }
      if (replacement.length > MAX_TEXT) throw new ToolError(`replace is too long (max ${MAX_TEXT} characters)`);
      let content: string;
      let novelId: string | undefined;
      let chapterNumber: number | undefined;
      if (mode === "draft") {
        if (typeof a.text !== "string") throw new ToolError("text must be a string");
        if (a.text.length > MAX_TEXT) throw new ToolError(`text is too long (max ${MAX_TEXT} characters)`);
        content = a.text;
      } else {
        novelId = uuid(a.novel_id, "novel_id");
        chapterNumber = int(a.chapter_number, "chapter_number", 1, 100000)!;
        const chapter = await loadChapter(userId, novelId, chapterNumber);
        content = chapter.content;
      }
      let result: { text: string; replacements: number };
      try {
        result = replaceLiteral(content, find, replacement);
      } catch (error) {
        throw new ToolError(error instanceof Error ? error.message : "Find and replace failed");
      }
      if (mode === "draft") return { saved: false, ...result };
      if (a.dry_run === true || result.replacements === 0) {
        return { saved: false, chapter_number: chapterNumber, replacements: result.replacements };
      }
      await upsertChapter(novelId!, chapterNumber!, { content: result.text });
      return { saved: true, chapter_number: chapterNumber, replacements: result.replacements };
    },
  },
  {
    name: "apply_glossary",
    title: "Apply glossary to a chapter",
    description:
      "Replace every glossary source term in a chapter's content with its preferred term (novel glossary plus your global terms) and save it.",
    readOnly: false,
    destructive: true,
    inputSchema: schema(
      {
        novel_id: idProp("Novel UUID"),
        chapter_number: { type: "integer", minimum: 1 },
        dry_run: { type: "boolean", default: false, description: "Only report how many replacements would be made" },
      },
      ["novel_id", "chapter_number"],
    ),
    run: async (userId, a) => {
      const novelId = uuid(a.novel_id, "novel_id");
      const chapter = await loadChapter(userId, novelId, int(a.chapter_number, "chapter_number", 1, 100000)!);
      const { data: terms, error } = await admin
        .from("glossary_entries")
        .select("source_term,preferred_term")
        .eq("owner_id", userId)
        .or(`novel_id.eq.${novelId},novel_id.is.null`)
        .limit(5000);
      check(error);
      if (!terms?.length) throw new ToolError("The glossary is empty");
      let content = chapter.content;
      let replacements = 0;
      for (const term of terms) {
        const pattern = new RegExp(`${term.source_term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[ \\t]*`, "g");
        content = content.replace(pattern, () => {
          replacements += 1;
          return `${term.preferred_term} `;
        });
      }
      if (a.dry_run === true || content === chapter.content) return { saved: false, replacements };
      await upsertChapter(novelId, chapter.chapter_number, { content });
      return { saved: true, replacements };
    },
  },
  {
    name: "delete_glossary_terms",
    title: "Delete several glossary terms",
    description:
      "Delete glossary terms by id list, or every term of a novel with delete_all (requires confirm: true). This cannot be undone.",
    readOnly: false,
    destructive: true,
    inputSchema: schema({
      entry_ids: { type: "array", items: { type: "string" }, maxItems: 500 },
      novel_id: idProp("Required with delete_all"),
      delete_all: { type: "boolean", default: false },
      confirm: { type: "boolean", description: "Must be true when delete_all is true" },
    }),
    run: async (userId, a) => {
      if (a.delete_all === true) {
        if (a.confirm !== true) throw new ToolError("delete_all requires confirm: true");
        const novelId = uuid(a.novel_id, "novel_id");
        await assertOwnsNovel(userId, novelId);
        const { data, error } = await admin
          .from("glossary_entries")
          .delete()
          .eq("owner_id", userId)
          .eq("novel_id", novelId)
          .select("id");
        check(error);
        return { deleted: data?.length ?? 0 };
      }
      const ids = Array.isArray(a.entry_ids) ? a.entry_ids.map((id) => uuid(id, "entry_ids")) : [];
      if (!ids.length) throw new ToolError("Pass entry_ids, or delete_all with confirm");
      const { data, error } = await admin
        .from("glossary_entries")
        .delete()
        .eq("owner_id", userId)
        .in("id", ids)
        .select("id");
      check(error);
      return { deleted: data?.length ?? 0 };
    },
  },
  {
    name: "delete_chapter",
    title: "Move a chapter to trash",
    description: "Move a chapter to the trash (it can be restored with restore_chapter).",
    readOnly: false,
    inputSchema: schema(
      { novel_id: idProp("Novel UUID"), chapter_number: { type: "integer", minimum: 1 } },
      ["novel_id", "chapter_number"],
    ),
    run: async (userId, a) => {
      const chapter = await loadChapter(userId, uuid(a.novel_id, "novel_id"), int(a.chapter_number, "chapter_number", 1, 100000)!);
      const { error } = await admin.from("chapters").update({ deleted_at: new Date().toISOString() }).eq("id", chapter.id);
      check(error);
      return { trashed: true, chapter_number: chapter.chapter_number, title: chapter.title };
    },
  },
  {
    name: "list_trash_chapters",
    title: "List trashed chapters",
    description: "List chapters of a novel that are in the trash.",
    readOnly: true,
    inputSchema: schema({ novel_id: idProp("Novel UUID") }, ["novel_id"]),
    run: async (userId, a) => {
      const novelId = uuid(a.novel_id, "novel_id");
      await assertOwnsNovel(userId, novelId);
      const { data, error } = await admin
        .from("chapters")
        .select("id,chapter_number,title,status,deleted_at")
        .eq("novel_id", novelId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      check(error);
      return data;
    },
  },
  {
    name: "restore_chapter",
    title: "Restore a trashed chapter",
    description: "Restore a chapter from the trash by its id (from list_trash_chapters). Fails if that chapter number is now in use.",
    readOnly: false,
    inputSchema: schema({ novel_id: idProp("Novel UUID"), chapter_id: idProp("Chapter UUID") }, ["novel_id", "chapter_id"]),
    run: async (userId, a) => {
      const novelId = uuid(a.novel_id, "novel_id");
      await assertOwnsNovel(userId, novelId);
      const { data, error } = await admin
        .from("chapters")
        .update({ deleted_at: null })
        .eq("id", uuid(a.chapter_id, "chapter_id"))
        .eq("novel_id", novelId)
        .not("deleted_at", "is", null)
        .select(CHAPTER_COLUMNS)
        .maybeSingle();
      if (error?.code === "23505") throw new ToolError("That chapter number is already used by another chapter");
      check(error);
      if (!data) throw new ToolError("Trashed chapter not found");
      return data;
    },
  },
];

const toolByName = new Map(tools.map((t) => [t.name, t]));

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function authenticate(req: Request): Promise<string | null> {
  const header = req.headers.get("Authorization");
  const token =
    header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? new URL(req.url).searchParams.get("token")?.trim();
  if (!token || !token.startsWith("rim_") || token.length > 200) return null;
  const { data } = await admin
    .from("mcp_tokens")
    .select("id,user_id")
    .eq("token_hash", await sha256Hex(token))
    .maybeSingle();
  if (!data) return null;
  void admin.from("mcp_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data.user_id;
}

const rpcResult = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: unknown, code: number, message: string) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

async function handleMessage(userId: string, msg: Json): Promise<Json | null> {
  const { id, method } = msg as { id?: unknown; method?: string };
  const isNotification = id === undefined;
  if (typeof method !== "string") return isNotification ? null : rpcError(id, -32600, "Invalid request");
  const params = (msg.params ?? {}) as Json;

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "rimora", title: "Rimora", version: "1.0.0" },
        instructions:
          "Manage the user's Rimora novels, chapters and glossary. Chapter `content` is the translated/working text; `source_content` is the original.",
      });
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, {
        tools: tools.map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: {
            title: t.title,
            readOnlyHint: t.readOnly,
            destructiveHint: t.destructive ?? false,
            openWorldHint: t.openWorld ?? false,
          },
        })),
      });
    case "tools/call": {
      const tool = toolByName.get(String(params.name));
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${String(params.name)}`);
      try {
        const result = await tool.run(userId, (params.arguments ?? {}) as Json);
        return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (error) {
        const message = error instanceof ToolError ? error.message : "Internal error";
        if (!(error instanceof ToolError)) console.error("mcp tool error", tool.name, error);
        return rpcResult(id, { isError: true, content: [{ type: "text", text: message }] });
      }
    }
    default:
      return isNotification ? null : rpcError(id, -32601, `Method not found: ${method}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const respond = (body: unknown, status = 200, extra: HeadersInit = {}) =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
    });

  const userId = await authenticate(req);
  if (!userId) {
    return respond({ error: "Invalid or missing Rimora access token" }, 401, {
      "WWW-Authenticate": 'Bearer realm="rimora"',
    });
  }
  // Stateless server: no SSE stream and no sessions to terminate.
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405, { Allow: "POST" });

  const body = await req.json().catch(() => undefined);
  if (body === undefined) return respond(rpcError(null, -32700, "Parse error"), 400);

  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.map((m) => handleMessage(userId, m as Json)))).filter(Boolean);
    return replies.length ? respond(replies) : respond(null, 202);
  }
  const reply = await handleMessage(userId, body as Json);
  return reply ? respond(reply) : respond(null, 202);
});
