// Rimora MCP server (Streamable HTTP, stateless JSON responses) for Claude custom connectors.
// Auth: personal access token created in Rimora Settings, sent as `Authorization: Bearer <token>`
// or, for clients that cannot set headers (claude.ai connector dialog), as `?token=<token>`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
      },
      ["title"],
    ),
    run: async (userId, a) => {
      const { data, error } = await admin
        .from("novels")
        .insert({
          owner_id: userId,
          title: str(a.title, "title", 160)!.trim(),
          translation_title: str(a.translation_title, "translation_title", 160, false) ?? null,
          novel_type: oneOf(a.novel_type, "novel_type", NOVEL_TYPES) ?? "Novel",
          description: str(a.description, "description", 5000, false) ?? "",
          language: str(a.language, "language", 10, false) ?? "en",
          status: oneOf(a.status, "status", STATUSES) ?? "draft",
          visibility: oneOf(a.visibility, "visibility", VISIBILITY) ?? "private",
          genre: str(a.genre, "genre", 80, false) ?? null,
          tags: strArray(a.tags, "tags") ?? [],
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
      if (a.genre !== undefined) patch.genre = str(a.genre, "genre", 80, false) ?? null;
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
      "content is the translated/working text; source_content is the original text.",
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
      if (a.content !== undefined) patch.content = str(a.content, "content", MAX_TEXT, false) ?? "";
      if (a.source_content !== undefined) patch.source_content = str(a.source_content, "source_content", MAX_TEXT, false) ?? null;
      if (a.source_url !== undefined) patch.source_url = str(a.source_url, "source_url", 2000, false) ?? null;
      if (a.status !== undefined) {
        patch.status = oneOf(a.status, "status", ["draft", "published"] as const);
        patch.published_at = patch.status === "published" ? new Date().toISOString() : null;
      }
      const { data: existing, error: findError } = await admin
        .from("chapters")
        .select("id")
        .eq("novel_id", novelId)
        .eq("chapter_number", number)
        .is("deleted_at", null)
        .maybeSingle();
      check(findError);
      const columns = "id,chapter_number,title,status,updated_at";
      if (existing) {
        if (Object.keys(patch).length === 0) throw new ToolError("Nothing to update");
        const { data, error } = await admin.from("chapters").update(patch).eq("id", existing.id).select(columns).single();
        check(error);
        return { created: false, chapter: data };
      }
      if (!patch.title) throw new ToolError("title is required when creating a chapter");
      const { data, error } = await admin
        .from("chapters")
        .insert({ novel_id: novelId, chapter_number: number, ...patch })
        .select(columns)
        .single();
      check(error);
      return { created: true, chapter: data };
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
            openWorldHint: false,
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
