import { useState } from "react";
import { Check, Copy, User } from "@phosphor-icons/react";
import { AdvisorIcon } from "@/components/ui/AdvisorIcon";
import { cn } from "@/lib/utils";
import type { UiMessage } from "@/hooks/useGroqChat";

interface AiMessageProps {
  message: UiMessage;
}

/** Code block with 1-click copy action, line gutters, and guaranteed high contrast in both light and dark mode */
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setCopied(false));
  };

  const lines = code.split("\n");
  const showGutter = lines.length > 1;

  return (
    <div className="my-3 min-w-0 overflow-hidden rounded-lg border border-white/15 bg-[#17191b] text-[#ededed]">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between border-b border-white/15 bg-[#222426] px-3 py-2 text-xs text-[#d5d5d0]">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="font-medium">{language || "source code"}</span>
          <span className="text-[10px] text-[#b5b5b0]">
            ({lines.length} {lines.length === 1 ? "line" : "lines"})
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          title="Copy code to clipboard"
          className="inline-flex items-center gap-1 font-semibold transition-colors hover:text-accent focus-visible:outline-none"
        >
          {copied ? (
            <>
              <Check size={11} weight="bold" className="text-success" />
              <span className="text-success font-bold">COPIED</span>
            </>
          ) : (
            <>
              <Copy size={11} weight="bold" />
              <span>COPY</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body with Line Gutters */}
      <div className="max-h-[420px] overflow-auto p-3 font-mono text-xs leading-relaxed">
        {showGutter ? (
          <div className="table w-full border-collapse">
            {lines.map((line, idx) => (
              <div
                key={idx}
                className="table-row hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <span className="table-cell w-8 select-none pr-3.5 text-right font-mono text-[10px] text-[#a5a5a0] align-top">
                  {idx + 1}
                </span>
                <span className="table-cell whitespace-pre-wrap break-all text-[#ededed] align-top">
                  {line || " "}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <pre className="whitespace-pre-wrap break-all text-[#ededed]">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

/** Format inline markdown without rewriting code or URL fragments. */
function renderInline(text: string): React.ReactNode {
  // Split on code backticks and bold markdown
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return parts.map((seg, k) => {
    if (seg.startsWith("`") && seg.endsWith("`")) {
      return (
        <code
          key={k}
          className="rounded-xs border border-border/80 bg-[#ebe5dc] text-[#111111] dark:bg-secondary/80 dark:text-foreground px-1.5 py-0.5 font-mono text-[11px] font-semibold"
        >
          {seg.slice(1, -1)}
        </code>
      );
    }

    if (seg.startsWith("**") && seg.endsWith("**")) {
      const boldContent = seg.slice(2, -2);
      return (
        <strong key={k} className="font-bold text-foreground">
          {boldContent}
        </strong>
      );
    }

    return <span key={k}>{seg}</span>;
  });
}

/** Renders a markdown table (header | cells) as a styled HTML table */
function renderTable(tableLines: string[]): React.ReactNode {
  if (tableLines.length < 2) return null;

  const parseRow = (line: string) =>
    line
      .split("|")
      .map((cell) => cell.trim())
      .filter((_, i, arr) => i !== 0 && i !== arr.length - 1); // strip leading/trailing empty from | borders

  const headerCells = parseRow(tableLines[0]);
  // tableLines[1] is the separator row (---)
  const dataRows = tableLines.slice(2).map(parseRow);

  return (
    <div className="my-3 overflow-x-auto rounded-sm border border-border shadow-xs">
      <table className="w-full text-[11px] font-mono border-collapse">
        <thead>
          <tr className="border-b border-border bg-secondary/60">
            {headerCells.map((cell, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left font-bold text-foreground uppercase tracking-wider whitespace-nowrap"
              >
                {renderInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, ri) => (
            <tr
              key={ri}
              className="border-b border-border/40 hover:bg-secondary/30 transition-colors"
            >
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-foreground/90 align-top leading-relaxed">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Markdown renderer for security explanations, code snippets, tables, and checklists */
function renderContent(text: string): React.ReactNode {
  const parts = text.split(/(```[\w-]*\n?[\s\S]*?```)/g);

  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const match = part.match(/^```([\w-]*)\n?([\s\S]*?)```$/);
      const language = match ? match[1] : "";
      const code = match ? match[2].trim() : part.slice(3, -3).trim();
      return <CodeBlock key={i} code={code} language={language} />;
    }

    const lines = part.split("\n");
    const output: React.ReactNode[] = [];
    let lineIdx = 0;

    while (lineIdx < lines.length) {
      const rawLine = lines[lineIdx];
      const trimmed = rawLine.trim();

      // Detect start of a markdown table (line contains | and is not just a separator)
      const isTableRow = (l: string) => /^\|.+\|/.test(l.trim());
      if (isTableRow(rawLine)) {
        // Collect all consecutive table lines
        const tableBlock: string[] = [];
        while (lineIdx < lines.length && isTableRow(lines[lineIdx])) {
          tableBlock.push(lines[lineIdx].trim());
          lineIdx++;
        }
        const tableNode = renderTable(tableBlock);
        if (tableNode) output.push(<div key={`t-${lineIdx}`}>{tableNode}</div>);
        continue;
      }

      lineIdx++;

      // Empty line
      if (!trimmed) {
        output.push(<div key={`e-${lineIdx}`} className="h-1" />);
        continue;
      }

      // Horizontal rule
      if (/^[-*_]{3,}$/.test(trimmed)) {
        output.push(<hr key={`hr-${lineIdx}`} className="my-2 border-border/50" />);
        continue;
      }

      // Markdown Headings
      const isHeading = /^#{1,6}\s+/.test(trimmed);
      if (isHeading) {
        const cleanHeading = trimmed.replace(/^#{1,6}\s+/, "").replace(/\s+#+\s*$/, "");
        output.push(
          <div
            key={`h-${lineIdx}`}
            className="mt-2.5 mb-1 flex items-center gap-1.5 border-b border-border/40 pb-1 font-mono text-[11px] font-bold uppercase tracking-wider text-foreground"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-xs bg-accent" />
            <span>{renderInline(cleanHeading)}</span>
          </div>,
        );
        continue;
      }

      // Blockquote
      if (/^>\s*/.test(trimmed)) {
        const quoteContent = trimmed.replace(/^>\s*/, "");
        output.push(
          <div
            key={`q-${lineIdx}`}
            className="my-1 border-l-2 border-accent/60 bg-accent/5 py-1 pl-2.5 text-[11px] italic text-foreground/90 rounded-r-xs"
          >
            {renderInline(quoteContent)}
          </div>,
        );
        continue;
      }

      // Bullet points
      const isBullet = /^[-*•]\s+/.test(trimmed);
      if (isBullet) {
        const content = trimmed.replace(/^[-*•]\s+/, "");
        output.push(
          <div key={`b-${lineIdx}`} className="flex items-start gap-2 py-0.5">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span className="flex-1 leading-relaxed text-foreground/90">
              {renderInline(content)}
            </span>
          </div>,
        );
        continue;
      }

      // Numbered lists
      const isNumbered = /^\d+\.\s+/.test(trimmed);
      if (isNumbered) {
        const num = trimmed.match(/^(\d+)\./)?.[1] ?? "1";
        const content = trimmed.replace(/^\d+\.\s+/, "");
        output.push(
          <div key={`n-${lineIdx}`} className="flex items-start gap-2 py-0.5">
            <span className="mt-0.5 shrink-0 font-mono text-[10px] font-bold text-accent">
              [{num}]
            </span>
            <span className="flex-1 leading-relaxed text-foreground/90">
              {renderInline(content)}
            </span>
          </div>,
        );
        continue;
      }

      // Standard paragraph
      output.push(
        <p key={`p-${lineIdx}`} className="leading-relaxed text-foreground/90">
          {renderInline(trimmed)}
        </p>,
      );
    }

    return (
      <div key={i} className="space-y-1.5">
        {output}
      </div>
    );
  });
}

export function AiMessage({ message }: AiMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    void navigator.clipboard
      .writeText(message.content)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setCopied(false));
  };

  // User Message: Sharp Brutalist Card
  if (isUser) {
    return (
      <div className="flex flex-col gap-1 items-end">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
          <User size={11} className="text-accent" />
          <span>You</span>
        </div>
        <div className="max-w-[92%] whitespace-pre-wrap break-words rounded-xl bg-secondary px-4 py-3 text-sm leading-7 text-foreground sm:max-w-[85%]">
          {message.content}
        </div>
      </div>
    );
  }

  // Advisor Response: Industrial Cyber-Defense Console Card
  return (
    <div className="flex flex-col gap-1.5">
      {/* Header Attribution */}
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground px-1">
        <div className="flex items-center gap-1.5">
          <AdvisorIcon size={13} className="text-muted-foreground" />
          <span className="font-bold text-foreground">Security Advisor</span>
        </div>

        {!message.streaming && message.content && (
          <button
            type="button"
            onClick={handleCopy}
            title="Copy full response"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {copied ? (
              <>
                <Check size={11} weight="bold" className="text-success" />
                <span className="text-success font-bold">COPIED</span>
              </>
            ) : (
              <>
                <Copy size={11} weight="bold" />
                <span>COPY</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Response Box */}
      <div className={cn("min-w-0 space-y-3 break-words py-3 text-sm leading-7 text-foreground")}>
        {message.content ? (
          renderContent(message.content)
        ) : (
          /* Streaming initialization indicator */
          <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
            <span role="status">
              {message.streaming ? "Preparing response…" : "No complete response was saved."}
            </span>
          </div>
        )}

        {message.streaming && message.content && (
          <span className="inline-block h-3.5 w-1.5 bg-accent animate-pulse align-middle ml-1" />
        )}
        {!message.streaming &&
          (message.status === "interrupted" || message.status === "failed") && (
            <p className="text-xs text-muted-foreground">
              Response interrupted. You can ask again to retry.
            </p>
          )}
      </div>
    </div>
  );
}
