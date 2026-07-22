import type { Session } from "@supabase/supabase-js";

import { api } from "./client";
import type { BootstrapResponse, CurrentUserResponse } from "./types";
import { supabase } from "../supabase";

export async function signUp(email: string, password: string) {
  const result = await supabase.auth.signUp({ email, password });
  if (result.error) throw result.error;
  return result.data;
}

export async function signIn(email: string, password: string) {
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  return result.data;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
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

export function bootstrapProfile(): Promise<BootstrapResponse> {
  return api.post<BootstrapResponse>("/api/v1/auth/bootstrap");
}
