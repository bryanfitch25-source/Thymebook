import { createClient } from "@supabase/supabase-js";

// Thymebook is a single-purpose personal app with exactly one shared
// household login (no multi-tenant concerns), so it's fine to hardcode the
// project URL and the publishable/anon key here directly rather than build
// out an env-var pipeline. The anon key is safe to ship client-side - it's
// Supabase's intended public key, and access is enforced by Row Level
// Security policies in supabase/migrations (only signed-in users can read
// or write anything, and there is only ever one signed-in identity).
export const SUPABASE_URL = "https://yqcrilowcauibrmigfbo.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_qwhG_UWeFMVHKApdkk3J8w_eNS9KQVb";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
