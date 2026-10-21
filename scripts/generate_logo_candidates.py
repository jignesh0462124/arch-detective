"""
Generate Archon / ThreatLens Master Brand Logo Candidates.
Creates mathematical vector SVG geometries and renders high-DPI raster comparison sheets.
"""
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.path import Path
import numpy as np

OUTPUT_DIR = "docs/brand/candidates"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# -------------------------------------------------------------------------
# Candidate 1: "The Archon Vanguard"
# A powerful architectural 'A' monogram integrated into a modern defense shield,
# featuring a precision scan aperture and Signal Orange (#FF5600) core.
# -------------------------------------------------------------------------
c1_svg_light = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <!-- Outer Shield Silhouette -->
  <path d="M32 4L11 14.5v16.5c0 13.8 8.9 23.6 21 28 12.1-4.4 21-14.2 21-28V14.5L32 4Z" fill="#111111"/>
  <!-- Architectural 'A' Chevron Cutout -->
  <path d="M32 15L43.5 38H37L32 27.5L27 38H20.5L32 15Z" fill="#FFFFFF"/>
  <!-- Precision Reticle Cross-Beam -->
  <path d="M15 36.5H23M41 36.5H49" stroke="#FF5600" stroke-width="2.5" stroke-linecap="round"/>
  <!-- Central Signal Orange Focal Core -->
  <circle cx="32" cy="36.5" r="3.2" fill="#FF5600"/>
  <!-- Optical Inner Micro-Aperture -->
  <circle cx="32" cy="36.5" r="1.2" fill="#111111"/>
</svg>"""

c1_svg_dark = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <!-- Outer Shield Silhouette (Crisp White in Dark Mode) -->
  <path d="M32 4L11 14.5v16.5c0 13.8 8.9 23.6 21 28 12.1-4.4 21-14.2 21-28V14.5L32 4Z" fill="#FFFFFF"/>
  <!-- Architectural 'A' Chevron Cutout -->
  <path d="M32 15L43.5 38H37L32 27.5L27 38H20.5L32 15Z" fill="#111111"/>
  <!-- Precision Reticle Cross-Beam -->
  <path d="M15 36.5H23M41 36.5H49" stroke="#FF5600" stroke-width="2.5" stroke-linecap="round"/>
  <!-- Central Signal Orange Focal Core -->
  <circle cx="32" cy="36.5" r="3.2" fill="#FF5600"/>
  <!-- Optical Inner Micro-Aperture -->
  <circle cx="32" cy="36.5" r="1.2" fill="#FFFFFF"/>
</svg>"""

# -------------------------------------------------------------------------
# Candidate 2: "The Precision Graph Shield" (Isometric Facets & Trust Boundary)
# 3 interlocking architectural facets forming a futuristic shield with a floating diamond core.
# -------------------------------------------------------------------------
c2_svg_light = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <!-- Left Protective Facet -->
  <path d="M30 6L11 15v16c0 12.5 7.5 21.8 19 26V6Z" fill="#111111"/>
  <!-- Right Complementary Facet -->
  <path d="M34 6L53 15v16c0 12.5-7.5 21.8-19 26V6Z" fill="#252524"/>
  <!-- Central Architectural Scan Channel (Negative Space) -->
  <!-- Top Chevron Reticle -->
  <path d="M22 23L32 16L42 23" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Precision Signal Core (Diamond & Crosshair) -->
  <path d="M32 28L37 33L32 38L27 33Z" fill="#FF5600"/>
  <circle cx="32" cy="33" r="1.5" fill="#FFFFFF"/>
  <!-- Precision Horizon Notches -->
  <path d="M16 33h4M44 33h4" stroke="#FF5600" stroke-width="2.5" stroke-linecap="round"/>
</svg>"""

# -------------------------------------------------------------------------
# Candidate 3: "The Calibrated Detective Shield" (Swiss High-Precision Reticle)
# A refined, luxury-aerospace evolution of the original shield + reticle.
# Chamfered crest, calibrated 4-quadrant bracket reticle, and signal orange aperture.
# -------------------------------------------------------------------------
c3_svg_light = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <!-- Outer Shield Border with Chamfered Crest -->
  <path d="M24 6h16l13 7.5v17.5c0 13.5-9 23.5-21 27-12-3.5-21-13.5-21-27V13.5L24 6Z" fill="#111111" fill-opacity="0.06" stroke="#111111" stroke-width="3.5" stroke-linejoin="round"/>
  <!-- 4-Quadrant Precision Target Brackets -->
  <path d="M24 26h-4v-4M40 26h4v-4M24 38h-4v4M40 38h4v4" stroke="#111111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Cardinal Axis Scan Beams in Signal Orange -->
  <path d="M32 19v6M32 39v6M19 32h6M39 32h6" stroke="#FF5600" stroke-width="2.5" stroke-linecap="round"/>
  <!-- Central Signal Lens -->
  <circle cx="32" cy="32" r="3.5" fill="#FF5600"/>
  <circle cx="32" cy="32" r="1.2" fill="#FFFFFF"/>
</svg>"""

c3_svg_dark = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <!-- Outer Shield Border with Chamfered Crest -->
  <path d="M24 6h16l13 7.5v17.5c0 13.5-9 23.5-21 27-12-3.5-21-13.5-21-27V13.5L24 6Z" fill="#FFFFFF" fill-opacity="0.08" stroke="#FFFFFF" stroke-width="3.5" stroke-linejoin="round"/>
  <!-- 4-Quadrant Precision Target Brackets -->
  <path d="M24 26h-4v-4M40 26h4v-4M24 38h-4v4M40 38h4v4" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Cardinal Axis Scan Beams in Signal Orange -->
  <path d="M32 19v6M32 39v6M19 32h6M39 32h6" stroke="#FF5600" stroke-width="2.5" stroke-linecap="round"/>
  <!-- Central Signal Lens -->
  <circle cx="32" cy="32" r="3.5" fill="#FF5600"/>
  <circle cx="32" cy="32" r="1.2" fill="#111111"/>
</svg>"""

# -------------------------------------------------------------------------
# Candidate 4: "The Archon Monolith" (Solid Icon Emblem with Negative Space Keyhole & Reticle)
# Maximum iconicity, incredible contrast at small sizes (16-32px) and huge impact at 512px.
# -------------------------------------------------------------------------
c4_svg_light = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <!-- Solid Shield Monolith -->
  <path d="M32 4L10 15v16.5c0 14 9.5 24 22 28.5 12.5-4.5 22-14.5 22-28.5V15L32 4Z" fill="#111111"/>
  <!-- Precision Optical Eye (Outer Ring) -->
  <circle cx="32" cy="32" r="12" stroke="#FFFFFF" stroke-width="2.5"/>
  <!-- Dynamic Crosshair Channels in Signal Orange -->
  <path d="M20 32h7M37 32h7M32 20v7M32 37v7" stroke="#FF5600" stroke-width="3" stroke-linecap="round"/>
  <!-- Center Core Lens -->
  <circle cx="32" cy="32" r="3.8" fill="#FF5600"/>
  <circle cx="32" cy="32" r="1.5" fill="#111111"/>
</svg>"""

c4_svg_dark = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <!-- Solid Shield Monolith (Pure White in Dark) -->
  <path d="M32 4L10 15v16.5c0 14 9.5 24 22 28.5 12.5-4.5 22-14.5 22-28.5V15L32 4Z" fill="#FFFFFF"/>
  <!-- Precision Optical Eye (Outer Ring) -->
  <circle cx="32" cy="32" r="12" stroke="#111111" stroke-width="2.5"/>
  <!-- Dynamic Crosshair Channels in Signal Orange -->
  <path d="M20 32h7M37 32h7M32 20v7M32 37v7" stroke="#FF5600" stroke-width="3" stroke-linecap="round"/>
  <!-- Center Core Lens -->
  <circle cx="32" cy="32" r="3.8" fill="#FF5600"/>
  <circle cx="32" cy="32" r="1.5" fill="#FFFFFF"/>
</svg>"""

# Save all SVGs
files = [
    ("c1_vanguard_light.svg", c1_svg_light),
    ("c1_vanguard_dark.svg", c1_svg_dark),
    ("c2_graph_light.svg", c2_svg_light),
    ("c3_calibrated_light.svg", c3_svg_light),
    ("c3_calibrated_dark.svg", c3_svg_dark),
    ("c4_monolith_light.svg", c4_svg_light),
    ("c4_monolith_dark.svg", c4_svg_dark),
]

for filename, content in files:
    path = os.path.join(OUTPUT_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content.strip())
    print(f"Saved: {path}")

# Now, generate a visual comparison sheet using matplotlib!
fig, axs = plt.subplots(2, 4, figsize=(16, 8), dpi=300)
fig.patch.set_facecolor('#F5F1EC') # Archon cream canvas

titles = [
    "Original (Current)",
    "Concept 1: Vanguard (A-Shield)",
    "Concept 2: Graph Facets",
    "Concept 3: Calibrated Reticle",
    "Current (Dark)",
    "Concept 1 (Dark)",
    "Concept 4: Monolith (Light)",
    "Concept 4 (Dark)"
]

def render_original(ax, dark=False):
    bg_c = '#111111' if dark else '#F5F1EC'
    ax.set_facecolor(bg_c)
    ax.set_xlim(0, 64)
    ax.set_ylim(64, 0)
    ax.axis('off')
    
    # Shield
    shield_pts = np.array([[32, 5], [10, 16], [10, 32], [32, 60], [54, 32], [54, 16]])
    shield_c = '#FFFFFF' if dark else '#111111'
    fill_c = (1.0, 1.0, 1.0, 0.08) if dark else '#F0EDE8'
    poly = patches.Polygon(shield_pts, closed=True, facecolor=fill_c, edgecolor=shield_c, linewidth=3)
    ax.add_patch(poly)
    
    # Crosshair
    ax.plot([20, 28], [33, 33], color='#FF5600', linewidth=3.5, solid_capstyle='round')
    ax.plot([36, 44], [33, 33], color='#FF5600', linewidth=3.5, solid_capstyle='round')
    ax.plot([32, 32], [21, 29], color='#FF5600', linewidth=3.5, solid_capstyle='round')
    ax.plot([32, 32], [37, 45], color='#FF5600', linewidth=3.5, solid_capstyle='round')
    ax.add_patch(patches.Circle((32, 33), 3.25, facecolor='#FF5600', edgecolor='none'))

def render_c1(ax, dark=False):
    bg_c = '#111111' if dark else '#F5F1EC'
    ax.set_facecolor(bg_c)
    ax.set_xlim(0, 64)
    ax.set_ylim(64, 0)
    ax.axis('off')
    
    shield_c = '#FFFFFF' if dark else '#111111'
    inner_c = '#111111' if dark else '#FFFFFF'
    
    # Outer Shield (Solid)
    shield_pts = np.array([[32, 4], [11, 14.5], [11, 31], [32, 59], [53, 31], [53, 14.5]])
    poly = patches.Polygon(shield_pts, closed=True, facecolor=shield_c, edgecolor='none')
    ax.add_patch(poly)
    
    # A-frame cutout
    a_pts = np.array([[32, 15], [43.5, 38], [37, 38], [32, 27.5], [27, 38], [20.5, 38]])
    a_poly = patches.Polygon(a_pts, closed=True, facecolor=inner_c, edgecolor='none')
    ax.add_patch(a_poly)
    
    # Cross-beam
    ax.plot([15, 23], [36.5, 36.5], color='#FF5600', linewidth=2.5, solid_capstyle='round')
    ax.plot([41, 49], [36.5, 36.5], color='#FF5600', linewidth=2.5, solid_capstyle='round')
    
    # Focal Core
    ax.add_patch(patches.Circle((32, 36.5), 3.2, facecolor='#FF5600', edgecolor='none'))
    ax.add_patch(patches.Circle((32, 36.5), 1.2, facecolor=shield_c, edgecolor='none'))

def render_c2(ax):
    ax.set_facecolor('#F5F1EC')
    ax.set_xlim(0, 64)
    ax.set_ylim(64, 0)
    ax.axis('off')
    
    # Left Facet
    l_pts = np.array([[30, 6], [11, 15], [11, 31], [30, 53]])
    ax.add_patch(patches.Polygon(l_pts, closed=True, facecolor='#111111', edgecolor='none'))
    
    # Right Facet
    r_pts = np.array([[34, 6], [53, 15], [53, 31], [34, 53]])
    ax.add_patch(patches.Polygon(r_pts, closed=True, facecolor='#2C2C2A', edgecolor='none'))
    
    # Chevron
    ax.plot([22, 32, 42], [23, 16, 23], color='#FFFFFF', linewidth=3, solid_capstyle='round', solid_joinstyle='round')
    
    # Diamond Core
    dia = np.array([[32, 28], [37, 33], [32, 38], [27, 33]])
    ax.add_patch(patches.Polygon(dia, closed=True, facecolor='#FF5600', edgecolor='none'))
    ax.add_patch(patches.Circle((32, 33), 1.5, facecolor='#FFFFFF', edgecolor='none'))
    
    # Side notches
    ax.plot([15, 19], [33, 33], color='#FF5600', linewidth=2.5, solid_capstyle='round')
    ax.plot([45, 49], [33, 33], color='#FF5600', linewidth=2.5, solid_capstyle='round')

def render_c3(ax, dark=False):
    bg_c = '#111111' if dark else '#F5F1EC'
    ax.set_facecolor(bg_c)
    ax.set_xlim(0, 64)
    ax.set_ylim(64, 0)
    ax.axis('off')
    
    line_c = '#FFFFFF' if dark else '#111111'
    fill_c = (1.0, 1.0, 1.0, 0.06) if dark else '#EAE5DF'
    
    # Chamfered Crest Shield
    shield_pts = np.array([[24, 6], [40, 6], [53, 13.5], [53, 31], [32, 58], [11, 31], [11, 13.5]])
    ax.add_patch(patches.Polygon(shield_pts, closed=True, facecolor=fill_c, edgecolor=line_c, linewidth=3.2))
    
    # 4-quadrant brackets
    # top-left
    ax.plot([20, 20, 24], [26, 22, 22], color=line_c, linewidth=2.4, solid_capstyle='round', solid_joinstyle='round')
    # top-right
    ax.plot([44, 44, 40], [26, 22, 22], color=line_c, linewidth=2.4, solid_capstyle='round', solid_joinstyle='round')
    # bottom-left
    ax.plot([20, 20, 24], [38, 42, 42], color=line_c, linewidth=2.4, solid_capstyle='round', solid_joinstyle='round')
    # bottom-right
    ax.plot([44, 44, 40], [38, 42, 42], color=line_c, linewidth=2.4, solid_capstyle='round', solid_joinstyle='round')
    
    # Scan Beams
    ax.plot([32, 32], [19, 25], color='#FF5600', linewidth=2.4, solid_capstyle='round')
    ax.plot([32, 32], [39, 45], color='#FF5600', linewidth=2.4, solid_capstyle='round')
    ax.plot([19, 25], [32, 32], color='#FF5600', linewidth=2.4, solid_capstyle='round')
    ax.plot([39, 45], [32, 32], color='#FF5600', linewidth=2.4, solid_capstyle='round')
    
    # Lens
    ax.add_patch(patches.Circle((32, 32), 3.5, facecolor='#FF5600', edgecolor='none'))
    ax.add_patch(patches.Circle((32, 32), 1.2, facecolor='#FFFFFF' if not dark else '#111111', edgecolor='none'))

def render_c4(ax, dark=False):
    bg_c = '#111111' if dark else '#F5F1EC'
    ax.set_facecolor(bg_c)
    ax.set_xlim(0, 64)
    ax.set_ylim(64, 0)
    ax.axis('off')
    
    shield_c = '#FFFFFF' if dark else '#111111'
    ring_c = '#111111' if dark else '#FFFFFF'
    dot_c = '#FFFFFF' if dark else '#111111'
    
    # Solid Shield
    shield_pts = np.array([[32, 4], [10, 15], [10, 31.5], [32, 60], [54, 31.5], [54, 15]])
    ax.add_patch(patches.Polygon(shield_pts, closed=True, facecolor=shield_c, edgecolor='none'))
    
    # Precision Optical Ring
    ax.add_patch(patches.Circle((32, 32), 12, facecolor='none', edgecolor=ring_c, linewidth=2.4))
    
    # Crosshairs
    ax.plot([20, 27], [32, 32], color='#FF5600', linewidth=3.0, solid_capstyle='round')
    ax.plot([37, 44], [32, 32], color='#FF5600', linewidth=3.0, solid_capstyle='round')
    ax.plot([32, 32], [20, 27], color='#FF5600', linewidth=3.0, solid_capstyle='round')
    ax.plot([32, 32], [37, 44], color='#FF5600', linewidth=3.0, solid_capstyle='round')
    
    # Core
    ax.add_patch(patches.Circle((32, 32), 3.8, facecolor='#FF5600', edgecolor='none'))
    ax.add_patch(patches.Circle((32, 32), 1.5, facecolor=dot_c, edgecolor='none'))

render_original(axs[0, 0], dark=False)
axs[0, 0].set_title(titles[0], fontsize=11, fontweight='bold', pad=10)

render_c1(axs[0, 1], dark=False)
axs[0, 1].set_title(titles[1], fontsize=11, fontweight='bold', pad=10)

render_c2(axs[0, 2])
axs[0, 2].set_title(titles[2], fontsize=11, fontweight='bold', pad=10)

render_c3(axs[0, 3], dark=False)
axs[0, 3].set_title(titles[3], fontsize=11, fontweight='bold', pad=10)

render_original(axs[1, 0], dark=True)
axs[1, 0].set_title(titles[4], fontsize=11, fontweight='bold', pad=10)

render_c1(axs[1, 1], dark=True)
axs[1, 1].set_title(titles[5], fontsize=11, fontweight='bold', pad=10)

render_c4(axs[1, 2], dark=False)
axs[1, 2].set_title(titles[6], fontsize=11, fontweight='bold', pad=10)

render_c4(axs[1, 3], dark=True)
axs[1, 3].set_title(titles[7], fontsize=11, fontweight='bold', pad=10)

plt.tight_layout()
sheet_path = os.path.join(OUTPUT_DIR, "logo_comparison_sheet.png")
plt.savefig(sheet_path, bbox_inches='tight', dpi=300)
plt.close()
print(f"Comparison sheet saved: {sheet_path}")
