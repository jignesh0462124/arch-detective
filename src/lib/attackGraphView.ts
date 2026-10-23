import type { AttackGraphNode, AttackGraphScenario, ThreatVector } from "./api/attackGraph";

/** Center a scaled DOM node in its scroll container without moving the page. */
export function centeredGraphScroll(
  view: {
    left: number;
    top: number;
    width: number;
    height: number;
    scrollLeft: number;
    scrollTop: number;
    scrollWidth: number;
    scrollHeight: number;
  },
  node: { left: number; top: number; width: number; height: number },
) {
  return {
    left: Math.max(
      0,
      Math.min(
        view.scrollWidth - view.width,
        view.scrollLeft + node.left - view.left + node.width / 2 - view.width / 2,
      ),
    ),
    top: Math.max(
      0,
      Math.min(
        view.scrollHeight - view.height,
        view.scrollTop + node.top - view.top + node.height / 2 - view.height / 2,
      ),
    ),
  };
}

export interface PlacedNode extends AttackGraphNode {
  px: number;
  py: number;
  pw: number;
  ph: number;
}

/** Keep one entry per chain column; all remaining nodes remain visible. */
export function layoutAttackGraph(nodes: AttackGraphNode[]) {
  const chain = ["client", "gateway", "service"].flatMap((type) => {
    const node = nodes.find((n) => n.type === type);
    return node ? [node] : [];
  });
  const used = new Set(chain.map((n) => n.id));
  const branches = nodes.filter((n) => !used.has(n.id));
  const columns = chain.length + (branches.length ? 1 : 0);
  const cardWidth = 288;
  const cardHeight = 136;
  const columnStep = cardWidth + 160;
  const rowStep = cardHeight + 32;
  const width = Math.max(352, 64 + columns * cardWidth + Math.max(0, columns - 1) * 160);
  const height = Math.max(320, 64 + branches.length * rowStep - 32);
  const place = (node: AttackGraphNode, column: number, y: number): PlacedNode => ({
    ...node,
    px: 32 + column * columnStep,
    py: y,
    pw: cardWidth,
    ph: cardHeight,
  });
  return {
    width,
    height,
    nodes: [
      ...chain.map((node, i) => place(node, i, (height - cardHeight) / 2)),
      ...branches.map((node, i) =>
        place(node, chain.length, (height - (branches.length * rowStep - 32)) / 2 + i * rowStep),
      ),
    ],
  };
}

export function edgePath(source: PlacedNode, target: PlacedNode): string {
  const forward = target.px > source.px;
  const x1 = source.px + (forward ? source.pw : 0);
  const x2 = target.px + (forward ? 0 : target.pw);
  const y1 = source.py + source.ph / 2;
  const y2 = target.py + target.ph / 2;
  if (source.px === target.px) {
    const x = source.px + source.pw / 2;
    const down = target.py > source.py;
    return `M ${x} ${source.py + (down ? source.ph : 0)} L ${x} ${target.py + (down ? 0 : target.ph)}`;
  }
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

export function getThreatTarget(scenario: AttackGraphScenario, threat?: ThreatVector) {
  return scenario.nodes.find((n) => n.id === threat?.compromisedNodeId) ?? null;
}

/** Keep the filename intact while shortening repetitive archive directory names. */
export function compactSourcePath(path: string, maxLength = 40) {
  const parts = path.replace(/\\/g, "/").split("/");
  const file = parts.pop() || path;
  const parent = parts.pop();
  if (!parent) return file;
  if (`${parent}/${file}`.length <= maxLength) return `${parent}/${file}`;
  const budget = maxLength - file.length - 2;
  return budget > 3 ? `${parent.slice(0, budget)}…/${file}` : `…/${file}`;
}

export function shouldShowEmptyAttackGraph({
  workspaceReady,
  scansPending,
  scansFailed,
  scanCount,
}: {
  workspaceReady: boolean;
  scansPending: boolean;
  scansFailed: boolean;
  scanCount: number;
}): boolean {
  return workspaceReady && !scansPending && !scansFailed && scanCount === 0;
}

export function formatCvss(score: number | null) {
  return typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 10
    ? score.toFixed(1)
    : "N/A";
}

export function peakCvss(threats: ThreatVector[]) {
  const scores = threats
    .map((t) => t.cvssScore)
    .filter((s): s is number => typeof s === "number" && Number.isFinite(s) && s >= 0 && s <= 10);
  return scores.length ? Math.max(...scores) : null;
}
