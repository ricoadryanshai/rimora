import { createClient } from "@supabase/supabase-js";

// Kept separate until the generated Supabase types include Rimora's new tables.
export const rimora = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);