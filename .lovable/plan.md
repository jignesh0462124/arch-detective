# LLM Compliance & Threat Modeling Engine — UI Prototype

Build a static, front-end-only prototype (no backend, no AI calls) styled strictly to the uploaded `DESIGN.md` (Neo-Brutalist High-Fidelity: CanvasCream background, OrangePrimary actions, GoldAccent highlights, InkBlack 1.5px borders, 4px hard offset shadows, IBM Plex Sans, pill badges, 10–16px radii).

## Design system setup
- Load **IBM Plex Sans** (300/400/600/700) via `<link>` in `__root.tsx`.
- Rewrite `src/styles.css` design tokens with the brutalist palette:
  - `--background: #F5F2ED` (CanvasCream), `--card: #FFFFFF`, `--foreground/--border: #1A1A1A` (InkBlack), `--primary: #F54E00` (Orange), `--secondary: #F7A501` (Gold), success green `#1A9E5C`.
  - All colors expressed as `oklch()` per template rules, mapped under `@theme inline`.
  - Radii: header 16px, card 12px, button/input 10px, badge 9999px.
  - Custom utilities: `shadow-brutal` (`4px 4px 0 0 #1A1A1A`), `shadow-brutal-gold` (`4px 4px 0 0 #F7A501`), `shadow-brutal-sm` (2px), `border-brutal` (1.5px solid InkBlack).
  - Section-title utility: 12px, uppercase, 1px tracking, 600 weight.

## Routes (TanStack file-based)
All pages share a shared brutalist app shell (sidebar + top header card). Built as a layout route `src/routes/_app.tsx` with `<Outlet />`, plus children:

1. `src/routes/index.tsx` — **Landing / Hero** (public, no shell)
   - Big DisplayHero headline "Audit at machine speed.", orange CTA "Launch Console", gold ghost CTA "View Sample Report".
   - 3 brutalist feature cards (Parse, Map, Report), hard shadows, marquee strip of compliance frameworks (SOC 2, ISO 27001, HIPAA, GDPR, PCI-DSS, NIST).
2. `src/routes/_app/dashboard.tsx` — **Dashboard**
   - Header card with screen title + "New Scan" orange button.
   - 4 stat cards (Open Findings, Critical, Compliance Score, Reports Generated) with hard shadows and trend chips.
   - Recent scans table (brutalist striped rows, status pill badges).
   - Framework coverage panel with progress bars.
3. `src/routes/_app/new-scan.tsx` — **New Threat Model**
   - Tabbed input card: "Architecture Diagram" (drag-drop zone), "System Description" (textarea), "Operational Logs" (file upload). Hard-bordered tab strip.
   - Framework multi-select chips (SOC 2 / ISO 27001 / HIPAA / GDPR / PCI-DSS / NIST 800-53).
   - Model selector (Llama 3 70B / Llama 3 8B / Mixtral) with Groq badge.
   - "Run Analysis" primary button; right-side preview shows a fake agent reasoning timeline (Parse → Identify Assets → Enumerate Threats → Map Controls → Draft Report) with animated active step.
4. `src/routes/_app/findings.tsx` — **Findings / Vulnerabilities**
   - Filter bar (severity, framework, asset).
   - List of finding cards: severity pill (Critical=orange, High=gold, Medium=ink, Low=ghost), STRIDE category tag, affected component, mapped controls chips (e.g. `SOC2 CC6.1`, `ISO A.8.24`).
   - Click row → side drawer with description, evidence snippet, remediation, control mapping table.
5. `src/routes/_app/reports.tsx` — **Audit Reports**
   - Grid of report cards (framework cover, generated date, status, page count).
   - "Generate Report" gold button.
   - One featured report uses gold hard shadow.
6. `src/routes/_app/reports.$reportId.tsx` — **Report Detail**
   - Document-style brutalist layout: cover header card, executive summary, findings table, control matrix (framework rows × status columns), signature block. Download buttons (PDF/DOCX – static).

All data is hardcoded mock JSON in `src/lib/mock-data.ts`. No network calls.

## Shared components (`src/components/brutal/`)
- `AppShell` (sidebar nav + top header card + bottom navigation rail on small screens with gold 4px top border).
- `BrutalCard`, `BrutalButton` (variants: primary/secondary/tertiary/ghost/utility per DESIGN.md), `BrutalInput`, `BrutalBadge` (variants new/live/rank/severity), `BrutalTable`, `StatCard`, `SectionHeading`, `AgentTimeline`, `FrameworkChip`.
- Icons via `lucide-react` (already installed) — square stroke, no fills, paired with bordered chip wrappers to match brutalist feel.

## SEO / head
Per-route `head()` with unique title + description (e.g. "Dashboard · Sentinel Audit"), shared og fallback in root.

## Out of scope (explicit)
- No backend, no Lovable Cloud, no auth, no real LLM calls, no file persistence.
- Forms are visual only; submitting "Run Analysis" just animates the timeline locally.
- No dark mode (brutalist cream theme only).

## Technical notes
- Tailwind v4 tokens in `src/styles.css` only — no `tailwind.config.js`.
- Use `@utility` for `shadow-brutal*` and `border-brutal`.
- Hover states bump shadow offset 4px→5px and translate element by 1px (per DESIGN.md hover spec).
- Replace placeholder `src/routes/index.tsx`.
