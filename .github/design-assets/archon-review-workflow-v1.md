# Archon review workflow v1

- Mode: built-in `image_gen`; final edit uses `transparent_background=false` for an intentional opaque cream artwork panel.
- Classification: `stylized-concept` generation with style/composition references, followed by built-in cleanup edits and a final `precise-object-edit` opaque-background render.
- Final project asset: `public/assets/marketing/archon-review-workflow-v1.webp`.
- Actual dimensions: **2172 × 724**, exact 3:1. Requested target was 1536 × 512; no resizing was applied.
- Encoding: Pillow lossless WebP, `exact=True`, no pixel edits. Final is fully opaque RGB; decoded pixels verified identical to selected generated PNG.
- Selected original: `C:/Users/jigne/.codex/generated_images/01a1e578-96c6-7d23-ad5f-5f315b0a7830/exec-7a038a30-f69c-4154-9923-171951a59019.png`. Original retained.
- Earlier transparent selection: `C:/Users/jigne/.codex/generated_images/01a1e578-96c6-7d23-ad5f-5f315b0a7830/exec-73bf8bde-a87f-4c9f-b240-a83b81ca2ecc.png`. Retained but superseded because alpha fringes were too visible on dark.
- Initial original: `C:/Users/jigne/.codex/generated_images/01a1e578-96c6-7d23-ad5f-5f315b0a7830/exec-8da0f62c-e2dc-442a-9064-7717ab7a194e.png`. Retained.
- Final cleanup trial (not selected): `C:/Users/jigne/.codex/generated_images/01a1e578-96c6-7d23-ad5f-5f315b0a7830/exec-1f46fec7-d0c5-4ac7-afa7-48aa75cd53ef.png`. Retained.
- Visual inspection: exactly five uncropped cream stone object groups, five separate low bases, single orange cable, no captions/arrows/UI. Opaque warm cream backdrop eliminates visible extraction speckles and alpha fringes. Intended for a cream artwork panel in both themes. The generated backdrop is visually near the requested #F5F1EC but not a mathematically uniform exact hex fill; corner RGB samples are (246,239,232), (246,239,231), (245,238,233), and (244,237,229). No manual recoloring applied.
- No team photograph, application source, browser checks, tests, or deployment files changed by this asset task.

## Exact initial prompt

```text
Use case: stylized-concept
Asset type: standalone transparent wide website process artwork, NOT a UI mockup or text diagram.
Primary request: exactly five evenly spaced cream stone architectural objects on five separate small low rectangular stone bases in one horizontal row, connected left-to-right by one small restrained burnt-orange cable.
Input images: Image 1 is a composition and material reference ONLY: use only the five-object architectural row near the bottom, do not reproduce the page, text, people, or photo. Image 2 is a material, lighting and orange-cable style reference ONLY, not the composition.
Subject, exactly left to right: (1) three upright project folders; (2) a stack of two server units with tiny charcoal slots; (3) three connected small processing cubes arranged in a compact stack; (4) a simple three-tier database cylinder; (5) an upright report/document screen with a cream sheet and short abstract charcoal line marks, no readable words, and a tiny orange circular detail.
Style/medium: premium orthographic architectural material illustration, tactile matte cream limestone, very subtle warm grain, softly bevelled solid edges, quiet realistic model-making aesthetic matching the reference.
Composition/framing: very wide 3:1 canvas, target 1536 by 512 pixels. Five equal-width positions centered at 10%, 30%, 50%, 70%, 90% across the usable artwork. All five bases sit on exactly the same horizontal baseline. Similar visual height and scale for all five objects, equal gaps. Entire objects, bases, cable, and soft shadows fully visible with balanced transparent margins. Slight elevated orthographic three-quarter view matching the reference row; no perspective size falloff.
Scene/backdrop: genuine transparent background, clean alpha cutout. No opaque backdrop, no environmental floor plane; only the five separate stone bases and natural soft contact shadows.
Color palette: quiet cream #F5F1EC, charcoal #111111, restrained burnt orange #B23800. Orange only for small cable and tiny connection details.
Lighting/mood: soft natural studio light, understated shadows, readable on both light and dark webpage backgrounds.
Constraints: exactly FIVE object groups and exactly FIVE separate bases. A single thin orange cable enters and leaves each successive object in one horizontal left-to-right sequence, with small circular ports. No extra props. No captions, no labels, no letters, no numbers, no readable text, no arrows, no UI, no website, no watermark, no borders. Do not include or modify any team photo.
Avoid: blue, glowing effects, neon, brains, robots, shields, approval badges, checkmarks, floating UI, sci-fi, shiny plastic, clutter, cropped edges, black or white opaque background.
```

## Exact final opaque-panel edit prompt

```text
Use case: precise-object-edit
Asset type: wide architectural process artwork for an intentional cream website artwork panel.
Input image: the attached five-object cream stone workflow artwork is the edit target.
Primary request: keep the same exact five-object row, orange cable, all object geometry, material appearance, scale, positions and 3:1 wide framing, but render the entire artwork on a solid flat Archon cream #F5F1EC background. This output must be fully opaque. Do NOT do transparency or background extraction.
Critical repair: eliminate ALL white, red and yellow edge noise, stray speckles, fringe artifacts and matte defects. Re-render clean natural antialiased silhouettes against the opaque cream background, not a cutout composited with bad alpha.
Preserve exactly five evenly spaced object groups on five separate low stone bases: upright project folders; two server units; three processing cubes; three-tier database cylinder; report/document screen. Preserve the single restrained burnt-orange connecting cable left-to-right, cream limestone texture, charcoal accents, soft natural contact shadows.
Composition: exact wide 3:1 canvas, everything uncropped with balanced margin. Target 1536 by 512 pixels. Same orthographic slightly elevated camera and one horizontal baseline.
Background: uniform flat #F5F1EC cream across the entire canvas, with no vignette, gradient, black areas, alpha, checkerboard, colored speckles, or extraction fringe. Soft realistic shadows close to the stone bases are allowed.
Constraints: do not add or remove any object, base or cable. No captions, readable words, letters, numbers, arrows, UI, labels, logos, watermarks, blue, glow, brains, robots, shields, badges or checkmarks. No team photograph.
```

## Exact selected cleanup prompt

```text
Use case: background-extraction
Asset type: standalone transparent wide website process artwork.
Input image: Image 1 is the edit target, the generated five-object cream stone workflow artwork.
Primary request: clean up the alpha cutout and remove ALL white, yellow, red and orange speckle/halo noise around the silhouettes and in the transparent negative space. Keep the exact five-object horizontal arrangement, architectural materials, orange cable, proportions and soft contact shadows unchanged.
Composition/framing: maintain the exact wide 3:1 aspect ratio and full uncropped artwork, target 1536 by 512 pixels. Exactly five separate low stone bases on one horizontal baseline, with balanced margin.
Constraints: outside the five cream stone objects, their five stone bases, the one connecting orange cable, and their subtle natural contact shadows, all pixels must be genuinely transparent. Clean antialiased edges with no white matte, black matte or colored fringes, suitable on dark and light backgrounds. Do not alter object geometry or add any elements. No background, floor plane, UI, text, letters, numbers, labels, arrows, logos, watermark, blue, glow, brains, robots, shields, badges or checkmarks.
```

## Exact final cleanup trial prompt (not selected)

```text
Use case: background-extraction
Edit the attached artwork only. Preserve the exact five cream-stone objects, five bases, orange cable, 3:1 canvas, scale and composition.
Remove all transparent-background extraction defects: every stray red/yellow/white speckle, every white jagged silhouette edge, and every colored fringe above or between objects. Render the silhouettes with clean, smooth, neutral antialiased alpha. The cable itself remains burnt orange but its fringe must have no yellow/red noise. Preserve only tight natural soft shadows under the five bases; all other negative space must be fully transparent alpha=0.
No additional objects, no labels, no words, no symbols, no opaque backdrop. Make this a production-ready clean transparent PNG cutout for use over both cream and charcoal backgrounds.
```

