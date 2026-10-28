import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowUp,
  List,
  Plus,
  MagnifyingGlass,
  X,
  StopCircle,
  DotsThree,
  FileCode,
} from "@phosphor-icons/react";
import { AppShell } from "@/components/brutal/AppShell";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { AiMessage } from "./AiMessage";
import { AiModelSelector } from "./AiModelSelector";
import { useSharedAiChat } from "./AiChatContext";
import { useAuth } from "@/hooks/useAuth";
import { useActiveWorkspace } from "@/hooks/useWorkspace";
import { getWorkbenchFinding } from "@/lib/api/workbench";
import {
  listConversations,
  renameConversation,
  deleteConversation,
  type AdvisorConversation,
} from "@/lib/api/advisorHistory";
import { authScope, isCurrentScope } from "@/lib/authState";
import { advisorErrorMessage } from "@/lib/advisorPresentation";
import type { AdvisorSearch } from "@/routes/_app/advisor";

const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm hover:bg-secondary disabled:opacity-50 focus-visible:shadow-ring";
function group(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const age = Math.round((today.getTime() - day.getTime()) / 86400000);
  return age <= 0 ? "Today" : age === 1 ? "Yesterday" : age < 7 ? "Previous 7 days" : "Older";
}
export function AdvisorWorkspace({ search }: { search: AdvisorSearch }) {
  const chat = useSharedAiChat();
  const { user } = useAuth();
  const { active: workspace } = useActiveWorkspace();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const filter = useDeferredValue(query);
  const [historyOpen, setHistoryOpen] = useState(true);
  const sheet = useRef<HTMLDialogElement>(null);
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState(0);
  const handoff = useRef("");
  const opened = useRef("");
  const scroll = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const requested = !!(search.workspaceId && search.scanId && search.findingId);
  const correct = workspace?.id === search.workspaceId;
  const { activateAdvisor, sendMessage, loadConversation } = chat;
  useEffect(() => activateAdvisor(), [activateAdvisor]);
  useEffect(() => {
    setFeedback("");
    setQuery("");
    opened.current = "";
    handoff.current = "";
  }, [user?.id, workspace?.id]);
  const finding = useQuery({
    queryKey: ["advisor-finding", user?.id, workspace?.id, search.scanId, search.findingId],
    queryFn: ({ signal }) =>
      getWorkbenchFinding(search.scanId!, search.findingId!, signal, search.workspaceId),
    enabled: requested && correct,
    retry: 1,
    staleTime: 30_000,
  });
  const history = useInfiniteQuery({
    queryKey: ["advisor-history", user?.id, workspace?.id, filter],
    queryFn: ({ pageParam, signal }) => listConversations(workspace!.id, filter, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
    enabled: !!user && !!workspace && chat.historyAvailable,
    staleTime: 30_000,
    retry: 1,
  });
  useEffect(() => {
    if (
      !search.conversation ||
      chat.conversationId === search.conversation ||
      opened.current === search.conversation ||
      requested
    )
      return;
    opened.current = search.conversation;
    void loadConversation(search.conversation);
  }, [search.conversation, chat.conversationId, loadConversation, requested]);
  const key = JSON.stringify(search);
  useEffect(() => {
    if (
      key === "{}" ||
      search.conversation ||
      handoff.current === `${key}:${retry}` ||
      chat.availability !== "ready" ||
      chat.loadingConversation
    )
      return;
    if (requested && (!correct || !finding.data || finding.isError)) return;
    const context = requested
      ? {
          workspace_id: search.workspaceId!,
          scan_id: search.scanId!,
          finding_id: search.findingId!,
          title: finding.data!.finding.title,
        }
      : undefined;
    const title = context?.title || search.threat || "this security issue";
    const intent =
      search.solution === "patch" || search.solution === "hardening"
        ? "Suggest a practical fix, a small code example, assumptions and verification steps for"
        : search.solution === "test"
          ? "Explain how to verify a fix for"
          : "Explain";
    const prompt =
      search.prompt || search.q || `${intent} ${title}. Distinguish evidence from assumptions.`;
    handoff.current = `${key}:${retry}`;
    void sendMessage(prompt, {
      context,
      newConversation: true,
      handoffKey: `${key}:${retry}`,
      onAccepted: (id) => {
        void navigate({ to: "/advisor", search: id ? { conversation: id } : {}, replace: true });
      },
    });
  }, [
    key,
    retry,
    requested,
    correct,
    finding.data,
    finding.isError,
    chat.availability,
    chat.loadingConversation,
    search,
    sendMessage,
    navigate,
  ]);
  useEffect(() => {
    const area = scroll.current;
    if (area && area.scrollHeight - area.scrollTop - area.clientHeight < 200)
      end.current?.scrollIntoView({ block: "nearest" });
  }, [chat.messages]);
  const newChat = () => {
    chat.newChat();
    setFeedback("");
    void navigate({ to: "/advisor", search: {} });
    sheet.current?.close();
  };
  const openChat = (id: string) => {
    setFeedback("");
    opened.current = id;
    void loadConversation(id);
    void navigate({ to: "/advisor", search: { conversation: id } });
    sheet.current?.close();
  };
  const mutate = async (item: AdvisorConversation, action: "rename" | "delete") => {
    if (pending) return;
    const name =
      action === "rename" ? window.prompt("Conversation name", item.title)?.trim() : undefined;
    if (
      (action === "rename" && !name) ||
      (action === "delete" && !window.confirm(`Delete “${item.title}” and its messages?`))
    )
      return;
    const scope = authScope();
    setPending(true);
    setFeedback("");
    try {
      if (action === "rename") await renameConversation(item.id, name!.slice(0, 120));
      else await deleteConversation(item.id);
      if (!isCurrentScope(scope)) return;
      if (action === "delete" && chat.conversationId === item.id) newChat();
      await client.invalidateQueries({ queryKey: ["advisor-history", user?.id, workspace?.id] });
    } catch {
      if (isCurrentScope(scope))
        setFeedback("The conversation could not be updated. Please retry.");
    } finally {
      if (isCurrentScope(scope)) setPending(false);
    }
  };
  const entries = [
    ...new Map(
      (history.data?.pages.flatMap((p) => p.items) || []).map((item) => [item.id, item]),
    ).values(),
  ];
  const historyContent = (
    <>
      <WorkspaceSwitcher />
      <button
        type="button"
        onClick={newChat}
        className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
      >
        <Plus size={18} />
        New chat
      </button>
      <label className="relative mt-4 block">
        <span className="sr-only">Search conversations</span>
        <MagnifyingGlass
          aria-hidden
          className="absolute left-3 top-3 text-muted-foreground"
          size={16}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations"
          className="min-h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm"
        />
      </label>
      <div className="mt-5 min-h-0 flex-1 overflow-y-auto" aria-label="Conversation history">
        {!chat.historyAvailable ? (
          <p className="text-xs leading-6 text-muted-foreground">
            {chat.availability === "checking"
              ? "Checking conversation history…"
              : "Saved history is not enabled on this server. Current messages are available during this session."}
          </p>
        ) : history.isPending ? (
          <p role="status" className="text-sm">
            Loading conversations…
          </p>
        ) : history.isError ? (
          <p role="alert" className="text-sm">
            History could not load.{" "}
            <button className="underline" onClick={() => void history.refetch()}>
              Retry
            </button>
          </p>
        ) : !entries.length ? (
          <p className="text-sm text-muted-foreground">
            {query ? "No matching conversations." : "Your conversations will appear here."}
          </p>
        ) : (
          ["Today", "Yesterday", "Previous 7 days", "Older"].map((label) => {
            const items = entries.filter((item) => group(item.updated_at) === label);
            return items.length ? (
              <section key={label} className="mb-5">
                <h2 className="mb-2 px-2 text-xs text-muted-foreground">{label}</h2>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`relative mb-1 flex min-w-0 items-center rounded-lg border-l-2 ${chat.conversationId === item.id ? "border-accent bg-secondary" : "border-transparent"}`}
                  >
                    <button
                      type="button"
                      onClick={() => openChat(item.id)}
                      disabled={pending}
                      title={item.title}
                      className="min-h-11 min-w-0 flex-1 truncate px-2 text-left text-sm hover:bg-secondary"
                    >
                      {item.title}
                    </button>
                    <details className="relative">
                      <summary
                        aria-label={`Actions for ${item.title}`}
                        className="flex size-9 cursor-pointer list-none items-center justify-center rounded hover:bg-secondary [&::-webkit-details-marker]:hidden"
                      >
                        <DotsThree size={18} />
                      </summary>
                      <div className="absolute right-0 top-9 z-20 w-36 rounded-lg border border-border bg-popover p-1 shadow-lg">
                        <button
                          disabled={pending}
                          className="min-h-10 w-full px-3 text-left text-sm hover:bg-secondary"
                          onClick={() => void mutate(item, "rename")}
                        >
                          Rename
                        </button>
                        <button
                          disabled={pending}
                          className="min-h-10 w-full px-3 text-left text-sm text-destructive hover:bg-secondary"
                          onClick={() => void mutate(item, "delete")}
                        >
                          Delete
                        </button>
                      </div>
                    </details>
                  </div>
                ))}
              </section>
            ) : null;
          })
        )}
        {history.hasNextPage && (
          <button
            className={button}
            disabled={history.isFetchingNextPage}
            onClick={() => void history.fetchNextPage()}
          >
            Load older chats
          </button>
        )}
      </div>
      {feedback && (
        <p role="alert" className="text-xs text-destructive">
          {feedback}
        </p>
      )}
      <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
        Private to your account · Up to 30 days
      </p>
    </>
  );
  const blocked = requested && (!correct || finding.isError);
  const send = () => {
    if (!input.trim() || !chat.configured || chat.isStreaming || blocked || requested) return;
    const value = input;
    void chat.sendMessage(value, {
      onAccepted: (id) => {
        setInput("");
        if (id) void navigate({ to: "/advisor", search: { conversation: id }, replace: true });
      },
    });
  };
  return (
    <AppShell
      title="Security Advisor"
      tools={
        <AiModelSelector
          selectedModel={chat.selectedModel}
          onSelectModel={chat.setSelectedModel}
          disabled={chat.isStreaming}
          toolbar
        />
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1">
        {historyOpen && (
          <aside className="hidden w-[264px] shrink-0 flex-col border-r border-border bg-background p-4 md:flex">
            {historyContent}
          </aside>
        )}
        <dialog
          ref={sheet}
          className="m-0 h-dvh max-h-none w-[min(90vw,340px)] max-w-none border-r border-border bg-background p-4 text-foreground backdrop:bg-black/50"
        >
          <div className="flex h-full min-h-0 flex-col">
            <button
              autoFocus
              aria-label="Close conversation history"
              className={`${button} mb-3 self-end`}
              onClick={() => sheet.current?.close()}
            >
              <X size={18} />
            </button>
            {historyContent}
          </div>
        </dialog>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Advisor conversation">
          <div className="flex min-h-12 items-center gap-2 border-b border-border px-3 sm:px-6">
            <button
              aria-label="Toggle conversation history"
              className={`${button} max-md:hidden`}
              onClick={() => setHistoryOpen((v) => !v)}
            >
              <List size={17} />
            </button>
            <button
              aria-label="Open conversation history"
              className={`${button} md:hidden`}
              onClick={() => sheet.current?.showModal()}
            >
              <List size={17} />
            </button>
            <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {chat.findingContext
                ? `Finding · ${chat.findingContext.title}`
                : "Ask about a finding or security question"}
            </p>
            {chat.findingContext && (
              <Link
                to="/workspace/$workspaceId/scans/$scanId/workbench"
                params={{
                  workspaceId: chat.findingContext.workspace_id,
                  scanId: chat.findingContext.scan_id,
                }}
                className="inline-flex min-h-10 shrink-0 items-center gap-1 text-xs text-accent"
              >
                <FileCode size={15} />
                Open source
              </Link>
            )}
          </div>
          <div
            ref={scroll}
            className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-8"
            aria-live="polite"
            aria-relevant="additions"
          >
            <div className="mx-auto max-w-[790px] space-y-7 py-7">
              {chat.olderCursor && (
                <button
                  className={button}
                  disabled={chat.loadingConversation}
                  onClick={() => void chat.loadOlderMessages()}
                >
                  Load earlier messages
                </button>
              )}
              {chat.loadingConversation && (
                <p role="status" className="text-sm">
                  Loading conversation…
                </p>
              )}
              {requested && !blocked && (
                <p role="status" className="rounded-lg border border-border p-3 text-sm">
                  {finding.isPending
                    ? "Loading saved finding…"
                    : chat.availability !== "ready"
                      ? "Waiting for Security Advisor…"
                      : "Preparing your finding question…"}
                </p>
              )}
              {blocked && (
                <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm">
                  This finding could not be opened in the active workspace.{" "}
                  <button className="underline" onClick={() => void finding.refetch()}>
                    Retry
                  </button>
                  <button className="ml-3 underline" onClick={newChat}>
                    Start a general chat
                  </button>
                </div>
              )}
              {!chat.messages.length && !requested && !chat.loadingConversation && (
                <div className="py-12 text-center sm:py-20">
                  <h2 className="text-2xl font-medium sm:text-3xl">
                    What would you like to understand?
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Explain a finding, review a suggested fix, or plan your next security check.
                  </p>
                  <button
                    className={`${button} mt-6`}
                    onClick={() => setInput("How do I prevent SQL injection in a database query?")}
                  >
                    How do I prevent SQL injection?
                  </button>
                </div>
              )}
              {chat.messages.map((message) => (
                <AiMessage key={message.id} message={message} />
              ))}
              {chat.error && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
                >
                  <p>{advisorErrorMessage(chat.error)}</p>
                  {requested && (
                    <button className="mt-2 underline" onClick={() => setRetry((v) => v + 1)}>
                      Retry finding question
                    </button>
                  )}
                  {search.conversation && !chat.conversationId && (
                    <button
                      className="mt-2 underline"
                      onClick={() => void chat.loadConversation(search.conversation!)}
                    >
                      Retry conversation
                    </button>
                  )}
                </div>
              )}
              <div ref={end} />
            </div>
          </div>
          <div className="shrink-0 bg-card px-4 pb-3 pt-2 sm:px-8">
            <div className="mx-auto max-w-[790px]">
              <div className="mb-2 flex flex-wrap gap-2">
                {["Explain", "Suggest a fix", "How to verify"].map((label) => (
                  <button
                    key={label}
                    className={button}
                    onClick={() =>
                      setInput(
                        `${label} ${chat.findingContext ? `the finding “${chat.findingContext.title}”` : "this security issue"}.`,
                      )
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="rounded-2xl border border-border bg-background p-3 shadow-sm">
                <label className="sr-only" htmlFor="advisor-question">
                  Your security question
                </label>
                <textarea
                  id="advisor-question"
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask about a finding or security question…"
                  className="max-h-40 min-h-14 w-full resize-y bg-transparent px-1 text-sm leading-6 outline-none focus-visible:shadow-ring"
                />
                <div className="mt-1 flex items-center justify-between gap-3">
                  <Link
                    to="/findings"
                    className="inline-flex min-h-9 items-center gap-2 px-1 text-xs text-muted-foreground"
                  >
                    <Plus size={16} />
                    Add finding
                  </Link>
                  {chat.isStreaming ? (
                    <button
                      aria-label="Stop response"
                      className={button}
                      onClick={chat.stopStreaming}
                    >
                      <StopCircle size={19} />
                      Stop
                    </button>
                  ) : (
                    <button
                      aria-label="Send message"
                      disabled={
                        !input.trim() || !chat.configured || chat.loadingConversation || requested
                      }
                      onClick={send}
                      className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
                    >
                      <ArrowUp size={20} />
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-center text-[11px] leading-5 text-muted-foreground">
                {chat.availability !== "ready" ? (
                  <>
                    <button onClick={() => void chat.retryAvailability()} className="underline">
                      {chat.availability === "checking"
                        ? "Checking availability…"
                        : "Advisor unavailable · Retry"}
                    </button>{" "}
                    ·{" "}
                  </>
                ) : null}
                Review suggestions and test changes before use.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
