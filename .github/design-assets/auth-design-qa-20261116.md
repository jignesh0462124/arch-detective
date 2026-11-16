# Authentication layout verification

Date: 2026-11-16

## Scope and selected references

Implemented the selected sign-in (option 1) and create-account (option 2) compositions. Dark mode retains their form-left / illustration-right arrangement; the rejected reversed dark composition was not implemented. Existing artwork and the canonical Archon wordmark were reused, not regenerated.

- Sign-in source: `C:/Users/jigne/.codex/generated_images/01a14884-7256-79b3-83a0-d85a3174c02c/exec-7eef9c1f-2725-4200-a64a-12ae293456a2.png`
- Signup source: `C:/Users/jigne/.codex/generated_images/01a14884-7256-79b3-83a0-d85a3174c02c/exec-f797366f-db5b-4f53-b46a-160f61612a7b.png`
- Real application: `http://localhost:5173/login`; signup is `/login?mode=signup`.
- Isolated interactive fixture: `http://127.0.0.1:5195/tests/auth-preview/index.html`.
- Evidence directory: `C:/Users/jigne/.codex/visualizations/2026/10/17/01a14884-7256-79b3-83a0-d85a3174c02c/auth-approved/`.

## Comparison evidence and normalization

Both source images are 1487 × 1058 pixels. They were normalized to the 1440 × 1024 CSS comparison viewport; browser captures are 1440 × 1024 pixels at approximately 1× density. Uniformly scaling the references to 1440 pixels wide produces a height of approximately 1024.57 pixels; normalization rounds that subpixel difference. No application screenshot was stretched for the final comparison.

- `comparison-final.png`: both approved references alongside the final light sign-in/signup captures.
- `comparison-form-final.png`: aligned sign-in form crops, x=80–696 and y=135–910, to inspect labels, controls and spacing.
- `signin-light-native-final.jpg` and `signup-light-native-final.jpg`: final desktop light states.
- `signin-dark-native-final.jpg`: final dark sign-in with the same panel order.
- `signup-dark-mobile-native-final.jpg` and `signup-light-mobile-native-final.jpg`: final 390 × 1040 mobile captures, including the footer.

In-app browser full-page capture became unreliable, with some cropped or failed captures. Those were excluded from final comparisons. Final desktop and mobile captures used the connected Chrome browser's documented native capture API. The real application's hydrated forms were also inspected in the in-app browser.

## Comparison history

| Earlier finding                                                                          | Fix                                                                                                                     | Post-fix evidence                                                                                |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| P2: initial 14px form type was noticeably smaller than the approved reference.           | Desktop labels, fields, actions and introduction increased to 18px; title increased to 48px; mobile fields remain 16px. | `comparison-form-final.png`; readable hierarchy without losing password requirements.            |
| P2: gateway appeared too small and too low in its panel.                                 | Original image uses the full available artwork height with contain sizing and bottom alignment.                         | `comparison-final.png`; gateway, key, orange route and report remain visible.                    |
| P2: integer max-width media query left a gap at fractional CSS widths just below 1024px. | Use the strict range query `width < 1024px`, matching the desktop source-image breakpoint.                              | Rechecked 1023px: artwork hidden and no horizontal overflow; 1024px retains the two-column view. |
| P2: enlarged signup content introduced a few pixels of avoidable desktop overflow.       | Reduced desktop signup bottom padding while preserving field spacing.                                                   | `signup-light-native-final.jpg`; footer and actions remain within the comparison viewport.       |

## Required visual surfaces

- **Typography:** existing Inter/system stack; strong but restrained headings; visible field labels, password help and loading states. Canonical wordmark retained instead of copying generated logo typography.
- **Spacing:** shared 48/52 desktop grid, integrated footer, consistent 48px controls, 44px password/navigation targets. Form-first single column below 1024px. Short landscapes can scroll normally.
- **Colours:** existing cream/charcoal/orange tokens; dark fields, labels, links and primary buttons remain legible. No reversed dark layout, neon, glow, security badges or unsupported claims.
- **Assets:** original gateway and infrastructure backdrop unchanged in Git. Contain sizing preserves the whole illustration. The media-specific picture selects an inline one-pixel fallback below desktop, avoiding a mobile gateway download; the desktop artwork loads eagerly.
- **Content:** sign-in/signup/recovery retain their respective purposes. Signup still explains email verification and workspace creation as separate steps. Privacy/Terms remain accessible; no simulated guarantees or extra providers were introduced.

Intentional adaptations from the generated images: existing logo/font family, an operational theme toggle, longer existing password guidance, non-italic interface copy, Phosphor icons and consistent field heights. These preserve the real product rather than treating generated artwork as a new brand system.

## Browser checks

| Check                                                   | Result                                                                                                                                                                                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Page identity, meaningful content, no framework overlay | Passed on real `/login` and signup navigation.                                                                                                                                                                                                   |
| Light/dark and responsive geometry                      | Passed at 320, 390, 768, 1023, 1024 and 1440px; no horizontal overflow. 844 × 390 landscape remains scrollable.                                                                                                                                  |
| Password visibility and keyboard                        | Show/Hide changes password type; Tab reaches recovery with a visible solid focus outline. Autofill attributes retained.                                                                                                                          |
| Invalid credentials                                     | Isolated short-password sign-in reaches authentication and renders the neutral credential error.                                                                                                                                                 |
| Signup                                                  | Isolated mismatch is invalid; matching confirmation renders email instructions and a disabled resend cooldown. No real account was created.                                                                                                      |
| Recovery                                                | Isolated reset request renders neutral delivery guidance and a disabled 60-second cooldown. No email was sent.                                                                                                                                   |
| Successful sign-in                                      | Isolated sign-in displays the protected `Private workspace` screen. Busy controls disable during submission.                                                                                                                                     |
| Console                                                 | Real app has no observed runtime errors; existing TanStack named-export/code-splitting warnings remain. Fixture logged an existing duplicate-createRoot warning during hot reload; no new error appeared after a full reload with edits stopped. |

## Automated checks

- `node --test tests/auth-layout.test.mjs tests/auth.test.mjs tests/auth-api.test.mjs tests/auth-bridge.test.mjs`: **21 passed**.
- Same auth checks plus `tests/sidebar.test.mjs tests/branding-ui.test.mjs tests/theme-contrast.test.mjs`: **42 passed**.
- `npm run test:ssr`: **12 passed**, including Login, Dashboard, Workbench intake, Advisor, Settings, Findings, Reports and Fix Verification routes.
- `npm run typecheck`: passed.
- Focused ESLint and Prettier checks for the changed route/tests/styles: passed.
- `npm run build`: passed after the final application edits. Existing bundle-size / mixed-import / library directive warnings remain non-fatal. Log: `output/auth-approved-build.log` (ignored generated output).
- `git diff --check` on changed tracked task files: passed. Original artwork has no diff.
- Compared the AuthPage hooks and submit/resend/navigation handlers against HEAD: unchanged.

## Changed files and safety boundaries

| File                                | Purpose and safety                                                                                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/login.tsx`              | Presentation, accessible control attributes and original artwork delivery only. Existing auth hooks, request handlers, duplicate guards, callback handling, destination validation and cooldowns are unchanged. |
| `src/components/auth/auth-page.css` | New `.auth-*` scoped composition. Does not restyle protected pages or replace shared theme tokens.                                                                                                              |
| `tests/auth-layout.test.mjs`        | New actual-markup SSR tests using isolated router/auth fixtures. No network or credentials.                                                                                                                     |
| `tests/auth-api.test.mjs`           | Additional GitHub initiation, destination and failure regression coverage; no production API change.                                                                                                            |
| `design-qa.md`                      | This verification record.                                                                                                                                                                                       |

No deletions, package changes, migrations, RLS changes, environment changes, credential changes, commits, pushes or deployments. Existing unrelated worktree edits were preserved.

## Remaining verification limits

Actual GitHub consent/callback completion, hosted signup email delivery and a real user's credential submission were not performed. They require an isolated authorized account and are not implied by fixture tests. Native mobile devices and screen-reader software were not exercised. Existing application-wide bundle optimization warnings are outside this presentation change.

## Implementation checklist

- [x] Implement selected designs 1 and 2 using original assets.
- [x] Adapt the same composition for dark mode; exclude option 3.
- [x] Preserve authentication behavior and existing worktree changes.
- [x] Inspect full-view and focused comparison evidence; correct P2 issues.
- [x] Verify responsive, keyboard and isolated submission states.
- [x] Pass focused automated checks and production build.

final result: passed
