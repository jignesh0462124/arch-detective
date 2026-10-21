import { createClient } from "@supabase/supabase-js";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

// Capture only a boolean, never provider error descriptions or callback credentials.
export const authCallbackFailed =
  typeof window !== "undefined" &&
  (() => {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    return url.searchParams.has("error") || hash.has("error") || hash.has("error_code");
  })();

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

type AuthObserver = (event: AuthChangeEvent, session: Session | null) => void;
const observers = new Set<AuthObserver>();
let recoverySession: Session | null = null;
// Subscribe as soon as the client exists: a fast callback can finish before React mounts.
const bridge =
  typeof window !== "undefined"
    ? supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY") recoverySession = session;
        if (!session || (recoverySession && recoverySession.user.id !== session.user.id))
          recoverySession = null;
        for (const observer of observers) observer(event, session);
      })
    : null;
export function observeAuth(observer: AuthObserver) {
  observers.add(observer);
  if (recoverySession) observer("PASSWORD_RECOVERY", recoverySession);
  return () => {
    observers.delete(observer);
  };
}
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    bridge?.data.subscription.unsubscribe();
    observers.clear();
  });
