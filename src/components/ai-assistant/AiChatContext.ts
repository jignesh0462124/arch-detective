import { createContext, useContext } from "react";
import type { useGroqChatState } from "@/hooks/useGroqChat";

export type AiChatState = ReturnType<typeof useGroqChatState>;
export const AiChatContext = createContext<AiChatState | null>(null);

export function useSharedAiChat() {
  const value = useContext(AiChatContext);
  if (!value) throw new Error("Security Advisor must be inside AiChatProvider");
  return value;
}
