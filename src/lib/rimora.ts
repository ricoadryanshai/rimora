import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Reuse the authenticated singleton. The Rimora tables are not in generated
// types yet, so this view intentionally exposes the client without its schema type.
export const rimora = supabase as unknown as SupabaseClient;