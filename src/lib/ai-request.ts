import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

// The installed functions-js version does not support invoke({ signal }).
// Use an authenticated fetch so Stop actually aborts the HTTP request.
export const invokeAiFunction = async (
  name: string,
  options: { body: Record<string, unknown> },
  signal: AbortSignal,
) => {
  signal.throwIfAborted();
  const { data, error } = await supabase.auth.getSession();
  signal.throwIfAborted();
  if (error) throw error;
  if (!data.session) throw new Error("Sign in before using AI tools.");
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      apikey: SUPABASE_PUBLISHABLE_KEY ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options.body),
    signal,
  });
  const result = await response.json();
  signal.throwIfAborted();
  if (!response.ok) throw new Error(result?.error || `AI request failed (${response.status}).`);
  return { data: result, error: null as Error | null };
};
