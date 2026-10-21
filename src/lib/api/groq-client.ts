/**
 * groq-client.ts (Legacy re-export wrapper)
 * Maintains backward compatibility while delegating to the unified ai-client
 * powered by OmegaPlus AI Gateway (models: glm-5-3-flash, qwen-3-8-flash, qwen-3-8)
 * and Groq fallback.
 */

export {
  streamChat,
  isGroqConfigured,
  isAiConfigured,
  GROQ_MODEL,
  type ChatMessage,
} from "./ai-client";

export {
  SUPPORTED_MODELS,
  DEFAULT_MODEL_ID,
  getStoredModelId,
  setStoredModelId,
  getModelConfig,
  type AiModelConfig,
} from "./ai-models";
