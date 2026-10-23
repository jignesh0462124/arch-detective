import { useState, useEffect } from "react";
import {
  GitBranch,
  ListChecks,
  FileText,
  TreeStructure,
  Warning,
  Info,
} from "@phosphor-icons/react";

export function SaaSHeroMotionGraphic() {
  const [activeStep, setActiveStep] = useState(0);
  const [packetProgress, setPacketProgress] = useState(0);

  // 10-second continuous deterministic loop cycle
  useEffect(() => {
    const startTime = performance.now();
    let frameId: number;

    const animate = (currentTime: number) => {
      const elapsed = (currentTime - startTime) % 10000;
      const progress = elapsed / 10000; // 0.0 to 1.0
      setPacketProgress(progress);

      // Determine active stage based on timeline
      if (progress < 0.22) {
        setActiveStep(0); // Ingestion & AST
      } else if (progress < 0.44) {
        setActiveStep(1); // Topology & Trust Boundaries
      } else if (progress < 0.66) {
        setActiveStep(2); // Security Scanners (Semgrep/Bandit)
      } else if (progress < 0.85) {
        setActiveStep(3); // Framework mapping
      } else {
        setActiveStep(4); // Report preparation
      }

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-sm border border-border bg-[#0e0e0d] text-[#f5f1ec] select-none font-sans">
      {/* Precision Technical Sub-Grid Background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #ffffff 1px, transparent 1px),
            linear-gradient(to bottom, #ffffff 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Top Status & Telemetry Bar */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[#141413]/90 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="flex items-center gap-1.5 font-semibold text-white">
            <span className="size-2 rounded-full bg-[#ff5600]" />
            ARCHON<span className="text-[#8e8e89] font-normal"> · WORKFLOW</span>
          </span>
          <span className="hidden text-[#4a4a46] sm:inline">|</span>
          <span className="hidden text-[#8e8e89] sm:inline">PROJECT REVIEW</span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="flex items-center gap-1.5 rounded bg-white/[0.04] px-2 py-0.5 text-[#8e8e89] border border-white/[0.06]">
            ILLUSTRATIVE WORKFLOW
          </span>
        </div>
      </div>

      {/* Main Architecture Flow Diagram */}
      <div className="relative z-10 p-4 sm:p-6 lg:p-7">
        <div className="relative mx-auto w-full max-w-[880px]">
          {/* SVG Pipeline Bus Wiring */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 880 340"
            fill="none"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="busGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff5600" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#ff5600" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#0bdf50" stopOpacity="0.9" />
              </linearGradient>
            </defs>

            {/* Circuit Connection Tracks */}
            {/* Bus Line 1 -> 2 */}
            <path
              d="M 230 75 L 340 75"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            {/* Bus Line 2 -> 3 */}
            <path
              d="M 570 75 L 650 75"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            {/* Bus Line 3 -> 4 (Down & Left) */}
            <path
              d="M 750 135 L 750 190 Q 750 205 735 205 L 570 205"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            {/* Bus Line 4 -> 5 */}
            <path
              d="M 340 255 L 230 255"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />

            {/* Dynamic Traveling Data Packet (Continuous Loop) */}
            {packetProgress < 0.25 && (
              <circle
                cx={230 + (packetProgress / 0.25) * 110}
                cy={75}
                r={3.5}
                fill="#ff5600"
                filter="drop-shadow(0 0 5px #ff5600)"
              />
            )}
            {packetProgress >= 0.25 && packetProgress < 0.5 && (
              <circle
                cx={570 + ((packetProgress - 0.25) / 0.25) * 80}
                cy={75}
                r={3.5}
                fill="#ff5600"
                filter="drop-shadow(0 0 5px #ff5600)"
              />
            )}
            {packetProgress >= 0.5 && packetProgress < 0.75 && (
              <circle
                cx={750 - ((packetProgress - 0.5) / 0.25) * 180}
                cy={205}
                r={3.5}
                fill="#ff5600"
                filter="drop-shadow(0 0 5px #ff5600)"
              />
            )}
            {packetProgress >= 0.75 && (
              <circle
                cx={340 - ((packetProgress - 0.75) / 0.25) * 110}
                cy={255}
                r={3.5}
                fill="#0bdf50"
                filter="drop-shadow(0 0 6px #0bdf50)"
              />
            )}
          </svg>

          {/* Top Row: Nodes 01, 02, 03 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
            {/* Stage 01: Ingestion */}
            <div
              className={`relative rounded-md border p-3.5 transition-all duration-300 ${
                activeStep === 0
                  ? "border-[#ff5600] bg-[#181816] shadow-[0_4px_20px_rgba(255,86,0,0.15)]"
                  : "border-white/[0.08] bg-[#121211]/80 text-[#8e8e89]"
              }`}
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 font-mono text-[10px]">
                <span className="flex items-center gap-1.5 text-[#ff5600] font-semibold">
                  <GitBranch size={12} weight="bold" />
                  01. INGEST
                </span>
                <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[#8e8e89]">
                  ZIP PROJECT
                </span>
              </div>
              <div className="mt-2.5">
                <div className="text-xs font-semibold text-white">Project upload</div>
                <p className="mt-1 font-mono text-[10px] text-[#8e8e89] leading-relaxed">
                  Validate the archive and prepare source previews.
                </p>
              </div>
              <div className="mt-2.5 flex items-center justify-between font-mono text-[9px] text-[#63635e]">
                <span>SOURCE FILES</span>
                <span>STEP 1</span>
              </div>
            </div>

            {/* Stage 02: Topology & Trust Boundaries */}
            <div
              className={`relative rounded-md border p-3.5 transition-all duration-300 ${
                activeStep === 1
                  ? "border-[#ff5600] bg-[#181816] shadow-[0_4px_20px_rgba(255,86,0,0.15)]"
                  : "border-white/[0.08] bg-[#121211]/80 text-[#8e8e89]"
              }`}
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 font-mono text-[10px]">
                <span className="flex items-center gap-1.5 text-[#ff5600] font-semibold">
                  <TreeStructure size={12} weight="bold" />
                  02. EVIDENCE
                </span>
                <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[#8e8e89]">
                  SOURCE LINKS
                </span>
              </div>
              <div className="mt-2.5">
                <div className="text-xs font-semibold text-white">Finding evidence</div>
                <p className="mt-1 font-mono text-[10px] text-[#8e8e89] leading-relaxed">
                  Connect findings to recorded source locations.
                </p>
              </div>
              <div className="mt-2.5 flex items-center justify-between font-mono text-[9px] text-[#63635e]">
                <span>EVIDENCE TOPOLOGY</span>
                <span>STEP 2</span>
              </div>
            </div>

            {/* Stage 03: Security Scanners */}
            <div
              className={`relative rounded-md border p-3.5 transition-all duration-300 ${
                activeStep === 2
                  ? "border-[#ff5600] bg-[#181816] shadow-[0_4px_20px_rgba(255,86,0,0.15)]"
                  : "border-white/[0.08] bg-[#121211]/80 text-[#8e8e89]"
              }`}
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 font-mono text-[10px]">
                <span className="flex items-center gap-1.5 text-[#ff5600] font-semibold">
                  <Warning size={12} weight="bold" />
                  03. REVIEW
                </span>
                <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[#8e8e89]">
                  FINDINGS
                </span>
              </div>
              <div className="mt-2.5">
                <div className="text-xs font-semibold text-white">Security review</div>
                <p className="mt-1 font-mono text-[10px] text-[#8e8e89] leading-relaxed">
                  Review severity, evidence, and suggested remediation.
                </p>
              </div>
              <div className="mt-2.5 flex items-center justify-between font-mono text-[9px] text-[#63635e]">
                <span>HUMAN REVIEW</span>
                <span>STEP 3</span>
              </div>
            </div>
          </div>

          {/* Bottom Row: Report and framework mapping */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            {/* Stage 05: Audit Report */}
            <div
              className={`relative rounded-md border p-4 transition-all duration-300 ${
                activeStep === 4
                  ? "border-[#0bdf50] bg-[#161a17] shadow-[0_4px_20px_rgba(11,223,80,0.15)]"
                  : "border-white/[0.08] bg-[#121211]/80 text-[#8e8e89]"
              }`}
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 font-mono text-[10px]">
                <span className="flex items-center gap-1.5 text-[#0bdf50] font-semibold">
                  <FileText size={13} weight="bold" />
                  05. REPORT
                </span>
                <span className="rounded bg-[#0b8f3c]/20 px-1.5 py-0.5 text-[9px] font-semibold text-[#0bdf50]">
                  PDF
                </span>
              </div>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Audit report</div>
                  <p className="mt-1 font-mono text-[10px] text-[#8e8e89]">
                    Saved evidence, remediation, and assessment limitations.
                  </p>
                </div>
                <div className="rounded border border-[#0bdf50]/30 bg-[#0bdf50]/10 px-2.5 py-1 text-right font-mono">
                  <div className="text-xs font-bold text-[#0bdf50]">REVIEW</div>
                  <div className="text-[9px] text-[#8e8e89]">REQUIRED</div>
                </div>
              </div>
            </div>

            {/* Stage 04: Framework Mapping */}
            <div
              className={`relative rounded-md border p-4 transition-all duration-300 ${
                activeStep === 3
                  ? "border-[#ff5600] bg-[#181816] shadow-[0_4px_20px_rgba(255,86,0,0.15)]"
                  : "border-white/[0.08] bg-[#121211]/80 text-[#8e8e89]"
              }`}
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 font-mono text-[10px]">
                <span className="flex items-center gap-1.5 text-[#ff5600] font-semibold">
                  <ListChecks size={13} weight="bold" />
                  04. MAPPINGS
                </span>
                <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[#8e8e89]">
                  FRAMEWORKS
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="space-y-1 font-mono text-[10px]">
                  <div className="text-white font-medium">Framework control mappings</div>
                  <div className="text-[#8e8e89]">
                    Explore recorded mappings for selected frameworks.
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-xs font-bold text-[#ff5600]">CONTEXT</div>
                  <div className="text-[9px] text-[#8e8e89]">NOT CERTIFICATION</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow illustration caption */}
      <div className="border-t border-white/[0.08] bg-[#111110] px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Illustrative stage description, not live scan telemetry */}
          <div className="flex items-center gap-2.5 font-mono text-[11px]">
            <Info size={13} className="shrink-0 text-[#ff5600]" />
            <span className="text-white/90">
              {activeStep === 0 && "Upload a project archive for review."}
              {activeStep === 1 && "Explore recorded source evidence."}
              {activeStep === 2 && "Review findings and suggested next steps."}
              {activeStep === 3 && "Explore framework control mappings."}
              {activeStep === 4 && "Prepare a report for human review."}
            </span>
          </div>

          {/* Framework examples, not measured scores */}
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="rounded bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 text-white">
              SOC 2
            </span>
            <span className="rounded bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 text-white">
              ISO 27001
            </span>
            <span className="rounded bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 text-white">
              GDPR
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
