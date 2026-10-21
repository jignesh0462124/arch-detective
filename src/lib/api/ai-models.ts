/**
 * ai-models.ts
 * Supported AI Models configuration for ThreatLens.
 *
 * Models provided by OmegaPlus AI Gateway (https://api.omegaplusapi.com/api/v1):
 * - glm-5-3-flash: Ultra-fast intelligent reasoning model with 1M context
 * - qwen-3-8-flash: Lightweight, highest-throughput cyber security triage
 * - qwen-3-8: Full-scale comprehensive code audit & deep architectural review
 */

export interface AiModelConfig {
  id: string;
  name: string;
  shortName: string;
  provider: "omegaplus" | "groq";
  providerLabel: string;
  badge: string;
  tagline: string;
  description: string;
  contextWindow: string;
  latencyEstimate: string;
  throughputEstimate: string;
  color: string;
}

export const SUPPORTED_MODELS: AiModelConfig[] = [
  {
    id: "glm-5-3-flash",
    name: "GLM 5.3 Flash",
    shortName: "GLM 5.3 Flash",
    provider: "omegaplus",
    providerLabel: "OmegaPlus · z.ai",
    badge: "Recommended",
    tagline: "Sub-second speed & advanced cyber reasoning",
    description: "Ultra-fast intelligent model with 1M context window. Excellent for live threat investigation and remediation advice.",
    contextWindow: "1,000,000 tokens",
    latencyEstimate: "~250 ms",
    throughputEstimate: "820 tok/s",
    color: "from-violet-500 to-indigo-600",
  },
  {
    id: "qwen-3-8-flash",
    name: "Qwen 3.8 Flash",
    shortName: "Qwen 3.8 Flash",
    provider: "omegaplus",
    providerLabel: "OmegaPlus · Alibaba",
    badge: "Fastest",
    tagline: "High-throughput lightning-fast vulnerability triage",
    description: "Optimized for ultra-low latency response times. Ideal for quick CVE lookups and rapid security queries.",
    contextWindow: "1,000,000 tokens",
    latencyEstimate: "~190 ms",
    throughputEstimate: "950 tok/s",
    color: "from-blue-500 to-cyan-600",
  },
  {
    id: "qwen-3-8",
    name: "Qwen 3.8",
    shortName: "Qwen 3.8",
    provider: "omegaplus",
    providerLabel: "OmegaPlus · Alibaba",
    badge: "Deep Audit",
    tagline: "Full-capability deep cybersecurity review & compliance",
    description: "Full-scale parameter architecture for intricate vulnerability verification, remediation synthesis, and compliance analysis.",
    contextWindow: "1,000,000 tokens",
    latencyEstimate: "~420 ms",
    throughputEstimate: "680 tok/s",
    color: "from-amber-500 to-orange-600",
  },
  {
    id: "qwen-3-8-groq",
    name: "Groq LPU (Ultra-Fast)",
    shortName: "Groq LPU",
    provider: "groq",
    providerLabel: "Groq LPUs · 250ms",
    badge: "Instant LPU",
    tagline: "Sub-second near-zero latency streaming via dedicated LPUs",
    description: "Hardware-accelerated cybersecurity reasoning engine running on Groq LPUs. Ideal for immediate answers without waiting.",
    contextWindow: "128,000 tokens",
    latencyEstimate: "~180 ms",
    throughputEstimate: "1,200 tok/s",
    color: "from-emerald-500 to-teal-600",
  },
];

export const DEFAULT_MODEL_ID = "glm-5-3-flash";

const STORAGE_KEY = "threatlens_active_ai_model";

/**
 * Get active model ID from localStorage, fallback to DEFAULT_MODEL_ID.
 */
export function getStoredModelId(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL_ID;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_MODELS.some((m) => m.id === stored)) {
    return stored;
  }
  return DEFAULT_MODEL_ID;
}

/**
 * Persist active model ID to localStorage and broadcast change.
 */
export function setStoredModelId(modelId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, modelId);
  window.dispatchEvent(
    new CustomEvent("threatlens-model-changed", { detail: { modelId } }),
  );
}

/**
 * Get full model configuration by ID.
 */
export function getModelConfig(modelId: string): AiModelConfig {
  return (
    SUPPORTED_MODELS.find((m) => m.id === modelId) ?? SUPPORTED_MODELS[0]
  );
}
