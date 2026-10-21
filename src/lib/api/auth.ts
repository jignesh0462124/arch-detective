import type { Session } from "@supabase/supabase-js";

import { api } from "./client";
import type { BootstrapResponse, CurrentUserResponse } from "./types";
import { supabase } from "../supabase";

export async function signUp(email: string, password: string, displayName?: string) {
  const result = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo:
        typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
      ...(displayName
        ? {
            data: {
              display_name: displayName,
              full_name: displayName,
            },
          }
        : {}),
    },
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function signIn(email: string, password: string) {
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  return result.data;
}

export async function signOut(scope: "local" | "global" = "local"): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope });
  if (error) throw error;
}

export async function resendConfirmation(email: string) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${window.location.origin}/login` },
  });
  if (error) throw error;
}

export async function resetPassword(email: string): Promise<void> {
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function getMe(): Promise<CurrentUserResponse> {
  return api.get<CurrentUserResponse>("/api/v1/auth/me");
}

export async function bootstrapProfile(): Promise<BootstrapResponse> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id || "";
  return {
    profile: {
      id: userId,
      display_name: data.session?.user?.user_metadata?.display_name || "User",
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    memberships: [],
  };
}
