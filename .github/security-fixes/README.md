# Archon correctness and access-control fixes

## Deployment status

Application fixes are implemented and the RLS hardening is **applied and verified on hosted Supabase** project `gzyxgqxycbccifajdoiu` (`group-project`). Deployment is recorded as migration `20261017185644` (`harden_workspace_rls`). The local migration filename matches the version returned by Supabase.

The supplied access token was used in memory, not stored in project files or CLI configuration. Revoke it after this task because it was shared in chat.

## Database fix

Migration: `supabase/migrations/20261017185644_harden_workspace_rls.sql`.

- Replaces legacy client policies (including the hard-coded anonymous demo-owner bypass). Adding another permissive policy alone would not close this bypass.
- Restricts reads to workspace members and writes to the appropriate owner/admin/analyst roles. Viewers cannot scan or triage.
- Uses private, identity-bound role lookups to avoid recursive membership RLS. Public compatibility wrappers are security invoker, not definer.
- Protects owner membership and ownership/tenant foreign keys from direct client reassignment.
- Removes anonymous grants; keeps the counts view security-invoker and authenticated-only.
- Restricts browser report writes to registrations/status; storage paths and integrity metadata can only be assigned by the trusted backend, preventing forged cross-workspace artifact references.
- Binds invite creators and audit actors to the authenticated user. Audit events cannot be updated/deleted by browser clients.
- Preserves dedicated backend-role policies and does not delete project data.
- Adds the scan summary columns already expected by the client, if missing.

This migration targets the **Supabase schema represented by `supabase/migrations/`**. The Python Alembic schema is a separate deployment path; do not blindly mix or reset the two histories. Review the hosted schema and migration history first, particularly any custom policies or functions added outside this repository.

For future deployments:

1. Connect the Supabase account with access to the configured project. Do not paste secrets into chat or commit credentials.
2. Take a database backup and inspect schema/policies and existing migration history. Confirm the expected tables, columns and enum types match this migration.
3. Review and apply **only the new hardening migration**, transactionally, through the intended project's SQL editor or a properly reconciled CLI migration workflow. Do not replay all historical migrations on an existing project.
4. Run `supabase/security/verify_workspace_rls.sql`, then Supabase Security Advisor. Confirm RLS is enabled, anonymous grants are absent, UPDATE policies have both predicates, and the counts view has `security_invoker=true`.
5. Run `supabase/security/test_live_rls.sql` using an administrative SQL connection. It creates only uncommitted fixture identities/workspaces, checks all roles and ends with ROLLBACK. Never remove its final rollback. Also verify the browser and storage configuration in that deployment.
6. Review pre-existing members/invites and activity for unexpected access. Closing a policy cannot undo previous access or identify all previously disclosed information.

## Hosted verification (18 October 2026, Asia/Calcutta)

- Live schema and policy metadata were inspected first; the pre-change snapshot is `live-schema-before.json`. No hosted backup snapshots/PITR were available, so the change was limited to access-control/schema DDL, with a rollback-only rehearsal before deployment. No application records were migrated or deleted.
- The role tests passed both before committing the migration (rollback rehearsal) and after deployment. Fixture accounts/workspaces were confirmed absent afterward.
- All 9 public application tables have RLS enabled, no anonymous table privileges, and preserved service-role privileges.
- All 27 client policies target authenticated users; zero anonymous/PUBLIC policies remain. UPDATE policies include both USING and WITH CHECK.
- Zero public SECURITY DEFINER functions are executable by browser roles. The counts view remains security-invoker.
- Browser roles cannot insert/update report object paths or write integrity metadata.
- Existing counts were unchanged: 3 workspaces, 3 memberships, 33 events, 0 hosted scans/findings/reports. One real user/profile remains. The MERN audit shown in the browser is cached local evidence, not a persisted hosted scan; the earlier UI fixes recover it without inventing database records.
- Supabase Security Advisor now has **no RLS/function-security findings**. Its remaining warning is **Leaked Password Protection Disabled**, a separate Auth setting not changed by this migration. Storage has no buckets or custom object policies in this project; no Storage behavior was changed.
- Earlier schema changes had no recorded Supabase migration history. Only the new migration is recorded; do not blindly replay historical SQL or claim those earlier files were formally tracked.

## Application fixes

- Scan summaries and restored risk labels derive from actual findings. A scoped batch query loads severity evidence without changing the original parent scan query. Completed legacy snapshots remain available even when no history ledger entry was saved.
- Workspace roles are read from memberships instead of showing every member as owner. Missing authentication can no longer impersonate a default account.
- Denied database triage writes cannot be disguised as successful local overrides. Local history updates match the scan, not just an array position.
- Saved scans feed the derived Attack Graph; examples are labeled separately. Inferred topology is not verified runtime infrastructure.
- Reports can be generated from completed persisted scans without fabricated findings/scores. Unknown report IDs produce not-found rather than fabricated reports; database lookup is workspace-scoped.
- Local report HTML escapes untrusted source/model text. Unknown artifact sizes remain unknown, not invented.
- Registration reuses the current signup page. Usage/data notices replace dead links and explicitly identify the research-prototype limitations; they are not finalized legal policies.
- User-facing branding, workspace slug validation/back navigation, false audit integrity claims and invented dashboard timing metrics are corrected.
- Advisor calls use the existing authenticated backend with server-side credentials, bounded inputs, streaming and provider failover. Unavailable providers produce errors, not generic text presented as AI output.
- Backend CORS uses the explicit `CORS_ORIGINS` allowlist; configure the exact deployed frontend origin. Arbitrary Vercel deployments are no longer trusted.

## Credentials and configuration

**Rotate existing OmegaPlus/Groq keys** because the previous frontend referenced `VITE_*_API_KEY` variables, which are public build inputs. Keep new values only in the backend environment (`threatlens/.env` locally), remove stale frontend key copies, and rebuild/redeploy. No credential values are written in these fixes. Keep Supabase service-role keys server-only.

The existing local scanner endpoints remain a development workflow, not a hosted multi-tenant authorization boundary. RLS protects database records, not local archive/result files. Do not expose `/api/local/*` publicly without a separately designed authenticated artifact-access model.

## Verification

- `npm run test:rls`: embedded real Postgres (PGlite), replays all checked-in Supabase migrations; tests signup/owner trigger, all roles, denied anonymous access, cross-workspace isolation, invoker view, protected columns and role escalation. No hosted data is touched. The test fixture supplies minimal Auth roles/schema and a substitute random-byte default; hosted Storage/Auth services are not emulated.
- `npm run test:summary`: severity/health/risk normalization and HTML escaping.
- `python -m pytest tests -q` from `threatlens/`: existing backend coverage plus authenticated advisor transport, validation, server-only keys and fallback tests. External AI calls are mocked.
- `npm run typecheck` and `npm run build`: application compatibility checks.

Dependency security updates keep TanStack Start pinned to `1.168.60`, the patched release supporting Vite 7. Forced toolchain upgrades are deliberately not used. Remaining development-tool advisories need a separate compatibility-tested upgrade; inspect `npm audit` before production.

Final checks: 104 isolated RLS assertions, 9 summary/escaping assertions, 98 backend tests passed (4 skipped), TypeScript passed, and production build passed. Browser checks confirmed the restored MERN audit's 1 high / 1 medium findings, High risk, dashboard recovery and completed-scan report selection. A build-output check found no configured provider keys in 74 public assets. `npm audit --omit=dev` reports zero production advisories; the full audit still reports 9 development-tool advisories (4 moderate, 5 high).

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [database testing](https://supabase.com/docs/guides/database/testing), [TanStack Start security advisory](https://github.com/advisories/GHSA-qx66-fv34-fjm8).
