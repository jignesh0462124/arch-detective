import { useState, useRef, useEffect } from "react";
import {
  Cpu,
  CaretDown,
  Check,
  Lightning,
  ShieldCheck,
  TerminalWindow,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { SUPPORTED_MODELS, getModelConfig } from "@/lib/api/ai-models";

interface AiModelSelectorProps {
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  disabled?: boolean;
  compact?: boolean;
  toolbar?: boolean;
}

export function AiModelSelector({
  selectedModel,
  onSelectModel,
  disabled = false,
  compact = false,
  toolbar = false,
}: AiModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeConfig = getModelConfig(selectedModel);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const getModelIcon = (id: string) => {
    switch (id) {
      case "glm-5-3-flash":
        return <Cpu size={13} weight="duotone" className="text-accent" />;
      case "qwen-3-8-flash":
        return <Lightning size={13} weight="duotone" className="text-cyan-400" />;
      case "qwen-3-8-groq":
        return <Lightning size={13} weight="fill" className="text-amber-400" />;
      case "qwen-3-8":
        return <ShieldCheck size={13} weight="duotone" className="text-emerald-400" />;
      default:
        return <TerminalWindow size={13} weight="duotone" className="text-muted-foreground" />;
    }
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`AI model: ${activeConfig.shortName}`}
        title="Switch Security Reasoning Model"
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-mono font-medium transition-colors",
          "hover:bg-secondary focus:outline-none focus:border-accent",
          disabled && "cursor-not-allowed opacity-50",
          compact ? "h-7 text-[11px]" : "h-9",
          toolbar && "w-44 justify-between",
        )}
      >
        {getModelIcon(activeConfig.id)}
        <span
          className={cn(
            "font-bold text-foreground",
            toolbar && "min-w-0 flex-1 truncate text-left",
          )}
        >
          {activeConfig.shortName}
        </span>
        <CaretDown
          size={12}
          weight="bold"
          className={cn(
            "text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Available AI reasoning models"
          className="absolute right-0 top-full z-50 mt-1.5 w-72 origin-top-right rounded-sm border border-border bg-card p-1.5 shadow-2xl animate-in fade-in-0 zoom-in-95"
        >
          <div className="border-b border-border/80 px-2.5 py-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-foreground">
                Neural Reasoning Engine
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-success/30 bg-success/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
                ONLINE
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground leading-tight">
              Select model for codebase audit & vulnerability remediation
            </p>
          </div>

          <div className="mt-1 space-y-1">
            {SUPPORTED_MODELS.map((model) => {
              const isSelected = model.id === selectedModel;
              return (
                <button
                  key={model.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelectModel(model.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-sm p-2 text-left transition-colors border",
                    isSelected
                      ? "border-accent/40 bg-accent/10 text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary">
                    {getModelIcon(model.id)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-foreground">{model.name}</span>
                      <span className="rounded border border-border bg-secondary px-1 py-0.2 font-mono text-[9px] font-bold uppercase text-muted-foreground">
                        {model.badge}
                      </span>
                    </div>

                    <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                      {model.tagline}
                    </p>

                    <div className="mt-1 flex items-center gap-2 font-mono text-[9px] text-muted-foreground">
                      <span>{model.latencyEstimate}</span>
                      <span>·</span>
                      <span>{model.contextWindow}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <Check size={14} weight="bold" className="mt-1 shrink-0 text-accent" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-2 border-t border-border/60 px-2 py-1.5 text-center font-mono text-[9px] text-muted-foreground">
            Provider:{" "}
            <span className="font-bold text-foreground">{activeConfig.providerLabel}</span> ·{" "}
            {activeConfig.contextWindow}
          </div>
        </div>
      )}
    </div>
  );
}
