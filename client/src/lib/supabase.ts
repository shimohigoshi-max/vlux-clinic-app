import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url) {
  throw new Error(
    "[supabase] VITE_SUPABASE_URL が未設定です。Replit Secrets / Vercel env に登録してください。"
  );
}
if (!anonKey) {
  throw new Error(
    "[supabase] VITE_SUPABASE_ANON_KEY が未設定です。Replit Secrets / Vercel env に登録してください。"
  );
}

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "vlux-auth",
  },
});
