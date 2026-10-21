"""
Generate IEEE publication-grade Figure 3: RAG-Grounded LangChain Multi-Agent Reasoning Pipeline.
Illustrates dense semantic search in Qdrant, context injection, LLM inference, Pydantic validation, CVSS scoring, and remediation planning.
"""
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

OUTPUT_DIR = "docs/paper_figures"
os.makedirs(OUTPUT_DIR, exist_ok=True)

fig, ax = plt.subplots(figsize=(8.8, 6.0), dpi=300)
ax.set_xlim(0, 100)
ax.set_ylim(0, 72)
ax.axis('off')

def draw_box(x, y, w, h, title, subtitle="", fill="#ffffff", border="#475569", radius=0.8, title_color="#0f172a", title_size=8.2, sub_size=6.8):
    box = FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0.2,rounding_size={radius}",
                         facecolor=fill, edgecolor=border, linewidth=1.1, zorder=2)
    ax.add_patch(box)
    if subtitle:
        ax.text(x + w/2, y + h/2 + 1.1, title, ha='center', va='center', fontsize=title_size, fontweight='bold', color=title_color, zorder=3)
        ax.text(x + w/2, y + h/2 - 1.2, subtitle, ha='center', va='center', fontsize=sub_size, color="#475569", zorder=3)
    else:
        ax.text(x + w/2, y + h/2, title, ha='center', va='center', fontsize=title_size, fontweight='bold', color=title_color, zorder=3)

def draw_arrow(x1, y1, x2, y2, color="#334155", lw=1.1, label="", label_pos=(0, 0), connectionstyle="arc3,rad=0"):
    arrow = FancyArrowPatch((x1, y1), (x2, y2),
                            arrowstyle='-|>',
                            mutation_scale=10,
                            color=color, linewidth=lw,
                            connectionstyle=connectionstyle,
                            zorder=4)
    ax.add_patch(arrow)
    if label:
        ax.text(label_pos[0], label_pos[1], label, fontsize=6.8, color=color, fontweight='bold', backgroundcolor="#ffffff", zorder=5)

# Title
ax.text(50, 70, "LangChain Agent Chain & RAG Compliance Mapping Workflow", ha='center', fontsize=11, fontweight='bold', color="#0f172a")

# Step 1: Input Normalized Finding
draw_box(30, 61, 40, 6.2, "Deduplicated Finding", 
         "e.g. CWE-798: AWS IAM Key in config.py:14 (Severity: Critical)", 
         fill="#f1f5f9", border="#475569", title_color="#0f172a")

# Step 2: Dense Embedding & Qdrant Search
draw_box(5, 48.5, 38, 7.5, "Sentence-BERT Embedder", 
         "all-MiniLM-L6-v2 (384-d vector)\nSingleton instance avoids repeated I/O", 
         fill="#ecfdf5", border="#059669", title_color="#065f46")

draw_box(57, 48.5, 38, 7.5, "Qdrant Vector Knowledge Base", 
         "Cosine similarity search over 534 clauses\nMetadata filter: framework IN [GDPR, SOC2, ...]", 
         fill="#ecfdf5", border="#059669", title_color="#065f46")

draw_arrow(50, 61, 24, 56, color="#059669", lw=1.1)
draw_arrow(43, 52.2, 57, 52.2, color="#059669", lw=1.1, label="384-d query", label_pos=(45, 53.5))

# Step 3: Context Grounding & Prompt Synthesis
draw_box(20, 36.5, 60, 7.2, "Prompt Construction with Grounded Context", 
         "Top-10 retrieved regulatory clauses injected into system prompt\nDelimited <code> tags mitigate prompt injection", 
         fill="#eff6ff", border="#2563eb", title_color="#1e40af")

draw_arrow(76, 48.5, 65, 43.7, color="#2563eb", lw=1.1, label="Top-10 clauses", label_pos=(71, 45.5))
draw_arrow(24, 48.5, 35, 43.7, color="#2563eb", lw=1.1)

# Step 4: LLM Inference & Strict Validation
draw_box(20, 25.0, 60, 7.5, "Compliance Mapper (Groq Llama-3-70B)", 
         "Zero-shot extraction of violated framework controls & citations\nValidated via Pydantic v2 strict mode (malformed dropped)", 
         fill="#faf5ff", border="#7e22ce", title_color="#581c87")

draw_arrow(50, 36.5, 50, 32.5, color="#7e22ce", lw=1.2, label="Structured prompt", label_pos=(51, 34.2))

# Step 5: Parallel Chains (CVSS Scorer & Remediation Planner)
draw_box(5, 12.0, 42, 8.5, "CVSS 3.1 Base Auto-Scorer", 
         "FIRST CVSS 3.1 specification (AV, AC, PR, UI, S, C, I, A)\nGenerates CVSS score (0.0-10.0) + vector string\nSTRIDE threat vector classification", 
         fill="#fef3c7", border="#d97706", title_color="#92400e", title_size=7.8)

draw_box(53, 12.0, 42, 8.5, "Remediation Urgency Planner", 
         "Concrete remediation steps + priority triage:\n- Immediate (<=24h): Critical exploitable\n- Short-term (<=1w): High / blockers\n- Long-term (<=1m): Low / best-practices", 
         fill="#fef3c7", border="#d97706", title_color="#92400e", title_size=7.8)

draw_arrow(40, 25.0, 26, 20.5, color="#d97706", lw=1.1)
draw_arrow(60, 25.0, 74, 20.5, color="#d97706", lw=1.1)

# Step 6: Synthesis & Persistence
draw_box(25, 1.5, 50, 6.2, "Persistence & Executive Summary Aggregation", 
         "PostgreSQL (compliance_violations) | WeasyPrint Audit PDF\nReal-time progress broadcasted via WebSockets", 
         fill="#f8fafc", border="#334155", title_color="#0f172a")

draw_arrow(26, 12.0, 42, 7.7, color="#334155", lw=1.1)
draw_arrow(74, 12.0, 58, 7.7, color="#334155", lw=1.1)

out_path = os.path.join(OUTPUT_DIR, "fig3_rag_agent_chain_sequence.png")
plt.savefig(out_path, bbox_inches='tight', dpi=300)
plt.close()
print(f"Generated: {out_path}")
