# Advisor, authentication layouts and audit resume

Implemented 24 October 2026.

## Behaviour

- About uses theme surfaces and readable illustration captions; its View reports action is removed.
- Login and signup share the approved spacious form layout, existing gateway illustration and background artwork. Email/password and GitHub access remain available.
- Settings Account and security uses the shared profile sections without the standalone cover/workspace card. Recovery and session actions retain their previous behaviour.
- Security Advisor has a compact app rail, search, private conversation history, new chat, rename/delete, a mobile history sheet and shared conversation state with the floating panel.
- Workbench Remediation offers Steps and Code solution. Suggestions use authorized, redacted source context, stay read-only and can be opened in the same Advisor conversation.
- Advisor handoffs retain their intent until request acceptance. Account-scoped opaque handoff references prevent a refresh from silently replaying a submission.
- Codebase Audit retains the last accepted/opened scan reference and shows a resume card. New audit resets the form without deleting the saved scan.

## Storage and configuration

The additive migration is `20261024060713_advisor_conversations.sql`. Both tables have RLS and authenticated read-only grants. Records require conversation ownership, current workspace membership and an unexpired window. Writes remain server-side. Conversation/message APIs are under `/api/v1/ai/conversations`; the existing chat endpoint accepts optional conversation/submission IDs.

Set `ADVISOR_HISTORY_ENABLED=true` on backends after the migration is verified. The default is false; capabilities check that the table exists before exposing history. The local backend environment has been enabled. No source/message bodies are added to persistent browser storage. Old local conversation data is preserved without automatic upload.

Source-linked conversations expire with their snapshot, at most 30 days after creation. Snapshot deletion, early expiry/failure and scan deletion remove their conversations/messages. Maintenance removes expired general chats and marks abandoned streams interrupted.

Backend environment lookup now includes absolute project-root and backend environment paths. This fixes a fresh-sign-in verification 503 when the backend was launched from its own folder and missed the frontend public-key alias.

## Hosted rollout

The new chat migration was deployed alone using an isolated migration directory matching the hosted migration history. An unrelated pending GitHub migration was not applied or recorded. Hosted RLS definitions were verified. The Supabase security advisor reported the existing leaked-password-protection warning; Auth security settings were not changed.

## Verification

- Isolated Postgres tests cover private history ownership, administrator/outsider/revoked-member denial, expiry, grants and source-deletion cascades.
- Backend tests cover history creation, source expiry, redaction, duplicate submissions, pagination and compatibility with chat, authentication, workbench and GitHub flows.
- Browser fixtures cover history/search, mobile sheets, code suggestions, exactly-once finding handoff, resume after navigation, Account alignment and About's removed report link, in light/dark desktop/mobile views.
- Login/signup browser checks cover both themes and sizes, password visibility, recovery navigation and short existing passwords.
- A live acceptance script creates disposable accounts and a synthetic ZIP, verifies a real scan and grounded persisted response, tests outsider denial, rename/delete/reload, retention caps and scan-deletion cascades, and removes its own fixtures. It never reads or changes an existing audit.

Final results: 107 backend tests, 47 frontend tests and 369 isolated RLS checks passed. TypeScript, focused lint and the production build passed. The browser workflows passed at desktop/mobile sizes in both themes. Live acceptance passed against both the in-process app and the actual backend at port 8000. The normal frontend is running at port 5173.

Run the live check from `threatlens` with `.venv/Scripts/python scripts/verify_advisor_workflow.py --live`; add `--api-url http://127.0.0.1:8000` to check the running backend. Runtime credentials remain in memory.

The primary model gateway returned 401 during live scanning; the configured fallback completed scanning and Advisor guidance successfully. Primary-provider credentials were not changed.

## Server-rendering follow-up

Fixed a frontend HTTP 500 caused by reading `document.visibilityState` inside Advisor's polling callback. TanStack Query evaluates this callback during server rendering even when the query is disabled. Advisor and Fix Verification now share a visibility helper that returns false without a browser document. Audit intake/history initialize visibility safely and synchronize it after mounting. Login's account-mode switch also waits for authentication initialization.

`npm run test:ssr` checks visibility behavior during an actual React server render and HTTP responses from ten routes; start the frontend first, or set `FRONTEND_TEST_URL`. All twelve checks pass. A browser check against the real frontend also verified login/signup hydration and signed-out protected-page redirects without HTTP 500s or client exceptions.
