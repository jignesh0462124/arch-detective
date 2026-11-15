/** Authenticated advisor transport. Provider credentials stay on the backend. */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { DEFAULT_MODEL_ID, getStoredModelId } from "./ai-models";
import { apiClient, validateSessionAfter401 } from "./client";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };
export type FindingContextIds = { workspace_id: string; scan_id: string } & (
  | { finding_id: string; policy_result_id?: never }
  | { finding_id?: never; policy_result_id: string }
);
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
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return "Sign in to use the Security Advisor.";
    const result = await validateSessionAfter401(data.session);
    if (result.check === "valid")
      return "You are signed in, but the server could not verify this request. Retry shortly.";
    if (result.check === "invalid") {
      return "Your session has ended. Sign in again.";
    }
  } catch {
    /* A network error is not proof of expiry. */
  }
  return "Could not check your session. Check your connection and retry.";
}

export async function advisorCapabilities(
  signal?: AbortSignal,
): Promise<{ available: boolean; history_available?: boolean }> {
  return apiClient<{ available: boolean; history_available?: boolean }>("/api/v1/ai/capabilities", {
    signal,
    cache: "no-store",
  });
}

export async function* streamChat(
  messages: ChatMessage[],
  modelOverride?: string,
  signal?: AbortSignal,
  context?: FindingContextIds,
  options?: {
    conversationId?: string;
    submissionId?: string;
    codeSolution?: boolean;
    onAccepted?: () => void;
  },
): AsyncGenerator<string> {
  if (signal?.aborted) return;
  const token = await accessToken();
  const base = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
  const response = await fetch(`${base}/api/v1/ai/chat`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messages,
      model: modelOverride || getStoredModelId(),
      context,
      conversation_id: options?.conversationId,
      submission_id: options?.submissionId,
      code_solution: options?.codeSolution || false,
    }),
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
  options?.onAccepted?.();
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
        if (event.error)
          throw new Error(
            event.error === "response_truncated"
              ? "The suggestion is incomplete. Regenerate before using the code."
              : event.error === "conversation_save_failed"
                ? "The response could not be saved. Copy any visible suggestion before retrying."
                : "Advisor stream was interrupted. Please retry.",
          );
        const content = event.choices?.[0]?.delta?.content;
        if (typeof content === "string" && content) {
          received = true;
          yield content;
        }
      }
      if (done) break;
    }
    throw new Error(
      received ? "Advisor stream was interrupted. Please retry." : "Advisor returned no content.",
    );
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
