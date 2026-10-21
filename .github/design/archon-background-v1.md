# Archon organic background — v1

Original background artwork for the application canvas and advisor/chat surfaces. Created with the built-in image generation tool, then encoded as WebP without resizing or changing the composition. The WebP assets are now applied to the shared application content canvas in both themes.

## Deliverables

| Theme | Production asset | Dimensions | Transfer size | Original |
| --- | --- | --- | --- | --- |
| Light | [archon-organic-light-v1.webp](../../public/assets/backgrounds/archon-organic-light-v1.webp) | 1672 × 941 | 32,784 bytes | [PNG](backgrounds/archon-organic-light-v1.png) |
| Dark | [archon-organic-dark-v1.webp](../../public/assets/backgrounds/archon-organic-dark-v1.webp) | 1672 × 941 | 24,564 bytes | [PNG](backgrounds/archon-organic-dark-v1.png) |

Public URLs:

- `/assets/backgrounds/archon-organic-light-v1.webp`
- `/assets/backgrounds/archon-organic-dark-v1.webp`

## Design direction

The project's current CSS tokens and actual SVG mark were the primary references: cream `#F5F1EC`, white cards, charcoal type, warm hairlines `#D3CEC6`, and signal orange `#FF5600`. The current mark uses an architectural arch, which appears as a small background motif rather than a repeated logo.

Fine contour lines introduce an organic rhythm. Small arches, inspection lenses, graph nodes, brackets, shields and documents connect the illustration to the project's audit purpose. Orange is limited to tiny points. Most detail sits toward the perimeter, leaving the middle quiet for content. Both themes retain the same composition.

This is a full-canvas illustration, **not a seamless repeating tile**. Do not repeat it or stretch it independently along each axis.

## Research references

- [WhatsApp — app and chat themes](https://faq.whatsapp.com/6298875896807790/?cms_platform=android&locale=en_US): reference for pairing a wallpaper with the foreground interface. The artwork and icon arrangements were not copied.
- [Material Design — color roles and surfaces](https://m3.material.io/styles/color/the-color-system): reference for keeping the background a low-emphasis surface beneath content containers.
- [Intercom — how and why the brand was refreshed](https://www.intercom.com/blog/how-and-why-we-refreshed-our-brand): reference for a coherent editorial identity with warm visual personality. The project's existing Intercom-inspired design tokens remain the actual palette source.
- Visual research also compared low-contrast messaging doodles and organic contour patterns. No third-party wallpaper was downloaded, bundled or used as a generation input.

## Placement in the application

The shared `AppShell` main area uses `.archon-app-canvas` from `src/styles.css`. The light and dark images switch with the existing theme. The image is clipped to the content area and anchored to the viewport, so long dashboards do not stretch it vertically. Navigation, menus, code editors, tables and cards keep their existing solid surfaces. The artwork is decorative CSS and is not announced to screen readers.

Existing CSS:

```css
.archon-app-canvas {
  background-color: var(--background);
  background-image: url('/assets/backgrounds/archon-organic-light-v1.webp');
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  background-attachment: fixed;
}

[data-theme='dark'] .archon-app-canvas {
  background-image: url('/assets/backgrounds/archon-organic-dark-v1.webp');
}
```

On mobile, a centred crop is appropriate; the quiet centre means some perimeter motifs may be cropped. Keep foreground surfaces opaque for text contrast.

## Generation prompts

### Light master — new generation

> Use case: stylized-concept. Asset type: production background wallpaper for Archon, a professional security code-audit web application. Generate a single original wide landscape 16:9 background image, no UI, no mockup, no text. This will sit BEHIND dense white cards, tables and readable chat messages, so it must be extremely quiet and restrained. Design: warm ivory cream canvas precisely inspired by #F5F1EC, with fine warm gray-beige linework inspired by #D3CEC6 at very low contrast. An elegant hand-composed, organic, airy pattern: a few softly wandering topographic contour strands and discreet small monoline motifs drawn with subtly imperfect human rhythm. Motifs should relate naturally to code review and architectural inspection: tiny architectural arch outlines, small graph nodes joined by one or two curved paths, code brackets, inspection lens circles, a few simple shield outlines and rounded document corners. Sparse, carefully spaced, no symbol larger than about 3 percent of canvas width; roughly 18 to 24 subtle motifs total, with ample breathing room. Contours occupy some peripheral areas and gently dissolve into open space; quieter broad center but not a blank framed box. Almost invisible matte paper fibers, very fine, absolutely no stains. A few microscopic muted terracotta-orange details related to #FF5600, less than 0.3 percent of total area, softened to match the quiet contrast. The composition feels like bespoke editorial stationery designed by a skilled product designer: natural, calm, understated, precise, aesthetically coherent. Flat 2D artwork, consistent fine strokes, softly irregular distribution. No words, no letters, no numbers, no branding or logos, no watermark, no rendered devices, no fake interface, no 3D, no glows, no gradients or colored blobs, no circuit-board maze, no dense doodles, no large locks, no robots, no heavy black marks, no border. It should look calm and professional at full opacity as a page background, with pattern contrast low enough that dark text can remain readable over it. Deliver only the finished background image filling the entire canvas edge to edge.

### Dark companion — palette edit of the light master

Input: the generated light master above.

> Create the coordinated DARK THEME version of this exact Archon background wallpaper. This is a precise palette-only edit: preserve every contour curve, architectural arch, node, document, shield, lens, spacing, placement, line weight and broad quiet center of the reference. Keep original landscape aspect ratio and resolution. Replace the warm cream background with uniform near-black warm charcoal, approximately #111110 / #191918, preserving a barely perceptible fine matte paper grain. Recolor the fine gray-beige pattern to very subtle warm charcoal-gray linework approximately #2C2C29 to #353530, low contrast and unobtrusive. Recolor the tiny orange dots to restrained burnt signal orange approximately #B15C31, absolutely no glow. This is a professional security app background behind charcoal cards and white text, so keep it exceptionally quiet and flat. No new objects, no new text, no added logos, no frame, no vignette, no gradients, no neon, no 3D effects, no high contrast highlights, no blue or purple. Deliver only the finished edge-to-edge dark wallpaper.

## Asset checks

- Both decoded WebP files were visually inspected after encoding.
- Resolution and composition are preserved from the PNG masters.
- Combined WebP transfer size is 57,348 bytes, approximately 56 KiB.
- No application logic, database policy or dependency was changed; only the shared content canvas now uses the theme-matched artwork.
