"""
Export All Production Brand Assets for Archon / ThreatLens.
Generates:
1. docs/logo.png (512x512 high-res primary logo for GitHub README)
2. public/icon-512.png (512x512 PWA webmanifest icon)
3. public/icon-192.png (192x192 PWA webmanifest icon)
4. public/apple-touch-icon.png (180x180 iOS touch icon)
5. public/favicon.png (64x64 / 32x32 retina favicon)
6. public/favicon.svg (Adaptive light/dark vector SVG favicon)
7. docs/brand/archon-mark.svg (Master light SVG)
8. docs/brand/archon-mark-inverse.svg (Master dark SVG)
9. docs/brand/archon-mark-mono.svg (Master monochrome SVG)
10. docs/brand/archon-wordmark.svg (Master horizontal lockup light)
11. docs/brand/archon-wordmark-inverse.svg (Master horizontal lockup dark)
12. docs/brand/archon-logo-sheet.png (Updated identity showcase sheet)
"""
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.path import Path
import numpy as np

# -------------------------------------------------------------------------
# Vector Path Data
# -------------------------------------------------------------------------
raw_shield_verts = [
    (24, 7), (40, 7), (53, 14.5), (53, 30.5),
    (53, 44.5), (44.2, 54.7), (32, 58),
    (19.8, 54.7), (11, 44.5), (11, 30.5),
    (11, 14.5), (24, 7)
]
shield_codes = [
    Path.MOVETO, Path.LINETO, Path.LINETO, Path.LINETO,
    Path.CURVE4, Path.CURVE4, Path.CURVE4,
    Path.CURVE4, Path.CURVE4, Path.CURVE4,
    Path.LINETO, Path.CLOSEPOLY
]

chev_pts = np.array([
    [32, 14.5], [43.5, 25.5], [38, 25.5], [32, 19.8], [26, 25.5], [20.5, 25.5]
])

def render_standalone_mark(ax, dark=False, mono=False, transparent=True):
    bg_c = '#111111' if dark else '#FFFFFF'
    fg_c = '#FFFFFF' if dark else '#111111'
    fill_c = (1.0, 1.0, 1.0, 0.05) if dark else (0.07, 0.07, 0.07, 0.04)
    accent_c = fg_c if mono else '#FF5600'
    pupil_c = bg_c
    
    if transparent:
        ax.set_facecolor('none')
    else:
        ax.set_facecolor(bg_c)
        
    ax.set_xlim(0, 64)
    ax.set_ylim(64, 0)
    ax.axis('off')
    
    # Shield Path
    shield_path = Path(raw_shield_verts, shield_codes)
    patch = patches.PathPatch(shield_path, facecolor=fill_c, edgecolor=fg_c,
                              linewidth=3.2, zorder=3, joinstyle='round', capstyle='round')
    ax.add_patch(patch)
    
    # Chevron Apex 'A'
    ax.add_patch(patches.Polygon(chev_pts, closed=True, facecolor=fg_c, edgecolor='none', zorder=4))
    
    # Dashed Radar Arc
    arc_center = (32, 33.5)
    arc_r = 9.0
    theta = np.linspace(np.pi, 2*np.pi, 30)
    arc_x = arc_center[0] + arc_r * np.cos(theta)
    arc_y = arc_center[1] - arc_r * np.sin(theta)
    ax.plot(arc_x, arc_y, color=fg_c, linewidth=1.5, linestyle='--', alpha=0.45, zorder=3)
    
    # Horizontal horizon scan line
    ax.plot([16, 23.5], [33.5, 33.5], color=accent_c, linewidth=3.0, solid_capstyle='round', zorder=5)
    ax.plot([40.5, 48], [33.5, 33.5], color=accent_c, linewidth=3.0, solid_capstyle='round', zorder=5)
    
    # Vertical axis ticks
    ax.plot([32, 32], [26, 29.5], color=accent_c, linewidth=2.4, solid_capstyle='round', zorder=5)
    ax.plot([32, 32], [37.5, 42.5], color=accent_c, linewidth=2.4, solid_capstyle='round', zorder=5)
    
    # Center Signal Core Lens
    ax.add_patch(patches.Circle((32, 33.5), 4.2, facecolor=accent_c, edgecolor='none', zorder=6))
    ax.add_patch(patches.Circle((32, 33.5), 1.6, facecolor=pupil_c, edgecolor='none', zorder=7))

def render_tile_icon(ax, size=512, dark_tile=True):
    ax.set_xlim(0, 64)
    ax.set_ylim(64, 0)
    ax.axis('off')
    
    tile_bg = '#111111' if dark_tile else '#FFFFFF'
    fg_c = '#FFFFFF' if dark_tile else '#111111'
    fill_c = (1.0, 1.0, 1.0, 0.06) if dark_tile else (0.07, 0.07, 0.07, 0.04)
    accent_c = '#FF5600'
    pupil_c = tile_bg
    
    # Squircle Tile
    tile = patches.FancyBboxPatch((2, 2), 60, 60, boxstyle="round,pad=0,rounding_size=14",
                                 facecolor=tile_bg, edgecolor='none', zorder=1)
    ax.add_patch(tile)
    
    scale = 0.84
    dx = 32 * (1 - scale)
    dy = 32 * (1 - scale)
    
    # Transform vertices
    t_verts = [(x * scale + dx, y * scale + dy) for x, y in raw_shield_verts]
    shield_path = Path(t_verts, shield_codes)
    patch = patches.PathPatch(shield_path, facecolor=fill_c, edgecolor=fg_c,
                              linewidth=3.2 * scale, zorder=3, joinstyle='round', capstyle='round')
    ax.add_patch(patch)
    
    # Chevron
    t_chev = chev_pts * scale + np.array([dx, dy])
    ax.add_patch(patches.Polygon(t_chev, closed=True, facecolor=fg_c, edgecolor='none', zorder=4))
    
    # Dashed Radar Arc
    arc_center = (32, 33.5 * scale + dy)
    arc_r = 9.0 * scale
    theta = np.linspace(np.pi, 2*np.pi, 30)
    arc_x = arc_center[0] + arc_r * np.cos(theta)
    arc_y = arc_center[1] - arc_r * np.sin(theta)
    ax.plot(arc_x, arc_y, color=fg_c, linewidth=1.5 * scale, linestyle='--', alpha=0.45, zorder=3)
    
    # Horizon
    h_y = 33.5 * scale + dy
    ax.plot([16 * scale + dx, 23.5 * scale + dx], [h_y, h_y],
            color=accent_c, linewidth=3.0 * scale, solid_capstyle='round', zorder=5)
    ax.plot([40.5 * scale + dx, 48 * scale + dx], [h_y, h_y],
            color=accent_c, linewidth=3.0 * scale, solid_capstyle='round', zorder=5)
    
    # Vertical axis ticks
    ax.plot([32, 32], [26 * scale + dy, 29.5 * scale + dy],
            color=accent_c, linewidth=2.4 * scale, solid_capstyle='round', zorder=5)
    ax.plot([32, 32], [37.5 * scale + dy, 42.5 * scale + dy],
            color=accent_c, linewidth=2.4 * scale, solid_capstyle='round', zorder=5)
    
    # Core Lens
    ax.add_patch(patches.Circle((32, h_y), 4.2 * scale, facecolor=accent_c, edgecolor='none', zorder=6))
    ax.add_patch(patches.Circle((32, h_y), 1.6 * scale, facecolor=pupil_c, edgecolor='none', zorder=7))

# -------------------------------------------------------------------------
# 1. Export docs/logo.png (512x512 transparent primary mark)
# -------------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(5.12, 5.12), dpi=100)
fig.patch.set_alpha(0.0)
render_standalone_mark(ax, dark=False, transparent=True)
plt.savefig("docs/logo.png", dpi=100, bbox_inches='tight', pad_inches=0.1, transparent=True)
plt.close(fig)
print("Saved docs/logo.png")

# -------------------------------------------------------------------------
# 2. Export public/icon-512.png & public/icon-192.png (PWA icons with squircle tile)
# -------------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(5.12, 5.12), dpi=100)
fig.patch.set_alpha(0.0)
render_tile_icon(ax, size=512, dark_tile=True)
plt.savefig("public/icon-512.png", dpi=100, bbox_inches='tight', pad_inches=0, transparent=True)
plt.close(fig)

fig, ax = plt.subplots(figsize=(1.92, 1.92), dpi=100)
fig.patch.set_alpha(0.0)
render_tile_icon(ax, size=192, dark_tile=True)
plt.savefig("public/icon-192.png", dpi=100, bbox_inches='tight', pad_inches=0, transparent=True)
plt.close(fig)

fig, ax = plt.subplots(figsize=(1.8, 1.8), dpi=100)
fig.patch.set_alpha(0.0)
render_tile_icon(ax, size=180, dark_tile=True)
plt.savefig("public/apple-touch-icon.png", dpi=100, bbox_inches='tight', pad_inches=0, transparent=True)
plt.close(fig)

fig, ax = plt.subplots(figsize=(0.64, 0.64), dpi=100)
fig.patch.set_alpha(0.0)
render_tile_icon(ax, size=64, dark_tile=True)
plt.savefig("public/favicon.png", dpi=100, bbox_inches='tight', pad_inches=0, transparent=True)
plt.close(fig)
print("Saved public icons (512, 192, apple-touch, favicon.png)")

# -------------------------------------------------------------------------
# 3. Export public/favicon.svg (Adaptive light/dark vector SVG favicon)
# -------------------------------------------------------------------------
favicon_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <style>
    .tile { fill: #111111; }
    .fg { stroke: #FFFFFF; fill: rgba(255,255,255,0.06); }
    .fg-fill { fill: #FFFFFF; }
    .pupil { fill: #111111; }
    @media (prefers-color-scheme: dark) {
      .tile { fill: #FFFFFF; }
      .fg { stroke: #111111; fill: rgba(17,17,17,0.06); }
      .fg-fill { fill: #111111; }
      .pupil { fill: #FFFFFF; }
    }
  </style>
  <!-- Squircle Tile -->
  <rect class="tile" x="2" y="2" width="60" height="60" rx="14"/>
  
  <g transform="translate(4, 2) scale(0.875)">
    <!-- Outer Defensive Shield -->
    <path class="fg" d="M24 7h16l13 7.5v16c0 14-8.8 24.2-21 27.5-12.2-3.3-21-13.5-21-27.5v-16L24 7Z"
          stroke-width="3.2" stroke-linejoin="round"/>
    
    <!-- Architectural 'A' Chevron Apex -->
    <path class="fg-fill" d="M32 14.5L43.5 25.5H38L32 19.8L26 25.5H20.5L32 14.5Z"/>
    
    <!-- Radar Arc -->
    <path class="fg" d="M23 33.5a9 9 0 0 1 18 0" stroke-width="1.8" stroke-dasharray="2.5 2.5" opacity="0.45"/>
    
    <!-- Signal Orange Scan Horizon -->
    <path d="M16 33.5h7.5M40.5 33.5H48" stroke="#FF5600" stroke-width="3" stroke-linecap="round"/>
    
    <!-- Vertical Calibration Axis -->
    <path d="M32 26v3.5M32 37.5v5" stroke="#FF5600" stroke-width="2.5" stroke-linecap="round"/>
    
    <!-- Signal Core Lens -->
    <circle cx="32" cy="33.5" r="4.2" fill="#FF5600"/>
    <circle class="pupil" cx="32" cy="33.5" r="1.6"/>
  </g>
</svg>"""

with open("public/favicon.svg", "w", encoding="utf-8") as f:
    f.write(favicon_svg.strip())
print("Saved public/favicon.svg")

# -------------------------------------------------------------------------
# 4. Export docs/brand/ master SVGs
# -------------------------------------------------------------------------
brand_mark_light = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" role="img" aria-labelledby="title">
  <title id="title">Archon</title>
  <path d="M24 7h16l13 7.5v16c0 14-8.8 24.2-21 27.5-12.2-3.3-21-13.5-21-27.5v-16L24 7Z"
        fill="#111111" fill-opacity="0.05" stroke="#111111" stroke-width="3.2" stroke-linejoin="round"/>
  <path d="M32 14.5L43.5 25.5H38L32 19.8L26 25.5H20.5L32 14.5Z" fill="#111111"/>
  <path d="M23 33.5a9 9 0 0 1 18 0" stroke="#111111" stroke-width="1.8" stroke-dasharray="2.5 2.5" stroke-opacity="0.45"/>
  <path d="M16 33.5h7.5M40.5 33.5H48" stroke="#FF5600" stroke-width="3" stroke-linecap="round"/>
  <path d="M32 26v3.5M32 37.5v5" stroke="#FF5600" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="32" cy="33.5" r="4.2" fill="#FF5600"/>
  <circle cx="32" cy="33.5" r="1.6" fill="#FFFFFF"/>
</svg>"""

brand_mark_dark = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" role="img" aria-labelledby="title">
  <title id="title">Archon</title>
  <path d="M24 7h16l13 7.5v16c0 14-8.8 24.2-21 27.5-12.2-3.3-21-13.5-21-27.5v-16L24 7Z"
        fill="#FFFFFF" fill-opacity="0.06" stroke="#FFFFFF" stroke-width="3.2" stroke-linejoin="round"/>
  <path d="M32 14.5L43.5 25.5H38L32 19.8L26 25.5H20.5L32 14.5Z" fill="#FFFFFF"/>
  <path d="M23 33.5a9 9 0 0 1 18 0" stroke="#FFFFFF" stroke-width="1.8" stroke-dasharray="2.5 2.5" stroke-opacity="0.45"/>
  <path d="M16 33.5h7.5M40.5 33.5H48" stroke="#FF5600" stroke-width="3" stroke-linecap="round"/>
  <path d="M32 26v3.5M32 37.5v5" stroke="#FF5600" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="32" cy="33.5" r="4.2" fill="#FF5600"/>
  <circle cx="32" cy="33.5" r="1.6" fill="#111111"/>
</svg>"""

brand_mark_mono = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" role="img" aria-labelledby="title">
  <title id="title">Archon</title>
  <path d="M24 7h16l13 7.5v16c0 14-8.8 24.2-21 27.5-12.2-3.3-21-13.5-21-27.5v-16L24 7Z"
        fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/>
  <path d="M32 14.5L43.5 25.5H38L32 19.8L26 25.5H20.5L32 14.5Z" fill="currentColor"/>
  <path d="M23 33.5a9 9 0 0 1 18 0" stroke="currentColor" stroke-width="1.8" stroke-dasharray="2.5 2.5" stroke-opacity="0.45"/>
  <path d="M16 33.5h7.5M40.5 33.5H48" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  <path d="M32 26v3.5M32 37.5v5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="32" cy="33.5" r="4.2" fill="currentColor"/>
  <circle cx="32" cy="33.5" r="1.6" fill="var(--color-card, #FFFFFF)"/>
</svg>"""

wordmark_light = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 64" fill="none" role="img" aria-labelledby="title">
  <title id="title">Archon Wordmark</title>
  <!-- Mark Lockup -->
  <g transform="translate(4, 0)">
    <path d="M24 7h16l13 7.5v16c0 14-8.8 24.2-21 27.5-12.2-3.3-21-13.5-21-27.5v-16L24 7Z"
          fill="#111111" fill-opacity="0.05" stroke="#111111" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M32 14.5L43.5 25.5H38L32 19.8L26 25.5H20.5L32 14.5Z" fill="#111111"/>
    <path d="M23 33.5a9 9 0 0 1 18 0" stroke="#111111" stroke-width="1.8" stroke-dasharray="2.5 2.5" stroke-opacity="0.45"/>
    <path d="M16 33.5h7.5M40.5 33.5H48" stroke="#FF5600" stroke-width="3" stroke-linecap="round"/>
    <path d="M32 26v3.5M32 37.5v5" stroke="#FF5600" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="32" cy="33.5" r="4.2" fill="#FF5600"/>
    <circle cx="32" cy="33.5" r="1.6" fill="#FFFFFF"/>
  </g>
  <!-- Typography Lockup -->
  <text x="80" y="37" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="700" fill="#111111" letter-spacing="-0.02em">ARCHON</text>
  <rect x="80" y="44" width="16" height="3" rx="1.5" fill="#FF5600"/>
  <text x="103" y="47.5" font-family="Inter, system-ui, sans-serif" font-size="9" font-weight="600" fill="#626260" letter-spacing="0.14em">AUDIT ENGINE</text>
</svg>"""

wordmark_dark = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 64" fill="none" role="img" aria-labelledby="title">
  <title id="title">Archon Wordmark</title>
  <!-- Mark Lockup -->
  <g transform="translate(4, 0)">
    <path d="M24 7h16l13 7.5v16c0 14-8.8 24.2-21 27.5-12.2-3.3-21-13.5-21-27.5v-16L24 7Z"
          fill="#FFFFFF" fill-opacity="0.06" stroke="#FFFFFF" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M32 14.5L43.5 25.5H38L32 19.8L26 25.5H20.5L32 14.5Z" fill="#FFFFFF"/>
    <path d="M23 33.5a9 9 0 0 1 18 0" stroke="#FFFFFF" stroke-width="1.8" stroke-dasharray="2.5 2.5" stroke-opacity="0.45"/>
    <path d="M16 33.5h7.5M40.5 33.5H48" stroke="#FF5600" stroke-width="3" stroke-linecap="round"/>
    <path d="M32 26v3.5M32 37.5v5" stroke="#FF5600" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="32" cy="33.5" r="4.2" fill="#FF5600"/>
    <circle cx="32" cy="33.5" r="1.6" fill="#111111"/>
  </g>
  <!-- Typography Lockup -->
  <text x="80" y="37" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="700" fill="#FFFFFF" letter-spacing="-0.02em">ARCHON</text>
  <rect x="80" y="44" width="16" height="3" rx="1.5" fill="#FF5600"/>
  <text x="103" y="47.5" font-family="Inter, system-ui, sans-serif" font-size="9" font-weight="600" fill="#A8A8A3" letter-spacing="0.14em">AUDIT ENGINE</text>
</svg>"""

with open("docs/brand/archon-mark.svg", "w", encoding="utf-8") as f:
    f.write(brand_mark_light.strip())

with open("docs/brand/archon-mark-inverse.svg", "w", encoding="utf-8") as f:
    f.write(brand_mark_dark.strip())

with open("docs/brand/archon-mark-mono.svg", "w", encoding="utf-8") as f:
    f.write(brand_mark_mono.strip())

with open("docs/brand/archon-wordmark.svg", "w", encoding="utf-8") as f:
    f.write(wordmark_light.strip())

with open("docs/brand/archon-wordmark-inverse.svg", "w", encoding="utf-8") as f:
    f.write(wordmark_dark.strip())

# Copy master showcase to docs/brand/archon-logo-sheet.png
import shutil
shutil.copy2("docs/brand/archon_master_brand_showcase.png", "docs/brand/archon-logo-sheet.png")

print("All production brand assets successfully generated and exported!")
