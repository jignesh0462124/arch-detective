"""
Generate publication-quality empirical evaluation charts for ThreatLens paper.
- Fig 5: RAG Retrieval Precision & Mean Rank by Framework (Table IX)
- Fig 6: Multi-Scanner Vulnerability Detection & False Positive Analysis (Table VIII)
- Fig 7: Pipeline Phase Execution Latency & Bottleneck Breakdown (Table X)
"""
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

# Set standard academic IEEE typography and styling
plt.rcParams.update({
    'font.family': 'sans-serif',
    'font.sans-serif': ['DejaVu Sans', 'Arial', 'Helvetica'],
    'font.size': 10,
    'axes.labelsize': 10.5,
    'axes.titlesize': 11.5,
    'xtick.labelsize': 9.5,
    'ytick.labelsize': 9.5,
    'legend.fontsize': 9.5,
    'figure.titlesize': 12,
    'figure.dpi': 300,
    'savefig.dpi': 300,
    'axes.linewidth': 0.8,
    'grid.linewidth': 0.5,
    'grid.alpha': 0.5,
})

OUTPUT_DIR = "docs/paper_figures"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ==============================================================================
# FIG 5: RAG Retrieval Precision (P@5, P@10) and Rank of First Relevant Control
# ==============================================================================
def generate_fig5():
    frameworks = ['GDPR', 'SOC 2', 'ISO 27001', 'PCI DSS v4.0', 'NIST CSF 2.0']
    p5 = [0.91, 0.89, 0.93, 0.88, 0.90]
    p10 = [0.88, 0.86, 0.89, 0.84, 0.87]
    rank_first = [1.4, 1.6, 1.2, 1.7, 1.5]
    
    mean_p5 = 0.902
    mean_p10 = 0.868
    mean_rank = 1.48

    x = np.arange(len(frameworks))
    width = 0.32

    fig, ax1 = plt.subplots(figsize=(7.2, 3.8), layout='constrained')
    ax2 = ax1.twinx()

    # Precision bars
    bar1 = ax1.bar(x - width/2, p5, width, label='Precision@5 (P@5)', color='#1d4ed8', edgecolor='#0f172a', linewidth=0.8, zorder=3)
    bar2 = ax1.bar(x + width/2, p10, width, label='Precision@10 (P@10)', color='#38bdf8', edgecolor='#0f172a', linewidth=0.8, zorder=3)

    # Rank line on secondary axis
    line1 = ax2.plot(x, rank_first, color='#dc2626', marker='s', markersize=6, linewidth=1.8, linestyle='--', label='Rank of 1st Relevant Control', zorder=4)

    # Value labels on bars
    for b in bar1:
        h = b.get_height()
        ax1.text(b.get_x() + b.get_width()/2., h - 0.07, f'{h:.2f}', ha='center', va='bottom', color='white', fontsize=8.5, fontweight='bold')
    for b in bar2:
        h = b.get_height()
        ax1.text(b.get_x() + b.get_width()/2., h - 0.07, f'{h:.2f}', ha='center', va='bottom', color='#0f172a', fontsize=8.5, fontweight='bold')

    # Value labels on line
    for i, r in enumerate(rank_first):
        ax2.text(x[i], r + 0.07, f'{r:.1f}', ha='center', va='bottom', color='#dc2626', fontsize=8.5, fontweight='bold')

    # Horizontal mean benchmark lines
    ax1.axhline(mean_p10, color='#0284c7', linestyle=':', linewidth=1.0, alpha=0.8, label=f'Mean P@10 ({mean_p10:.3f})')
    
    # Axis formatting
    ax1.set_ylabel('Retrieval Precision Score [0.0 - 1.0]', fontweight='semibold', color='#0f172a')
    ax2.set_ylabel('Mean Rank of First Relevant Control (Lower is Better)', fontweight='semibold', color='#dc2626')
    ax1.set_xticks(x)
    ax1.set_xticklabels(frameworks, fontweight='semibold')
    ax1.set_ylim(0.65, 1.02)
    ax2.set_ylim(0.8, 2.4)
    ax2.invert_yaxis() # Rank 1 at top!
    
    ax1.grid(axis='y', linestyle='--', alpha=0.5, zorder=0)
    ax2.grid(False)

    # Combine legends from both axes
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper center', bbox_to_anchor=(0.5, 1.22), ncol=4, frameon=True, edgecolor='#cbd5e1')

    out_path = os.path.join(OUTPUT_DIR, "fig5_rag_retrieval_precision.png")
    plt.savefig(out_path, bbox_inches='tight', dpi=300)
    plt.close()
    print(f"Generated: {out_path}")

# ==============================================================================
# FIG 6: Multi-Scanner Vulnerability Detection & False Positives (Table VIII)
# ==============================================================================
def generate_fig6():
    scanners = ['Semgrep\n(AST & Regex)', 'Bandit\n(Python AST)', 'TruffleHog\n(Secrets)', 'Dep. Audit\n(OSV/NVD)', 'Log Anomaly\n(IsoForest)', 'LLM Review\n(Llama 3 70B)', 'Total\nEnsemble']
    expected = [12, 8, 3, 3, 5, 6, 37]
    detected = [11, 8, 3, 3, 4, 5, 34]
    false_pos = [2, 1, 0, 0, 1, 2, 6]
    recall_pct = [91.7, 100.0, 100.0, 100.0, 80.0, 83.3, 91.9]

    x = np.arange(len(scanners))
    width = 0.28

    fig, ax1 = plt.subplots(figsize=(7.5, 4.0), layout='constrained')
    ax2 = ax1.twinx()

    b_exp = ax1.bar(x - width, expected, width, label='Expected Vulnerabilities', color='#94a3b8', edgecolor='#334155', linewidth=0.8)
    b_det = ax1.bar(x, detected, width, label='Detected (True Positives)', color='#059669', edgecolor='#064e3b', linewidth=0.8)
    b_fp = ax1.bar(x + width, false_pos, width, label='False Positives (FP)', color='#dc2626', edgecolor='#7f1d1d', linewidth=0.8)

    # Detection Rate Line on ax2
    ax2.plot(x, recall_pct, color='#d97706', marker='o', markersize=6, linewidth=2.0, linestyle='-', label='Detection Rate (% Recall)', zorder=5)

    # Data labels on bars
    for b in b_det:
        h = b.get_height()
        ax1.text(b.get_x() + b.get_width()/2., h + 0.3, f'{int(h)}', ha='center', va='bottom', color='#064e3b', fontsize=8.5, fontweight='bold')
    for b in b_fp:
        h = b.get_height()
        if h > 0:
            ax1.text(b.get_x() + b.get_width()/2., h + 0.3, f'{int(h)}', ha='center', va='bottom', color='#7f1d1d', fontsize=8.5, fontweight='bold')

    # Rate labels
    for i, r in enumerate(recall_pct):
        ax2.text(x[i], r - 4.5 if i == 6 else r + 2.5, f'{r:.1f}%', ha='center', va='bottom', color='#b45309', fontsize=8.5, fontweight='bold')

    ax1.set_ylabel('Vulnerability Count', fontweight='semibold', color='#0f172a')
    ax2.set_ylabel('Recall Rate (%)', fontweight='semibold', color='#b45309')
    ax1.set_xticks(x)
    ax1.set_xticklabels(scanners, fontsize=8.5)
    ax1.set_ylim(0, 44)
    ax2.set_ylim(50, 110)

    ax1.grid(axis='y', linestyle='--', alpha=0.5)
    ax2.grid(False)

    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper center', bbox_to_anchor=(0.5, 1.2), ncol=4, frameon=True, edgecolor='#cbd5e1')

    out_path = os.path.join(OUTPUT_DIR, "fig6_scanner_detection_evaluation.png")
    plt.savefig(out_path, bbox_inches='tight', dpi=300)
    plt.close()
    print(f"Generated: {out_path}")

# ==============================================================================
# FIG 7: Pipeline Latency Breakdown & Bottleneck (Table X)
# ==============================================================================
def generate_fig7():
    phases = [
        ('Ingestion (ZIP Extract)', 1.2, 1.5, '#64748b', 'Preprocessing'),
        ('Bandit (AST Scan)', 3.1, 3.8, '#0284c7', 'Static Analysis'),
        ('Dependency Audit (OSV/NVD)', 6.2, 7.7, '#0284c7', 'Static Analysis'),
        ('TruffleHog (Secret Scan)', 8.7, 10.8, '#0284c7', 'Static Analysis'),
        ('Semgrep (Rule Pattern Matching)', 14.3, 17.7, '#0284c7', 'Static Analysis'),
        ('Compliance Mapping (RAG + Llama-3)', 17.6, 21.8, '#d97706', 'LLM Agentic Reasoning'),
        ('LLM Deep Review (30 files, Groq)', 28.4, 35.2, '#b45309', 'LLM Agentic Reasoning'),
        ('Deduplication (Fingerprint)', 0.3, 0.4, '#64748b', 'Post-Processing'),
        ('Report Generation (WeasyPrint)', 0.9, 1.1, '#64748b', 'Post-Processing'),
    ]

    # Sort descending by execution time
    phases_sorted = sorted(phases, key=lambda x: x[1])
    names = [p[0] for p in phases_sorted]
    times = [p[1] for p in phases_sorted]
    shares = [p[2] for p in phases_sorted]
    colors = [p[3] for p in phases_sorted]

    fig, ax = plt.subplots(figsize=(7.5, 4.2), layout='constrained')

    bars = ax.barh(names, times, color=colors, height=0.62, edgecolor='#1e293b', linewidth=0.8)

    # Value labels
    for bar, t, s in zip(bars, times, shares):
        ax.text(t + 0.6, bar.get_y() + bar.get_height()/2, f'{t:.1f}s  ({s:.1f}%)', 
                va='center', ha='left', fontsize=8.5, fontweight='bold', color='#1e293b')

    ax.set_xlabel('Wall-Clock Execution Time (Seconds)', fontweight='semibold')
    ax.set_xlim(0, 36)
    ax.grid(axis='x', linestyle='--', alpha=0.5)

    # Highlight LLM bottleneck annotation
    ax.annotate('Dominant Bottleneck: LLM Inference (57.0% Total Time)\nGroq Llama-3-70B API Sequential Rate Limiting',
                xy=(28.4, 7), xytext=(12.0, 4.2),
                arrowprops=dict(facecolor='#b45309', shrink=0.08, width=1.5, headwidth=6),
                fontsize=8.5, fontweight='bold', color='#9a3412',
                bbox=dict(boxstyle='round,pad=0.5', facecolor='#ffedd5', edgecolor='#f97316', alpha=0.9))

    # Category legend proxy
    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor='#b45309', edgecolor='#1e293b', label='LLM Agentic Chains (57.0%)'),
        Patch(facecolor='#0284c7', edgecolor='#1e293b', label='Multi-Scanner Ensemble (40.0%)'),
        Patch(facecolor='#64748b', edgecolor='#1e293b', label='Ingestion & Synthesis (3.0%)'),
    ]
    ax.legend(handles=legend_elements, loc='lower right', frameon=True, edgecolor='#cbd5e1', fontsize=8.5)

    out_path = os.path.join(OUTPUT_DIR, "fig7_pipeline_latency_breakdown.png")
    plt.savefig(out_path, bbox_inches='tight', dpi=300)
    plt.close()
    print(f"Generated: {out_path}")

if __name__ == '__main__':
    generate_fig5()
    generate_fig6()
    generate_fig7()
    print("All evaluation figures generated successfully.")
