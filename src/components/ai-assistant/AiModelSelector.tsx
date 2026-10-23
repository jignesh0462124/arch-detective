import { useState, useRef, useEffect, useId } from "react";
import { SlidersHorizontal, CaretDown, Check } from "@phosphor-icons/react";
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

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
      containerRef.current
        ?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')
        ?.focus();
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div
      className="relative inline-block text-left"
      ref={containerRef}
      onKeyDown={(event) => {
        if (!isOpen) return;
        if (event.key === "Escape") {
          event.preventDefault();
          setIsOpen(false);
          triggerRef.current?.focus();
        }
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const options = Array.from(
            containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [],
          );
          if (!options.length) return;
          const current = options.findIndex((option) => option === document.activeElement);
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? options.length - 1
                : (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) %
                  options.length;
          options[next]?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onKeyDown={(event) => {
          if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        aria-label="Select model"
        title="Select model"
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-mono font-medium transition-colors",
          "hover:bg-secondary focus:outline-none focus:border-accent",
          disabled && "cursor-not-allowed opacity-50",
          compact ? "h-7 text-[11px]" : "h-9",
          toolbar && "justify-between",
        )}
      >
        <SlidersHorizontal size={14} aria-hidden="true" className="text-muted-foreground" />
        <span
          className={cn(
            "font-bold text-foreground",
            toolbar && "min-w-0 flex-1 truncate text-left",
          )}
        >
          Model
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
          id={menuId}
          role="listbox"
          aria-label="Available models"
          className="absolute left-0 top-full z-50 mt-1.5 w-72 max-w-[calc(100vw-2rem)] origin-top-left rounded-sm border border-border bg-card p-1.5 shadow-2xl animate-in fade-in-0 zoom-in-95 sm:left-auto sm:right-0 sm:origin-top-right"
        >
          <div className="border-b border-border/80 px-2.5 py-2">
            <p className="text-xs font-semibold text-foreground">Select model</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground leading-tight">
              Used for codebase review and Security Advisor suggestions.
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
                    triggerRef.current?.focus();
                  }}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-sm p-2 text-left transition-colors border",
                    isSelected
                      ? "border-accent/40 bg-accent/10 text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-foreground">
                      {model.id === "qwen-3-8-groq" ? "Groq LPU" : model.name}
                    </span>
                  </div>

                  {isSelected && (
                    <Check size={14} weight="bold" className="mt-1 shrink-0 text-accent" />
                  )}
                </button>
              );
            })}
          </div>

          <p className="mt-2 border-t border-border/60 px-2 py-1.5 text-[10px] text-muted-foreground">
            Selected: {activeConfig.shortName}. Review and test suggestions before use.
          </p>
        </div>
      )}
    </div>
  );
}
