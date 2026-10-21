import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  PaperPlaneRight,
  ShieldCheck,
  Sparkle,
  StopCircle,
  Trash,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react";
import { AppShell } from "@/components/brutal/AppShell";
import { AiMessage } from "@/components/ai-assistant/AiMessage";
import { AiModelSelector } from "@/components/ai-assistant/AiModelSelector";
import { useSharedAiChat } from "@/components/ai-assistant/AiChatContext";
import { useActiveWorkspace } from "@/hooks/useWorkspace";
import { getWorkbenchFinding } from "@/lib/api/workbench";

type AdvisorSearch = {
  prompt?: string;
  q?: string;
  threat?: string;
  solution?: string;
  workspaceId?: string;
  scanId?: string;
  findingId?: string;
  example?: string;
  cwe?: string;
  file?: string;
};

export const Route = createFileRoute("/_app/advisor")({
  validateSearch: (search: Record<string, unknown>): AdvisorSearch => ({
    prompt: typeof search.prompt === "string" ? search.prompt : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
    threat: typeof search.threat === "string" ? search.threat : undefined,
    solution: typeof search.solution === "string" ? search.solution : undefined,
    workspaceId: typeof search.workspaceId === "string" ? search.workspaceId : undefined,
    scanId: typeof search.scanId === "string" ? search.scanId : undefined,
    findingId: typeof search.findingId === "string" ? search.findingId : undefined,
    example: typeof search.example === "string" ? search.example : undefined,
    cwe: typeof search.cwe === "string" ? search.cwe : undefined,
    file: typeof search.file === "string" ? search.file : undefined,
  }),
  head: () => ({ meta: [{ title: "Security Advisor · Archon" }] }),
  component: AdvisorPage,
});

type Guidance = "explain" | "fix" | "verify";
const actions: { id: Guidance; title: string; description: string; icon: typeof Sparkle }[] = [
  {
    id: "explain",
    title: "Explain",
    description: "Understand the issue and what the evidence shows.",
    icon: Sparkle,
  },
  {
    id: "fix",
    title: "Suggest a fix",
    description: "Get a remediation approach to review in your code.",
    icon: Wrench,
  },
  {
    id: "verify",
    title: "How to verify",
    description: "Plan tests and checks after a change.",
    icon: CheckCircle,
  },
];
const starters = [
  "How do I prevent SQL injection in a database query?",
  "What should I do after finding a hardcoded secret?",
  "How can I test object-level authorization?",
];
function actionPrompt(kind: Guidance, title?: string) {
  const subject = title ? `the saved finding “${title}”` : "this security issue";
  if (kind === "explain")
    return `Explain ${subject} in plain language. Separate recorded evidence from assumptions. What is the likely impact?`;
  if (kind === "fix")
    return `Suggest a practical fix for ${subject}. Explain what must be reviewed before applying any code change.`;
  return `How should I verify the fix for ${subject}? Give a short test checklist and expected outcomes.`;
}

function AdvisorPage() {
  const { active: workspace } = useActiveWorkspace();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const chat = useSharedAiChat();
  const { findingContext, setFindingContext, sendMessage } = chat;
  const [input, setInput] = useState("");
  const [exampleTitle, setExampleTitle] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const processed = useRef("");
  const requestedFinding = Boolean(search.workspaceId && search.scanId && search.findingId);
  const correctWorkspace = Boolean(workspace && search.workspaceId === workspace.id);
  const finding = useQuery({
    queryKey: ["advisor-finding", workspace?.id, search.scanId, search.findingId],
    queryFn: ({ signal }) =>
      getWorkbenchFinding(search.scanId!, search.findingId!, signal, search.workspaceId),
    enabled: requestedFinding && correctWorkspace,
    staleTime: 30_000,
    retry: 1,
  });

  useEffect(() => {
    if (requestedFinding && (!correctWorkspace || finding.isError) && findingContext)
      setFindingContext(null);
  }, [requestedFinding, correctWorkspace, finding.isError, findingContext, setFindingContext]);

  useEffect(() => {
    if (!finding.data || !search.workspaceId || !search.scanId || !search.findingId) return;
    const next = {
      workspace_id: search.workspaceId,
      scan_id: search.scanId,
      finding_id: search.findingId,
      title: finding.data.finding.title,
    };
    if (findingContext?.finding_id !== next.finding_id || findingContext?.scan_id !== next.scan_id)
      setFindingContext(next);
    setExampleTitle(null);
  }, [
    finding.data,
    search.workspaceId,
    search.scanId,
    search.findingId,
    findingContext,
    setFindingContext,
  ]);

  useEffect(() => {
    const key = JSON.stringify(search);
    if (key === "{}" || processed.current === key) return;
    if (
      requestedFinding &&
      (!correctWorkspace ||
        finding.isError ||
        !finding.data ||
        findingContext?.finding_id !== search.findingId)
    )
      return;
    if (!requestedFinding && search.threat && findingContext) {
      setFindingContext(null);
      return;
    }
    processed.current = key;
    const title = requestedFinding ? finding.data?.finding.title : search.threat;
    if (!requestedFinding && search.threat) {
      setExampleTitle(search.threat);
      setFindingContext(null);
    }
    const mode: Guidance | undefined =
      search.solution === "patch" || search.solution === "hardening"
        ? "fix"
        : search.solution === "test" || search.solution === "compliance"
          ? "verify"
          : search.solution
            ? "explain"
            : undefined;
    const prompt =
      search.prompt ||
      search.q ||
      (mode ? actionPrompt(mode, title) : search.threat ? actionPrompt("explain", title) : "");
    if (prompt) void sendMessage(prompt, { interrupt: true });
    void navigate({ to: "/advisor", search: {}, replace: true });
  }, [
    search,
    requestedFinding,
    correctWorkspace,
    finding.data,
    finding.isError,
    findingContext,
    setFindingContext,
    sendMessage,
    navigate,
  ]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [chat.messages, chat.error]);
  const blockedContext = requestedFinding && (!correctWorkspace || finding.isError);
  const contextReady =
    !requestedFinding ||
    (correctWorkspace &&
      !finding.isError &&
      chat.findingContext?.scan_id === search.scanId &&
      chat.findingContext?.finding_id === search.findingId);
  const submit = () => {
    const value = input.trim();
    if (!value || chat.isStreaming || !chat.configured || !contextReady) return;
    setInput("");
    void chat.sendMessage(value);
  };
  const clearContext = () => {
    setExampleTitle(null);
    if (requestedFinding)
      void navigate({ to: "/advisor", search: {}, replace: true }).then(() =>
        setFindingContext(null),
      );
    else setFindingContext(null);
  };
  const selectedTitle = chat.findingContext?.title || exampleTitle || undefined;

  return (
    <AppShell
      title="Security Advisor"
      subtitle={workspace ? `Workspace · ${workspace.name}` : "Security guidance"}
    >
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="section-title">AI guidance</p>
              <h2 className="mt-1 text-lg font-semibold">
                Ask about a finding or security question
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                The advisor explains evidence and suggests next steps. Review its answers and test
                any proposed change before using it.
              </p>
            </div>
            <AiModelSelector
              selectedModel={chat.selectedModel}
              onSelectModel={chat.setSelectedModel}
              disabled={chat.isStreaming}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded border border-border bg-secondary px-2.5 py-1.5">
              <ShieldCheck size={14} />{" "}
              {chat.availability === "ready"
                ? "Ready to ask"
                : chat.availability === "checking"
                  ? "Checking advisor…"
                  : chat.availability === "unavailable"
                    ? "Advisor not configured"
                    : "Advisor unavailable"}
            </span>
            {(chat.availability === "error" || chat.availability === "unavailable") && (
              <button
                type="button"
                className="text-accent underline"
                onClick={() => void chat.retryAvailability()}
              >
                Retry check
              </button>
            )}
            {chat.findingContext && (
              <span className="max-w-full truncate rounded border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-accent">
                Saved finding · {chat.findingContext.title}
              </span>
            )}
            {exampleTitle && !chat.findingContext && (
              <span className="max-w-full truncate rounded border border-border px-2.5 py-1.5">
                Example only · {exampleTitle}
              </span>
            )}
            {selectedTitle && (
              <button
                type="button"
                className="text-muted-foreground underline"
                onClick={clearContext}
              >
                Ask a general question instead
              </button>
            )}
          </div>
          {requestedFinding && finding.isPending && correctWorkspace && (
            <p role="status" className="mt-3 text-xs text-muted-foreground">
              Loading saved finding evidence…
            </p>
          )}
          {blockedContext && (
            <div
              role="alert"
              className="mt-3 flex flex-wrap items-center gap-2 rounded border border-destructive/30 bg-destructive/10 p-3 text-xs"
            >
              <WarningCircle size={16} />
              <span>
                This finding could not be opened in the active workspace. Select another finding or
                ask a general question.
              </span>
              {finding.isError && (
                <button
                  type="button"
                  onClick={() => void finding.refetch()}
                  className="text-accent underline"
                >
                  Retry
                </button>
              )}
              <button type="button" onClick={clearContext} className="text-accent underline">
                Ask a general question
              </button>
            </div>
          )}
        </div>

        <section className="grid gap-3 sm:grid-cols-3" aria-label="Advisor actions">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                disabled={!chat.configured || chat.isStreaming || !contextReady}
                onClick={() => void chat.sendMessage(actionPrompt(action.id, selectedTitle))}
                className="group rounded border border-border bg-card p-4 text-left transition-colors hover:border-accent hover:bg-secondary disabled:opacity-50"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Icon size={17} className="text-accent" />
                  {action.title}
                  <ArrowRight
                    size={14}
                    className="ml-auto text-muted-foreground group-hover:text-accent"
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{action.description}</p>
              </button>
            );
          })}
        </section>

        <section
          className="flex min-h-[420px] flex-col overflow-hidden rounded border border-border bg-card"
          aria-label="Advisor conversation"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/30 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">Conversation</h3>
              <p className="text-xs text-muted-foreground">
                {chat.findingContext
                  ? "Answers use this saved finding’s redacted evidence."
                  : "General guidance without scan evidence."}
              </p>
            </div>
            {chat.messages.length > 0 && (
              <button
                type="button"
                onClick={chat.clearMessages}
                disabled={chat.isStreaming}
                className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1.5 text-xs disabled:opacity-50"
              >
                <Trash size={14} /> Clear
              </button>
            )}
          </div>
          <div className="max-h-[550px] min-h-[280px] flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {!chat.messages.length && (
              <div className="mx-auto max-w-lg py-10 text-center">
                <Sparkle size={28} className="mx-auto text-accent" />
                <h3 className="mt-3 font-semibold">Start with a question</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose an action above or ask your own question below.
                </p>
                {!selectedTitle && (
                  <div className="mt-5 flex flex-col gap-2">
                    {starters.map((prompt) => (
                      <button
                        type="button"
                        key={prompt}
                        disabled={!chat.configured || !contextReady}
                        onClick={() => void chat.sendMessage(prompt)}
                        className="rounded border border-border px-3 py-2 text-left text-xs hover:border-accent disabled:opacity-50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {chat.messages.map((message) => (
              <AiMessage key={message.id} message={message} />
            ))}
            {chat.error && (
              <div
                role="alert"
                className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs"
              >
                <p className="font-semibold text-destructive">Could not complete that answer</p>
                <p className="mt-1 text-muted-foreground">{chat.error}</p>
              </div>
            )}
            <div ref={end} />
          </div>
          <div className="border-t border-border bg-secondary/20 p-3 sm:p-4">
            <label htmlFor="advisor-question" className="sr-only">
              Your security question
            </label>
            <textarea
              id="advisor-question"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder="Ask a question about a finding, fix or security control…"
              rows={2}
              disabled={!chat.configured || !contextReady}
              className="w-full resize-y rounded border border-input bg-background p-3 text-sm outline-none focus:border-accent disabled:opacity-50"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Enter to send · Shift+Enter for a new line
              </p>
              {chat.isStreaming ? (
                <button
                  type="button"
                  onClick={chat.stopStreaming}
                  className="inline-flex h-9 items-center gap-2 rounded border border-border px-3 text-xs"
                >
                  <StopCircle size={15} /> Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!input.trim() || !chat.configured || !contextReady}
                  className="inline-flex h-9 items-center gap-2 rounded bg-primary px-3 text-xs text-primary-foreground disabled:opacity-50"
                >
                  Send <PaperPlaneRight size={14} />
                </button>
              )}
            </div>
          </div>
        </section>
        <p className="pb-2 text-xs text-muted-foreground">
          Need the saved source?{" "}
          <Link to="/findings" className="text-accent underline">
            Review findings
          </Link>{" "}
          or open the Codebase Audit workbench.
        </p>
      </div>
    </AppShell>
  );
}
