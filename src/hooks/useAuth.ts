import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { getSession, resetPassword, signIn, signOut, signUp } from "@/lib/api/auth";
import { supabase } from "@/lib/supabase";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    getSession()
      .then((nextSession) => {
        if (mounted) setSession(nextSession);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user: session?.user ?? null,
    isAuthenticated: Boolean(session),
    isLoading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };
}
