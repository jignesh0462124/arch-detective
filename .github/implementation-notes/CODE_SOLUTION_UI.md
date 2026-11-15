# Code-first remediation

Implemented and locally verified on 4 November 2026.

## User-facing changes

Remediation retains Steps and Code solution tabs, with keyboard arrow/Home/End navigation. Code solution now has one expandable source label, a concise assessment, read-only code with line numbers and lexical colours, Copy/Expand controls, verification steps, and collapsed explanation/assumptions. It does not render the chat avatar or repeated Advisor header. Code scrolls horizontally instead of wrapping mid-token. The primary actions remain Regenerate and Open in Security Advisor; uploaded source is never edited.

Suggestions are associated with an exact client response ID and workspace/scan/finding, with the generating conversation retained for Advisor navigation. Up to eight results remain in memory; no new conversation/source browser storage is introduced. Normal conversation changes preserve completed suggestions, while account/workspace changes and denied conversation access clear them. Unavailable/unverified source clears the corresponding generated result. Switching remediation tabs does not regenerate; leaving a finding stops only a request started by that inspector, including before acceptance. Failed submission preserves the earlier result and conversation link.

## Response and stream handling

- Server-controlled instructions request Assessment, Suggested code, How to verify and Explanation and assumptions. They distinguish static trusted SVG from attacker-controlled HTML and explicitly reject treating DOMParser as a sanitizer. These are generation instructions, not proof that a model's proposed fix is correct.
- Code requests allow 2,048 output tokens; ordinary chat remains at 1,024. Existing model selection, fallback and timeouts are unchanged.
- Length/filter/tool completion reasons and response-size limits are reported as incomplete; unclosed fences in code-solution responses also prevent completion. Partial answers use the existing interrupted-history state. Older compatible providers that send DONE without a finish reason remain supported.
- New stream error `response_truncated` maps to a controlled Regenerate message. No database schema, migration, RLS or permission changes were made.
- The first content update is immediate. Subsequent text updates are coalesced at roughly 100 ms and flushed on terminal states. Parsing is memoized; completed code blocks use lightweight escaped React spans, not another Monaco instance. Existing saved Markdown receives a fallback layout and missing sections are explicitly identified.

## Files

| Area | Files and purpose |
| --- | --- |
| Workbench UI | `src/components/audit-workbench/CodeSolution.tsx`, `SolutionPreview.tsx`, `AuditWorkbench.tsx`: dedicated preview, scoped actions, one source label and retained inspector state |
| Presentation/transport | `src/lib/codeSolution.ts`, `src/hooks/useGroqChat.ts`, `src/lib/api/ai-client.ts`, `src/lib/advisorPresentation.ts`: parser, batched updates, exact response ownership, controlled incomplete errors |
| Backend | `threatlens/app/api/ai_chat.py`: generation instructions, code-only token budget and completion/fence detection |
| Regression tests | `tests/code-solution.test.mjs`, `tests/branding-ui.test.mjs`, `threatlens/tests/test_ai_chat.py`: parser, escaped rendering, batching, provider reasons and budgets |
| Browser fixtures | `tests/code-solution-browser.cjs`, `tests/workbench-preview/main.tsx`: complete/truncated/rejected/slow synthetic replies and responsive controls |
| Compatibility smoke | `tests/github-review-browser.cjs`: open New audit when prior fixture activity left a resume card; production GitHub logic untouched |

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, zero errors; existing fixture Fast Refresh warning remains |
| `npm run build` | Passed, standalone Node client/server build; existing chunk/import warnings remain |
| All frontend `*.test.mjs` with `FRONTEND_TEST_URL=http://127.0.0.1:5196` | 106 passed, including ten production SSR routes |
| Full backend pytest suite in isolated Python profile | 321 passed, four external-service smoke tests skipped |
| `npm run test:rls` | 369 isolated checks passed; no hosted database used |
| `node scripts/check-client-secrets.mjs` | 95 public assets passed |
| Advisor redesign browser regression | Passed history, shared conversation, code-remedy navigation and resume flow |
| Code-solution browser regression | Passed complete/truncated replies, disabled incomplete copy, clipboard denial, exact conversation link, tab reuse, finding isolation, rejected regeneration and Stop without replay |
| GitHub review browser regression | Passed synthetic proposal validation/review/publication, repository selection and preserved ZIP flow |

Browser checks used the existing Playwright CLI and isolated fixture server on 127.0.0.1:5193, at 1440px and 390px in both themes. Desktop and mobile screenshots were inspected for readable code, aligned actions and absence of page overflow. Expected synthetic denial/truncation states were tested without real user data. The browser was restarted after fixture hot reloads produced duplicate-root errors; the clean final fixture run passed.

Performance evidence is synthetic: 1,000 synchronous text chunks produced two UI publications after the 100 ms batching window, then an explicit final flush without text loss. This demonstrates reduced render scheduling, not guaranteed provider speed or measured real-world latency improvement.

Screenshots: `output/playwright/code-solution-{light,dark}-{1440,390}.png`. Fixtures label their data as isolated demonstrations. Generated QA screenshots are not real scan evidence.

## Limits and rollout

No live provider answer, real uploaded ZIP, hosted chat reload/expiry or actual GitHub repository mutation was exercised. Existing automated authorization/redaction/history tests pass, but isolated tests are not hosted verification. The response can still require human correction; neither the rendering nor the prompt proves that XSS exists or that replacement code works.

Deploy/restart the compatible backend first, then serve the rebuilt frontend. No migration is needed. Keep human review and project tests mandatory; do not auto-apply suggestions or resolve findings based on response completion.
