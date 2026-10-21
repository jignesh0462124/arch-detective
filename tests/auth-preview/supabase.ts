import type { Session } from "@supabase/supabase-js";
type Callback = (event: string, session: Session | null) => void;
let callback: Callback | null = null;
let session: Session | null = null;
let signouts = 0;
let updates = 0;
let calls = 0;
let subscribes = 0;
const scenario = new URLSearchParams(location.search).get("scenario");
const fake = (id = "alice") =>
  ({ user: { id, email: `${id}@example.test` }, access_token: "fixture" }) as Session;
if (["ordinary", "recovery", "logout-failure", "global"].includes(scenario || "")) session = fake();
function emit(event: string, next: Session | null) {
  session = next;
  callback?.(event, next);
}
export const isSupabaseConfigured = true;
export const authCallbackFailed = false;
export function observeAuth(callback: Callback) {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}
export const supabase = {
  auth: {
    onAuthStateChange: (fn: Callback) => {
      callback = fn;
      subscribes++;
      queueMicrotask(() =>
        fn(scenario === "recovery" ? "PASSWORD_RECOVERY" : "INITIAL_SESSION", session),
      );
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              callback = null;
            },
          },
        },
      };
    },
    getSession: async () => {
      const captured = session;
      if (scenario === "stale") await new Promise((r) => setTimeout(r, 150));
      return { data: { session: captured }, error: null };
    },
    getUser: async () => ({ data: { user: session?.user }, error: null }),
    signInWithPassword: async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 80));
      if (scenario === "credentials") return { data: {}, error: { code: "invalid_credentials" } };
      emit("SIGNED_IN", fake());
      return { data: { session }, error: null };
    },
    signUp: async () => ({ data: { session: null }, error: null }),
    resetPasswordForEmail: async () => {
      calls++;
      return { error: null };
    },
    resend: async () => {
      calls++;
      return { error: null };
    },
    signOut: async ({ scope }: { scope: string }) => {
      signouts++;
      (window as any).lastScope = scope;
      if ((scenario === "logout-failure" || scenario === "recovery") && signouts === 1)
        return { error: new Error("offline") };
      emit("SIGNED_OUT", null);
      return { error: null };
    },
    updateUser: async () => {
      updates++;
      if (scenario === "update-failure") throw new Error("offline");
      return { error: null };
    },
  },
};
(window as any).authFixture = {
  emit,
  fake,
  stats: () => ({ calls, updates, signouts, subscribes }),
};
