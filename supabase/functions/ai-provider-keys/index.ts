import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encryptSecret } from "../_shared/crypto.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => null);
    const providerId = typeof body?.providerId === "string" ? body.providerId : "";
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";

    if (!providerId || !apiKey || apiKey.length > 500) {
      return json({ error: "providerId and a valid apiKey are required" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: provider } = await admin
      .from("ai_providers")
      .select("id, user_id")
      .eq("id", providerId)
      .maybeSingle();

    if (!provider || provider.user_id !== userId) {
      return json({ error: "Provider not found" }, 404);
    }

    const encrypted = await encryptSecret(apiKey);
    const { error: updateError } = await admin
      .from("ai_providers")
      .update({ api_key_encrypted: encrypted })
      .eq("id", providerId);

    if (updateError) return json({ error: updateError.message }, 500);

    return json({ success: true });
  } catch (error) {
    console.error("ai-provider-keys error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
