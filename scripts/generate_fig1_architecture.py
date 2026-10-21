"""
Generate IEEE publication-grade Figure 1: ThreatLens High-Level End-to-End System Architecture.
Professional vector diagram with crisp boxes, clear layered flow, annotations, and clean typography.
"""
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle
import matplotlib.patheffects as patheffects

OUTPUT_DIR = "docs/paper_figures"
os.makedirs(OUTPUT_DIR, exist_ok=True)

fig, ax = plt.subplots(figsize=(10.5, 5.8), dpi=300)
ax.set_xlim(0, 105)
ax.set_ylim(0, 58)
ax.axis('off')

# Styling palette (Professional IEEE Academic / Clean Slate & Tech Blue)
COLOR_BG = "#ffffff"
LAYER_BG = "#f8fafc"
BORDER_DARK = "#0f172a"
LINE_COLOR = "#334155"

# Colors for layers
C_INPUT = "#f1f5f9"
C_SCANNER = "#eff6ff"
C_DEDUP = "#fef3c7"
C_RAG = "#f0fdf4"
C_AGENT = "#faf5ff"
C_PERSIST = "#f8fafc"
C_OUTPUT = "#fff7ed"

def draw_box(x, y, w, h, title, subtitle="", fill="#ffffff", border="#475569", radius=1.0, title_color="#0f172a", title_size=8.5, sub_size=7.0):
    box = FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0.2,rounding_size={radius}",
                         facecolor=fill, edgecolor=border, linewidth=1.1, zorder=2)
    ax.add_patch(box)
    if subtitle:
        ax.text(x + w/2, y + h/2 + 1.1, title, ha='center', va='center', fontsize=title_size, fontweight='bold', color=title_color, zorder=3)
        ax.text(x + w/2, y + h/2 - 1.2, subtitle, ha='center', va='center', fontsize=sub_size, color="#475569", zorder=3)
    else:
        ax.text(x + w/2, y + h/2, title, ha='center', va='center', fontsize=title_size, fontweight='bold', color=title_color, zorder=3)

def draw_arrow(x1, y1, x2, y2, color="#334155", lw=1.2, style='->', connectionstyle="arc3,rad=0"):
    arrow = FancyArrowPatch((x1, y1), (x2, y2),
                            arrowstyle='-|>',
                            mutation_scale=11,
                            color=color, linewidth=lw,
                            connectionstyle=connectionstyle,
                            zorder=4)
    ax.add_patch(arrow)

# Background canvas
fig.patch.set_facecolor(COLOR_BG)

# Title banner
ax.text(52.5, 56.0, "ThreatLens End-to-End System Architecture", ha='center', va='center',
        fontsize=12, fontweight='bold', color="#0f172a")
ax.text(52.5, 54.0, "Asynchronous Multi-Scanner Orchestration, RAG Compliance Mapping, and Multi-Tenant Isolation",
        ha='center', va='center', fontsize=8.5, color="#64748b", fontstyle='italic')

# --- 1. INPUT & INGESTION (X: 2 to 18) ---
box_layer1 = FancyBboxPatch((2, 3), 16, 48, boxstyle="round,pad=0.3,rounding_size=1.5",
                            facecolor=C_INPUT, edgecolor="#cbd5e1", linewidth=1.2, linestyle='--', zorder=1)
ax.add_patch(box_layer1)
ax.text(10, 49.5, "1. INGESTION LAYER", ha='center', fontsize=8.5, fontweight='bold', color="#334155")

draw_box(3.5, 39, 13, 7.5, "Source Codebases", "ZIP / Git Repositories\n(8 KB Context Window)", fill="#ffffff", border="#94a3b8")
draw_box(3.5, 27, 13, 7.5, "Architecture Specs", "Cloud YAML / JSON\n(IaC & Services)", fill="#ffffff", border="#94a3b8")
draw_box(3.5, 15, 13, 7.5, "Server Logs", "Apache / Nginx / Syslog\n(Feature Vectors)", fill="#ffffff", border="#94a3b8")
draw_box(3.5, 4.5, 13, 7.5, "Sanitizer & Parser", "Safe Extraction, Path Clean\nRatio Checks (<100x)", fill="#e2e8f0", border="#64748b")

draw_arrow(10, 39, 10, 34.5)
draw_arrow(10, 27, 10, 22.5)
draw_arrow(10, 15, 10, 12.0)

# --- 2. MULTI-SCANNER LAYER (X: 22 to 43) ---
box_layer2 = FancyBboxPatch((21, 3), 22, 48, boxstyle="round,pad=0.3,rounding_size=1.5",
                            facecolor=C_SCANNER, edgecolor="#93c5fd", linewidth=1.2, linestyle='--', zorder=1)
ax.add_patch(box_layer2)
ax.text(32, 49.5, "2. CELERY MULTI-SCANNER CHORD", ha='center', fontsize=8.5, fontweight='bold', color="#1e40af")
ax.text(32, 47.8, "(Asynchronous Celery Workers + Redis Broker)", ha='center', fontsize=7, color="#3b82f6")

draw_box(22.5, 40, 19, 6.2, "Semgrep Static Engine", "8 Rulesets (OWASP, SQLi, JWT)", fill="#ffffff", border="#3b82f6")
draw_box(22.5, 33, 19, 6.2, "Bandit Python AST", "Syntax Tree Call Graph Analysis", fill="#ffffff", border="#3b82f6")
draw_box(22.5, 26, 19, 6.2, "TruffleHog v3", "Shannon Entropy + 700+ Secret Regex", fill="#ffffff", border="#3b82f6")
draw_box(22.5, 19, 19, 6.2, "Dependency Audit", "pip-audit / npm audit (OSV & NVD)", fill="#ffffff", border="#3b82f6")
draw_box(22.5, 12, 19, 6.2, "Log Anomaly Detector", "Isolation Forest (5% Contamination)", fill="#ffffff", border="#3b82f6")
draw_box(22.5, 5, 19, 6.2, "Groq Llama-3-70B Review", "Pydantic Schema Code Review", fill="#dbeafe", border="#1d4ed8")

# Arrows from Ingestion to Scanners
draw_arrow(16.5, 8.2, 22.5, 43, color="#1e40af", connectionstyle="arc3,rad=-0.15")
draw_arrow(16.5, 8.2, 22.5, 22.1, color="#1e40af", connectionstyle="arc3,rad=-0.1")
draw_arrow(16.5, 8.2, 22.5, 8.1, color="#1e40af")

# --- 3. NORMALIZATION & DEDUPLICATION (X: 46 to 61) ---
box_layer3 = FancyBboxPatch((45.5, 22), 17, 29, boxstyle="round,pad=0.3,rounding_size=1.5",
                            facecolor=C_DEDUP, edgecolor="#fcd34d", linewidth=1.2, linestyle='--', zorder=1)
ax.add_patch(box_layer3)
ax.text(54, 49.5, "3. DEDUPLICATION", ha='center', fontsize=8.5, fontweight='bold', color="#92400e")

draw_box(47, 39, 14, 8.2, "NormalizedFinding", "Unified CWE, File, Line,\nConfidence >= 0.70", fill="#ffffff", border="#f59e0b")
draw_box(47, 25, 14, 10.5, "Deterministic Dedup", "Composite Fingerprint:\n(path, line, cwe_id)\nRetains Highest Severity", fill="#fef9c3", border="#d97706")

draw_arrow(41.5, 25, 47, 28, color="#d97706")
draw_arrow(41.5, 43, 47, 43, color="#d97706")
draw_arrow(54, 39, 54, 35.5, color="#d97706")

# --- 4. RAG KNOWLEDGE BASE & AGENT LAYER (X: 65 to 83) ---
box_layer4 = FancyBboxPatch((65, 3), 19, 48, boxstyle="round,pad=0.3,rounding_size=1.5",
                            facecolor=C_AGENT, edgecolor="#c084fc", linewidth=1.2, linestyle='--', zorder=1)
ax.add_patch(box_layer4)
ax.text(74.5, 49.5, "4. RAG & AGENT LAYER", ha='center', fontsize=8.5, fontweight='bold', color="#6b21a8")

draw_box(66.5, 39.5, 16, 7.8, "Qdrant Vector Store", "534 Clauses (GDPR, SOC2,\nISO27001, PCI DSS, NIST CSF)", fill=C_RAG, border="#16a34a")
draw_box(66.5, 29.5, 16, 7.8, "all-MiniLM-L6-v2", "384-d Dense Embeddings\nCosine Distance Retrieval", fill="#ffffff", border="#16a34a")
draw_box(66.5, 18, 16, 9.2, "Compliance Mapper", "LangChain + Groq Llama-3-70B\nPydantic Strict Validation", fill="#ffffff", border="#9333ea")
draw_box(66.5, 5, 16, 10.5, "CVSS & Remediation", "CVSS 3.1 Base Auto-Scorer\nSTRIDE Threat Decomposition\nPriority: Immed/Short/Long", fill="#f3e8ff", border="#7e22ce")

draw_arrow(61, 30, 66.5, 23, color="#7e22ce")
draw_arrow(74.5, 29.5, 74.5, 27.2, color="#16a34a")
draw_arrow(74.5, 39.5, 74.5, 37.3, color="#16a34a")
draw_arrow(74.5, 18, 74.5, 15.5, color="#7e22ce")

# --- 5. PERSISTENCE & OUTPUTS (X: 86 to 103) ---
box_layer5 = FancyBboxPatch((86, 3), 17, 48, boxstyle="round,pad=0.3,rounding_size=1.5",
                            facecolor=C_OUTPUT, edgecolor="#fdba74", linewidth=1.2, linestyle='--', zorder=1)
ax.add_patch(box_layer5)
ax.text(94.5, 49.5, "5. PERSISTENCE & OUTPUT", ha='center', fontsize=8.5, fontweight='bold', color="#c2410c")

draw_box(87.5, 39, 14, 7.8, "PostgreSQL (Supabase)", "RLS Multi-Tenancy\nworkspace_id isolation", fill="#ffffff", border="#ea580c")
draw_box(87.5, 28, 14, 7.8, "Private S3 Storage", "Encrypted Audit Reports\nSigned URLs (300s TTL)", fill="#ffffff", border="#ea580c")
draw_box(87.5, 16, 14, 9.2, "WeasyPrint PDF Engine", "Audit-Ready PDF Reports\nMatplotlib Compliance Bar\nCSV / JSON Exports", fill="#ffedd5", border="#c2410c")
draw_box(87.5, 5, 14, 8.5, "React Frontend UI", "Authenticated WebSockets\nNeo-Brutalist Dashboard\nReal-Time Scan Progress", fill="#ffffff", border="#ea580c")

draw_arrow(82.5, 22, 87.5, 42.5, color="#ea580c")
draw_arrow(82.5, 9, 87.5, 20.5, color="#ea580c")
draw_arrow(94.5, 16, 94.5, 13.5, color="#c2410c")

plt.tight_layout()
out_path = os.path.join(OUTPUT_DIR, "fig1_system_architecture.png")
plt.savefig(out_path, bbox_inches='tight', dpi=300)
plt.close()
print(f"Generated: {out_path}")
