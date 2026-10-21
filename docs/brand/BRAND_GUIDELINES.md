# Archon Brand & Identity System

## 1. Visual Identity Overview
**Archon** (*formerly ThreatLens / Arch Detective*) is an automated audit engine and agentic compliance platform designed for engineering teams navigating SOC 2, HIPAA, ISO 27001, and CVSS threat modeling.

The new identity — **"The Sovereign Sentinel"** — was mathematically constructed to embody architectural rigor, continuous automated inspection, and cryptographic defense. It strictly adheres to the project's Intercom-inspired editorial aesthetic: quiet, high-contrast, confident, and free of generic AI-generated artifacts.

---

## 2. Symbolic Anatomy

| Component | Visual Geometry | Conceptual Meaning |
|---|---|---|
| **Defensive Crest** | Chamfered aerospace polygon (`24 7 h16 l13 7.5...`) | Structural stability, architectural trust, and boundary enforcement. |
| **Chevron Apex** | Pure 45° structural triangle (`M32 14.5 L43.5 25.5...`) | The capital letter **'A'** representing **Archon** and software architecture. |
| **Radar Horizon Sweep** | Monoline dashed scanning arc (`M23 33.5 a9 9 0 0 1 18 0`) | Continuous topological graph traversal, dependency mapping, and log anomaly detection. |
| **Calibration Crosshair** | Precision cardinal horizontal & vertical ticks | Forensic alignment, zero-false-positive targeting, and CVSS scoring precision. |
| **Optical Core Lens** | Concentric dual-radius sensor pupil (`r = 4.2` / `r = 1.6`) | Autonomous agentic reasoning eye inspecting ASTs, security vulnerabilities, and code paths. |

---

## 3. Brand Color Palette

| Token Name | HEX Code | CSS Variable | Semantic Usage |
|---|---|---|---|
| **Deep Ink** | `#111111` | `--foreground`, `--primary` (light) | Primary typography, mark silhouette, high-contrast dark surfaces. |
| **Signal Orange** | `#FF5600` | `--brand-accent` | Primary brand punch, reticle crosshair, radar sweep, critical detections. |
| **Cream Canvas** | `#F5F1EC` | `--background` | Warm editorial background inspired by modern Swiss/Intercom product UI. |
| **Pure Surface** | `#FFFFFF` | `--card`, `--surface` | Elevated card surfaces, light contrast containers, dark mode inversion. |
| **Quiet Hairline** | `#D3CEC6` | `--border` | Structural 1px division rules, table grids, and bounding containers. |
| **Dark Canvas** | `#000000` / `#191918` | `--background` (dark) | Deep night mode audit workspace background. |

---

## 4. Production Assets Catalog

All production vector and raster assets are located in `docs/brand/` and `public/`:

- **Main Repository Emblem:** [`docs/logo.png`](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/docs/logo.png) (512×512 transparent PNG)
- **Brand Identity Sheet:** [`docs/brand/archon-logo-sheet.png`](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/docs/brand/archon-logo-sheet.png)
- **Vector Light Mark:** [`docs/brand/archon-mark.svg`](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/docs/brand/archon-mark.svg)
- **Vector Dark Mark:** [`docs/brand/archon-mark-inverse.svg`](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/docs/brand/archon-mark-inverse.svg)
- **Monochrome Vector Mark:** [`docs/brand/archon-mark-mono.svg`](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/docs/brand/archon-mark-mono.svg)
- **Vector Wordmark (Light):** [`docs/brand/archon-wordmark.svg`](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/docs/brand/archon-wordmark.svg)
- **Vector Wordmark (Dark):** [`docs/brand/archon-wordmark-inverse.svg`](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/docs/brand/archon-wordmark-inverse.svg)
- **Web Favicon (Adaptive SVG):** [`public/favicon.svg`](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/public/favicon.svg)
- **PWA & Mobile App Icons:**
  - `public/icon-512.png` (512×512 HD PWA Icon)
  - `public/icon-192.png` (192×192 Standard PWA Icon)
  - `public/apple-touch-icon.png` (180×180 iOS App Icon)
  - `public/favicon.png` (64×64 Fallback Favicon)

---

## 5. UI Component Usage

The mark is directly integrated in React via [`src/components/ui/ArchonLogo.tsx`](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/src/components/ui/ArchonLogo.tsx) and wrapped within the unified brand header lockup [`src/components/ui/ArchonWordmark.tsx`](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/src/components/ui/ArchonWordmark.tsx).

```tsx
import { ArchonLogo } from "@/components/ui/ArchonLogo";

// Standard brand reticle
<ArchonLogo size={24} variant="brand" />

// Monochromatic mode (inherits current text color)
<ArchonLogo size={20} variant="mono" />
```
