import type { ReactNode } from "react";
import { useGroqChatState } from "@/hooks/useGroqChat";
import { AiChatContext } from "./AiChatContext";

export function AiChatProvider({ children }: { children: ReactNode }) {
  const value = useGroqChatState();
  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>;
}
