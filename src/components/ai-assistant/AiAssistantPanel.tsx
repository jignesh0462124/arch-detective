import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowSquareOut,
  CheckCircle,
  PaperPlaneRight,
  ShieldCheck,
  Info,
  StopCircle,
  Trash,
  WarningCircle,
  Wrench,
  X,
} from "@phosphor-icons/react";
import { AiMessage } from "@/components/ai-assistant/AiMessage";
import { AiModelSelector } from "@/components/ai-assistant/AiModelSelector";
import { useSharedAiChat } from "@/components/ai-assistant/AiChatContext";
import { advisorErrorMessage } from "@/lib/advisorPresentation";

const actions = [
  {
    label: "Explain",
    icon: Info,
    prompt: "Explain this security issue in plain language. Separate evidence from assumptions.",
  },
  {
    label: "Suggest a fix",
    icon: Wrench,
    prompt:
      "Suggest a practical fix for this security issue and what must be reviewed before applying it.",
  },
  {
    label: "How to verify",
    icon: CheckCircle,
    prompt: "How should I verify this security fix? Give short test steps and expected results.",
  },
];

export function AiAssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const chat = useSharedAiChat();
  const { activateAdvisor } = chat;
  useEffect(() => {
    if (open) activateAdvisor();
  }, [open, activateAdvisor]);
  const [input, setInput] = useState("");
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    const keydown = (key: KeyboardEvent) => {
      if (key.key === "Escape") onClose();
      if (key.key !== "Tab" || !panel.current) return;
      const items = Array.from(
        panel.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a, textarea:not(:disabled), select:not(:disabled)",
        ),
      );
      if (!items.length) return;
      if (key.shiftKey && document.activeElement === items[0]) {
        key.preventDefault();
        items.at(-1)?.focus();
      } else if (!key.shiftKey && document.activeElement === items.at(-1)) {
        key.preventDefault();
        items[0].focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [open, onClose]);
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: "end" });
  }, [open, chat.messages, chat.error]);
  if (!open) return null;
  const submit = () => {
    const value = input.trim();
    if (!value || !chat.configured || chat.isStreaming) return;
    setInput("");
    void chat.sendMessage(value);
  };
  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      <button
        type="button"
        aria-label="Close Security Advisor"
        onClick={onClose}
        className="absolute inset-0 w-full bg-black/55"
      />
      <aside
        ref={panel}
        id="ai-assistant-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Security Advisor"
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-border bg-card shadow-2xl sm:max-w-[500px]"
      >
        <div className="flex items-start justify-between gap-2 border-b border-border p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-accent" />
              <h2 className="font-semibold">Security Advisor</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {chat.availability === "ready"
                ? "Ready to ask"
                : chat.availability === "checking"
                  ? "Checking advisor…"
                  : chat.availability === "unavailable"
                    ? "Advisor not configured"
                    : "Advisor unavailable"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Link
              to="/advisor"
              onClick={onClose}
              aria-label="Open full Security Advisor page"
              className="rounded border border-border p-2 hover:bg-secondary"
            >
              <ArrowSquareOut size={15} />
            </Link>
            <button
              ref={close}
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="rounded border border-border p-2 hover:bg-secondary"
            >
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/20 px-4 py-3">
          <AiModelSelector
            compact
            selectedModel={chat.selectedModel}
            onSelectModel={chat.setSelectedModel}
            disabled={chat.isStreaming}
          />
          {chat.messages.length > 0 && (
            <button
              type="button"
              onClick={chat.clearMessages}
              disabled={chat.isStreaming}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1.5 text-xs disabled:opacity-50"
            >
              <Trash size={13} /> Clear
            </button>
          )}
        </div>
        {chat.findingContext && (
          <div className="flex items-center justify-between gap-2 border-b border-accent/30 bg-accent/10 px-4 py-2 text-xs">
            <span className="min-w-0 truncate text-accent">
              Saved finding · {chat.findingContext.title}
            </span>
            <button
              type="button"
              onClick={() => chat.setFindingContext(null)}
              className="shrink-0 underline"
            >
              Clear context
            </button>
          </div>
        )}
        {(chat.availability === "error" || chat.availability === "unavailable") && (
          <div
            role="status"
            className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground"
          >
            <span>Advisor could not be reached or configured.</span>
            <button
              type="button"
              onClick={() => void chat.retryAvailability()}
              className="text-accent underline"
            >
              Retry
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {!chat.messages.length && (
            <div className="mx-auto max-w-xs py-9 text-center">
              <ShieldCheck size={25} className="mx-auto text-accent" />
              <h3 className="mt-3 text-sm font-semibold">Ask a security question</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose a prompt below or type your own question. Advice needs human review before
                implementation.
              </p>
            </div>
          )}
          {chat.messages.map((message) => (
            <AiMessage key={message.id} message={message} />
          ))}
          {chat.error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 p-3 text-xs"
            >
              <WarningCircle size={16} className="shrink-0 text-destructive" />
              <span>{advisorErrorMessage(chat.error)}</span>
            </div>
          )}
          <div ref={end} />
        </div>
        <div className="border-t border-border bg-secondary/20 p-3">
          <div
            className="mb-3 flex flex-wrap gap-1.5"
            role="group"
            aria-label="Quick advisor prompts"
          >
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  type="button"
                  key={action.label}
                  disabled={!chat.configured || chat.isStreaming}
                  onClick={() =>
                    void chat.sendMessage(
                      chat.findingContext
                        ? `${action.prompt} Use the selected saved finding.`
                        : action.prompt,
                    )
                  }
                  className="inline-flex min-h-9 items-center gap-1 rounded border border-border bg-card px-2.5 text-[11px] font-medium hover:border-accent disabled:opacity-50"
                >
                  <Icon size={14} className="text-accent" />
                  {action.label}
                </button>
              );
            })}
          </div>
          <label htmlFor="advisor-panel-input" className="sr-only">
            Your security question
          </label>
          <textarea
            id="advisor-panel-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            disabled={!chat.configured}
            placeholder="Ask about a finding or security control…"
            rows={2}
            className="w-full resize-y rounded border border-input bg-background p-2.5 text-sm focus:border-accent disabled:opacity-50"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              Enter sends · Shift+Enter adds a line
            </span>
            {chat.isStreaming ? (
              <button
                type="button"
                onClick={chat.stopStreaming}
                className="inline-flex h-9 items-center gap-1.5 rounded border border-border px-3 text-xs"
              >
                <StopCircle size={14} /> Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!input.trim() || !chat.configured}
                className="inline-flex h-9 items-center gap-1.5 rounded bg-primary px-3 text-xs text-primary-foreground disabled:opacity-50"
              >
                Send <PaperPlaneRight size={13} />
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
