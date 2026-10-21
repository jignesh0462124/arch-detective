"""
Generate IEEE publication-grade Figure 4: Multi-Tenant Security & JWKS Cryptographic Authentication Flow.
Sequence diagram showing frontend, Supabase Auth PKCE, FastAPI JWT verifier, cached JWKS, and PostgreSQL RLS.
"""
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle

OUTPUT_DIR = "docs/paper_figures"
os.makedirs(OUTPUT_DIR, exist_ok=True)

fig, ax = plt.subplots(figsize=(8.8, 5.8), dpi=300)
ax.set_xlim(0, 100)
ax.set_ylim(0, 80)
ax.axis('off')

# Lifelines
actors = [
    ("Frontend Client\n(TanStack Start)", 12, "#3b82f6"),
    ("Supabase Auth\n(PKCE / OAuth)", 34, "#059669"),
    ("FastAPI Gateway\n(jwt_verifier)", 56, "#d97706"),
    ("JWKS Endpoint\n(Supabase Keys)", 76, "#6366f1"),
    ("PostgreSQL DB\n(RLS Enforced)", 92, "#7e22ce"),
]

# Draw actor header boxes
for name, x, col in actors:
    box = FancyBboxPatch((x - 8, 72), 16, 6.0, boxstyle="round,pad=0.2,rounding_size=0.8",
                         facecolor="#ffffff", edgecolor=col, linewidth=1.2, zorder=3)
    ax.add_patch(box)
    ax.text(x, 75, name, ha='center', va='center', fontsize=7.2, fontweight='bold', color="#0f172a", zorder=4)
    # Lifeline dashed
    ax.plot([x, x], [8, 72], linestyle='--', color='#94a3b8', linewidth=0.9, zorder=1)

def draw_msg(y, x1, x2, step_num, text, is_return=False, color="#1e293b"):
    ls = '--' if is_return else '-'
    arrow = FancyArrowPatch((x1, y), (x2, y),
                            arrowstyle='-|>', linestyle=ls,
                            mutation_scale=9, color=color, linewidth=1.0, zorder=4)
    ax.add_patch(arrow)
    mid_x = (x1 + x2) / 2
    ax.text(mid_x, y + 1.2, f"({step_num}) {text}", ha='center', va='bottom', fontsize=6.8, fontweight='bold', color=color,
            backgroundcolor='#ffffff', zorder=5)

# Messages
# 1. Sign in
draw_msg(66, 12, 34, "1", "POST /auth/v1/token (PKCE credentials)", color="#059669")
# 2. Return access token
draw_msg(59, 34, 12, "2", "Signed JWT Access Token (RS256, sub=user_id)", is_return=True, color="#059669")
# 3. Request API
draw_msg(52, 12, 56, "3", "GET /api/v1/scans (Bearer JWT in Authorization)", color="#d97706")
# 4. Fetch/Verify JWKS
draw_msg(45, 56, 76, "4a", "GET /.well-known/jwks.json (Cached 5 min)", color="#6366f1")
draw_msg(39, 76, 56, "4b", "Public RSA Keys (kid verification)", is_return=True, color="#6366f1")
# 5. Extract claims & slowapi rate limit
ax.text(56, 32.5, "[Verify signature, issuer, audience]\n[slowapi rate check: <=100 req/min]\n[Extract user_id & workspace_id]",
        ha='center', va='center', fontsize=6.2, color="#b45309", fontstyle='italic',
        bbox=dict(boxstyle='square,pad=0.3', facecolor='#fffbeb', edgecolor='#fde68a', linewidth=0.8), zorder=5)
# 6. DB Query with RLS
draw_msg(24, 56, 92, "5", "SET LOCAL app.current_workspace_id; SELECT * FROM scans", color="#7e22ce")
# 7. RLS filtered response
draw_msg(17, 92, 56, "6", "Workspace-isolated records returned (RLS enforced)", is_return=True, color="#7e22ce")
# 8. API response to client
draw_msg(11, 56, 12, "7", "200 OK (JSON Scan Payload)", is_return=True, color="#1e293b")

out_path = os.path.join(OUTPUT_DIR, "fig4_security_auth_flow.png")
plt.savefig(out_path, bbox_inches='tight', dpi=300)
plt.close()
print(f"Generated: {out_path}")
