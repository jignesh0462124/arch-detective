"""
Generate Master Archon Logo & Identity Showcase.
Synthesizes the architectural A-frame, defensive shield, and calibrated precision reticle.
"""
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.path import Path
import numpy as np

OUTPUT_DIR = "docs/brand"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# -------------------------------------------------------------------------
# Master SVG Definition: "Archon Sovereign"
# Coordinates designed on a 64x64 grid with 3.2px stroke harmony.
# -------------------------------------------------------------------------

def get_master_svg(mode="light", size=64):
    """
    Returns standalone vector mark SVG.
    mode: 'light', 'dark', 'mono'
    """
    if mode == "light":
        shield_stroke = "#111111"
        shield_fill = "rgba(17, 17, 17, 0.04)"
        chevron_color = "#111111"
        accent_color = "#FF5600"
        center_pupil = "#FFFFFF"
    elif mode == "dark":
        shield_stroke = "#FFFFFF"
        shield_fill = "rgba(255, 255, 255, 0.06)"
        chevron_color = "#FFFFFF"
        accent_color = "#FF5600"
        center_pupil = "#111111"
    else: # mono
        shield_stroke = "#111111"
        shield_fill = "none"
        chevron_color = "#111111"
        accent_color = "#111111"
        center_pupil = "#FFFFFF"

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="{size}" height="{size}" fill="none">
  <!-- Outer Defensive Shield (Engineered with chamfered roof and ergonomic curve) -->
  <path d="M24 7h16l13 7.5v16c0 14-8.8 24.2-21 27.5-12.2-3.3-21-13.5-21-27.5v-16L24 7Z"
        fill="{shield_fill}" stroke="{shield_stroke}" stroke-width="3.2" stroke-linejoin="round"/>
  
  <!-- Architectural 'A' Apex Chevron -->
  <path d="M32 14.5L43.5 25.5H38L32 19.8L26 25.5H20.5L32 14.5Z"
        fill="{chevron_color}"/>
        
  <!-- Precision Radar Target Arc (Subtle internal framing) -->
  <path d="M23 33.5a9 9 0 0 1 18 0" stroke="{shield_stroke}" stroke-width="1.8" stroke-dasharray="2.5 2.5" opacity="0.6"/>
  
  <!-- Precision Horizontal Scan Horizon -->
  <path d="M16 33.5h7.5M40.5 33.5H48" stroke="{accent_color}" stroke-width="3" stroke-linecap="round"/>
  
  <!-- Vertical Optical Calibration Axis -->
  <path d="M32 26v3.5M32 37.5v5" stroke="{accent_color}" stroke-width="2.5" stroke-linecap="round"/>
  
  <!-- Central Signal Core Lens -->
  <circle cx="32" cy="33.5" r="4.2" fill="{accent_color}"/>
  <circle cx="32" cy="33.5" r="1.6" fill="{center_pupil}"/>
</svg>"""
    return svg

def get_app_tile_svg(mode="light", size=64):
    """
    Returns app icon tile (squircle container with mark inside).
    """
    tile_bg = "#111111" if mode == "light" else "#FFFFFF"
    mark_color = "#FFFFFF" if mode == "light" else "#111111"
    accent = "#FF5600"
    pupil = "#111111" if mode == "light" else "#FFFFFF"

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="{size}" height="{size}" fill="none">
  <!-- Rounded Squircle Tile -->
  <rect x="2" y="2" width="60" height="60" rx="14" fill="{tile_bg}"/>
  
  <!-- Scaled Inner Mark (Center 32, 32) -->
  <g transform="translate(4, 2) scale(0.875)">
    <!-- Shield -->
    <path d="M24 7h16l13 7.5v16c0 14-8.8 24.2-21 27.5-12.2-3.3-21-13.5-21-27.5v-16L24 7Z"
          fill="rgba(255,255,255,0.06)" stroke="{mark_color}" stroke-width="3.2" stroke-linejoin="round"/>
    <!-- 'A' Chevron -->
    <path d="M32 14.5L43.5 25.5H38L32 19.8L26 25.5H20.5L32 14.5Z" fill="{mark_color}"/>
    <!-- Horizon -->
    <path d="M16 33.5h7.5M40.5 33.5H48" stroke="{accent}" stroke-width="3" stroke-linecap="round"/>
    <!-- Vertical -->
    <path d="M32 26v3.5M32 37.5v5" stroke="{accent}" stroke-width="2.5" stroke-linecap="round"/>
    <!-- Lens -->
    <circle cx="32" cy="33.5" r="4.2" fill="{accent}"/>
    <circle cx="32" cy="33.5" r="1.6" fill="{pupil}"/>
  </g>
</svg>"""
    return svg

# Save SVGs
with open(os.path.join(OUTPUT_DIR, "archon-mark.svg"), "w", encoding="utf-8") as f:
    f.write(get_master_svg("light"))

with open(os.path.join(OUTPUT_DIR, "archon-mark-inverse.svg"), "w", encoding="utf-8") as f:
    f.write(get_master_svg("dark"))

with open(os.path.join(OUTPUT_DIR, "archon-mark-mono.svg"), "w", encoding="utf-8") as f:
    f.write(get_master_svg("mono"))

print("Master SVGs generated.")

# -------------------------------------------------------------------------
# Render High-Resolution Brand Identity Showcase Sheet (300 DPI)
# -------------------------------------------------------------------------
fig = plt.figure(figsize=(16, 10), dpi=300)
fig.patch.set_facecolor('#F5F1EC') # Canvas cream

# Layout:
# Top Section: Hero Showcase (Light Mode Card vs Dark Mode Card)
# Middle Section: Size Scalability (256px, 64px, 32px, 16px) & In-Product App Icon
# Bottom Section: Wordmark Lockup & Brand Color Tokens

gs = fig.add_gridspec(3, 3, height_ratios=[1.2, 0.9, 0.9], hspace=0.35, wspace=0.25)

def draw_logo_mark(ax, x_center, y_center, scale=1.0, dark=False, with_tile=False):
    bg = '#111111' if dark else '#F5F1EC'
    fg = '#FFFFFF' if dark else '#111111'
    fill_subtle = (1.0, 1.0, 1.0, 0.06) if dark else (0.07, 0.07, 0.07, 0.04)
    accent = '#FF5600'
    pupil = '#111111' if dark else '#FFFFFF'
    
    if with_tile:
        tile_bg = '#111111' if not dark else '#FFFFFF'
        fg = '#FFFFFF' if not dark else '#111111'
        pupil = '#111111' if not dark else '#FFFFFF'
        tile_box = patches.FancyBboxPatch(
            (x_center - 28*scale, y_center - 28*scale), 56*scale, 56*scale,
            boxstyle=f"round,pad=0,rounding_size={12*scale}",
            facecolor=tile_bg, edgecolor='none', zorder=2
        )
        ax.add_patch(tile_box)
        scale *= 0.82
    
    # Outer Shield with smooth cubic Bezier flanks
    raw_verts = [
        (24, 7), (40, 7), (53, 14.5), (53, 30.5),
        (53, 44.5), (44.2, 54.7), (32, 58),
        (19.8, 54.7), (11, 44.5), (11, 30.5),
        (11, 14.5), (24, 7)
    ]
    codes = [
        Path.MOVETO, Path.LINETO, Path.LINETO, Path.LINETO,
        Path.CURVE4, Path.CURVE4, Path.CURVE4,
        Path.CURVE4, Path.CURVE4, Path.CURVE4,
        Path.LINETO, Path.CLOSEPOLY
    ]
    verts = []
    for x, y in raw_verts:
        verts.append((x_center + (x - 32) * scale, y_center - (y - 32) * scale))
    
    shield_path = Path(verts, codes)
    patch = patches.PathPatch(shield_path, facecolor=fill_subtle, edgecolor=fg,
                              linewidth=3.2 * scale, zorder=3, joinstyle='round', capstyle='round')
    ax.add_patch(patch)
    
    # 'A' Chevron
    chev_pts = np.array([
        [32, 14.5], [43.5, 25.5], [38, 25.5], [32, 19.8], [26, 25.5], [20.5, 25.5]
    ])
    c_pts = np.copy(chev_pts).astype(float)
    c_pts[:, 0] = x_center + (c_pts[:, 0] - 32) * scale
    c_pts[:, 1] = y_center - (c_pts[:, 1] - 32) * scale
    ax.add_patch(patches.Polygon(c_pts, closed=True, facecolor=fg, edgecolor='none', zorder=4))
    
    # Dashed Radar Arc
    arc_center = (x_center, y_center - (33.5 - 32)*scale)
    arc_r = 9 * scale
    theta = np.linspace(0, np.pi, 30)
    arc_x = arc_center[0] + arc_r * np.cos(theta)
    arc_y = arc_center[1] + arc_r * np.sin(theta)
    ax.plot(arc_x, arc_y, color=fg, linewidth=1.5*scale, linestyle='--', alpha=0.45, zorder=3)
    
    # Horizon line
    h_y = y_center - (33.5 - 32)*scale
    ax.plot([x_center - 16*scale, x_center - 8.5*scale], [h_y, h_y],
            color=accent, linewidth=3.0*scale, solid_capstyle='round', zorder=5)
    ax.plot([x_center + 8.5*scale, x_center + 16*scale], [h_y, h_y],
            color=accent, linewidth=3.0*scale, solid_capstyle='round', zorder=5)
    
    # Vertical axis ticks
    ax.plot([x_center, x_center], [y_center + 6*scale, y_center + 2.5*scale],
            color=accent, linewidth=2.4*scale, solid_capstyle='round', zorder=5)
    ax.plot([x_center, x_center], [y_center - 5.5*scale, y_center - 10.5*scale],
            color=accent, linewidth=2.4*scale, solid_capstyle='round', zorder=5)
    
    # Central Core Lens
    ax.add_patch(patches.Circle((x_center, h_y), 4.2*scale, facecolor=accent, edgecolor='none', zorder=6))
    ax.add_patch(patches.Circle((x_center, h_y), 1.6*scale, facecolor=pupil, edgecolor='none', zorder=7))

# -------------------------------------------------------------------------
# Subplot 0,0 & 0,1: Light Card vs Dark Card Showcase
# -------------------------------------------------------------------------
ax_light = fig.add_subplot(gs[0, :2])
ax_light.set_facecolor('#FFFFFF')
ax_light.set_xlim(0, 100)
ax_light.set_ylim(0, 50)
ax_light.axis('off')
# Add subtle border card
card_l = patches.FancyBboxPatch((1, 1), 98, 48, boxstyle="round,pad=0,rounding_size=2",
                               facecolor='#FFFFFF', edgecolor='#D3CEC6', linewidth=1.2)
ax_light.add_patch(card_l)

draw_logo_mark(ax_light, 20, 25, scale=0.68, dark=False)
ax_light.text(38, 28, "ARCHON", fontsize=28, fontweight='bold', color="#111111", fontfamily='sans-serif')
ax_light.text(38.5, 20, "AUDIT ENGINE  ·  AGENTIC COMPLIANCE", fontsize=11, fontweight='semibold',
              color="#FF5600", fontfamily='sans-serif')
ax_light.text(38.5, 14, "Primary Identity (Light Surface / Intercom-Style Canvas)", fontsize=9.5,
              fontstyle='italic', color="#626260")

ax_dark = fig.add_subplot(gs[0, 2])
ax_dark.set_facecolor('#111111')
ax_dark.set_xlim(0, 50)
ax_dark.set_ylim(0, 50)
ax_dark.axis('off')
card_d = patches.FancyBboxPatch((1, 1), 48, 48, boxstyle="round,pad=0,rounding_size=2",
                               facecolor='#111111', edgecolor='#313130', linewidth=1.2)
ax_dark.add_patch(card_d)

draw_logo_mark(ax_dark, 25, 27, scale=0.64, dark=True)
ax_dark.text(25, 5.5, "Dark Mode Inversion", ha='center', fontsize=9.5, fontweight='bold', color="#FFFFFF")

# -------------------------------------------------------------------------
# Subplot Row 1: App Tile, Scalability (48px, 32px, 20px, 16px) & Philosophy
# -------------------------------------------------------------------------
ax_tile = fig.add_subplot(gs[1, 0])
ax_tile.set_facecolor('#F5F1EC')
ax_tile.set_xlim(0, 50)
ax_tile.set_ylim(0, 50)
ax_tile.axis('off')
draw_logo_mark(ax_tile, 25, 25, scale=0.75, dark=False, with_tile=True)
ax_tile.text(25, 6, "App Console Tile (AppShell)", ha='center', fontsize=10, fontweight='bold', color="#111111")

ax_scale = fig.add_subplot(gs[1, 1])
ax_scale.set_facecolor('#F5F1EC')
ax_scale.set_xlim(0, 50)
ax_scale.set_ylim(0, 50)
ax_scale.axis('off')

# Display multi-scale test: 48px, 32px, 20px, 16px without overlaps
draw_logo_mark(ax_scale, 8.5, 25, scale=0.36, dark=False)
draw_logo_mark(ax_scale, 21.5, 25, scale=0.26, dark=False)
draw_logo_mark(ax_scale, 33.5, 25, scale=0.18, dark=False)
draw_logo_mark(ax_scale, 43.0, 25, scale=0.13, dark=False)
ax_scale.text(25, 6, "Multi-Scale Hierarchy (48px · 32px · 20px · 16px)", ha='center',
              fontsize=9.2, fontweight='bold', color="#111111")

ax_anatomy = fig.add_subplot(gs[1, 2])
ax_anatomy.set_facecolor('#FFFFFF')
ax_anatomy.set_xlim(0, 50)
ax_anatomy.set_ylim(0, 50)
ax_anatomy.axis('off')
card_a = patches.FancyBboxPatch((1, 1), 48, 48, boxstyle="round,pad=0,rounding_size=1.5",
                               facecolor='#FFFFFF', edgecolor='#D3CEC6', linewidth=1.0)
ax_anatomy.add_patch(card_a)

ax_anatomy.text(4, 41, "Symbolic Anatomy:", fontsize=11, fontweight='bold', color="#111111")
ax_anatomy.text(4, 33, "1. Chamfered Crest: Trust & roofline", fontsize=8.5, color="#333333")
ax_anatomy.text(4, 25, "2. Chevron Apex: 'A' for Archon", fontsize=8.5, color="#333333")
ax_anatomy.text(4, 17, "3. Radar Arc: Graph vulnerability sweep", fontsize=8.5, color="#333333")
ax_anatomy.text(4, 9, "4. Core Sensor: Signal Orange reticle", fontsize=8.5, color="#FF5600", fontweight='bold')

# -------------------------------------------------------------------------
# Subplot Row 2: Color Palette Tokens & In-Context Wordmark
# -------------------------------------------------------------------------
ax_palette = fig.add_subplot(gs[2, :])
ax_palette.set_facecolor('#FFFFFF')
ax_palette.set_xlim(0, 100)
ax_palette.set_ylim(0, 40)
ax_palette.axis('off')
card_p = patches.FancyBboxPatch((1, 1), 98, 38, boxstyle="round,pad=0,rounding_size=1.5",
                               facecolor='#FFFFFF', edgecolor='#D3CEC6', linewidth=1.0)
ax_palette.add_patch(card_p)

# Color swatches
colors = [
    ("#111111", "Deep Ink", "Primary Text & Silhouette"),
    ("#FF5600", "Signal Orange", "Core Scan Beam & Precision Reticle"),
    ("#F5F1EC", "Cream Canvas", "Intercom-Inspired Editorial Background"),
    ("#FFFFFF", "Pure Surface", "Elevated Cards & Dark Inversion"),
    ("#D3CEC6", "Quiet Hairline", "Engineered System Borders")
]

for i, (hex_c, name, role) in enumerate(colors):
    x_c = 6 + i * 19
    swatch = patches.FancyBboxPatch((x_c, 16), 14, 16, boxstyle="round,pad=0,rounding_size=1.5",
                                   facecolor=hex_c, edgecolor='#D3CEC6', linewidth=1.0)
    ax_palette.add_patch(swatch)
    ax_palette.text(x_c + 7, 10, name, ha='center', fontsize=9.5, fontweight='bold', color="#111111")
    ax_palette.text(x_c + 7, 5, hex_c, ha='center', fontsize=8.5, fontfamily='monospace', color="#666666")

sheet_path = os.path.join(OUTPUT_DIR, "archon_master_brand_showcase.png")
plt.savefig(sheet_path, bbox_inches='tight', dpi=300)
plt.close()
print(f"Showcase sheet saved to: {sheet_path}")
