/** Authenticated advisor transport. Provider credentials stay on the backend. */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { DEFAULT_MODEL_ID, getStoredModelId } from "./ai-models";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };
export type FindingContextIds = { workspace_id: string; scan_id: string; finding_id: string };
export const isAiConfigured = () => isSupabaseConfigured;
export const isGroqConfigured = isAiConfigured;
export const GROQ_MODEL = DEFAULT_MODEL_ID;

async function accessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sign in to use the Security Advisor.");
  return data.session.access_token;
}

async function authFailureMessage() {
  try {
    const { error } = await supabase.auth.getUser();
    if (!error)
      return "You are signed in, but the server could not verify this request. Retry shortly.";
    if (error.status === 401 || error.status === 403) {
      window.dispatchEvent(new Event("archon-auth-revalidate"));
      return "Your session has ended. Sign in again.";
    }
  } catch {
    /* A network error is not proof of expiry. */
  }
  return "Could not check your session. Check your connection and retry.";
}

export async function advisorCapabilities(signal?: AbortSignal): Promise<{ available: boolean }> {
  const token = await accessToken();
  const base = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
  const response = await fetch(`${base}/api/v1/ai/capabilities`, {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) throw new Error(await authFailureMessage());
  if (!response.ok) throw new Error("Advisor availability could not be checked. Retry shortly.");
  return response.json();
}

export async function* streamChat(
  messages: ChatMessage[],
  modelOverride?: string,
  signal?: AbortSignal,
  context?: FindingContextIds,
): AsyncGenerator<string> {
  if (signal?.aborted) return;
  const token = await accessToken();
  const base = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
  const response = await fetch(`${base}/api/v1/ai/chat`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages, model: modelOverride || getStoredModelId(), context }),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error(await authFailureMessage());
    throw new Error(
      response.status === 403 || response.status === 404
        ? "This saved finding is no longer available to your workspace. Choose another finding."
        : response.status === 503
          ? "Security Advisor is temporarily unavailable. Retry shortly."
          : "Advisor request failed. Please try again.",
    );
  }
  if (!response.body) throw new Error("Advisor returned an empty response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let received = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      if (done && pending) {
        lines.push(pending);
        pending = "";
      }
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (raw === "[DONE]") {
          if (!received) throw new Error("Advisor returned no content.");
          return;
        }
        let event;
        try {
          event = JSON.parse(raw);
        } catch {
          continue;
        }
        if (event.error) throw new Error("Advisor stream was interrupted. Please retry.");
        const content = event.choices?.[0]?.delta?.content;
        if (typeof content === "string" && content) {
          received = true;
          yield content;
        }
      }
      if (done) break;
    }
    if (!received) throw new Error("Advisor returned no content.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
