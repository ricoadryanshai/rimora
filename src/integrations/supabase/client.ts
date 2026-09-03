import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const configuredSupabase = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

// Keep the app renderable when local backend configuration has not been provided yet.
const supabaseUrl = SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = SUPABASE_PUBLISHABLE_KEY || "placeholder-key";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseKey,
);

export const isSupabaseConfigured = configuredSupabase;
