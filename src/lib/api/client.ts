import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { authScope, isCurrentScope, authRequestSignal } from "@/lib/authState";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
export type AuthCheck = "valid" | "invalid" | "unavailable" | "unknown";

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: unknown,
    public authCheck: AuthCheck = "unknown",
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = "ApiError";
  }
}

async function authHeaders(): Promise<{ headers: Headers; session: Session | null }> {
  const headers = new Headers();
  if (!isSupabaseConfigured || typeof window === "undefined") {
    return { headers, session: null };
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session?.access_token) {
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }
  return { headers, session: data.session };
}

export async function apiClient<T>(path: string, options: RequestInit = {}): Promise<T> {
  const scope = authScope();
  const signal = options.signal
    ? AbortSignal.any([options.signal, authRequestSignal()])
    : authRequestSignal();
  const { headers, session } = await authHeaders();
  if (!isCurrentScope(scope)) throw new DOMException("Account changed", "AbortError");
  const optionHeaders = new Headers(options.headers);
  optionHeaders.forEach((value, key) => headers.set(key, value));

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const request = { ...options, signal, headers };
  let response = await fetch(`${API_BASE}${path}`, request);
  let authCheck: AuthCheck = "unknown";
  if (response.status === 401 && typeof window !== "undefined" && session) {
    try {
      const { error } = await supabase.auth.getUser();
      if (!error) {
        authCheck = "valid";
        // A safe read may recover from a token that expired between requests.
        // Uploads and other mutations are never replayed.
        if ((options.method ?? "GET").toUpperCase() === "GET" && isCurrentScope(scope)) {
          const refreshed = await supabase.auth.refreshSession();
          if (!refreshed.error && refreshed.data.session?.access_token && isCurrentScope(scope)) {
            headers.set("Authorization", `Bearer ${refreshed.data.session.access_token}`);
            response = await fetch(`${API_BASE}${path}`, request);
          }
        }
      } else if (error.status === 401 || error.status === 403) {
        authCheck = "invalid";
        window.dispatchEvent(new Event("archon-auth-revalidate"));
      } else authCheck = "unavailable";
    } catch {
      authCheck = "unavailable";
    }
  }
  if (!isCurrentScope(scope)) throw new DOMException("Account changed", "AbortError");

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, response.statusText, body, authCheck);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => apiClient<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiClient<T>(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  patch: <T>(path: string, body: unknown) =>
    apiClient<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  delete: <T>(path: string) => apiClient<T>(path, { method: "DELETE" }),
};
