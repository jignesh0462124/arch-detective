import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AiMessage } from "@/components/ai-assistant/AiMessage";
import { useSharedAiChat } from "@/components/ai-assistant/AiChatContext";
import type { WorkbenchFinding } from "@/lib/api/workbench";
import { advisorErrorMessage } from "@/lib/advisorPresentation";

export function CodeSolution({
  workspaceId,
  scanId,
  finding,
  available,
}: {
  workspaceId: string;
  scanId: string;
  finding: WorkbenchFinding;
  available: boolean;
}) {
  const chat = useSharedAiChat();
  const [view, setView] = useState<"steps" | "code">("steps");
  const [requested, setRequested] = useState(false);
  const { activateAdvisor, stopStreaming } = chat;
  const matches =
    chat.findingContext?.workspace_id === workspaceId &&
    chat.findingContext?.scan_id === scanId &&
    chat.findingContext?.finding_id === finding.id;
  const savedCode = /```[\s\S]*?```/.test(finding.remediation || "");
  const response = matches
    ? [...chat.messages].reverse().find((m) => m.role === "assistant")
    : undefined;
  useEffect(() => {
    if (view === "code") return activateAdvisor();
  }, [view, activateAdvisor]);
  useEffect(
    () => () => {
      if (requested) stopStreaming();
    },
    [requested, stopStreaming],
  );
  const generate = () => {
    setRequested(true);
    void chat.sendMessage(
      "Suggest a minimal code solution for this saved finding. Include an explanation, fenced code, assumptions and verification steps. Preserve the existing application behaviour and do not claim the change is verified.",
      {
        context: {
          workspace_id: workspaceId,
          scan_id: scanId,
          finding_id: finding.id,
          title: finding.title,
        },
        codeSolution: true,
        newConversation: true,
      },
    );
  };
  const button =
    "inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-card px-3 text-xs disabled:opacity-50 hover:bg-secondary";
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Remediation format" className="flex gap-2">
        {(["steps", "code"] as const).map((value) => (
          <button
            role="tab"
            aria-selected={view === value}
            key={value}
            className={`${button} ${view === value ? "border-accent font-semibold" : "text-muted-foreground"}`}
            onClick={() => setView(value)}
          >
            {value === "steps" ? "Steps" : "Code solution"}
          </button>
        ))}
      </div>
      {view === "steps" ? (
        <>
          <h3 className="text-xs font-semibold">Suggested remediation</h3>
          <p className="whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
            {finding.remediation ||
              "No remediation was captured. Request guidance in Security Advisor."}
          </p>
        </>
      ) : (
        <>
          <p className="break-all font-mono text-[11px] text-muted-foreground">
            {finding.file_path || "Source location unavailable"}
            {finding.line_number ? `:${finding.line_number}` : ""}
          </p>
          {savedCode && !requested ? (
            <AiMessage
              message={{
                id: `saved-${finding.id}`,
                role: "assistant",
                content: finding.remediation!,
              }}
            />
          ) : response && requested ? (
            <AiMessage message={response} />
          ) : (
            <p className="text-xs leading-6 text-muted-foreground">
              Generate a small code suggestion grounded in this finding and its available source.
              Review how it fits your project before using it.
            </p>
          )}
          {!available || finding.location?.match_status !== "verified" ? (
            <p role="status" className="rounded-md border border-border p-3 text-xs leading-6">
              Source is unavailable, expired or unverified. Run a fresh audit for a code solution,
              or open Security Advisor for general remediation guidance.
            </p>
          ) : (
            <button
              className={button}
              disabled={!chat.configured || chat.isStreaming || chat.loadingConversation}
              onClick={generate}
            >
              {chat.isStreaming && matches
                ? "Preparing code…"
                : requested
                  ? "Regenerate code suggestion"
                  : "Generate code suggestion"}
            </button>
          )}
          {requested && matches && chat.isStreaming && (
            <button className={`${button} ml-2`} onClick={chat.stopStreaming}>
              Stop
            </button>
          )}
          {chat.error && requested && (
            <p role="alert" className="text-xs text-destructive">
              {advisorErrorMessage(chat.error)}
            </p>
          )}
          {view === "code" && chat.availability !== "ready" && (
            <button
              className={`${button} text-muted-foreground`}
              onClick={() => void chat.retryAvailability()}
            >
              {chat.availability === "checking"
                ? "Checking Advisor…"
                : "Advisor unavailable · Retry"}
            </button>
          )}
          <Link
            className={`${button} w-full`}
            to="/advisor"
            search={
              matches && chat.conversationId && requested
                ? { conversation: chat.conversationId }
                : !available || finding.location?.match_status !== "verified"
                  ? {
                      prompt: `Explain general remediation for ${finding.title}. The original source is unavailable or unverified; do not infer its code.`,
                    }
                  : { workspaceId, scanId, findingId: finding.id, solution: "patch" }
            }
          >
            Open in Security Advisor
          </Link>
        </>
      )}
      <p className="rounded-md border border-border p-3 text-[11px] leading-5 text-muted-foreground">
        Suggestions do not change your uploaded code. Review assumptions and validate changes with
        your project's tests.
      </p>
    </div>
  );
}
