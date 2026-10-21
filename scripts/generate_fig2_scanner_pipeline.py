"""
Generate IEEE publication-grade Figure 2: Scanner Ensemble, Concurrency & Deduplication Pipeline.
Shows Celery chord execution, confidence gating, canonical normalization, and deterministic fingerprint deduplication.
"""
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Circle

OUTPUT_DIR = "docs/paper_figures"
os.makedirs(OUTPUT_DIR, exist_ok=True)

fig, ax = plt.subplots(figsize=(8.5, 5.2), dpi=300)
ax.set_xlim(0, 100)
ax.set_ylim(0, 60)
ax.axis('off')

# Palette
C_BOX_BORDER = "#1e293b"
C_SCANNER_BG = "#f0fdf4"
C_SCANNER_BORDER = "#16a34a"
C_FILTER_BG = "#eff6ff"
C_DEDUP_BG = "#fef3c7"
C_PERSIST_BG = "#faf5ff"

def draw_box(x, y, w, h, title, subtitle="", fill="#ffffff", border="#475569", radius=0.8, title_color="#0f172a", title_size=8.0, sub_size=6.5):
    box = FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0.2,rounding_size={radius}",
                         facecolor=fill, edgecolor=border, linewidth=1.0, zorder=2)
    ax.add_patch(box)
    if subtitle:
        ax.text(x + w/2, y + h/2 + 1.0, title, ha='center', va='center', fontsize=title_size, fontweight='bold', color=title_color, zorder=3)
        ax.text(x + w/2, y + h/2 - 1.1, subtitle, ha='center', va='center', fontsize=sub_size, color="#475569", zorder=3)
    else:
        ax.text(x + w/2, y + h/2, title, ha='center', va='center', fontsize=title_size, fontweight='bold', color=title_color, zorder=3)

def draw_arrow(x1, y1, x2, y2, color="#334155", lw=1.1, connectionstyle="arc3,rad=0"):
    arrow = FancyArrowPatch((x1, y1), (x2, y2),
                            arrowstyle='-|>',
                            mutation_scale=10,
                            color=color, linewidth=lw,
                            connectionstyle=connectionstyle,
                            zorder=4)
    ax.add_patch(arrow)

# Title
ax.text(50, 58, "Multi-Scanner Orchestration and Deduplication Pipeline", ha='center', fontsize=11, fontweight='bold', color="#0f172a")

# Ingestion Source Box
draw_box(30, 50, 40, 5.5, "Input Targets: Source Tree | Dependency Lockfiles | Server Logs", 
         "Extracted files sanitized, token window sliced (<8 KB per file)", fill="#f8fafc", border="#64748b", title_size=8.5)

# Celery Chord Container
chord_box = FancyBboxPatch((2, 28), 96, 19.5, boxstyle="round,pad=0.3,rounding_size=1.2",
                           facecolor="#f0fdfa", edgecolor="#0d9488", linewidth=1.2, linestyle='--', zorder=1)
ax.add_patch(chord_box)
ax.text(50, 45.8, "PARALLEL SCANNER ENSEMBLE (CELERY CHORD EXECUTION)", ha='center', fontsize=8.5, fontweight='bold', color="#0f766e")
ax.text(50, 44.0, "Individual scanner failures isolated via exception logging; Redis task broker", ha='center', fontsize=7.0, color="#115e59")

# 6 Scanner Boxes
scanners = [
    ("Semgrep (SAST)", "8 Rulesets: OWASP,\nSQLi, XSS, JWT", 3.5),
    ("Bandit (AST)", "Python AST call graph\nshell=True, md5()", 19.5),
    ("TruffleHog v3", "Shannon entropy &\n700+ secret regex", 35.5),
    ("Dependency Audit", "pip/npm audit vs\nGoogle OSV & NVD", 51.5),
    ("Log Anomaly", "Isolation Forest\nper-IP request matrix", 67.5),
    ("Groq Llama-3-70B", "Contextual LLM review\nPydantic JSON schema", 83.5),
]

for name, desc, x_pos in scanners:
    draw_box(x_pos, 29.5, 13.5, 12.5, name, desc, fill="#ffffff", border="#0d9488", title_size=7.5, sub_size=6.2)
    # arrow from input to each scanner
    draw_arrow(50, 50, x_pos + 6.75, 42, color="#0f766e", lw=0.9)

# Fan-in arrows to Canonical Normalization Stage
draw_box(20, 18, 60, 6.5, "Stage 1: Canonical Normalization & Calibration Gating", 
         "Schema: NormalizedFinding (file_path, line_number, cwe_id, severity, confidence >= 0.70)", 
         fill=C_FILTER_BG, border="#2563eb", title_color="#1d4ed8", title_size=8.5)

for _, _, x_pos in scanners:
    draw_arrow(x_pos + 6.75, 29.5, 50, 24.5, color="#2563eb", lw=0.8)

# Stage 2: Deduplication
draw_box(20, 9, 60, 6.5, "Stage 2: Deterministic Composite Fingerprinting", 
         "Composite Key: hash(file_path:line_number:cwe_id) | Conflict Resolution: Highest Severity", 
         fill=C_DEDUP_BG, border="#d97706", title_color="#b45309", title_size=8.5)

draw_arrow(50, 18, 50, 15.5, color="#d97706", lw=1.2)

# Output Persistence
draw_box(28, 1, 44, 5.5, "PostgreSQL Findings Table", 
         "Workspace-scoped via RLS; Ready for RAG Compliance Mapping", 
         fill=C_PERSIST_BG, border="#7e22ce", title_color="#6b21a8", title_size=8.5)

draw_arrow(50, 9, 50, 6.5, color="#7e22ce", lw=1.2)

out_path = os.path.join(OUTPUT_DIR, "fig2_scanner_deduplication_pipeline.png")
plt.savefig(out_path, bbox_inches='tight', dpi=300)
plt.close()
print(f"Generated: {out_path}")
