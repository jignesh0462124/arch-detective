import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { authScope, isCurrentScope, authRequestSignal } from "@/lib/authState";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
export type AuthCheck = "valid" | "invalid" | "unavailable" | "unknown";

type SessionCheck = { check: AuthCheck; session: Session | null };
let validation: {
  token: string;
  scope: ReturnType<typeof authScope>;
  task: Promise<SessionCheck>;
} | null = null;

/** Single-flight per token/account; no persistent token cache or mutation replay. */
export function validateSessionAfter401(session: Session): Promise<SessionCheck> {
  const scope = authScope();
  if (validation?.token === session.access_token && isCurrentScope(validation.scope))
    return validation.task;
  const task = (async (): Promise<SessionCheck> => {
    try {
      const { error } = await supabase.auth.getUser();
      if (!isCurrentScope(scope)) throw new DOMException("Account changed", "AbortError");
      if (error) {
        if (error.status === 401) {
          window.dispatchEvent(new Event("archon-auth-revalidate"));
          return { check: "invalid", session: null };
        }
        return { check: "unavailable", session: null };
      }
      const latest = await supabase.auth.getSession();
      if (latest.error || !latest.data.session) return { check: "unavailable", session: null };
      return { check: "valid", session: latest.data.session };
    } catch {
      return { check: "unavailable", session: null };
    }
  })();
  validation = { token: session.access_token, scope, task };
  void task.finally(() => {
    if (validation?.task === task) validation = null;
  });
  return task;
}

let refresh: {
  token: string;
  scope: ReturnType<typeof authScope>;
  task: Promise<Session | null>;
} | null = null;
function refreshOnce(session: Session) {
  if (refresh?.token === session.access_token && isCurrentScope(refresh.scope)) return refresh.task;
  const scope = authScope();
  const task = supabase.auth
    .refreshSession()
    .then((result) => (result.error ? null : result.data.session))
    .catch(() => null);
  refresh = { token: session.access_token, scope, task };
  void task.finally(() => {
    if (refresh?.task === task) refresh = null;
  });
  return task;
}

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
      const validation = await validateSessionAfter401(session);
      authCheck = validation.check;
      if (authCheck === "valid" && validation.session) {
        // Only a near-expiry token justifies refresh. Repeatedly refreshing a valid
        // token cannot repair a backend verifier/configuration failure.
        // Uploads and other mutations are never replayed.
        const nearExpiry =
          !validation.session.expires_at ||
          validation.session.expires_at * 1000 - Date.now() < 60_000;
        if ((options.method ?? "GET").toUpperCase() === "GET" && isCurrentScope(scope)) {
          const next =
            validation.session.access_token !== session.access_token
              ? validation.session
              : nearExpiry
                ? await refreshOnce(validation.session)
                : null;
          if (
            next?.access_token &&
            next.access_token !== session.access_token &&
            isCurrentScope(scope)
          ) {
            headers.set("Authorization", `Bearer ${next.access_token}`);
            response = await fetch(`${API_BASE}${path}`, request);
          }
        }
      }
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
