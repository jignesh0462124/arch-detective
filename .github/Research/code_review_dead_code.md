# MODE: CODE_REVIEW — Dead & Useless Code Audit

**Role**: Principal Engineer — Zero Tolerance for Dead Code  
**Scope**: Full frontend `src/` tree  
**Overall Assessment**: `REQUEST_CHANGES`

> Dead code is the #1 source of confusion in a growing codebase. Every unused variable, import, or constant costs the next engineer 10 minutes of head-scratching. Below is every useless piece of code found, ranked by impact.

---

## Summary Table

| # | File | Issue | Type | Severity |
|---|---|---|---|---|
| 1 | `reports.tsx` | `rest` variable computed, never rendered | Unused Variable | 🔴 |
| 2 | `reports.tsx` | `draft` variable computed, consumed via `review + draft` only | Shadowed/Misnamed | 🟡 |
| 3 | `index.tsx` | Local `COVERAGE` array duplicates `mock-data.ts` | Duplicate Data | 🟡 |
| 4 | `mock-data.ts` | `color` field on every `FRAMEWORKS` entry never read | Orphaned Field | 🟡 |
| 5 | `mock-data.ts` | `Stride` type & `stride` field exist only in mock, absent from `api/types.ts` | Schema Mismatch | 🟡 |
| 6 | `auth.ts` | `getMe()` exported but never imported anywhere | Dead Export | 🟡 |
| 7 | `findings.tsx` | `idle` branch in ternary is vacuous (variable declared but effectively unused) | Dead Branch | 🟢 |
| 8 | `reports.$reportId.tsx` | `FRAMEWORKS` imported but only used for computed fake math | Misleading Usage | 🟢 |
| 9 | `AppShell.tsx` | Search `<input>` has no handler, state, or action — pure decoration | Non-functional UI | 🟢 |
| 10 | `AppShell.tsx` | Sidebar LLM stats ("312 ms", "740 tok/s") are hardcoded strings — never live | Hardcoded Stale Data | 🟢 |
| 11 | `new-scan.tsx` | `run()` function mutates state but never calls any API | Disconnected Action | 🟡 |
| 12 | `findings.tsx` | `BrutalButton` "Generate remediation PR" is an inert button with no handler | Dead Action Button | 🟡 |
| 13 | `reports.tsx` | `download all PDF` button has no handler | Dead Button | 🟢 |
| 14 | `copilot-instructions.md` | Duplicate at project root AND `.agents/` — two canonical sources of truth | Config Duplication | 🟢 |

---

## 🔴 Critical — Must Fix

### 1. `rest` — Computed but Never Rendered
**File**: [reports.tsx](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/src/routes/_app/reports.tsx#L53)  
**Line**: 53

```typescript
// ❌ `rest` is computed here...
const rest = REPORTS.filter((r) => r.id !== featured.id);

// ...and the only place it appears in the JSX is this label:
{rest.length + 1} total   // line 184
```

The variable was almost certainly meant to render a "rest of the reports" section separately from the featured report. But the full `REPORTS.map()` on line 213 iterates **all** reports including the featured one — making `rest` completely redundant. The count `rest.length + 1` is just a roundabout way of writing `REPORTS.length`.

**Fix**:
```diff
- const rest = REPORTS.filter((r) => r.id !== featured.id);
  // ...in the JSX:
- {rest.length + 1} total
+ {REPORTS.length} total
```

---

## 🟡 High Priority — Should Fix

### 2. `draft` — Computed but Silently Merged
**File**: [reports.tsx](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/src/routes/_app/reports.tsx#L41)  
**Lines**: 41, 48

```typescript
const draft = REPORTS.filter((r) => r.status === "Draft").length;
const review = REPORTS.filter((r) => r.status === "In Review").length;

// ...then silently merged with no explanation:
{ code: "03 // REVIEW", label: "In review", value: String(review + draft) },
```

`draft` has no standalone use. It's only used mixed into `review + draft`. Either the stat label is wrong ("In review" should be "Pending review"), or `draft` should be a separate stat tile. As-is, the intent is ambiguous.

**Fix option A** — rename and be explicit:
```diff
- const draft = REPORTS.filter((r) => r.status === "Draft").length;
- const review = REPORTS.filter((r) => r.status === "In Review").length;
+ const pending = REPORTS.filter(
+   (r) => r.status === "Draft" || r.status === "In Review"
+ ).length;

- { code: "03 // REVIEW", label: "In review", value: String(review + draft) },
+ { code: "03 // PENDING", label: "Pending", value: String(pending) },
```

---

### 3. Duplicate `COVERAGE` Array — `index.tsx` Shadows `mock-data.ts`
**File A**: [index.tsx](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/src/routes/index.tsx#L33)  
**File B**: [mock-data.ts](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/src/lib/mock-data.ts#L256)

```typescript
// mock-data.ts — exported COVERAGE
export const COVERAGE = [
  { framework: "SOC 2", pct: 92 },
  { framework: "ISO 27001", pct: 78 },
  ...
];

// index.tsx — REDECLARES an almost identical local copy
const COVERAGE = [
  { label: "SOC 2", pct: 92 },   // ← different key name ("label" vs "framework")
  { label: "ISO 27001", pct: 78 },
  ...
];
```

Two arrays with identical data but different key names (`framework` vs `label`). One is exported; one is local and shadows the export. This will cause a divergence bug — update one and forget the other.

**Fix**: Unify the key name in `mock-data.ts` to `label`, and import the single source:
```diff
// mock-data.ts
export const COVERAGE = [
-  { framework: "SOC 2", pct: 92 },
+  { label: "SOC 2", pct: 92 },
  ...
];

// index.tsx
- const COVERAGE = [
-   { label: "SOC 2", pct: 92 },
-   ...
- ];
+ import { COVERAGE } from "@/lib/mock-data";
```

---

### 4. `color` Field on `FRAMEWORKS` — Never Read
**File**: [mock-data.ts](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/src/lib/mock-data.ts#L1-L8)  
**Lines**: 1–8

```typescript
export const FRAMEWORKS = [
  { id: "soc2",    label: "SOC 2",      controls: 64,   color: "primary" }, // ← never used
  { id: "iso27001",label: "ISO 27001",  controls: 93,   color: "gold" },
  { id: "hipaa",   label: "HIPAA",      controls: 54,   color: "ink" },
  ...
] as const;
```

Grep confirms zero occurrences of `.color` anywhere in `src/`. The `color` field on every framework entry is dead data. Also note: `Framework` in `api/types.ts` has `color?: string` declared too — both are unused.

**Fix**:
```diff
// mock-data.ts — remove color from every entry
- { id: "soc2", label: "SOC 2", controls: 64, color: "primary" },
+ { id: "soc2", label: "SOC 2", controls: 64 },

// api/types.ts — remove the dead optional field
export interface Framework {
  id: string;
  label: string;
  version: string;
  controls: number;
- color?: string;
}
```

---

### 5. `Stride` Type and `stride` Field — Mock-Only, No API Type
**File**: [mock-data.ts](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/src/lib/mock-data.ts#L10-L17)

```typescript
export type Stride =
  | "Spoofing"
  | "Tampering"
  | "Repudiation"
  | "Information Disclosure"
  | "Denial of Service"
  | "Elevation of Privilege";

export interface Finding {
  // ...
  stride: Stride;  // ← this field
}
```

The real `Finding` interface in [api/types.ts](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/src/lib/api/types.ts) has **no `stride` field at all**. The mock `Finding` and the API `Finding` are two completely separate, diverging types. When the backend goes live, all components consuming `stride` will break silently because they're importing from mock-data.

**Fix**: Either add `stride` to the canonical `Finding` in `api/types.ts`, or remove it from mock data if the backend won't support it. Don't maintain two parallel `Finding` types.

---

### 6. `getMe()` — Exported But Never Imported
**File**: [auth.ts](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/src/lib/api/auth.ts#L50)  
**Line**: 50

```typescript
export function getMe(): Promise<CurrentUserResponse> {
  return api.get<CurrentUserResponse>("/api/v1/auth/me");
}
```

Grep: zero imports of `getMe` anywhere in the codebase. This was likely written for a planned "fetch current user" flow but was replaced by `bootstrapProfile()`. It's a dead API call sitting in the exported surface.

**Fix**:
```diff
- export function getMe(): Promise<CurrentUserResponse> {
-   return api.get<CurrentUserResponse>("/api/v1/auth/me");
- }
```

---

### 7. `run()` in `new-scan.tsx` — Fake Pipeline with No API Call
**File**: [new-scan.tsx](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/src/routes/_app/new-scan.tsx#L77)  
**Lines**: 77–93

```typescript
const run = () => {
  if (running) return;
  setRunning(true);
  setStep(0);
  let i = 0;
  const tick = () => {
    i += 1;
    if (i >= PIPELINE.length) {
      setStep(PIPELINE.length);
      setRunning(false);
      return;
    }
    setStep(i);
    setTimeout(tick, 1100);   // ← fake 1.1s delay per step
  };
  setTimeout(tick, 1100);
};
```

The "Run analysis" button fires this function which **only animates a progress bar** — it makes zero network requests, submits nothing to the backend, and produces no real output. It's an elaborate visual trick that will mislead anyone who clicks "Run analysis" expecting something to happen.

**Fix** (short-term): Add a clear comment or placeholder state to communicate that API integration is pending:
```diff
const run = async () => {
  if (running) return;
+ // TODO: Replace with actual API call to POST /api/v1/scans/
+ // Once backend is integrated, use: api.post('/api/v1/scans/', { ... })
  setRunning(true);
  ...
};
```

---

### 8. "Generate Remediation PR" Button — Inert, No Handler
**File**: [findings.tsx](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/src/routes/_app/findings.tsx#L282)  
**Line**: 282

```tsx
<BrutalButton variant="primary" className="flex-1">
  Generate remediation PR   {/* ← no onClick, no href, nothing */}
</BrutalButton>
<BrutalButton variant="secondary">Snooze</BrutalButton>  {/* ← same */}
```

Two action buttons with no handlers. Clicking them does nothing. This is worse than no button — it's a button that creates false expectations.

**Fix** (short-term): Disable with a tooltip, or add a `TODO` `onClick` handler that shows a toast: "API integration pending".

---

## 🟢 Low Priority — Nice to Fix

### 9. Search Input in `AppShell` — Purely Decorative
**File**: [AppShell.tsx](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/src/components/brutal/AppShell.tsx#L144)  
**Lines**: 144–152

```tsx
<input
  placeholder="Search findings, scans, controls..."
  className="w-56 bg-transparent ..."
/>
```

No `value`, no `onChange`, no `onKeyDown`. The `Ctrl K` keyboard hint is also a pure decoration — no global keyboard handler exists. The entire search bar is a non-functional decoration.

**Fix**: Either wire up a real search (e.g., filtering on the findings/scans list), or remove it until it's implemented.

---

### 10. Sidebar LLM Stats — Hardcoded Stale Strings
**File**: [AppShell.tsx](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/src/components/brutal/AppShell.tsx#L118)  
**Lines**: 118–130

```tsx
<span className="truncate text-xs font-semibold">Groq / Llama 3 70B</span>
<p className="mt-0.5 font-mono text-[11px] font-medium">312 ms</p>   // ← hardcoded
<p className="mt-0.5 font-mono text-[11px] font-medium">740 tok/s</p> // ← hardcoded
```

These numbers are hardcoded and never updated. They show a "live" pulse animation alongside fake statistics, which is misleading. Either pull these from a real API endpoint, or replace with a simple "Backend online" / "Backend offline" status that's already being queried via `backendHealth`.

---

### 11. `Download PDF` Button — No Handler
**File**: [reports.tsx](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/src/routes/_app/reports.tsx#L318)  
**Lines**: 318–320

```tsx
<BrutalButton variant="secondary">
  <Download size={15} /> Export all (PDF)
</BrutalButton>
```

No `onClick`. Clicking does nothing. Similar pattern to finding #8.

---

### 12. Duplicate `copilot-instructions.md`
**File A**: [copilot-instructions.md (root)](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/copilot-instructions.md)  
**File B**: [copilot-instructions.md (.agents/)](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/.agents/copilot-instructions.md)

Two copies of the policy file exist at the root and under `.agents/`. Both are likely different versions. Developers will not know which is canonical. Update one and the other silently drifts.

**Fix**: Delete the root-level copy. `.agents/` is the correct location per the project conventions. Add a note to `.gitignore` or README pointing to `.agents/` as canonical.

---

## Automated Checks Status

| Check | Status | Notes |
|---|---|---|
| Frontend Lint (ESLint) | ⚠️ Likely issues | `draft` and `rest` should trigger `no-unused-vars` |
| TypeScript `strict` mode | ⚠️ Unknown | Verify `strict: true` in tsconfig.json |
| Dead export detection | ❌ Not configured | Add `eslint-plugin-import/no-unused-modules` |
| Frontend unit tests | ❌ None | Zero test files found |

---

## Recommended ESLint Rules to Add

Add these rules to [`eslint.config.js`](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/eslint.config.js) to catch this class of bug automatically:

```js
rules: {
  "no-unused-vars": ["error", { vars: "all", args: "after-used", ignoreRestSiblings: true }],
  "@typescript-eslint/no-unused-vars": ["error"],
  "import/no-unused-modules": ["warn", { unusedExports: true }],
}
```

---

## Quick Fix Checklist

```
- [ ] reports.tsx:53   — Delete `const rest = ...` and simplify count to REPORTS.length
- [ ] reports.tsx:41   — Merge `draft` into `pending`, rename stat label
- [ ] index.tsx:33     — Delete local COVERAGE, import from mock-data
- [ ] mock-data.ts:1   — Remove `color` from all FRAMEWORKS entries
- [ ] api/types.ts     — Remove `color?: string` from Framework interface
- [ ] auth.ts:50       — Delete `getMe()` function
- [ ] mock-data.ts:10  — Decide: add `stride` to api/types.ts OR remove from mock
- [ ] new-scan.tsx:77  — Add TODO comment, or wire real API call
- [ ] findings.tsx:282 — Disable buttons or add pending-state handler
- [ ] AppShell.tsx:144 — Remove search input OR wire to a real filter
- [ ] AppShell.tsx:118 — Remove hardcoded "312 ms" stats OR pull from API
- [ ] reports.tsx:318  — Add onClick handler or disable button
- [ ] root/            — Delete duplicate copilot-instructions.md from project root
```

---

*Review completed: August 5, 2026 | Reviewer: Antigravity AI*  
*Mode: [MODE: CODE_REVIEW per copilot-instructions.md](file:///c:/Users/jigne/OneDrive/Desktop/College%20Project/arch-detective/.agents/copilot-instructions.md)*
