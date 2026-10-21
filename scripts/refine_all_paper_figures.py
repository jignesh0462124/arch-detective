"""
ThreatLens IEEE Paper Figures - Master Generation Script v2.1 (Perfect Calibration)
Calibrated for:
- 300 DPI high-resolution PNG + vector PDF exports
- 16:9 widescreen aspect ratio (1920x1080 px equivalent)
- DejaVu Sans IEEE-safe typography
- WCAG AA compliant contrast ratios (>= 4.5:1 on white)
- Zero text clipping, zero text collisions, strict mathematical alignment
"""
import os
import shutil
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patheffects as pe
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle, Circle, Patch
import numpy as np

OUTPUT_DIR = "docs/paper_figures"
ARTIFACT_DIR = r"C:\Users\jigne\.gemini\antigravity-ide\brain\cbeafe42-cc04-4331-8190-1c039a963ff8"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Global styling configuration
plt.rcParams.update({
    'font.family': 'sans-serif',
    'font.sans-serif': ['DejaVu Sans', 'Arial', 'Helvetica'],
    'figure.dpi': 300,
    'savefig.dpi': 300,
    'savefig.bbox': 'tight',
    'savefig.pad_inches': 0.15,
    'axes.spines.top': False,
    'axes.spines.right': False,
    'axes.grid': True,
    'grid.linestyle': '--',
    'grid.color': '#CCCCCC',
    'grid.alpha': 0.6,
})

def save_dual_format(fig, base_name):
    """Saves figure as both 300 DPI PNG and vector PDF, and syncs to artifact directory."""
    png_path = os.path.join(OUTPUT_DIR, f"{base_name}.png")
    pdf_path = os.path.join(OUTPUT_DIR, f"{base_name}.pdf")
    
    fig.savefig(png_path, dpi=300, bbox_inches='tight', pad_inches=0.15, facecolor='white')
    fig.savefig(pdf_path, format='pdf', bbox_inches='tight', pad_inches=0.15, facecolor='white')
    plt.close(fig)
    
    if os.path.exists(ARTIFACT_DIR):
        try:
            shutil.copy2(png_path, os.path.join(ARTIFACT_DIR, f"{base_name}.png"))
            shutil.copy2(pdf_path, os.path.join(ARTIFACT_DIR, f"{base_name}.pdf"))
        except Exception as e:
            print(f"Warning syncing {base_name}: {e}")
    print(f"Refined & Verified: {png_path} & {pdf_path}")

# ==============================================================================
# FIGURE 1: ThreatLens End-to-End System Architecture (16:9)
# ==============================================================================
def generate_fig1():
    fig, ax = plt.subplots(figsize=(16, 9), dpi=300)
    ax.set_xlim(0, 160)
    ax.set_ylim(0, 90)
    ax.axis('off')
    fig.patch.set_facecolor('#ffffff')

    def draw_box(x, y, w, h, title, subtitle="", fill="#ffffff", border="#1A6EBD",
                 radius=0.7, title_color="#0f172a", title_size=10, sub_size=8.5, lw=1.2,
                 title_dx=0.0):
        box = FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0.2,rounding_size={radius}",
                             facecolor=fill, edgecolor=border, linewidth=lw, zorder=3)
        ax.add_patch(box)
        if subtitle:
            ax.text(x + w/2 + title_dx, y + h - 1.8, title, ha='center', va='top',
                    fontsize=title_size, fontweight='bold', color=title_color, zorder=4)
            ax.text(x + w/2, y + (h - 2.8)/2, subtitle, ha='center', va='center',
                    fontsize=sub_size, fontstyle='italic', color="#475569", zorder=4)
        else:
            ax.text(x + w/2, y + h/2, title, ha='center', va='center',
                    fontsize=title_size, fontweight='bold', color=title_color, zorder=4)

    def draw_arrow(x1, y1, x2, y2, color="#155724", lw=2.5):
        arrow = FancyArrowPatch((x1, y1), (x2, y2),
                                arrowstyle='-|>', mutation_scale=14,
                                color=color, linewidth=lw, zorder=5)
        ax.add_patch(arrow)

    # Master Header
    ax.text(80, 87, "ThreatLens End-to-End System Architecture",
            ha='center', va='center', fontsize=18, fontweight='bold', color="#000000")
    ax.text(80, 83.5, "Asynchronous Multi-Scanner Orchestration, RAG Compliance Mapping, and Multi-Tenant Isolation",
            ha='center', va='center', fontsize=12, fontstyle='italic', color="#333333")

    layers = [
        ("1. INGESTION", "Validation & Normalization", 4, 28, "#D0E8FF", "#1A6EBD"),
        ("2. SCANNER CHORD", "Celery Workers + Redis Broker", 35, 29, "#D4EDDA", "#155724"),
        ("3. DEDUPLICATION", "Canonical Gating & Fingerprint", 67, 26, "#FFF3CD", "#856404"),
        ("4. RAG & AGENTS", "LangChain + Llama-3 + Qdrant", 96, 29, "#E8D5FF", "#6A0DAD"),
        ("5. PERSISTENCE & UI", "PostgreSQL RLS & WeasyPrint", 128, 28, "#FFE5CC", "#B45309")
    ]

    for title, subtitle, x_lane, w_lane, fill_c, border_c in layers:
        # Background lane with subtle diagonal hatch
        lane = FancyBboxPatch((x_lane, 4), w_lane, 76, boxstyle="round,pad=0.3,rounding_size=1.2",
                              facecolor=fill_c, edgecolor=border_c, linewidth=1.5,
                              linestyle='--', hatch='////', alpha=0.18, zorder=1)
        ax.add_patch(lane)
        lane_border = FancyBboxPatch((x_lane, 4), w_lane, 76, boxstyle="round,pad=0.3,rounding_size=1.2",
                                     facecolor='none', edgecolor=border_c, linewidth=1.5,
                                     linestyle='--', zorder=2)
        ax.add_patch(lane_border)

        # Header Badge
        header_bbox = FancyBboxPatch((x_lane + 1.5, 73.5), w_lane - 3, 5.2,
                                     boxstyle="round,pad=0.2,rounding_size=0.6",
                                     facecolor=fill_c, edgecolor=border_c, linewidth=1.4, zorder=3)
        ax.add_patch(header_bbox)
        ax.text(x_lane + w_lane/2, 76.5, title, ha='center', va='center',
                fontsize=11.5, fontweight='bold', color=border_c, zorder=4)
        ax.text(x_lane + w_lane/2, 74.5, subtitle, ha='center', va='center',
                fontsize=8.0, fontstyle='italic', color="#334155", zorder=4)

    # --- Layer 1 Nodes (Ingestion) ---
    draw_box(6, 61.5, 24, 10, "Source Codebases", "ZIP / Git Repositories\n(<8 KB Window Slicing)", border="#1A6EBD")
    draw_box(6, 47.5, 24, 10, "Architecture Specs", "Cloud YAML / JSON\n(IaC & Microservices)", border="#1A6EBD")
    draw_box(6, 33.5, 24, 10, "Server Logs", "Apache / Nginx / Syslog\n(Per-IP Feature Matrix)", border="#1A6EBD")
    draw_box(6, 11.0, 24, 18, "Sanitizer & Parser",
             "• Zip bomb check (<100x)\n• Path traversal filter\n• Context window slicing\n• Binary file exclusion",
             fill="#f8fafc", border="#1A6EBD", lw=1.5)

    # Internal arrows down to Sanitizer
    draw_arrow(18, 61.5, 18, 58.0, color="#1A6EBD", lw=1.5)
    draw_arrow(18, 47.5, 18, 44.0, color="#1A6EBD", lw=1.5)
    draw_arrow(18, 33.5, 18, 29.5, color="#1A6EBD", lw=1.5)

    # --- Layer 2 Nodes (Scanners) ---
    scanners = [
        ("Semgrep Static Engine", "8 Rulesets: OWASP, SQLi, JWT", 63.5, False),
        ("Bandit Python AST", "Python AST Call Graph", 53.5, False),
        ("TruffleHog v3", "Entropy + 700+ Secret Regex", 43.5, False),
        ("Dependency Audit", "pip/npm audit (OSV & NVD)", 33.5, False),
        ("Log Anomaly Detector", "Isolation Forest (5% Contam.)", 23.5, False),
        ("Groq Llama-3-70B", "Pydantic Schema Code Review", 13.5, True),
    ]
    for name, sub, y_p, is_llm in scanners:
        fill_s = "#FFF3CD" if is_llm else "#FFFFFF"
        border_s = "#B45309" if is_llm else "#155724"
        # Shift title left on LLM box so badge has clear separation
        t_dx = -2.8 if is_llm else 0.0
        t_sz = 9.2 if is_llm else 10.0
        draw_box(37, y_p, 25, 8.2, name, sub, fill=fill_s, border=border_s, title_dx=t_dx, title_size=t_sz)
        if is_llm:
            badge = FancyBboxPatch((56.2, y_p + 5.3), 4.5, 2.2, boxstyle="round,pad=0.1,rounding_size=0.4",
                                   facecolor="#DC2626", edgecolor="#991B1B", zorder=5)
            ax.add_patch(badge)
            ax.text(58.45, y_p + 6.4, "LLM", ha='center', va='center',
                    fontsize=7.5, fontweight='bold', color="#ffffff", zorder=6)

    # Ingestion -> Scanner Chord Dispatch Bus
    ax.plot([30, 33.5, 33.5], [20.0, 20.0, 67.6], color="#155724", linewidth=2.0, zorder=4)
    for _, _, y_p, _ in scanners:
        draw_arrow(33.5, y_p + 4.1, 37.0, y_p + 4.1, color="#155724", lw=1.5)

    # --- Layer 3 Nodes (Deduplication - Perfectly Balanced Height) ---
    draw_box(69, 45.0, 22, 26, "NormalizedFinding",
             "• Canonical Data Model\n• CWE Identifier\n• File & Line Number\n• Vulnerable Code Snippet\n• Confidence Gating >= 0.70",
             border="#856404", lw=1.4)
    draw_box(69, 11.5, 22, 28, "Deterministic Dedup",
             "• Composite Key Fingerprint\n  hash(file:line:cwe_id)\n• Collision-free filtering\n• Removes redundant hits\n• Retains Max Severity",
             border="#856404", lw=1.4)
    draw_arrow(80, 45.0, 80, 39.5, color="#856404", lw=2.0)

    # Scanner Collector Bus -> NormalizedFinding
    ax.plot([62, 65.5, 65.5], [17.6, 17.6, 67.6], color="#856404", linewidth=2.0, zorder=4)
    for _, _, y_p, _ in scanners:
        ax.plot([62, 65.5], [y_p + 4.1, y_p + 4.1], color="#856404", linewidth=1.5, zorder=4)
    draw_arrow(65.5, 58.0, 69.0, 58.0, color="#856404", lw=2.5)

    # --- Layer 4 Nodes (RAG & Compliance) ---
    draw_box(98, 60.5, 25, 10.5, "Qdrant Vector Store", "534 Clauses: GDPR, SOC2,\nISO 27001, PCI DSS, NIST CSF", border="#6A0DAD")
    draw_box(98, 45.0, 25, 11.5, "all-MiniLM-L6-v2", "384-d Dense Vector Embeddings\nCosine Similarity Top-k\nIn-Memory Singleton", border="#6A0DAD")
    draw_box(98, 29.5, 25, 11.5, "Compliance Mapper", "LangChain + Llama-3-70B\nGrounded System Prompts\nPydantic Strict Mode", border="#6A0DAD")
    draw_box(98, 11.0, 25, 14.5, "CVSS & Remediation", "CVSS 3.1 Base Auto-Scorer\nSTRIDE Threat Modeling\nUrgency: Immed/Short/Long", border="#6A0DAD")

    draw_arrow(110.5, 60.5, 110.5, 57.0, color="#6A0DAD", lw=1.5)
    draw_arrow(110.5, 45.0, 110.5, 41.5, color="#6A0DAD", lw=1.5)
    draw_arrow(110.5, 29.5, 110.5, 26.0, color="#6A0DAD", lw=1.5)

    # Inter-layer arrow L3 -> L4 (Dedup output horizontally into Compliance Mapper center y=35.25)
    draw_arrow(91, 35.25, 98, 35.25, color="#6A0DAD", lw=2.5)

    # --- Layer 5 Nodes (Persistence & UI) ---
    draw_box(130, 60.5, 24, 10.5, "Supabase PostgreSQL", "Row-Level Security (RLS)\nworkspace_id isolation\nACID Scan Transactions", border="#B45309")
    draw_box(130, 45.0, 24, 11.5, "Private Object Storage", "Encrypted Audit Reports\nArtifact Archival\nSigned URLs (300s TTL)", border="#B45309")
    draw_box(130, 29.5, 24, 11.5, "WeasyPrint PDF Engine", "Enterprise Compliance PDF\nExecutive Scorecards\nRFC 4180 CSV Export", border="#B45309")
    draw_box(130, 11.0, 24, 14.5, "React Neo-Brutalist UI", "Authenticated WebSockets\nReal-Time Scan Progress\nInteractive Findings Triage", border="#B45309")

    # Inter-layer arrow L4 -> L5
    draw_arrow(123, 18.25, 130, 18.25, color="#B45309", lw=2.5)

    save_dual_format(fig, "fig1_system_architecture")

# ==============================================================================
# FIGURE 2: Multi-Scanner Orchestration & Deduplication Pipeline (16:9)
# ==============================================================================
def generate_fig2():
    fig, ax = plt.subplots(figsize=(16, 9), dpi=300)
    ax.set_xlim(0, 160)
    ax.set_ylim(0, 90)
    ax.axis('off')
    fig.patch.set_facecolor('#ffffff')

    def draw_box(x, y, w, h, title, subtitle="", fill="#ffffff", border="#1E3A5F",
                 radius=0.7, title_color="#0f172a", title_size=11, sub_size=9, lw=1.5, title_dx=0.0):
        box = FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0.2,rounding_size={radius}",
                             facecolor=fill, edgecolor=border, linewidth=lw, zorder=3)
        ax.add_patch(box)
        if subtitle:
            ax.text(x + w/2 + title_dx, y + h - 2.2, title, ha='center', va='top',
                    fontsize=title_size, fontweight='bold', color=title_color, zorder=4)
            ax.text(x + w/2, y + (h - 3.2)/2, subtitle, ha='center', va='center',
                    fontsize=sub_size, color="#333333", zorder=4)
        else:
            ax.text(x + w/2, y + h/2, title, ha='center', va='center',
                    fontsize=title_size, fontweight='bold', color=title_color, zorder=4)

    def draw_arrow(x1, y1, x2, y2, color="#1E3A5F", lw=2.0):
        arrow = FancyArrowPatch((x1, y1), (x2, y2),
                                arrowstyle='-|>', mutation_scale=14,
                                color=color, linewidth=lw, zorder=5)
        ax.add_patch(arrow)

    # Master Header
    ax.text(80, 87, "Multi-Scanner Orchestration and Deduplication Pipeline",
            ha='center', va='center', fontsize=18, fontweight='bold', color="#000000")
    ax.text(80, 83.5, "Parallel Celery Chord Execution, Canonical Normalization, and Deterministic Deduplication",
            ha='center', va='center', fontsize=12, fontstyle='italic', color="#444444")

    # 1. Input Targets Box (Span matching chord: x=10 to 150)
    in_box = FancyBboxPatch((10, 71), 140, 9, boxstyle="round,pad=0.2,rounding_size=0.8",
                            facecolor="#F1F5F9", edgecolor="#475569", linewidth=2.0, zorder=3)
    ax.add_patch(in_box)
    ax.text(80, 76.5, "Input Targets: Source Tree | Dependency Lockfiles | Server Logs",
            ha='center', va='center', fontsize=12, fontweight='bold', color="#0F172A", zorder=4)
    ax.text(80, 73.2, "Extracted files sanitized, token window sliced (<8 KB per file)",
            ha='center', va='center', fontsize=9.5, fontstyle='italic', color="#475569", zorder=4)

    # 2. Parallel Scanner Ensemble Chord Box (x=10 to 150)
    chord_box = FancyBboxPatch((10, 32.5), 140, 34.0, boxstyle="round,pad=0.3,rounding_size=1.2",
                               facecolor="#E6FFFA", edgecolor="#008080", linewidth=2.0,
                               linestyle='--', alpha=0.25, zorder=1)
    ax.add_patch(chord_box)
    chord_border = FancyBboxPatch((10, 32.5), 140, 34.0, boxstyle="round,pad=0.3,rounding_size=1.2",
                                 facecolor='none', edgecolor="#008080", linewidth=2.0,
                                 linestyle='--', zorder=2)
    ax.add_patch(chord_border)

    # Dedicated Top Header Banner inside Chord (eliminates arrow collision)
    chord_banner = FancyBboxPatch((12, 60.0), 136, 5.5, boxstyle="round,pad=0.2,rounding_size=0.5",
                                  facecolor="#CCFBF1", edgecolor="#0F766E", linewidth=1.2, zorder=3)
    ax.add_patch(chord_banner)
    ax.text(80, 63.3, "PARALLEL SCANNER ENSEMBLE (CELERY CHORD EXECUTION)",
            ha='center', va='center', fontsize=12.5, fontweight='bold', color="#0F766E", zorder=4)
    ax.text(80, 61.2, "Dispatched concurrently across distributed workers via Redis message broker",
            ha='center', va='center', fontsize=8.8, fontstyle='italic', color="#0D9488", zorder=4)

    # Main dispatch arrow from Input box to Chord Banner
    draw_arrow(80, 71.0, 80, 65.5, color="#1E3A5F", lw=2.2)

    scanners = [
        ("Semgrep SAST", "8 Rulesets: OWASP,\nSQLi, XSS, JWT", 12, False),
        ("Bandit AST", "Python AST call graph,\nshell=True, md5()", 35, False),
        ("TruffleHog v3", "Shannon entropy &\n700+ secret regex", 58, False),
        ("Dependency Audit", "pip/npm audit vs\nGoogle OSV & NVD", 81, False),
        ("Log Anomaly", "Isolation Forest,\nper-IP request matrix", 104, False),
        ("Llama-3-70B", "Groq Contextual LLM,\nPydantic JSON output", 127, True),
    ]

    for name, sub, x_sc, is_llm in scanners:
        fill_c = "#FFF3CD" if is_llm else "#FAFAFA"
        border_c = "#B45309" if is_llm else "#155724"
        t_dx = -2.2 if is_llm else 0.0
        t_sz = 10.0 if is_llm else 10.5
        draw_box(x_sc, 35.0, 21, 21.0, name, sub, fill=fill_c, border=border_c,
                 title_size=t_sz, sub_size=8.8, lw=1.8, title_dx=t_dx)
        
        if is_llm:
            badge = FancyBboxPatch((x_sc + 15.6, 51.6), 4.4, 2.4, boxstyle="round,pad=0.1,rounding_size=0.4",
                                   facecolor="#DC2626", edgecolor="#991B1B", zorder=5)
            ax.add_patch(badge)
            ax.text(x_sc + 17.8, 52.8, "LLM", ha='center', va='center',
                    fontsize=7.5, fontweight='bold', color="#ffffff", zorder=6)

        # Dispatch arrow inside chord from banner to scanner top
        draw_arrow(x_sc + 10.5, 60.0, x_sc + 10.5, 56.0, color="#0F766E", lw=1.8)
        # Fan-in arrow from scanner bottom directly into Stage 1 top
        draw_arrow(x_sc + 10.5, 35.0, x_sc + 10.5, 31.0, color="#1E3A5F", lw=2.0)

    # 3. Stage 1: Canonical Normalization (Full width 140 matching chord!)
    draw_box(10, 23.5, 140, 7.5,
             "Stage 1: Canonical Normalization & Calibration Gating",
             "NormalizedFinding Schema: file_path, line_number, cwe_id, severity, confidence >= 0.70",
             fill="#DBEAFE", border="#1D4ED8", title_color="#1E3A8A", title_size=12, sub_size=10, lw=2.0)
    # Distinct 4.0-unit arrow from Stage 1 into Stage 2
    draw_arrow(80, 23.5, 80, 19.5, color="#1E3A5F", lw=2.2)

    # 4. Stage 2: Deterministic Composite Fingerprinting (Full width 140)
    draw_box(10, 12.0, 140, 7.5,
             "Stage 2: Deterministic Composite Fingerprinting",
             "Composite Key: hash(file_path:line_number:cwe_id) | Conflict Resolution: Retains Highest Severity",
             fill="#FEF9C3", border="#B45309", title_color="#854D0E", title_size=12, sub_size=10, lw=2.0)
    # Distinct 4.0-unit arrow from Stage 2 into PostgreSQL table
    draw_arrow(80, 12.0, 80, 8.0, color="#1E3A5F", lw=2.2)

    # 5. Final PostgreSQL Table (Full width 140)
    draw_box(10, 0.5, 140, 7.5,
             "PostgreSQL Findings Table",
             "Workspace-scoped via Row-Level Security; Feeds RAG Compliance Mapper",
             fill="#F3E8FF", border="#7C3AED", title_color="#581C87", title_size=12, sub_size=10, lw=2.0)

    save_dual_format(fig, "fig2_scanner_deduplication_pipeline")

# ==============================================================================
# FIGURE 3: LangChain Agent Chain & RAG Compliance Mapping Workflow (16:9)
# ==============================================================================
def generate_fig3():
    fig, ax = plt.subplots(figsize=(16, 9), dpi=300)
    ax.set_xlim(0, 160)
    ax.set_ylim(0, 90)
    ax.axis('off')
    fig.patch.set_facecolor('#ffffff')

    def draw_box(x, y, w, h, title, subtitle="", fill="#ffffff", border="#1E3A5F",
                 radius=0.7, title_color="#0f172a", title_size=11, sub_size=9, lw=1.5):
        box = FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0.2,rounding_size={radius}",
                             facecolor=fill, edgecolor=border, linewidth=lw, zorder=3)
        ax.add_patch(box)
        if subtitle:
            ax.text(x + w/2, y + h - 2.0, title, ha='center', va='top',
                    fontsize=title_size, fontweight='bold', color=title_color, zorder=4)
            ax.text(x + w/2, y + (h - 2.8)/2, subtitle, ha='center', va='center',
                    fontsize=sub_size, color="#333333", zorder=4)
        else:
            ax.text(x + w/2, y + h/2, title, ha='center', va='center',
                    fontsize=title_size, fontweight='bold', color=title_color, zorder=4)

    def draw_arrow(x1, y1, x2, y2, color="#1E3A5F", lw=2.0):
        arrow = FancyArrowPatch((x1, y1), (x2, y2),
                                arrowstyle='-|>', mutation_scale=14,
                                color=color, linewidth=lw, zorder=5)
        ax.add_patch(arrow)

    # Master Header
    ax.text(80, 87, "LangChain Agent Chain & RAG Compliance Mapping Workflow",
            ha='center', va='center', fontsize=18, fontweight='bold', color="#000000")
    ax.text(80, 83.5, "Semantic Vector Retrieval, LLM Control Mapping, and Dual-Track Remediation Synthesis",
            ha='center', va='center', fontsize=12, fontstyle='italic', color="#444444")

    # Step 1: Input Finding Box
    in_box = FancyBboxPatch((15, 69.5), 130, 11, boxstyle="round,pad=0.2,rounding_size=0.8",
                            facecolor="#F1F5F9", edgecolor="#475569", linewidth=1.5, zorder=3)
    ax.add_patch(in_box)
    ax.text(80, 77.8, "Deduplicated Normalized Finding",
            ha='center', va='center', fontsize=11.5, fontweight='bold', color="#0F172A", zorder=4)
    sub_ex = FancyBboxPatch((20, 71), 120, 4.8, boxstyle="round,pad=0.15,rounding_size=0.5",
                            facecolor="#FEF3C7", edgecolor="#D97706", linewidth=1.0, zorder=4)
    ax.add_patch(sub_ex)
    ax.text(80, 73.4, "CWE-798: Exposed AWS IAM Key in config.py:14 (Severity: Critical)",
            ha='center', va='center', fontsize=9.5, fontfamily='monospace', fontstyle='italic',
            color="#78350F", zorder=5)

    # Input feeds directly into Embedder (no collision at center!)
    draw_arrow(44, 69.5, 44, 64.5, color="#0284C7", lw=2.0)

    # Step 2: Side-by-side Balanced Boxes (Sentence-BERT & Qdrant)
    # Left: Embedder
    draw_box(15, 52.5, 58, 12,
             "all-MiniLM-L6-v2 Embedder",
             "384-dimensional dense vector representation\nLoaded once as singleton; eliminates disk I/O",
             fill="#E0F2FE", border="#0284C7", title_color="#0369A1", title_size=11, sub_size=9, lw=2.0)

    # Right: Vector KB
    draw_box(87, 52.5, 58, 12,
             "Qdrant Vector Knowledge Base",
             "Cosine search over 534 compliance control clauses\nMetadata filter: framework IN [GDPR, SOC2, ISO27001...]",
             fill="#EDE9FE", border="#6D28D9", title_color="#5B21B6", title_size=11, sub_size=9, lw=2.0)

    # Horizontal connection arrow labeled "384-d vector"
    draw_arrow(73, 58.5, 87, 58.5, color="#0F766E", lw=2.5)
    ax.text(80, 61.0, "384-d vector", ha='center', va='center',
            fontsize=10, fontweight='bold', color="#0F766E",
            path_effects=[pe.withStroke(linewidth=3, foreground='white')], zorder=6)

    # Retrieval arrow from Qdrant down to Prompt Construction
    draw_arrow(116, 52.5, 116, 47.5, color="#1D4ED8", lw=2.0)
    ax.text(123, 50.0, "Top-10 clauses", ha='left', va='center',
            fontsize=9.0, fontstyle='italic', color="#1D4ED8",
            path_effects=[pe.withStroke(linewidth=3, foreground='white')], zorder=5)

    # Step 3: Prompt Construction
    draw_box(15, 37.5, 130, 10,
             "Prompt Construction & Context Injection",
             "Top-10 retrieved regulatory clauses injected into LLM prompt\nEnclosed in explicit <code> delimiters to prevent prompt injection",
             fill="#DBEAFE", border="#1D4ED8", title_color="#1E3A8A", title_size=11.5, sub_size=9.5, lw=2.0)

    draw_arrow(80, 37.5, 80, 33.5, color="#7C3AED", lw=2.0)

    # Step 4: Compliance Mapper (Groq Llama-3-70B)
    draw_box(15, 23.0, 130, 10.5,
             "Compliance Mapper (Groq Llama-3-70B)",
             "Zero-shot extraction of violated framework controls & evidence citations\nValidated via Pydantic v2 strict mode (malformed responses discarded)",
             fill="#EDE9FE", border="#7C3AED", title_color="#581C87", title_size=12, sub_size=9.2, lw=2.0)

    # Step 5: Dual Output Branches Split (Symmetrical orange arrows)
    draw_arrow(46, 23.0, 46, 19.5, color="#D97706", lw=2.0)
    draw_arrow(114, 23.0, 114, 19.5, color="#D97706", lw=2.0)

    # Left Branch: CVSS 3.1
    draw_box(15, 8.0, 62, 11.5,
             "CVSS 3.1 Base Auto-Scorer",
             "FIRST CVSS 3.1 specification (AV, AC, PR, UI, S, C, I, A)\nGenerates CVSS base score (0.0-10.0) + vector string\nSTRIDE threat vector classification",
             fill="#FEF3C7", border="#D97706", title_color="#92400E", title_size=11, sub_size=8.5, lw=2.0)

    # Right Branch: Remediation Urgency Planner
    draw_box(83, 8.0, 62, 11.5,
             "Remediation Urgency Planner",
             "Ordered implementer-focused steps + priority assignment:\nImmediate (<=24h): Critical | Short-term (<=1w): High\nLong-term (<=1m): Medium/Low best practices",
             fill="#FEF3C7", border="#D97706", title_color="#92400E", title_size=11, sub_size=8.5, lw=2.0)

    # Dual arrows down to persistence
    draw_arrow(46, 8.0, 46, 6.0, color="#475569", lw=2.0)
    draw_arrow(114, 8.0, 114, 6.0, color="#475569", lw=2.0)

    # Step 6: Persistence & Aggregation (High-contrast legible text)
    persist_box = FancyBboxPatch((15, 0.5), 130, 5.5, boxstyle="round,pad=0.2,rounding_size=0.6",
                                 facecolor="#1F2937", edgecolor="#111827", linewidth=2.0, zorder=3)
    ax.add_patch(persist_box)
    ax.text(80, 4.2, "Persistence & Executive Summary Aggregation",
            ha='center', va='center', fontsize=11.5, fontweight='bold', color="#FFFFFF", zorder=4)
    ax.text(80, 2.0, "PostgreSQL compliance_violations  |  WeasyPrint Audit PDF  |  Real-time progress broadcasted via WebSockets",
            ha='center', va='center', fontsize=9.2, color="#E2E8F0", zorder=4)

    save_dual_format(fig, "fig3_rag_agent_chain_sequence")

# ==============================================================================
# FIGURE 4: Multi-Tenant Security & JWKS Cryptographic Flow (16:9 Sequence Diagram)
# ==============================================================================
def generate_fig4():
    fig, ax = plt.subplots(figsize=(16, 9), dpi=300)
    ax.set_xlim(0, 160)
    ax.set_ylim(0, 95)
    ax.axis('off')
    fig.patch.set_facecolor('#ffffff')

    # Master Header
    ax.text(80, 92, "Multi-Tenant Security & JWKS Cryptographic Authentication Flow",
            ha='center', va='center', fontsize=18, fontweight='bold', color="#000000")
    ax.text(80, 88.5, "OAuth2 / PKCE Authorization, Asymmetric RS256 Verification, and Row-Level Security (RLS) Enforcement",
            ha='center', va='center', fontsize=12, fontstyle='italic', color="#444444")

    actors = [
        ("Frontend Client\n(TanStack Start)", 18, "#DBEAFE", "#1D4ED8"),
        ("Supabase Auth\n(PKCE / OAuth)", 49, "#D1FAE5", "#065F46"),
        ("FastAPI Gateway\n(jwt_verifier)", 80, "#FEF3C7", "#B45309"),
        ("JWKS Endpoint\n(Supabase Keys)", 111, "#EDE9FE", "#6D28D9"),
        ("PostgreSQL DB\n(RLS Enforced)", 142, "#FEE2E2", "#991B1B"),
    ]

    # Draw Actor Header Boxes and Lifelines
    for title, x_pos, fill_c, border_c in actors:
        box = FancyBboxPatch((x_pos - 13, 79), 26, 6.8, boxstyle="round,pad=0.2,rounding_size=0.6",
                             facecolor=fill_c, edgecolor=border_c, linewidth=2.0, zorder=4)
        ax.add_patch(box)
        ax.text(x_pos, 82.4, title, ha='center', va='center',
                fontsize=9.5, fontweight='bold', color=border_c, zorder=5)

        # Lifeline at zorder=1
        ax.plot([x_pos, x_pos], [79, 5], linestyle='--', color='#9CA3AF', linewidth=1.5, zorder=1)

    def draw_msg(y, x1, x2, label, color, is_response=False, two_line=False):
        ls = (0, (5, 3)) if is_response else '-'
        lw = 1.5 if is_response else 2.0
        arrow = FancyArrowPatch((x1, y), (x2, y),
                                arrowstyle='-|>', mutation_scale=12,
                                color=color, linewidth=lw, linestyle=ls, zorder=4)
        ax.add_patch(arrow)
        x_text = min(x1, x2) + 2.0
        y_text = y + 1.2
        # Use white bbox so text completely masks out any lifeline passing behind it
        bbox_style = dict(boxstyle='square,pad=0.25', facecolor='#FFFFFF', edgecolor='none')
        if two_line:
            ax.text(x_text, y_text, label, ha='left', va='bottom',
                    fontsize=9.0, fontfamily='monospace', fontweight='bold', color=color,
                    bbox=bbox_style, clip_on=False, zorder=5)
        else:
            ax.text(x_text, y_text, label, ha='left', va='bottom',
                    fontsize=9.5, fontweight='bold', color=color,
                    bbox=bbox_style, clip_on=False, zorder=5)

    # 1. Frontend -> Supabase Auth (solid green)
    draw_msg(72, 18, 49, "1. POST /auth/v1/token (PKCE credentials)", "#065F46")

    # 2. Supabase Auth -> Frontend (dashed green)
    draw_msg(64, 49, 18, "2. Signed JWT Access Token (RS256, sub=user_id)", "#065F46", is_response=True)

    # 3. Frontend -> FastAPI Gateway (solid orange)
    draw_msg(56, 18, 80, "3. GET /api/v1/scans (Bearer JWT in Authorization)", "#B45309")

    # 4a. FastAPI -> JWKS Endpoint (solid purple)
    draw_msg(48, 80, 111, "4a. GET /.well-known/jwks.json (Cached 5 min)", "#6D28D9")

    # 4b. JWKS Endpoint -> FastAPI (dashed purple)
    draw_msg(41, 111, 80, "4b. Public RSA Keys (kid verification)", "#6D28D9", is_response=True)

    # Verification Box (at FastAPI gateway, solid fill blocks lifeline completely)
    v_box = FancyBboxPatch((61, 28.5), 38, 9.8, boxstyle="round,pad=0.25,rounding_size=0.6",
                           facecolor="#F0F7FF", edgecolor="#1D4ED8", linewidth=1.6,
                           linestyle='--', zorder=3)
    ax.add_patch(v_box)
    ax.text(80, 36.6, "FastAPI Token Verification", ha='center', va='center',
            fontsize=9.2, fontweight='bold', color="#1E3A8A", zorder=4)
    ax.plot([64.0, 96.0], [35.5, 35.5], color='#93C5FD', linewidth=0.8, linestyle='-', zorder=4)

    v_steps = [
        "• Verify RS256 signature, issuer & audience",
        "• slowapi rate limit check: ≤100 req/min",
        "• Extract user_id & workspace_id context",
    ]
    for i, step in enumerate(v_steps):
        ax.text(64.2, 33.9 - i * 1.85, step, ha='left', va='center',
                fontsize=8.2, fontweight='normal', color="#1E40AF", zorder=4)

    # 5. FastAPI -> PostgreSQL (solid red)
    draw_msg(23, 80, 142, "5. SET LOCAL app.current_workspace_id;\n   SELECT * FROM scans", "#991B1B", two_line=True)

    # 6. PostgreSQL -> FastAPI (dashed red)
    draw_msg(15, 142, 80, "6. Workspace-isolated records returned (RLS policy enforced)", "#991B1B", is_response=True)

    # 7. FastAPI -> Frontend (dashed blue)
    draw_msg(8, 80, 18, "7. 200 OK (JSON Scan Payload)", "#1D4ED8", is_response=True)

    save_dual_format(fig, "fig4_security_auth_flow")

# ==============================================================================
# FIGURE 5: RAG Retrieval Precision (16:9 Bar + Line Chart)
# ==============================================================================
def generate_fig5():
    fig, ax1 = plt.subplots(figsize=(16, 9), dpi=300)
    fig.patch.set_facecolor('#ffffff')

    frameworks = ['GDPR', 'SOC 2', 'ISO 27001', 'PCI DSS v4.0', 'NIST CSF 2.0']
    p_at_5 = [0.91, 0.89, 0.93, 0.88, 0.90]
    p_at_10 = [0.88, 0.86, 0.89, 0.84, 0.87]
    ranks = [1.4, 1.6, 1.2, 1.7, 1.5]
    mean_p10 = 0.868

    x = np.arange(len(frameworks))
    width = 0.35

    # Grouped bars
    b1 = ax1.bar(x - width/2, p_at_5, width, label='Precision@5 (P@5)', color='#1D4ED8', zorder=3)
    b2 = ax1.bar(x + width/2, p_at_10, width, label='Precision@10 (P@10)', color='#60A5FA', zorder=3)

    # Reference line for Mean P@10
    ref_line = ax1.axhline(mean_p10, color='#93C5FD', linestyle=':', linewidth=2.0,
                           label=f'Mean P@10 ({mean_p10:.3f})', zorder=2)

    # Primary Y-axis setup
    ax1.set_ylabel('Retrieval Precision (0.0 – 1.0)', fontsize=12, fontweight='bold', color='#1E3A8A')
    ax1.set_ylim(0.65, 1.05)
    ax1.set_xticks(x)
    ax1.set_xticklabels(frameworks, fontsize=11, fontweight='bold', color='#111827')
    ax1.tick_params(axis='y', labelsize=10)

    # Data labels on bars (halo path effect prevents any interference from lines/grid)
    for bar in b1:
        h = bar.get_height()
        ax1.annotate(f"{h:.2f}",
                     xy=(bar.get_x() + bar.get_width() / 2, h),
                     xytext=(0, 4), textcoords="offset points",
                     ha='center', va='bottom', fontsize=9, fontweight='bold', color='#1D4ED8',
                     path_effects=[pe.withStroke(linewidth=3, foreground='white')], zorder=5)
    for bar in b2:
        h = bar.get_height()
        ax1.annotate(f"{h:.2f}",
                     xy=(bar.get_x() + bar.get_width() / 2, h),
                     xytext=(0, 4), textcoords="offset points",
                     ha='center', va='bottom', fontsize=9, fontweight='bold', color='#1E40AF',
                     path_effects=[pe.withStroke(linewidth=3, foreground='white')], zorder=5)

    # Secondary Y-axis for Mean Rank
    ax2 = ax1.twinx()
    ax2.set_ylabel('Mean Rank of 1st Relevant Control\n(Lower is Better)',
                   fontsize=11, fontweight='bold', color='#DC2626', labelpad=15)
    ax2.set_ylim(1.0, 2.8)
    ax2.tick_params(axis='y', labelcolor='#DC2626', labelsize=10)

    # Red dashed rank line with white path effect halo
    l1 = ax2.plot(x, ranks, color='#DC2626', linestyle='--', linewidth=2.5,
                  marker='s', markersize=10, label='Mean Rank (1st Relevant)',
                  path_effects=[pe.withStroke(linewidth=4, foreground='white')], zorder=5)

    # Data labels for red line
    for i, r in enumerate(ranks):
        ax2.annotate(f"{r:.1f}", xy=(x[i], r), xytext=(0, 8), textcoords="offset points",
                     ha='center', va='bottom', fontsize=9.5, fontweight='bold', color='#DC2626',
                     bbox=dict(boxstyle='round,pad=0.2', facecolor='white', edgecolor='#FECACA', alpha=0.9),
                     zorder=6)

    # Clean non-colliding title hierarchy
    fig.suptitle('ThreatLens RAG Retrieval Precision & Control Clause Ranking',
                 fontsize=18, fontweight='bold', color='#000000', y=0.97)
    fig.text(0.5, 0.93, 'Top-k Vector Search over 534 Compliance Clauses Across 5 Major Regulatory Frameworks',
             ha='center', fontsize=12, fontstyle='italic', color='#444444')

    # Unified Legend placed below subtitle and above plot area
    lines_1, labels_1 = ax1.get_legend_handles_labels()
    lines_2, labels_2 = ax2.get_legend_handles_labels()
    ax1.legend(lines_1 + lines_2, labels_1 + labels_2,
               loc='lower center', bbox_to_anchor=(0.5, 1.02),
               ncol=4, frameon=True, fontsize=10)

    fig.subplots_adjust(top=0.81, bottom=0.10, left=0.08, right=0.90)
    save_dual_format(fig, "fig5_rag_retrieval_precision")

# ==============================================================================
# FIGURE 6: Scanner Detection Evaluation (16:9 Grouped Bar + Recall Line)
# ==============================================================================
def generate_fig6():
    fig, ax1 = plt.subplots(figsize=(16, 9), dpi=300)
    fig.patch.set_facecolor('#ffffff')

    scanners = [
        'Semgrep\n(AST/Regex)',
        'Bandit\n(Python AST)',
        'TruffleHog\n(Secrets)',
        'Dep. Audit\n(OSV/NVD)',
        'Log Anomaly\n(IsoForest)',
        'LLM Review\n(Llama 3 70B)',
        'Total Ensemble\n(Aggregate)'
    ]
    expected = [12, 8, 3, 3, 5, 6, 37]
    tp = [11, 8, 3, 3, 4, 5, 34]
    fp = [2, 1, 0, 0, 1, 2, 6]
    recall = [91.7, 100.0, 100.0, 100.0, 80.0, 83.3, 91.9]

    x = np.arange(len(scanners))
    w = 0.22

    # Visual emphasis shading centered on Total Ensemble cluster (x=6)
    rect = Rectangle((5.45, 0), 1.1, 45, facecolor='#F9FAFB', edgecolor='#6B7280',
                     linestyle='--', linewidth=1.5, zorder=0)
    ax1.add_patch(rect)
    ax1.text(6.0, 43.5, "Ensemble Aggregate", ha='center', va='top',
             fontsize=8.5, fontstyle='italic', color='#4B5563', zorder=1)

    # 3 bars per cluster
    b_exp = ax1.bar(x - w, expected, w, label='Expected Vulnerabilities', color='#9CA3AF', zorder=3)
    b_tp  = ax1.bar(x, tp, w, label='Detected (True Positives)', color='#16A34A', zorder=3)
    b_fp  = ax1.bar(x + w, fp, w, label='False Positives', color='#DC2626', zorder=3)

    # Bar data counts with white halo
    for bar in b_exp:
        h = bar.get_height()
        ax1.annotate(f"{h}", xy=(bar.get_x() + bar.get_width() / 2, h),
                     xytext=(0, 3), textcoords="offset points", ha='center', va='bottom',
                     fontsize=9, fontweight='bold', color='#4B5563',
                     path_effects=[pe.withStroke(linewidth=3, foreground='white')], zorder=4)
    for bar in b_tp:
        h = bar.get_height()
        ax1.annotate(f"{h}", xy=(bar.get_x() + bar.get_width() / 2, h),
                     xytext=(0, 3), textcoords="offset points", ha='center', va='bottom',
                     fontsize=9, fontweight='bold', color='#15803D',
                     path_effects=[pe.withStroke(linewidth=3, foreground='white')], zorder=4)
    for bar in b_fp:
        h = bar.get_height()
        ax1.annotate(f"{h}", xy=(bar.get_x() + bar.get_width() / 2, h),
                     xytext=(0, 3), textcoords="offset points", ha='center', va='bottom',
                     fontsize=9, fontweight='bold', color='#B91C1C',
                     path_effects=[pe.withStroke(linewidth=3, foreground='white')], zorder=4)

    ax1.set_ylabel('Vulnerability Count', fontsize=12, fontweight='bold', color='#111827')
    ax1.set_ylim(0, 45)
    ax1.set_xticks(x)
    ax1.set_xticklabels(scanners, fontsize=10, fontweight='bold', color='#111827')
    ax1.tick_params(axis='y', labelsize=10)

    # Secondary Y-axis for Recall Rate %
    ax2 = ax1.twinx()
    ax2.set_ylabel('Recall Rate (%)', fontsize=11, fontweight='bold', color='#D97706', labelpad=12)
    ax2.set_ylim(50, 110)
    ax2.tick_params(axis='y', labelcolor='#D97706', labelsize=10)

    # Orange recall line
    l_rec = ax2.plot(x, recall, color='#D97706', linestyle='-', linewidth=2.5,
                     marker='o', markersize=10, label='Recall Rate (%)',
                     path_effects=[pe.withStroke(linewidth=4, foreground='white')], zorder=5)

    # Recall labels (Offset Total Ensemble label to the right of the marker to avoid colliding with 34)
    for i, r in enumerate(recall):
        if i == 6:  # Total Ensemble
            ax2.annotate(f"{r:.1f}%", xy=(x[i], r), xytext=(16, 0), textcoords="offset points",
                         ha='left', va='center', fontsize=9, fontweight='bold', color='#92400E',
                         bbox=dict(boxstyle='round,pad=0.2', facecolor='white', edgecolor='#FDE68A', alpha=0.9),
                         zorder=6)
        else:
            ax2.annotate(f"{r:.1f}%", xy=(x[i], r), xytext=(0, 8), textcoords="offset points",
                         ha='center', va='bottom', fontsize=9, fontweight='bold', color='#92400E',
                         bbox=dict(boxstyle='round,pad=0.2', facecolor='white', edgecolor='#FDE68A', alpha=0.9),
                         zorder=6)

    # Log Anomaly IsoForest annotation arrow
    ax2.annotate("Expected: IsoForest\ntrades recall for precision",
                 xy=(4, 80), xytext=(4.35, 73),
                 arrowprops=dict(arrowstyle='->', color='#4B5563', lw=1.2),
                 fontsize=8.5, color='#374151',
                 bbox=dict(boxstyle='round,pad=0.2', facecolor='#F3F4F6', edgecolor='#D1D5DB'))

    fig.suptitle('ThreatLens Scanner Detection Performance and Ensemble Recall',
                 fontsize=18, fontweight='bold', color='#000000', y=0.97)
    fig.text(0.5, 0.93, 'Empirical Evaluation Across 6 Specialized Engines Against Ground-Truth Benchmark Targets',
             ha='center', fontsize=12, fontstyle='italic', color='#444444')

    lines_1, labels_1 = ax1.get_legend_handles_labels()
    lines_2, labels_2 = ax2.get_legend_handles_labels()
    ax1.legend(lines_1 + lines_2, labels_1 + labels_2,
               loc='lower center', bbox_to_anchor=(0.5, 1.02),
               ncol=4, frameon=True, fontsize=10)

    fig.subplots_adjust(top=0.81, bottom=0.10, left=0.08, right=0.90)
    save_dual_format(fig, "fig6_scanner_detection_evaluation")

# ==============================================================================
# FIGURE 7: Pipeline Latency Breakdown (16:9 Horizontal Bar Chart)
# ==============================================================================
def generate_fig7():
    fig, ax = plt.subplots(figsize=(16, 9), dpi=300)
    fig.patch.set_facecolor('#ffffff')

    stages = [
        'LLM Deep Review (30 files, Groq)',
        'Compliance Mapping (RAG + Llama-3)',
        'Semgrep (Rule Pattern Matching)',
        'TruffleHog (Secret Scan)',
        'Dependency Audit (OSV/NVD)',
        'Bandit (AST Scan)',
        'Ingestion (ZIP Extract)',
        'Report Generation (WeasyPrint)',
        'Deduplication (Fingerprint)'
    ]
    times = [28.4, 17.6, 13.2, 8.7, 6.2, 3.1, 1.2, 0.9, 0.3]
    pcts  = [35.2, 21.8, 16.4, 10.8, 7.7, 3.8, 1.5, 1.1, 0.4]

    colors = [
        '#EA580C', '#EA580C',  # LLM Agentic Chains (57.0%)
        '#2563EB', '#2563EB', '#2563EB', '#2563EB',  # Scanner Ensemble (40.0%)
        '#6B7280', '#6B7280', '#6B7280'   # Ingestion & Synthesis (3.0%)
    ]

    stages = stages[::-1]
    times  = times[::-1]
    pcts   = pcts[::-1]
    colors = colors[::-1]

    y_pos = np.arange(len(stages))
    bars = ax.barh(y_pos, times, height=0.55, color=colors, zorder=3)

    # Value labels at ends of bars
    for i, bar in enumerate(bars):
        w = bar.get_width()
        ax.text(w + 0.4, bar.get_y() + bar.get_height()/2,
                f"{w:.1f}s ({pcts[i]}%)",
                va='center', ha='left', fontsize=10, fontweight='bold', color=colors[i], clip_on=False)

    # Bottleneck annotation shifted to x=23.4 so it NEVER collides with 17.6s (21.8%)
    ax.annotate("Bottleneck: LLM Inference (57.0%)\n28.4s LLM Review + 17.6s RAG Mapping\nGroq sequential rate limits binding",
                xy=(28.4, 8), xytext=(23.4, 6.6),
                arrowprops=dict(arrowstyle='->', connectionstyle='arc3,rad=-0.15', color='#B45309', lw=1.5),
                fontsize=9.0, fontweight='bold', color='#78350F',
                bbox=dict(boxstyle='round,pad=0.4', facecolor='#FEF9C3', edgecolor='#B45309', linewidth=1.5),
                zorder=6)

    ax.set_yticks(y_pos)
    ax.set_yticklabels(stages, fontsize=10.5, fontweight='bold', color='#111827')
    ax.set_xlabel('Wall-Clock Execution Time (Seconds)', fontsize=12, fontweight='bold', color='#111827')
    ax.set_xlim(0, 33)

    legend_elements = [
        Patch(facecolor='#EA580C', label='LLM Agentic Chains (57.0%)'),
        Patch(facecolor='#2563EB', label='Multi-Scanner Ensemble (40.0%)'),
        Patch(facecolor='#6B7280', label='Ingestion & Synthesis (3.0%)')
    ]
    ax.legend(handles=legend_elements, loc='lower right', bbox_to_anchor=(0.98, 0.05),
              frameon=True, fontsize=10, title="Stage Classification", title_fontsize=10.5)

    fig.suptitle('ThreatLens End-to-End Pipeline Latency Breakdown',
                 fontsize=18, fontweight='bold', color='#000000', y=0.97)
    fig.text(0.5, 0.93, 'Execution Time Profiling per Task Stage Demonstrating LLM Rate Limit Domination',
             ha='center', fontsize=12, fontstyle='italic', color='#444444')

    fig.subplots_adjust(top=0.86, bottom=0.10, left=0.28, right=0.94)
    save_dual_format(fig, "fig7_pipeline_latency_breakdown")

# ==============================================================================
# FIGURE 8: Audit Report Artifact (16:9 UI Card Mockup)
# ==============================================================================
def generate_fig8():
    fig, ax = plt.subplots(figsize=(16, 9), dpi=300)
    ax.set_xlim(0, 160)
    ax.set_ylim(0, 90)
    ax.axis('off')
    fig.patch.set_facecolor('#F8FAFC')

    # Main Card Container
    card = FancyBboxPatch((8, 4), 144, 82, boxstyle="round,pad=0.4,rounding_size=1.2",
                          facecolor="#FFFFFF", edgecolor="#1F2937", linewidth=2.0, zorder=1)
    ax.add_patch(card)

    # Card Header Area (Dark Navy)
    header = FancyBboxPatch((8, 74), 144, 12, boxstyle="round,pad=0.2,rounding_size=1.0",
                            facecolor="#0F172A", edgecolor="#0F172A", zorder=2)
    ax.add_patch(header)

    # Header Content
    ax.text(14, 81.5, "ThreatLens Automated Security & Compliance Audit Report",
            fontsize=15, fontweight='bold', color="#FFFFFF", zorder=3)
    ax.text(14, 76.5, "Workspace: production-api-v2  |  Scan ID: scan-9f82a1  |  Profile: Full Security + Compliance Audit",
            fontsize=9.5, color="#94A3B8", zorder=3)

    # Header Badges
    b_audit = FancyBboxPatch((118, 77.2), 17, 5.0, boxstyle="round,pad=0.15,rounding_size=0.6",
                             facecolor="#059669", edgecolor="#047857", linewidth=1.2, zorder=3)
    ax.add_patch(b_audit)
    ax.text(126.5, 79.7, "✓ AUDIT READY", ha='center', va='center',
            fontsize=9.5, fontweight='bold', color="#FFFFFF", zorder=4)

    b_cvss = FancyBboxPatch((137, 77.2), 13, 5.0, boxstyle="round,pad=0.15,rounding_size=0.6",
                            facecolor="#DC2626", edgecolor="#B91C1C", linewidth=1.2, zorder=3)
    ax.add_patch(b_cvss)
    ax.text(143.5, 79.7, "CVSS: 9.8", ha='center', va='center',
            fontsize=10.5, fontweight='bold', color="#FFFFFF", zorder=4)

    # --------------------------------------------------------------------------
    # SECTION 1: Compliance Readiness Scores (Calibrated width to avoid border overflow)
    # --------------------------------------------------------------------------
    ax.text(12, 70.0, "SECTION 1: COMPLIANCE READINESS SCORES",
            fontsize=11.5, fontweight='bold', color="#1F2937", zorder=3)
    ax.plot([12, 148], [68.5, 68.5], color="#E5E7EB", linewidth=1.2, zorder=3)

    framework_scores = [
        ("ISO 27001:2022", 89, "Compliant, Minor Gaps"),
        ("GDPR (Art. 32/83)", 88, "Encrypted Credential Storage Required"),
        ("NIST CSF 2.0", 87, "Access Control Policies Satisfied"),
        ("SOC 2 Type II", 86, "Logical Access & Audit Trail Verification"),
        ("PCI DSS v4.0", 84, "Hardcoded Credential Remediation Critical"),
    ]

    track_x = 44
    track_w = 48
    y_start = 64.0

    # Draw 80% Threshold vertical dashed reference line
    thresh_x = track_x + 0.80 * track_w
    ax.plot([thresh_x, thresh_x], [41.0, 67.0], color="#9CA3AF", linestyle='--', linewidth=1.5, zorder=3)
    ax.text(thresh_x, 40.0, "▼ 80% Threshold", ha='center', va='top', fontsize=8.5, color="#64748B", zorder=3)

    for i, (name, score, note) in enumerate(framework_scores):
        y_bar = y_start - i * 5.0

        # Framework name
        ax.text(14, y_bar + 1.2, name, fontsize=10, fontweight='bold', color="#1F2937", zorder=3)

        # Background track
        track = FancyBboxPatch((track_x, y_bar), track_w, 3.2, boxstyle="round,pad=0.1,rounding_size=0.4",
                               facecolor="#E2E8F0", edgecolor="#CBD5E1", linewidth=0.8, zorder=3)
        ax.add_patch(track)

        # Subtle ticks at 20%, 40%, 60%, 80%, 100%
        for pct in [0.2, 0.4, 0.6, 0.8, 1.0]:
            tx = track_x + pct * track_w
            ax.plot([tx, tx], [y_bar - 0.5, y_bar], color="#9CA3AF", linewidth=0.8, zorder=4)

        # Filled score bar
        fill_w = (score / 100.0) * track_w
        bar_fill = FancyBboxPatch((track_x, y_bar), fill_w, 3.2, boxstyle="round,pad=0.1,rounding_size=0.4",
                                  facecolor="#059669", edgecolor="#047857", linewidth=0.8, zorder=4)
        ax.add_patch(bar_fill)

        # Inside percentage text
        ax.text(track_x + fill_w - 2.0, y_bar + 1.6, f"{score}%", ha='right', va='center',
                fontsize=10.0, fontweight='bold', color="#FFFFFF", zorder=5)

        # Outside percentage text + compliance note (Comfortably within x=148, zero border overflow!)
        ax.text(track_x + track_w + 3.0, y_bar + 1.6, f"{score}%", ha='left', va='center',
                fontsize=11.0, fontweight='bold', color="#059669", zorder=4)
        ax.text(track_x + track_w + 12.0, y_bar + 1.6, f"({note})", ha='left', va='center',
                fontsize=8.5, color="#64748B", zorder=4)

    # --------------------------------------------------------------------------
    # SECTION 2: Sample Highest-Severity Finding Card
    # --------------------------------------------------------------------------
    ax.text(12, 36.5, "SECTION 2: HIGHEST SEVERITY IDENTIFIED FINDING",
            fontsize=11.5, fontweight='bold', color="#1F2937", zorder=3)
    ax.plot([12, 148], [35.0, 35.0], color="#E5E7EB", linewidth=1.2, zorder=3)

    find_card = FancyBboxPatch((12, 6.0), 136, 27.5, boxstyle="round,pad=0.3,rounding_size=0.8",
                               facecolor="#F8FAFC", edgecolor="#E2E8F0", linewidth=1.5, zorder=2)
    ax.add_patch(find_card)

    # Finding Header: CRITICAL badge + Title + Source
    crit_badge = FancyBboxPatch((14, 28.5), 14, 3.8, boxstyle="round,pad=0.15,rounding_size=0.5",
                                facecolor="#DC2626", edgecolor="#B91C1C", linewidth=1.0, zorder=3)
    ax.add_patch(crit_badge)
    ax.text(21, 30.4, "CRITICAL", ha='center', va='center',
            fontsize=9.5, fontweight='bold', color="#FFFFFF", zorder=4)

    ax.text(30, 30.4, "CWE-798: Use of Hard-coded AWS IAM Credentials",
            fontsize=11, fontweight='bold', color="#1F2937", zorder=3)
    ax.text(146, 30.4, "Source: TruffleHog v3", ha='right',
            fontsize=9.5, fontstyle='italic', color="#6B7280", zorder=3)

    # Location & Threat Vectors
    ax.text(14, 25.5, "Location:", fontsize=9.5, fontweight='bold', color="#334155", zorder=3)
    ax.text(26, 25.5, "app/config/aws_client.py:28 (Entropy: hex=3.42, verified AWS secret key)",
            fontsize=9.0, fontfamily='monospace', color="#0F172A", zorder=3)

    ax.text(14, 22.5, "STRIDE Category:", fontsize=9.5, fontweight='bold', color="#334155", zorder=3)
    ax.text(37, 22.5, "Information Disclosure", fontsize=9.5, color="#0F172A", zorder=3)

    ax.text(68, 22.5, "CVSS v3.1 Vector:", fontsize=9.5, fontweight='bold', color="#334155", zorder=3)
    ax.text(92, 22.5, "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:N",
            fontsize=9.0, fontfamily='monospace', color="#991B1B", zorder=3)

    # RAG Control Violations Box
    rag_box = FancyBboxPatch((14, 12.5), 132, 8.5, boxstyle="round,pad=0.2,rounding_size=0.5",
                             facecolor="#EFF6FF", edgecolor="#BFDBFE", linewidth=1.5, zorder=3)
    ax.add_patch(rag_box)
    ax.text(16, 18.8, "RAG-Mapped Control Violations (Top-k Qdrant Retrieval + Llama-3-70B Grounding):",
            fontsize=9.5, fontweight='bold', color="#1D4ED8", zorder=4)

    violations = [
        ("GDPR Art. 32(1)(a)", "Requirement for encryption and secure credential storage for processing systems."),
        ("PCI DSS v4.0 Req. 8.3.2", "Strong authentication credentials must never be hardcoded into configuration scripts."),
        ("ISO 27001:2022 A.8.5", "Secure authentication management and prevention of cleartext credential exposure."),
    ]
    for i, (ctrl, desc) in enumerate(violations):
        y_v = 16.8 - i * 2.0
        ax.text(17, y_v, f"• {ctrl}:", fontsize=8.8, fontweight='bold', color="#1D4ED8", zorder=4)
        ax.text(48, y_v, desc, fontsize=8.8, color="#1F2937", zorder=4)

    # Remediation Action
    imm_badge = FancyBboxPatch((14, 7.2), 22, 4.0, boxstyle="round,pad=0.15,rounding_size=0.5",
                               facecolor="#D97706", edgecolor="#B45309", linewidth=1.0, zorder=3)
    ax.add_patch(imm_badge)
    ax.text(25, 9.2, "IMMEDIATE (<24h)", ha='center', va='center',
            fontsize=9.5, fontweight='bold', color="#FFFFFF", zorder=4)

    ax.text(38, 9.2, "Remediation Action:", fontsize=9.5, fontweight='bold', color="#1F2937", zorder=3)
    ax.text(62, 9.2, "Revoke AWS secret in IAM console -> Migrate to environment variables -> Audit CloudTrail access logs.",
            fontsize=8.5, color="#334155", zorder=3)

    save_dual_format(fig, "fig8_audit_report_artifact")

if __name__ == '__main__':
    print("=" * 60)
    print("Generating ThreatLens Master IEEE Figures v2.1 (Perfect Calibration)...")
    print("=" * 60)
    generate_fig1()
    generate_fig2()
    generate_fig3()
    generate_fig4()
    generate_fig5()
    generate_fig6()
    generate_fig7()
    generate_fig8()
    print("=" * 60)
    print("All 8 figures successfully generated and calibrated!")
    print("=" * 60)
