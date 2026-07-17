import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client. SERVER-ONLY — it bypasses RLS, so never
// import this into client components. Used for admin tasks like creating
// judge accounts via the Auth admin API.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
