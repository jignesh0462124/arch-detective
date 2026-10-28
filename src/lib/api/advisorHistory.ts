import { apiClient } from "./client";
import type { FindingContextIds } from "./ai-client";
export type AdvisorConversation = {
  finding_title?: string;
  id: string;
  workspace_id: string;
  title: string;
  scan_id: string | null;
  finding_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};
export type AdvisorMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "streaming" | "completed" | "interrupted" | "failed";
  model_id?: string;
  created_at: string;
};
export type AdvisorPage<T> = { items: T[]; next_cursor: string | null };
const root = "/api/v1/ai/conversations";
export function listConversations(
  workspace: string,
  q: string,
  cursor?: string | null,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ workspace_id: workspace, q });
  if (cursor) params.set("cursor", cursor);
  return apiClient<AdvisorPage<AdvisorConversation>>(`${root}?${params}`, {
    signal,
    cache: "no-store",
  });
}
export const getConversation = (id: string, signal?: AbortSignal) =>
  apiClient<AdvisorConversation>(`${root}/${encodeURIComponent(id)}`, {
    signal,
    cache: "no-store",
  });
export function getConversationMessages(id: string, cursor?: string | null, signal?: AbortSignal) {
  return apiClient<AdvisorPage<AdvisorMessage>>(
    `${root}/${encodeURIComponent(id)}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    { signal, cache: "no-store" },
  );
}
export const createConversation = (
  workspace: string,
  title: string,
  context?: FindingContextIds,
  signal?: AbortSignal,
) =>
  apiClient<AdvisorConversation>(root, {
    method: "POST",
    body: JSON.stringify({ workspace_id: workspace, title: title.trim().slice(0, 120), context }),
    signal,
  });
export const renameConversation = (id: string, title: string) =>
  apiClient<AdvisorConversation>(`${root}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
export const deleteConversation = (id: string) =>
  apiClient<{ deleted: string }>(`${root}/${encodeURIComponent(id)}`, { method: "DELETE" });
