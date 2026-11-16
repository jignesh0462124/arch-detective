# Team, Privacy and Terms — implementation verification

Date: 2026-11-16

## Scope

Implemented the approved Team, Privacy and Terms compositions as responsive application pages. Team is next to About in desktop/mobile marketing navigation. About and Team reuse a five-stage illustrated review workflow. The privacy and terms documents share their actual disclosure content with Settings.

The preceding authentication-layout QA report is preserved verbatim at `.github/design-assets/auth-design-qa-20261116.md`.

## Source visual truth

All three source images are 1003 × 1568 pixels, under `C:/Users/jigne/.codex/generated_images/01a14884-7256-79b3-83a0-d85a3174c02c/`:

- Team: `exec-dc46ffd5-fd5b-4e32-9044-78883815645f.png`.
- Privacy: `exec-e720b1bc-38a2-4935-b850-f7239c4b7f99.png`.
- Terms: `exec-294e6ec5-6075-4ead-a496-774c7d52dea8.png`.

The user's later instruction to keep the photograph unedited takes precedence over the generated Team preview. The original JPEG was copied byte-for-byte, never regenerated, retouched or cropped. Its GPS/weather overlay remains visible. SHA256: `447ae6ce5be1e78a39b40243308ac2a6fc5a36134e2ce126337045abd4b87345`. Names are listed separately, not assigned to faces. The award is described only as the user-reported first prize at the project seminar.

## Implementation and evidence

Local routes: `http://127.0.0.1:5173/team`, `/privacy`, `/terms`, `/about`.

Evidence directory: `C:/Users/jigne/OneDrive/Desktop/College Project/arch-detective/output/team-legal-qa-20261116/` (disposable QA output, narrowly ignored in Git).

Desktop comparison viewport: 1440 × 1000 CSS pixels, approximately 1× screenshot density. Full-page screenshots include naturally flowing content beyond the viewport. Native screenshots use 1440 pixels; some full-page captures omit the scrollbar strip and are 1424 pixels wide. Source images are uniformly scaled to each actual capture width, not stretched. Comparisons show the full reference and implementation side by side, with white padding for different content heights.

- `chrome-team-light-full.jpg`: final full Team light page, 1440 × 2268 pixels.
- `chrome-privacy-light-full.jpg`: final full Privacy light page, 1424 × 2273 pixels.
- `chrome-terms-light-full.jpg`: Terms light page; corresponding `*-dark-full.jpg` files record dark mode.
- `comparison-team-full.jpg`, `comparison-privacy-full.jpg`, `comparison-terms-full.jpg`: full-view comparisons.
- `comparison-team-hero.jpg`, `comparison-privacy-hero.jpg`, `comparison-terms-hero.jpg`: focused hero/header/type/asset comparisons.
- `chrome-team-final-hero.jpg`: settled native desktop capture, including full original photograph.
- `chrome-team-dark-mobile-settled.jpg`: settled native dark mobile view confirming readable navigation controls; use this instead of transition frames in early full-page captures.
- `mobile-theme-review.jpg`: six complete mobile pages, light/dark for each route, at 390 × 844 CSS viewport.
- `chrome-team-dark-tablet.jpg`: 768 × 1024 CSS viewport.
- About workflow/illustration captures: `chrome-about-dark-full.jpg`, `chrome-about-dark-workflow.jpg`, `chrome-about-light-workflow.jpg`.
- `implemented-pages-preview.jpg`: compact three-page preview, not a substitute for the full comparisons.

The in-app browser was used first. Its intermittent failed/cropped/stale captures were not treated as implementation defects or final proof. The user explicitly approved Chrome for final checks. Chrome also had occasional capture timeouts; settled successful captures and DOM/asset checks were used. Early non-Chrome files and mis-timed captures are diagnostic only. A lazy workflow image was initially absent in a full-page capture; scrolling into view confirmed it loaded, followed by a new full-page capture.

## Fidelity review and adaptations

- **Typography:** existing Inter/system stack and canonical Archon wordmark retained. Editorial headings, short purpose statements, readable 17px legal body text (16px mobile), separate captions and technical caveats. Reference layout hierarchy is retained; production type/control scale uses the existing application rather than enlarging every control with the raster reference.
- **Spacing:** split hero, right-side intact photo, three-column roster, separate guide row and five-stage workflow. Mobile stacks these in order. Privacy uses sticky contents on desktop, normal-flow two-column contents on mobile. Terms uses horizontal desktop contents and a two-column mobile grid. No measured horizontal overflow at 390, 768 or 1440 CSS pixels.
- **Colour:** canonical cream/charcoal/orange tokens, orange title emphasis, restrained borders, readable dark-mode headings, text and controls. No new gradient, sparkle, robot badge or approval claim.
- **Assets:** supplied logo unchanged. Separate cream/charcoal/orange illustrations, not flattened page mockups. All artwork uses contain/full intrinsic sizing. An intentional bounded cream workflow panel is used in both themes to eliminate cutout defects. The original team photo remains full-aspect and unchanged.
- **Content:** exact existing operational disclosures retained, including external-provider processing, source/chat retention limits, browser clearing not deleting server records, authorized use and human review. Shared Settings content remains available. No guarantee of security, certification or legal sufficiency was introduced. Additional factual GitHub/ZIP explanations are conditional on configuration.

Intentional differences from the mockups: original photograph/overlay and full aspect ratio; canonical header, logo and control sizing; fuller existing privacy wording; explicit authorized-use caveats; expanded workflow descriptions; a cream artwork panel for edge quality; no decorative document icon in the final privacy notice. These preserve the product and the user's photograph instruction. This is a design implementation, not a pixel-identical reproduction of generated people or text.

## Issues found and resolved

| Finding | Correction | Verified evidence |
| --- | --- | --- |
| P2: transparent workflow asset had white/coloured edge noise on dark backgrounds. | Re-rendered once on an opaque cream panel; retained five objects and the orange route. | Final workflow WebP, Team dark full/mobile captures; no alpha fringes. |
| P2: first legal implementation missed orange title emphasis and the Terms horizontal contents layout. | Added semantic title spans, horizontal Terms contents and mobile wrapping. | Focused hero comparisons; Terms desktop/mobile captures. |
| P2: the first privacy-settings CTA lost its intended destination through the existing signed-out guard. | The public CTA now uses the existing login route with an explicit safe `/settings?section=privacy` return destination. No auth implementation changed. | Browser URL `login?next=%2Fsettings%3Fsection%3Dprivacy`; auth destination regression assertion. |
| New test assertion depended on HTML attribute order. | Matched actual anchor semantics independently of attribute order. | All 43 focused tests pass. |

Final combined full-view and focused comparisons were opened and reviewed after these corrections. No actionable P0/P1/P2 layout or interaction findings remain within these public-page changes.

## Browser checks

- Team beside About in desktop and mobile navigation; active page indication; About → Meet the team works.
- Mobile menu opens, Escape closes and restores focus; choosing Team closes the menu.
- Privacy/Terms contents links work with mouse and keyboard. Target section receives focus and sits below the sticky header (observed approximately 112px from the viewport top).
- About's workflow anchor works; removed report action was not reintroduced.
- Theme changes and route navigation retain the selected theme. Both themes checked at desktop/mobile, plus tablet Team/About overflow checks.
- Full original photo aspect ratio verified at approximately 1600/1046; all local image resources load.
- Privacy settings action opens sign-in with its exact return destination. Terms → account creation opens the actual signup form. No forms were submitted or real accounts modified.
- New public routes show no browser error logs. Existing development warnings concern named exports in login/reset-password/findings and are unrelated to this change.

## Commands and results

- Baseline focused auth/branding/UI tests: **36 passed** outside the filesystem sandbox. Initial sandbox esbuild failure was a parent-directory permission issue, before test assertions.
- `node --test tests/public-pages.test.mjs tests/branding-ui.test.mjs tests/auth-layout.test.mjs tests/auth.test.mjs tests/auth-api.test.mjs tests/auth-bridge.test.mjs`: **43 passed** on final source.
- `node --experimental-strip-types --test tests/ssr-pages.test.mjs`: **13 passed** on final source, including all three new/redesigned public routes and existing protected-route shells.
- `npm run typecheck`: **passed**.
- Focused ESLint across all modified/new TypeScript/TSX and test files: **passed**.
- Prettier check across all modified/new maintained source and tests: **passed**.
- `npm run build`: **passed** on final source. Existing mixed dynamic/static import and dependency `use client` warnings remain non-fatal.
- Task-source `git diff --check`: **passed**.
- Whole-worktree diff inspection also encountered existing permission-denied pytest artifacts under `output/`; these unrelated artifacts were not modified. The scoped task-source diff check is the relevant passing result.
- Original photograph SHA256: **passed**, unchanged bytes.

Checks/build used explicit outside-sandbox execution because esbuild could not read parent configuration directories inside the sandbox. No dependency updates were made.

## Task-specific file manifest

| File | Reason / safety |
| --- | --- |
| `.gitignore` | Narrow exclusion for this reproducible QA output only. |
| `src/components/marketing/MarketingChrome.tsx` | One shared About/Team definition; real Privacy/Terms footer destinations, existing theme/menu behaviour retained. |
| `src/components/marketing/TeamPage.tsx` | New public Team view using supplied names, guide, college and intact photo. |
| `src/components/marketing/ReviewWorkflow.tsx` | Shared factual five-stage explanatory section; no scan calls. |
| `src/components/marketing/ProjectNotice.tsx` | Shared responsive public legal shell, contents navigation and safe existing-route CTAs. |
| `src/components/marketing/public-pages.css` | Scoped layouts/theme tokens; no application-shell or editor changes. |
| `src/components/settings/legalNotices.ts` | One typed source for existing disclosure text and section metadata. |
| `src/components/settings/LegalContent.tsx` | Same Settings/public disclosures, now accessible named sections. Public-only styling is scoped. |
| `src/routes/team.tsx` | New typed public route with factual metadata. |
| `src/routes/privacy.tsx`, `src/routes/terms.tsx` | Approved titles and notice kind; same content components. |
| `src/routes/about.tsx` | Shared workflow/Team link and accurate wording; existing illustrations retained. |
| `src/routeTree.gen.ts` | Automatically regenerated by TanStack Router for `/team`; not hand-edited. |
| `tests/public-pages.test.mjs` | SSR markup, photo checksum, navigation, disclosures and real links. |
| `tests/auth.test.mjs` | Added privacy-settings return-destination assertion only. |
| `tests/ssr-pages.test.mjs` | Added Team, Privacy and Terms server-rendering cases. |
| `public/assets/team/project-seminar-original.jpeg` | Byte-for-byte supplied original, including overlay. |
| `public/assets/marketing/archon-privacy-hero-v1.webp` | Separate local privacy illustration. |
| `public/assets/marketing/archon-terms-hero-v1.webp` | Separate local terms illustration. |
| `public/assets/marketing/archon-review-workflow-v1.webp` | Separate five-stage illustration, final opaque cream version. |
| `.github/design-assets/archon-privacy-hero-v1.md`, `archon-terms-hero-v1.md`, `archon-review-workflow-v1.md` | Asset provenance and exact generation prompts. |
| `.github/design-assets/auth-design-qa-20261116.md` | Preserves preceding QA report verbatim. |
| `design-qa.md` | This current review and verification record. |

No project source/data files were deleted. Existing unrelated tracked deletions under `output/` were preserved, not restored or extended. No backend, API, auth logic, database, RLS, scan/model routing, environment, dependency or deployment configuration changes.

## Limitations and follow-up

- No live authenticated scan, GitHub publication or hosted Settings persistence was performed for this public-page task. Relevant existing auth regressions and protected-route SSR passed; these are not claims of full end-to-end backend verification.
- Policy wording is still explicitly a research-prototype notice; an operator must supply reviewed legal terms and contact details before production use.
- The unedited photograph exposes its supplied location overlay. This was the user's explicit choice; deployment/publication is not part of this task.
- P3: opaque workflow panel is intentionally brighter than the dark canvas. Further art-direction changes can be reviewed separately; no quality blocker remains.

final result: passed
