-- Read-only deployment checks. Run using the intended project's SQL editor.
-- All application tables should have RLS enabled and no anon/PUBLIC policies.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS anon_has_table_privilege
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = ANY (ARRAY[
  'profiles','workspaces','workspace_members','workspace_invites','scans',
  'findings','compliance_violations','reports','audit_events'])
ORDER BY c.relname;

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

SELECT relname, reloptions FROM pg_class
WHERE oid = 'public.workspaces_with_counts'::regclass;

-- Should return no rows. Review legacy memberships created before hardening.
SELECT m.workspace_id, m.user_id, m.role
FROM public.workspace_members m JOIN public.workspaces w ON w.id = m.workspace_id
WHERE m.role = 'owner' AND m.user_id <> w.owner_user_id;

SELECT has_function_privilege('anon', 'public.workspace_user_role(uuid)', 'EXECUTE') AS anon_can_call_role_helper,
  has_function_privilege('anon', 'public.is_workspace_member(uuid)', 'EXECUTE') AS anon_can_call_member_helper;
