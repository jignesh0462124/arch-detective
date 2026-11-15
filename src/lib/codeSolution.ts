export type SolutionBlock = { language: string; code: string; complete: boolean };

/** Read-only presentation parser: never interprets or executes HTML. */
export function parseCodeSolution(content: string) {
  const sections: Record<string, string[]> = { assessment: [], explanation: [], verification: [] };
  const blocks: SolutionBlock[] = [];
  let section = "assessment";
  let block: { language: string; lines: string[]; marker: string } | null = null;
  for (const line of content.replace(/\r\n/g, "\n").split("\n")) {
    const fence = line.match(/^\s*(`{3,}|~{3,})([^\s]*)\s*$/);
    if (block) {
      if (
        fence &&
        fence[1][0] === block.marker[0] &&
        fence[1].length >= block.marker.length &&
        !fence[2]
      ) {
        blocks.push({ language: block.language, code: block.lines.join("\n"), complete: true });
        block = null;
      } else block.lines.push(line);
      continue;
    }
    if (fence) {
      block = { language: fence[2], marker: fence[1], lines: [] };
      continue;
    }
    const heading = line
      .trim()
      .replace(/^#{1,6}\s+/, "")
      .replace(/^\*\*(.*?)\*\*:?$/, "$1")
      .replace(/:$/, "")
      .toLowerCase();
    if (
      /^(assessment|assessment of evidence|explanation|assumptions|explanation and assumptions|verification|verification steps|how to verify|suggested code|fenced code solution|code solution)$/.test(
        heading,
      )
    ) {
      section = /verif/.test(heading)
        ? "verification"
        : /explanation|assumptions/.test(heading)
          ? "explanation"
          : /assessment/.test(heading)
            ? "assessment"
            : "explanation";
    } else sections[section].push(line);
  }
  if (block)
    blocks.push({ language: block.language, code: block.lines.join("\n"), complete: false });
  const assessment = sections.assessment.join("\n").trim();
  // Keep the preview short without discarding any original explanation/caveats.
  const first = assessment.split(/\n\s*\n/)[0] || "No assessment was provided.";
  return {
    assessment: first.length > 360 ? first.slice(0, 360) + "…" : first,
    explanation: [assessment, sections.explanation.join("\n").trim()].filter(Boolean).join("\n\n"),
    verification: sections.verification
      .filter((line) => line.trim())
      .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "")),
    blocks,
    incompleteFence: blocks.some((item) => !item.complete),
  };
}

export const solutionKey = (workspace: string, scan: string, finding: string) =>
  JSON.stringify([workspace, scan, finding]);

/** First content is immediate; subsequent token updates are coalesced. */
export function textBatcher(publish: (text: string) => void, delay = 100) {
  let text = "";
  let first = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (text) publish(text);
  };
  return {
    append(chunk: string) {
      text += chunk;
      if (first) {
        first = false;
        flush();
      } else if (!timer) timer = setTimeout(flush, delay);
    },
    flush,
    dispose() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
