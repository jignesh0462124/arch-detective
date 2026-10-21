# Archon refined identity

A vector logo created for the current Archon product, formerly called ThreatLens in the research material. The design follows the existing interface palette and editorial style inspected in `src/styles.css`, `src/routes/index.tsx`, and the marketing and brand components.

The symbol combines an architectural arch with an A-shaped silhouette. The orange square is an inspection point beneath the crossbar. The wordmark consists of six custom vector glyphs. The logo assets have no font dependency, gradients, filters, embedded images, or external references.

## Assets

- `archon-wordmark.svg` and `.png`: primary transparent horizontal logo.
- `archon-wordmark-inverse.svg` and `.png`: cream and orange for dark surfaces.
- `archon-wordmark-mono.svg` and `.png`: single-color horizontal logo.
- `archon-mark.svg` and `.png`: standalone symbol on transparency.
- `archon-mark-inverse.svg` and `.png`: standalone symbol for dark surfaces.
- `archon-mark-mono.svg` and `.png`: single-color symbol.
- `archon-app-icon.svg` and `.png`: cream and orange on a charcoal tile.
- `archon-identity-preview.svg` and `.png`: presentation sheet showing applications and palette.
- `archon-size-check.png`: interface size specimens.

Horizontal PNGs are 2688 by 512 pixels; standalone PNGs are 1024 by 1024 pixels. The identity preview is 2400 by 1680 pixels. SVGs scale without resolution limits.

## Usage

Use ink `#111111` on cream `#F5F1EC` or white. Use the inverse variant on dark surfaces. The accent is the UI's orange `#FF5600`.

Keep clear space of at least one-quarter of the symbol's width on every side. Prefer at least 24 CSS pixels for the symbol and 168 CSS pixels for the horizontal logo. Use the standalone mark for narrow sidebars and app tiles. Use the monochrome variant for one-color printing. Keep the orange square separate from the crossbar and preserve all negative spaces.

These are new assets for review; the active application logo and favicon have not been replaced.

The reproducible source is `scripts/create-refined-archon-logo.cjs`.
