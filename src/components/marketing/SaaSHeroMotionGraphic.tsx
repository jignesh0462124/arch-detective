import { useState, useEffect } from "react";
import { 
  GitBranch, 
  Cpu, 
  FileText, 
  TreeStructure, 
  Warning, 
  TerminalWindow,
  ArrowsClockwise
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
        setActiveStep(3); // Agentic LLM RAG Reasoning
      } else {
        setActiveStep(4); // Cryptographic Audit Seal
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
            THREATLENS<span className="text-[#8e8e89] font-normal">.PIPELINE</span>
          </span>
          <span className="hidden text-[#4a4a46] sm:inline">|</span>
          <span className="hidden text-[#8e8e89] sm:inline">GROQ LLAMA 3.1 70B · QDRANT HYBRID</span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="flex items-center gap-1.5 rounded bg-white/[0.04] px-2 py-0.5 text-[#8e8e89] border border-white/[0.06]">
            <ArrowsClockwise size={11} className="animate-spin text-[#ff5600]" />
            STREAMING RUN #4089
          </span>
          <span className="inline-flex items-center gap-1.5 rounded bg-[#0b8f3c]/15 px-2 py-0.5 text-[10px] font-semibold text-[#0bdf50] border border-[#0bdf50]/30">
            <span className="size-1.5 rounded-full bg-[#0bdf50] animate-pulse" />
            ONLINE
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
            <path d="M 230 75 L 340 75" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="3 3" />
            {/* Bus Line 2 -> 3 */}
            <path d="M 570 75 L 650 75" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="3 3" />
            {/* Bus Line 3 -> 4 (Down & Left) */}
            <path d="M 750 135 L 750 190 Q 750 205 735 205 L 570 205" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="3 3" />
            {/* Bus Line 4 -> 5 */}
            <path d="M 340 255 L 230 255" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="3 3" />

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
            <div className={`relative rounded-md border p-3.5 transition-all duration-300 ${
              activeStep === 0 
                ? "border-[#ff5600] bg-[#181816] shadow-[0_4px_20px_rgba(255,86,0,0.15)]" 
                : "border-white/[0.08] bg-[#121211]/80 text-[#8e8e89]"
            }`}>
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 font-mono text-[10px]">
                <span className="flex items-center gap-1.5 text-[#ff5600] font-semibold">
                  <GitBranch size={12} weight="bold" />
                  01. INGEST
                </span>
                <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[#8e8e89]">AST PARSE</span>
              </div>
              <div className="mt-2.5">
                <div className="text-xs font-semibold text-white">Repository Ingestion</div>
                <p className="mt-1 font-mono text-[10px] text-[#8e8e89] leading-relaxed">
                  84 source files · 1,482 AST nodes indexed
                </p>
              </div>
              <div className="mt-2.5 flex items-center justify-between font-mono text-[9px] text-[#63635e]">
                <span>GIT SHA 4c89a</span>
                <span className="text-[#0bdf50]">READY</span>
              </div>
            </div>

            {/* Stage 02: Topology & Trust Boundaries */}
            <div className={`relative rounded-md border p-3.5 transition-all duration-300 ${
              activeStep === 1 
                ? "border-[#ff5600] bg-[#181816] shadow-[0_4px_20px_rgba(255,86,0,0.15)]" 
                : "border-white/[0.08] bg-[#121211]/80 text-[#8e8e89]"
            }`}>
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 font-mono text-[10px]">
                <span className="flex items-center gap-1.5 text-[#ff5600] font-semibold">
                  <TreeStructure size={12} weight="bold" />
                  02. TOPOLOGY
                </span>
                <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[#8e8e89]">VPC MESH</span>
              </div>
              <div className="mt-2.5">
                <div className="text-xs font-semibold text-white">Trust Boundaries</div>
                <p className="mt-1 font-mono text-[10px] text-[#8e8e89] leading-relaxed">
                  12 VPC Assets · Auth Gateway mapped
                </p>
              </div>
              <div className="mt-2.5 flex items-center justify-between font-mono text-[9px] text-[#63635e]">
                <span>DATAFLOW GRAPH</span>
                <span className="text-[#0bdf50]">ISOLATED</span>
              </div>
            </div>

            {/* Stage 03: Security Scanners */}
            <div className={`relative rounded-md border p-3.5 transition-all duration-300 ${
              activeStep === 2 
                ? "border-[#ff5600] bg-[#181816] shadow-[0_4px_20px_rgba(255,86,0,0.15)]" 
                : "border-white/[0.08] bg-[#121211]/80 text-[#8e8e89]"
            }`}>
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 font-mono text-[10px]">
                <span className="flex items-center gap-1.5 text-[#ff5600] font-semibold">
                  <Warning size={12} weight="bold" />
                  03. SCANNERS
                </span>
                <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[#8e8e89]">MULTI-ENGINE</span>
              </div>
              <div className="mt-2.5">
                <div className="text-xs font-semibold text-white">Semgrep + Trufflehog</div>
                <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-[#ff6b60]">
                  <span className="size-1.5 rounded-full bg-[#ff6b60]" />
                  2 CWEs (SQLi &amp; SSRF) Detected
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between font-mono text-[9px] text-[#63635e]">
                <span>14 RULES CHECKED</span>
                <span className="text-[#fe4c02]">CVSS 9.8</span>
              </div>
            </div>

          </div>

          {/* Bottom Row: Nodes 05 (Report) and 04 (Agentic RAG) */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">

            {/* Stage 05: Cryptographic Audit Report */}
            <div className={`relative rounded-md border p-4 transition-all duration-300 ${
              activeStep === 4 
                ? "border-[#0bdf50] bg-[#161a17] shadow-[0_4px_20px_rgba(11,223,80,0.15)]" 
                : "border-white/[0.08] bg-[#121211]/80 text-[#8e8e89]"
            }`}>
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 font-mono text-[10px]">
                <span className="flex items-center gap-1.5 text-[#0bdf50] font-semibold">
                  <FileText size={13} weight="bold" />
                  05. SIGNED REPORT
                </span>
                <span className="rounded bg-[#0b8f3c]/20 px-1.5 py-0.5 text-[9px] font-semibold text-[#0bdf50]">
                  PDF AUDIT READY
                </span>
              </div>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Signed Audit Report</div>
                  <p className="mt-1 font-mono text-[10px] text-[#8e8e89]">
                    SHA-256: 8f92a4e...71c0
                  </p>
                </div>
                <div className="rounded border border-[#0bdf50]/30 bg-[#0bdf50]/10 px-2.5 py-1 text-right font-mono">
                  <div className="text-xs font-bold text-[#0bdf50]">SEALED</div>
                  <div className="text-[9px] text-[#8e8e89]">CO-SIGNED</div>
                </div>
              </div>
            </div>

            {/* Stage 04: LLM Agentic Compliance Mapping */}
            <div className={`relative rounded-md border p-4 transition-all duration-300 ${
              activeStep === 3 
                ? "border-[#ff5600] bg-[#181816] shadow-[0_4px_20px_rgba(255,86,0,0.15)]" 
                : "border-white/[0.08] bg-[#121211]/80 text-[#8e8e89]"
            }`}>
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 font-mono text-[10px]">
                <span className="flex items-center gap-1.5 text-[#ff5600] font-semibold">
                  <Cpu size={13} weight="bold" />
                  04. AGENTIC RAG
                </span>
                <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[#8e8e89]">
                  LLAMA 3.1 70B
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="space-y-1 font-mono text-[10px]">
                  <div className="text-white font-medium">Control Citation Synthesis</div>
                  <div className="text-[#8e8e89]">SOC 2 (CC6.1) · ISO 27001 (A.12) · GDPR (Art.32)</div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-xs font-bold text-[#ff5600]">12 CONTROLS</div>
                  <div className="text-[9px] text-[#0bdf50]">MAPPED</div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Bottom Live Telemetry & Metrics Console */}
      <div className="border-t border-white/[0.08] bg-[#111110] px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          
          {/* CLI Telemetry Line */}
          <div className="flex items-center gap-2.5 font-mono text-[11px]">
            <TerminalWindow size={13} className="text-[#ff5600]" />
            <span className="text-[#ff5600] font-semibold">$ archon audit</span>
            <span className="text-[#8e8e89]">--stream</span>
            <span className="text-white/90">
              {activeStep === 0 && "Parsing AST graph & repository files..."}
              {activeStep === 1 && "Extracting trust boundaries & VPC network topology..."}
              {activeStep === 2 && "Running Semgrep + Bandit static analysis scanners..."}
              {activeStep === 3 && "Synthesizing compliance controls with Groq Llama 3.1 70B..."}
              {activeStep === 4 && "Generating cryptographically signed audit PDF deliverable..."}
            </span>
          </div>

          {/* Compliance Framework Score Pills */}
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="rounded bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 text-white">
              SOC 2: <strong className="text-[#0bdf50]">92%</strong>
            </span>
            <span className="rounded bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 text-white">
              ISO 27001: <strong className="text-[#0bdf50]">88%</strong>
            </span>
            <span className="rounded bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 text-white">
              GDPR: <strong className="text-[#0bdf50]">91%</strong>
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
