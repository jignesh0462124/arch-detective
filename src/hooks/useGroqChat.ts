import { accountStorage, authScope, isCurrentScope } from "@/lib/authState";
/**
 * useGroqChat.ts (Unified AI Chat Hook)
 * React hook that manages the AI chat conversation state with multi-model streaming support.
 *
 * Supported Models (OmegaPlus Gateway):
 * - glm-5-3-flash (Recommended)
 * - qwen-3-8-flash (Fastest)
 * - qwen-3-8 (Deep Audit)
 *
 * Features:
 * - Real-time model switching with accountStorage persistence
 * - Multi-turn conversation history
 * - Real-time streaming chunks
 * - Model attribution on assistant responses
 * - Context-aware system prompt injected with workspace and findings data
 * - Error handling & abort support
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  streamChat,
  isAiConfigured,
  advisorCapabilities,
  type FindingContextIds,
  type ChatMessage,
} from "@/lib/api/ai-client";
import {
  SUPPORTED_MODELS,
  DEFAULT_MODEL_ID,
  getStoredModelId,
  setStoredModelId,
  getModelConfig,
} from "@/lib/api/ai-models";
import { useActiveWorkspace } from "@/hooks/useWorkspace";

export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** true while this particular message is still being streamed */
  streaming?: boolean;
  /** The model that generated this assistant response */
  modelId?: string;
};

function buildSystemPrompt(workspaceName: string | undefined): string {
  return `You are ThreatLens Security Advisor, a cybersecurity specialist.
Workspace: ${workspaceName ?? "Unknown"}. Do not infer scan findings or verified evidence unless a saved finding is attached by the server.

CRITICAL FORMATTING & BREVITY RULES (FOLLOW STRICTLY):
1. STRICT BREVITY & CONCISENESS:
   - Provide short, direct, actionable answers. Never write lengthy essays, verbose introductory paragraphs, or conversational filler.
   - Limit standard answers to 1-3 short paragraphs or 3-5 concise bullet points.
   - Lead immediately with the primary vulnerability, root cause, or direct fix.
   - No generic intro phrases ("Certainly!", "Here is a breakdown", "In this section") and no closing conversational fluff.

2. NEVER USE HASH SYMBOLS (#) FOR HEADINGS:
   - Do NOT use "#", "##", "###", or any "#" character for headings or section titles.
   - For section titles, ONLY use bold text (for example: **Remediation:** or **Root Cause:**).
   - Use standard dashes (-) or bullet points for lists, or numbered items (1., 2.).

3. MINIMAL CODE SNIPPETS:
   - When asked for code fixes, output ONLY the exact lines that need to be changed in a standard markdown code block. Do NOT reproduce large unaffected code blocks.

4. COMPLIANCE & STANDARDS:
   - Cite exact IDs (e.g., CWE-89, OWASP A01, SOC2 CC6.1, GDPR Art. 32) directly and concisely.`;
}

const CHAT_STORAGE_KEY_PREFIX = "threatlens_ai_chat_v1";

function getChatStorageKey(workspaceId?: string): string {
  return `${CHAT_STORAGE_KEY_PREFIX}_${workspaceId || "global"}`;
}

export function loadPersistedChat(workspaceId?: string): UiMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = accountStorage.getItem(getChatStorageKey(workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((m: UiMessage) => ({ ...m, streaming: false }));
    }
  } catch {
    // ignore parse error
  }
  return [];
}

export function savePersistedChat(messages: UiMessage[], workspaceId?: string) {
  if (typeof window === "undefined") return;
  try {
    const key = getChatStorageKey(workspaceId);
    if (messages.length === 0) {
      accountStorage.removeItem(key);
      return;
    }
    const clean = messages.map((m) => ({ ...m, streaming: false }));
    accountStorage.setItem(key, JSON.stringify(clean));
  } catch {
    // ignore quota error
  }
}

export function clearPersistedChat(workspaceId?: string) {
  if (typeof window === "undefined") return;
  try {
    accountStorage.removeItem(getChatStorageKey(workspaceId));
  } catch {
    // ignore
  }
}

export type SendMessageOptions = {
  modelOverride?: string;
  interrupt?: boolean;
  context?: AdvisorFindingContext;
};

export type AdvisorFindingContext = FindingContextIds & { title: string };

export function useGroqChatState() {
  const ownerScope = useRef(authScope()).current;
  const { user, isAuthenticated } = useAuth();
  const { active: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;

  const [messages, setMessages] = useState<UiMessage[]>(() => loadPersistedChat(workspaceId));
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModelState] = useState<string>(() => getStoredModelId());
  const [findingContext, setFindingContextState] = useState<AdvisorFindingContext | null>(null);
  const availability = useQuery({
    queryKey: ["advisor-capabilities", user?.id],
    queryFn: ({ signal }) => advisorCapabilities(signal),
    enabled: isAuthenticated && isAiConfigured(),
    staleTime: 60_000,
    retry: 1,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const isStreamingRef = useRef(false);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // The provider is keyed by account and workspace. This also protects direct hook users.
  useEffect(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setFindingContextState(null);
    setMessages(loadPersistedChat(workspaceId));
  }, [workspaceId]);

  // Persist messages whenever they change and streaming is not active
  useEffect(() => {
    const hasStreaming = messages.some((m) => m.streaming);
    if (!findingContext && !hasStreaming && messages.length > 0 && isCurrentScope(ownerScope)) {
      savePersistedChat(messages, workspaceId);
    }
  }, [messages, workspaceId, ownerScope, findingContext]);

  const setFindingContext = useCallback(
    (next: AdvisorFindingContext | null) => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      isStreamingRef.current = false;
      setError(null);
      setFindingContextState(next);
      setMessages(next ? [] : loadPersistedChat(workspaceId));
    },
    [workspaceId],
  );

  // Sync state if model changes in another component or tab
  useEffect(() => {
    const handleModelChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ modelId: string }>;
      if (customEvent.detail?.modelId) {
        setSelectedModelState(customEvent.detail.modelId);
      }
    };
    window.addEventListener("threatlens-model-changed", handleModelChange);
    return () => {
      window.removeEventListener("threatlens-model-changed", handleModelChange);
    };
  }, []);

  const changeModel = useCallback((newModelId: string) => {
    setSelectedModelState(newModelId);
    setStoredModelId(newModelId);
  }, []);
  const sendMessage = useCallback(
    async (userContent: string, optionsOrModel?: SendMessageOptions | string) => {
      const modelOverride =
        typeof optionsOrModel === "string" ? optionsOrModel : optionsOrModel?.modelOverride;
      const interrupt =
        typeof optionsOrModel === "object" ? Boolean(optionsOrModel?.interrupt) : false;
      const requestContext =
        typeof optionsOrModel === "object"
          ? (optionsOrModel.context ?? findingContext)
          : findingContext;

      if (!userContent.trim()) return;

      // If already streaming: interrupt if requested, otherwise ignore duplicate call
      if (isStreamingRef.current) {
        if (!interrupt) return;
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
        setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
      }

      if (!availability.data?.available) {
        setError(
          availability.isError
            ? "Could not reach Security Advisor. Check the backend and retry."
            : "Security Advisor is not available yet. Retry its availability check.",
        );
        return;
      }

      const activeModel = modelOverride || selectedModel || DEFAULT_MODEL_ID;

      setError(null);
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Add user message
      const userMsg: UiMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: userContent.trim(),
      };

      // Placeholder for streaming assistant message with model attribution
      const assistantId = crypto.randomUUID();
      const assistantMsg: UiMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
        modelId: activeModel,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      isStreamingRef.current = true;

      // Build conversation payload for the API
      const systemPrompt = buildSystemPrompt(workspace?.name);

      // Window prior conversation history to last 6 turns to avoid prefill latency spikes
      const priorHistory = (requestContext ? [] : messagesRef.current)
        .filter((m) => !m.streaming && m.content.trim())
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const apiMessages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...priorHistory,
        { role: "user", content: userContent.trim() },
      ];

      let totalReceived = "";

      try {
        for await (const chunk of streamChat(
          apiMessages,
          activeModel,
          abortController.signal,
          requestContext ?? undefined,
        )) {
          if (abortController.signal.aborted) {
            return;
          }
          totalReceived += chunk;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
          );
        }

        if (abortController.signal.aborted) {
          return;
        }

        if (!totalReceived.trim()) {
          throw new Error("No response received from the security engine. Please try again.");
        }
      } catch (err: unknown) {
        if (
          abortController.signal.aborted ||
          (err instanceof Error &&
            (err.name === "AbortError" || err.message.includes("aborted"))) ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          // User deliberately stopped streaming or component unmounted
          return;
        }
        const message =
          err instanceof Error ? err.message : "Failed to receive AI analysis response.";
        setError(message);
        // Remove the blank assistant placeholder on error if it has no content
        setMessages((prev) => prev.filter((m) => !(m.id === assistantId && !m.content)));
      } finally {
        if (abortControllerRef.current === abortController) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
          );
          setIsStreaming(false);
          isStreamingRef.current = false;
          abortControllerRef.current = null;
        }
      }
    },
    [selectedModel, workspace, findingContext, availability.data?.available, availability.isError],
  );

  // Abort running stream on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const clearMessages = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setMessages([]);
    setError(null);
    if (!findingContext) clearPersistedChat(workspaceId);
  }, [workspaceId, findingContext]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
    stopStreaming,
    configured: availability.data?.available === true,
    availability: availability.isPending
      ? "checking"
      : availability.isError
        ? "error"
        : availability.data?.available
          ? "ready"
          : "unavailable",
    retryAvailability: availability.refetch,
    findingContext,
    setFindingContext,
    selectedModel,
    setSelectedModel: changeModel,
    availableModels: SUPPORTED_MODELS,
    currentModelConfig: getModelConfig(selectedModel),
  };
}

/** Export alias for convenience */
export const useAiChat = useGroqChatState;
