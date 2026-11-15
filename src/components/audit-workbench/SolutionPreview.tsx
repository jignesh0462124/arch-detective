import { memo, useMemo, useState } from "react";
import { parseCodeSolution, type SolutionBlock } from "@/lib/codeSolution";
import type { UiMessage } from "@/hooks/useGroqChat";

const control =
  "inline-flex min-h-10 items-center justify-center rounded-md border border-border px-3 text-xs hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50";

function prose(text: string) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("`") ? (
      <code key={i} className="rounded bg-secondary px-1 font-mono">
        {part.slice(1, -1)}
      </code>
    ) : part.startsWith("**") ? (
      <strong key={i} className="font-semibold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

// Lightweight lexical colour only, not a parser or a validation claim.
function syntax(line: string) {
  return line
    .split(
      /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*$|\b(?:const|let|function|return|if|else|def|import|from|class|new|true|false|null)\b)/g,
    )
    .map((part, i) =>
      i % 2 ? (
        <span
          key={i}
          className={
            part.startsWith("//")
              ? "text-[#a5a5a0]"
              : /^["']/.test(part)
                ? "text-[#c4d99b]"
                : "text-[#f2b98a]"
          }
        >
          {part}
        </span>
      ) : (
        part
      ),
    );
}

const Snippet = memo(function Snippet({
  block,
  disabled,
}: {
  block: SolutionBlock;
  disabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState("");
  // A provider language label is a hint, not verification of the code's language.
  const language = /^\s*<script[\s>]/i.test(block.code) ? "html" : block.language || "source";
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {language} · {block.code.split("\n").length}{" "}
          {block.code.includes("\n") ? "lines" : "line"}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className={control}
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Collapse code" : "Expand code"}
          </button>
          <button
            type="button"
            className={control}
            disabled={disabled || !block.complete}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(block.code);
                setFeedback("Code copied.");
              } catch {
                setFeedback("Could not copy. Select the code and copy manually.");
              }
            }}
          >
            Copy code
          </button>
        </div>
      </div>
      <div
        tabIndex={0}
        role="region"
        aria-label="Suggested code preview"
        className={`overflow-auto bg-[#17191b] text-[#ededed] ${expanded ? "max-h-[70vh]" : "max-h-72"}`}
      >
        <pre className="w-max min-w-full p-3 text-xs leading-6">
          <code>
            {block.code.split("\n").map((line, i) => (
              <span className="block" key={i}>
                <span
                  aria-hidden
                  className="mr-4 inline-block w-7 select-none text-right text-[#a5a5a0]"
                >
                  {i + 1}
                </span>
                {block.complete && !disabled ? syntax(line || " ") : line || " "}
              </span>
            ))}
          </code>
        </pre>
      </div>
      {feedback && (
        <p role="status" className="px-3 py-2 text-xs">
          {feedback}
        </p>
      )}
    </section>
  );
});

export const SolutionPreview = memo(function SolutionPreview({ message }: { message: UiMessage }) {
  const parsed = useMemo(() => parseCodeSolution(message.content), [message.content]);
  const incomplete =
    message.status === "interrupted" || message.status === "failed" || parsed.incompleteFence;
  return (
    <div className="min-w-0 space-y-4" aria-busy={message.streaming}>
      {message.streaming ? (
        <p role="status" className="text-xs text-muted-foreground">
          Preparing suggestion…
        </p>
      ) : (
        incomplete && (
          <p role="alert" className="rounded-md border border-amber-500/40 p-3 text-xs">
            Incomplete suggestion. Regenerate before using this code.
          </p>
        )
      )}
      <section>
        <h3 className="text-xs font-semibold">Assessment</h3>
        <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
          {prose(parsed.assessment)}
        </p>
      </section>
      <section className="min-w-0 space-y-2">
        <h3 className="text-xs font-semibold">Suggested code</h3>
        {parsed.blocks.length ? (
          parsed.blocks.map((block, i) => (
            <Snippet
              key={`${message.id}-${i}`}
              block={block}
              disabled={!!message.streaming || incomplete}
            />
          ))
        ) : (
          <p className="text-xs leading-6 text-muted-foreground">
            {message.streaming
              ? "Waiting for proposed code…"
              : "No code replacement was provided. Review the assessment or request further guidance."}
          </p>
        )}
      </section>
      <section>
        <h3 className="text-xs font-semibold">How to verify</h3>
        {parsed.verification.length ? (
          <ul className="mt-2 list-disc space-y-2 pl-4 text-xs leading-6 text-muted-foreground">
            {parsed.verification.map((line, i) => (
              <li key={i}>{prose(line)}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Verification steps were not provided.
          </p>
        )}
      </section>
      <details className="rounded-md border border-border p-3">
        <summary className="cursor-pointer text-xs font-medium">
          Explanation and assumptions
        </summary>
        <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-muted-foreground">
          {prose(parsed.explanation || "No additional explanation or assumptions were provided.")}
        </p>
      </details>
    </div>
  );
});
