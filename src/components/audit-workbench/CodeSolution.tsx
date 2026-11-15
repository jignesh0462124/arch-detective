import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSharedAiChat } from "@/components/ai-assistant/AiChatContext";
import type { WorkbenchFinding } from "@/lib/api/workbench";
import { advisorErrorMessage } from "@/lib/advisorPresentation";
import { solutionKey } from "@/lib/codeSolution";
import { SolutionPreview } from "./SolutionPreview";

export function CodeSolution({
  workspaceId,
  scanId,
  finding,
  available,
  policyResultId,
  unavailableReason,
}: {
  workspaceId: string;
  scanId: string;
  finding: Pick<
    WorkbenchFinding,
    "id" | "title" | "file_path" | "line_number" | "remediation" | "location"
  >;
  available: boolean;
  policyResultId?: string;
  unavailableReason?: string;
}) {
  const chat = useSharedAiChat();
  const [view, setView] = useState<"steps" | "code">("steps");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const alive = useRef(true);
  const ownedMessage = useRef<string | null>(null);
  const id = useId();
  const key = solutionKey(workspaceId, scanId, finding.id);
  const validSource = available && finding.location?.match_status === "verified";
  const result = validSource ? chat.codeSolutions[key] : undefined;
  const savedCode = /\x60\x60\x60|~~~/.test(finding.remediation || "");
  const response =
    result?.message ||
    (savedCode
      ? { id: "saved-" + finding.id, role: "assistant" as const, content: finding.remediation! }
      : undefined);
  const { activateAdvisor, stopCodeSolution, clearCodeSolution } = chat;
  useEffect(() => {
    if (!validSource) clearCodeSolution(key);
  }, [validSource, key, clearCodeSolution]);
  useEffect(() => {
    if (view === "code") return activateAdvisor();
  }, [view, activateAdvisor]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (ownedMessage.current) stopCodeSolution(key, ownedMessage.current);
    };
  }, [key, stopCodeSolution]);
  const generate = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    ownedMessage.current = crypto.randomUUID();
    const accepted = await chat.sendMessage(
      "Review this finding's evidence and suggest a minimal behavior-preserving code solution only if justified. Include a concise assessment, complete fenced code, verification steps and assumptions. Do not claim an exploit or fix is verified.",
      {
        context: {
          workspace_id: workspaceId,
          scan_id: scanId,
          ...(policyResultId ? { policy_result_id: policyResultId } : { finding_id: finding.id }),
          title: finding.title,
        },
        codeSolution: true,
        responseId: ownedMessage.current,
        newConversation: true,
        onAccepted: (_conversation, messageId) => {
          ownedMessage.current = messageId || null;
        },
      },
    );
    if (alive.current) {
      setPending(false);
      if (!accepted)
        setError(
          "The new suggestion could not be started. Your previous result has been kept. Retry when Advisor is available.",
        );
    }
    busy.current = false;
  };
  const button =
    "inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-card px-3 text-xs disabled:opacity-50 hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  const path = finding.file_path || "Source location unavailable";
  return (
    <div className="min-w-0 space-y-4">
      <div role="tablist" aria-label="Remediation format" className="flex gap-2">
        {(["steps", "code"] as const).map((value, index) => (
          <button
            type="button"
            role="tab"
            id={id + "-" + value}
            aria-controls={id + "-panel"}
            tabIndex={view === value ? 0 : -1}
            aria-selected={view === value}
            key={value}
            className={
              button + (view === value ? " border-accent font-semibold" : " text-muted-foreground")
            }
            onKeyDown={(event) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? "steps"
                    : event.key === "End"
                      ? "code"
                      : index === 0
                        ? "code"
                        : "steps";
                setView(next);
                document.getElementById(id + "-" + next)?.focus();
              }
            }}
            onClick={() => setView(value)}
          >
            {value === "steps" ? "Steps" : "Code solution"}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={id + "-panel"}
        aria-labelledby={id + "-" + view}
        className="min-w-0 space-y-4"
      >
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
            <details className="min-w-0 rounded-md border border-border p-3 text-xs">
              <summary className="cursor-pointer break-words font-mono">
                {path.split(/[\\/]/).pop()}
                {finding.line_number ? ":" + finding.line_number : ""}
              </summary>
              <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">{path}</p>
            </details>
            {response ? (
              <SolutionPreview message={response} />
            ) : (
              <p className="text-xs leading-6 text-muted-foreground">
                Generate a small code suggestion based on the recorded evidence. If a replacement is
                not justified, the assessment will explain why.
              </p>
            )}
            {!validSource && (
              <p role="status" className="rounded-md border border-border p-3 text-xs leading-6">
                {unavailableReason ||
                  "Source is unavailable, expired or unverified. Run a fresh audit for a code solution, or open Security Advisor for general guidance."}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {validSource && (
                <button
                  type="button"
                  className={button + " flex-1"}
                  disabled={
                    !chat.configured || pending || chat.isStreaming || chat.loadingConversation
                  }
                  onClick={() => void generate()}
                >
                  {pending
                    ? "Preparing code…"
                    : response
                      ? "Regenerate code suggestion"
                      : "Generate code suggestion"}
                </button>
              )}
              {result?.message.streaming && (
                <button type="button" className={button} onClick={() => chat.stopCodeSolution(key)}>
                  Stop
                </button>
              )}
              <Link
                className={button + " flex-1"}
                to="/advisor"
                onClick={() => {
                  if (policyResultId && validSource && !result?.conversationId)
                    chat.setFindingContext({
                      workspace_id: workspaceId,
                      scan_id: scanId,
                      policy_result_id: policyResultId,
                      title: finding.title,
                    });
                }}
                search={
                  result?.conversationId
                    ? { conversation: result.conversationId }
                    : !validSource
                      ? {
                          prompt:
                            "Explain general remediation for " +
                            finding.title +
                            ". Original source is unavailable or unverified; do not infer its code.",
                        }
                      : policyResultId
                        ? {}
                        : { workspaceId, scanId, findingId: finding.id, solution: "patch" }
                }
              >
                Open in Security Advisor
              </Link>
            </div>
            {(error || result?.error) && (
              <p role="alert" className="text-xs text-destructive">
                {error || advisorErrorMessage(result?.error)}
              </p>
            )}
            {chat.availability !== "ready" && (
              <button
                type="button"
                className={button}
                onClick={() => void chat.retryAvailability()}
              >
                {chat.availability === "checking"
                  ? "Checking Advisor…"
                  : "Advisor unavailable · Retry"}
              </button>
            )}
          </>
        )}
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">
        Read-only suggestion. Review assumptions and test changes before using them; your uploaded
        code is unchanged.
      </p>
    </div>
  );
}
