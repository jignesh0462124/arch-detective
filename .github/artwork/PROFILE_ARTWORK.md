# Profile artwork

Ten original raster assets for Archon's profile picker. Created with the built-in
image-generation tool on 15 November 2026, then resized and JPEG-encoded for the web.
These are generated illustrations, not photographs or claims of handmade artwork.
The supplied robot reference informed the broad subject only; its composition,
watermark and branding were not copied.

## Shared direction and prompt set

Mode: new image generation, one asset per request. Shared direction: restrained
industrial field-guide illustration, cream paper, charcoal ink, muted burnt-orange
accents, fine outline work and subtle screen-print grain. No text, lettering,
watermarks, sparkle motifs, neon, gradients or glossy three-dimensional styling.
Portraits use a centered, readable silhouette with generous safe space. Covers
use a quiet left side and a three-to-one panoramic composition.

| Asset | Individual prompt direction |
| --- | --- |
| Sentinel | Rectangular cream robot head, dark visor, two cream eyes, orange antenna and shoulders. |
| Scout | Rounded cream capsule face, circular charcoal eyes, orange forehead stripe and ear bolts. |
| Relay portrait | Horizontal oval head, dark visor, cream dash eyes, orange side modules. |
| Rover | Three-quarter trapezoid cream head, circular eyes, orange side aerial and ribbed neck. |
| Keeper | Softly hexagonal head, dark face, oval cream eyes, orange cheek discs and chest detail. |
| Contour | Charcoal paper, sparse cream contour lines and one muted-orange route. |
| Workshop | Cream paper with an isometric robot-parts workbench concentrated on the right. |
| Relay cover | Minimal cream schematic with charcoal and orange orthogonal paths. |
| Paper | Cream and charcoal editorial paper-plane geometry with an orange quarter circle. |
| Foundry | Charcoal paper, sparse cream isometric stacked blocks on the right, one orange block. |

## Application assets and behavior

- `public/profile-art/avatar-{sentinel,scout,relay,rover,keeper}.jpg`: 512 × 512.
- `public/profile-art/cover-{contour,workshop,relay,paper,foundry}.jpg`: 1,600 px wide, approximately 3:1.
- All ten assets together are under 1 MiB. No image library or runtime dependency was added.
- Profile → Change image / Change cover → choose → Save. Previewing does not save.
- Preset IDs are whitelisted. Only cosmetic fields `archon_avatar_preset` and
  `archon_cover_preset` are written through the existing authenticated SDK.
- Original account photos, initials and existing cover artwork remain available.
- These fields must never be used for permissions or authorization. No schema,
  RLS, scan-pipeline or credential changes are required.

## Verification

Focused automated coverage lives in `tests/profile-appearance.test.mjs`: asset
availability/bounds, preset validation, original-photo behavior, confirmed saves,
failed writes and stale-account rejection. Browser review covers selection without
saving, Escape/focus restoration, scrollable choices, fixed Save controls, both
themes and a 390 px viewport. Tests use an isolated SDK fixture, not a production
account write.

Verification on 15 November 2026:

- 36 focused profile/auth/navigation/settings/history tests passed.
- TypeScript and lint for all task-modified source/test files passed.
- Production client/server build and client-secret check passed.
- Local profile route and avatar asset returned HTTP 200.
- Browser: desktop and 390 × 844, light/dark; selection, Escape, restored focus,
  scrollable grid, visible Save control, workspace menu and Advisor open/close.
  No browser console errors were observed. No live profile Save was submitted.
- Full-repository lint is not clean: 514 existing formatting errors in untouched
  `.github/Security Skill` validators and `tmp/thesis-figures-20261112` scripts,
  plus one existing auth-preview warning. They were not reformatted in this task.

## Changed-file map

| File or group | Purpose |
| --- | --- |
| `src/lib/profileAppearance.ts` | Whitelisted presets, original-photo/legacy-cover compatibility, initials. |
| `src/lib/api/profileAppearance.ts` | Account-scoped cosmetic update with confirmed success and stale-response rejection. |
| `src/components/profile/ProfileAvatar.tsx` | Reusable image with neutral initials fallback. |
| `src/components/profile/ProfileArtworkPicker.tsx` | Responsive, keyboard-accessible preview-and-save dialog. |
| `src/routes/_app/profile.tsx` | Profile image/cover selection and confirmed feedback; existing session controls preserved. |
| `src/components/auth/AccountMenu.tsx` | Show the chosen image in the existing account control. |
| `src/components/brutal/AppShell.tsx` | Selected sidebar image and neutral Advisor toolbar icon. |
| `src/components/workspace-switcher.tsx` | Neutral tiles and truthful workspace total; selection logic unchanged. |
| `tests/profile-appearance.test.mjs` | Six focused regression tests; no real account mutations. |
| `public/profile-art/*.jpg` | Five portraits and five optimized covers; no old assets removed. |
| `.github/artwork/PROFILE_ARTWORK.md` | Artwork direction, usage, implementation and verification notes. |

Existing backend-launcher/deployment worktree changes were preserved. Nothing was
committed, pushed or deployed as part of the profile-artwork task.
