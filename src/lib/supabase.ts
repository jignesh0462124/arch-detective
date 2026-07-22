import { createClient } from "@supabase/supabase-js";

const configuredUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const configuredKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(configuredUrl && configuredKey);

// Valid placeholders keep SSR/builds importable before local credentials are supplied.
const supabaseUrl = configuredUrl || "http://127.0.0.1:54321";
const publishableKey = configuredKey || "missing-publishable-key";

export const supabase = createClient(supabaseUrl, publishableKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: typeof window !== "undefined",
  },
});
