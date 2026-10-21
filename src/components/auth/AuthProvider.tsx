import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSession, resetPassword, signIn, signOut, signUp } from "@/lib/api/auth";
import { supabase, observeAuth } from "@/lib/supabase";
import { setAuthOwner, clearAuthCallbackUrl, authScope, isCurrentScope } from "@/lib/authState";
import { prefetchUserData } from "@/lib/api/prefetch";

type Status = "initializing" | "authenticated" | "signed-out" | "recovery" | "error";
type AuthValue = {
  session: Session | null;
  user: Session["user"] | null;
  status: Status;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemo: false;
  error: string;
  signingOut: boolean;
  signIn: typeof signIn;
  signUp: typeof signUp;
  resetPassword: typeof resetPassword;
  signOut: (scope?: "local" | "global") => Promise<void>;
  retry: () => Promise<void>;
};
// The context and provider intentionally share the compatibility module.
// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("initializing");
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const revision = useRef(0);
  const current = useRef<Session | null>(null);
  const recovery = useRef(false);
  const alive = useRef(false);
  const logoutTask = useRef<Promise<void> | null>(null);
  const apply = useCallback(
    (next: Session | null, recovering = false) => {
      revision.current++;
      setAuthOwner(next?.user.id ?? null);
      if (current.current?.user.id !== next?.user.id) {
        void client.cancelQueries();
        client.clear();
      }
      current.current = next;
      recovery.current = !!next && (recovering || recovery.current);
      setSession(next);
      setError("");
      setStatus(next ? (recovery.current ? "recovery" : "authenticated") : "signed-out");
    },
    [client],
  );
  const retry = useCallback(async () => {
    const version = revision.current;
    setStatus("initializing");
    try {
      const next = await getSession();
      if (next) {
        const { error: validationError } = await supabase.auth.getUser();
        if (validationError) {
          if (validationError.status === 401 || validationError.status === 403) {
            if (alive.current && version === revision.current) {
              try {
                await signOut("local");
              } catch {
                /* Invalid credentials cannot grant access. */
              }
              if (alive.current && (version === revision.current || !current.current)) apply(null);
            }
            return;
          }
          throw validationError;
        }
      }
      if (alive.current && version === revision.current) apply(next);
    } catch {
      if (alive.current && version === revision.current) {
        setError("Unable to check your session. Check your connection and retry.");
        setStatus("error");
      }
    } finally {
      if (alive.current) clearAuthCallbackUrl();
    }
  }, [apply]);
  useEffect(() => {
    alive.current = true;
    const unsubscribe = observeAuth((event, next) => {
      // Initialization errors must not be mistaken for an empty session.
      if (event === "INITIAL_SESSION") return;
      if (alive.current) apply(next, event === "PASSWORD_RECOVERY");
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        const url = new URL(window.location.href);
        if (url.hash.includes("access_token=") || url.searchParams.has("code")) {
          url.hash = "";
          url.searchParams.delete("code");
          window.history.replaceState(window.history.state, "", url.pathname + url.search);
        }
      }
    });
    void retry();
    const revalidate = () => {
      void retry();
    };
    window.addEventListener("archon-auth-revalidate", revalidate);
    return () => {
      alive.current = false;
      // This is a request-generation counter, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      revision.current++;
      unsubscribe();
      window.removeEventListener("archon-auth-revalidate", revalidate);
    };
  }, [apply, retry]);
  useEffect(() => {
    if (status === "authenticated" && session?.user.id) void prefetchUserData(client);
  }, [client, session?.user.id, status]);
  const handleSignOut = useCallback(
    (scope: "local" | "global" = "local") => {
      if (logoutTask.current) return logoutTask.current;
      const startedScope = authScope();
      setSigningOut(true);
      setError("");
      logoutTask.current = (async () => {
        try {
          await signOut(scope);
          if (alive.current && isCurrentScope(startedScope)) apply(null);
        } catch (failure) {
          try {
            const next = await getSession();
            if (alive.current && isCurrentScope(startedScope)) apply(next);
          } catch {
            /* Retain known state. */
          }
          if (alive.current && isCurrentScope(startedScope))
            setError("Sign out could not be confirmed. Please retry.");
          throw failure;
        } finally {
          logoutTask.current = null;
          if (alive.current) setSigningOut(false);
        }
      })();
      return logoutTask.current;
    },
    [apply],
  );
  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        status,
        isAuthenticated: !!session && status === "authenticated",
        isLoading: status === "initializing",
        isDemo: false,
        error,
        signingOut,
        signIn,
        signUp,
        resetPassword,
        signOut: handleSignOut,
        retry,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
