"""
Refined Logo Concepts for Archon / ThreatLens.
Exploring:
- Concept 5: The "Archon Apex" (Refined A-Shield with golden-ratio proportions and precision reticle)
- Concept 6: The "Architectural Prism" (Faceted geometric shield with central orange lens)
- Concept 7: The "Editorial Reticle Shield" (Clean, high-end Swiss line-and-glyph design)
- Concept 8: The "Archon Core" (Isometric layered shield with optical sensor)
"""
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

OUTPUT_DIR = "docs/brand/candidates"
os.makedirs(OUTPUT_DIR, exist_ok=True)

fig, axs = plt.subplots(2, 4, figsize=(18, 9), dpi=300)
fig.patch.set_facecolor('#F5F1EC')

def draw_concept_5(ax, dark=False):
    """
    Concept 5: The Refined Archon Apex.
    A bold architectural 'A' fused seamlessly with a modern defensive shield.
    Outer shield with chamfered top crest, solid left/right pillars converging at apex,
    central negative space framing the Signal Orange optical reticle.
    """
    bg = '#111111' if dark else '#F5F1EC'
    fg = '#FFFFFF' if dark else '#111111'
    accent = '#FF5600'
    
    ax.set_facecolor(bg)
    ax.set_xlim(0, 64)
    ax.set_ylim(64, 0)
    ax.axis('off')
    
    # Left Pillar of A-Shield
    # Starts at apex (32, 6), slopes to left shoulder (12, 16), drops to (12, 32),
    # tapers to bottom (30, 56), cut in to (24, 38), then up to inner apex (32, 22)
    left_pillar = np.array([
        [32, 6], [12, 16], [12, 32], [28, 54],
        [28, 42], [21, 42], [26, 31], [32, 19]
    ])
    ax.add_patch(patches.Polygon(left_pillar, closed=True, facecolor=fg, edgecolor='none'))
    
    # Right Pillar of A-Shield (mirrored)
    right_pillar = np.array([
        [32, 6], [52, 16], [52, 32], [36, 54],
        [36, 42], [43, 42], [38, 31], [32, 19]
    ])
    ax.add_patch(patches.Polygon(right_pillar, closed=True, facecolor=fg, edgecolor='none'))
    
    # Horizontal Optical Scan Beam (Signal Orange)
    ax.plot([14, 23], [37, 37], color=accent, linewidth=2.8, solid_capstyle='round')
    ax.plot([41, 50], [37, 37], color=accent, linewidth=2.8, solid_capstyle='round')
    
    # Central Optical Core (Lens + Reticle Center)
    ax.add_patch(patches.Circle((32, 37), 4.2, facecolor=accent, edgecolor='none'))
    ax.add_patch(patches.Circle((32, 37), 1.8, facecolor=bg, edgecolor='none'))

def draw_concept_6(ax, dark=False):
    """
    Concept 6: The Modern Architectural Shield (Monoline + Solid Core).
    Features an outer aerospace shield with 3.2px stroke,
    an inner bold chevron roofline forming the top of the 'A',
    and a precision 4-axis reticle targeting the center.
    """
    bg = '#111111' if dark else '#F5F1EC'
    fg = '#FFFFFF' if dark else '#111111'
    fill_subtle = (1.0, 1.0, 1.0, 0.06) if dark else (0.07, 0.07, 0.07, 0.04)
    accent = '#FF5600'
    
    ax.set_facecolor(bg)
    ax.set_xlim(0, 64)
    ax.set_ylim(64, 0)
    ax.axis('off')
    
    # Outer Shield Contour with Chamfered Crest
    # (26, 6) -> (38, 6) -> (53, 14) -> (53, 33) -> (32, 58) -> (11, 33) -> (11, 14)
    shield = np.array([
        [25, 7], [39, 7], [53, 14.5], [53, 33], [32, 58], [11, 33], [11, 14.5]
    ])
    ax.add_patch(patches.Polygon(shield, closed=True, facecolor=fill_subtle, edgecolor=fg, linewidth=3.2))
    
    # Inner Architectural 'A' Chevron (Upper Structure)
    chev = np.array([
        [32, 14], [43, 26], [38, 26], [32, 19.5], [26, 26], [21, 26]
    ])
    ax.add_patch(patches.Polygon(chev, closed=True, facecolor=fg, edgecolor='none'))
    
    # Precision Scan Horizon (Orange)
    ax.plot([16, 25], [36, 36], color=accent, linewidth=2.8, solid_capstyle='round')
    ax.plot([39, 48], [36, 36], color=accent, linewidth=2.8, solid_capstyle='round')
    ax.plot([32, 32], [27, 31], color=accent, linewidth=2.4, solid_capstyle='round')
    ax.plot([32, 32], [41, 47], color=accent, linewidth=2.4, solid_capstyle='round')
    
    # Central Lens
    ax.add_patch(patches.Circle((32, 36), 3.8, facecolor=accent, edgecolor='none'))
    ax.add_patch(patches.Circle((32, 36), 1.5, facecolor=bg, edgecolor='none'))

def draw_concept_7(ax, dark=False):
    """
    Concept 7: The Archon Emblem (Solid Geometric Mark).
    A solid shield with an embossed technical crosshair channel and diamond aperture.
    Ultra-clean, high visual weight, unmistakable at 16px favicon.
    """
    bg = '#111111' if dark else '#F5F1EC'
    fg = '#FFFFFF' if dark else '#111111'
    accent = '#FF5600'
    
    ax.set_facecolor(bg)
    ax.set_xlim(0, 64)
    ax.set_ylim(64, 0)
    ax.axis('off')
    
    # Solid Shield
    shield = np.array([
        [32, 5], [11, 15], [11, 32], [32, 59], [53, 32], [53, 15]
    ])
    ax.add_patch(patches.Polygon(shield, closed=True, facecolor=fg, edgecolor='none'))
    
    # Cutout Negative Space Diamond
    dia = np.array([[32, 20], [44, 32], [32, 44], [20, 32]])
    ax.add_patch(patches.Polygon(dia, closed=True, facecolor=bg, edgecolor='none'))
    
    # Inner Solid Diamond (Signal Orange)
    inner_dia = np.array([[32, 24], [40, 32], [32, 40], [24, 32]])
    ax.add_patch(patches.Polygon(inner_dia, closed=True, facecolor=accent, edgecolor='none'))
    
    # Center Pinpoint (Negative Space)
    ax.add_patch(patches.Circle((32, 32), 2.2, facecolor=bg, edgecolor='none'))
    
    # 4 Precision Axis Ticks
    ax.plot([14, 18], [32, 32], color=accent, linewidth=2.5, solid_capstyle='round')
    ax.plot([46, 50], [32, 32], color=accent, linewidth=2.5, solid_capstyle='round')
    ax.plot([32, 32], [14, 18], color=accent, linewidth=2.5, solid_capstyle='round')
    ax.plot([32, 32], [46, 50], color=accent, linewidth=2.5, solid_capstyle='round')

def draw_concept_8(ax, dark=False):
    """
    Concept 8: The Intercom-Editorial Detective Mark.
    Sophisticated monoline shield + interlocking dual-layer reticle.
    Has subtle rounded joints, cardinal coordinates, and glowing optical sensor.
    """
    bg = '#111111' if dark else '#F5F1EC'
    fg = '#FFFFFF' if dark else '#111111'
    fill_subtle = (1.0, 1.0, 1.0, 0.05) if dark else (0.07, 0.07, 0.07, 0.03)
    accent = '#FF5600'
    
    ax.set_facecolor(bg)
    ax.set_xlim(0, 64)
    ax.set_ylim(64, 0)
    ax.axis('off')
    
    # Shield
    shield = np.array([
        [32, 6], [12, 16], [12, 32], [32, 58], [52, 32], [52, 16]
    ])
    ax.add_patch(patches.Polygon(shield, closed=True, facecolor=fill_subtle, edgecolor=fg, linewidth=3.2))
    
    # Inner Precision Target Ring
    ax.add_patch(patches.Circle((32, 33), 11, facecolor='none', edgecolor=fg, linewidth=1.8, linestyle='--'))
    
    # Crosshair with Center Break
    ax.plot([17, 26], [33, 33], color=accent, linewidth=3.0, solid_capstyle='round')
    ax.plot([38, 47], [33, 33], color=accent, linewidth=3.0, solid_capstyle='round')
    ax.plot([32, 32], [18, 27], color=accent, linewidth=3.0, solid_capstyle='round')
    ax.plot([32, 32], [39, 48], color=accent, linewidth=3.0, solid_capstyle='round')
    
    # Core Sensor
    ax.add_patch(patches.Circle((32, 33), 3.6, facecolor=accent, edgecolor='none'))
    ax.add_patch(patches.Circle((32, 33), 1.4, facecolor='#FFFFFF' if not dark else '#111111', edgecolor='none'))

# Row 1: Light Mode
draw_concept_5(axs[0, 0], dark=False)
axs[0, 0].set_title("Concept 5: Archon Apex (Light)", fontsize=11, fontweight='bold', pad=10)

draw_concept_6(axs[0, 1], dark=False)
axs[0, 1].set_title("Concept 6: Modern A-Shield (Light)", fontsize=11, fontweight='bold', pad=10)

draw_concept_7(axs[0, 2], dark=False)
axs[0, 2].set_title("Concept 7: Solid Emblem (Light)", fontsize=11, fontweight='bold', pad=10)

draw_concept_8(axs[0, 3], dark=False)
axs[0, 3].set_title("Concept 8: Editorial Reticle (Light)", fontsize=11, fontweight='bold', pad=10)

# Row 2: Dark Mode
draw_concept_5(axs[1, 0], dark=True)
axs[1, 0].set_title("Concept 5 (Dark)", fontsize=11, fontweight='bold', pad=10)

draw_concept_6(axs[1, 1], dark=True)
axs[1, 1].set_title("Concept 6 (Dark)", fontsize=11, fontweight='bold', pad=10)

draw_concept_7(axs[1, 2], dark=True)
axs[1, 2].set_title("Concept 7 (Dark)", fontsize=11, fontweight='bold', pad=10)

draw_concept_8(axs[1, 3], dark=True)
axs[1, 3].set_title("Concept 8 (Dark)", fontsize=11, fontweight='bold', pad=10)

plt.tight_layout()
out_file = os.path.join(OUTPUT_DIR, "refined_concepts_sheet.png")
plt.savefig(out_file, bbox_inches='tight', dpi=300)
plt.close()
print(f"Saved refined sheet to: {out_file}")
