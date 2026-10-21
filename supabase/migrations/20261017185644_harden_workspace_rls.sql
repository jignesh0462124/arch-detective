-- Replace the legacy anonymous/demo bypass, not just add restrictive policies:
-- permissive policies combine with OR, so leaving an old policy would retain it.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

-- A definer lookup is necessary here to avoid recursively querying membership
-- through its own RLS policy. Identity always comes from the caller's JWT.
CREATE OR REPLACE FUNCTION private.workspace_role(p_workspace_id uuid)
RETURNS public.workspace_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN w.owner_user_id = (SELECT auth.uid()) THEN 'owner'::public.workspace_role
    ELSE (SELECT m.role FROM public.workspace_members m
          WHERE m.workspace_id = w.id AND m.user_id = (SELECT auth.uid())) END
  FROM public.workspaces w
  WHERE w.id = p_workspace_id AND (SELECT auth.uid()) IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION private.workspace_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.workspace_role(uuid) TO authenticated;

-- Retain existing function signatures for consumers, but remove their elevated
-- privileges and anonymous access. The private helper is not a Data API RPC.
CREATE OR REPLACE FUNCTION public.workspace_user_role(p_workspace_id uuid)
RETURNS public.workspace_role LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.workspace_role(p_workspace_id);
$$;
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.workspace_role(p_workspace_id) IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.workspace_user_role(uuid), public.is_workspace_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_user_role(uuid), public.is_workspace_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.shares_workspace(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.user_id = p_user_id AND private.workspace_role(m.workspace_id) IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION private.shares_workspace(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.shares_workspace(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_workspace_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.workspace_members(workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_user_id, 'owner') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles(id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_workspace_created(), public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Compatibility with the fields already written by the scan persistence code.
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS critical_count integer NOT NULL DEFAULT 0 CHECK (critical_count >= 0);
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS high_count integer NOT NULL DEFAULT 0 CHECK (high_count >= 0);
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS summary jsonb NOT NULL DEFAULT '{}';

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY (ARRAY[
      'profiles','workspaces','workspace_members','workspace_invites','scans',
      'findings','compliance_violations','reports','audit_events'])
      AND roles && ARRAY['public','anon','authenticated']::name[]
  LOOP EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename); END LOOP;
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.profiles, public.workspaces, public.workspace_members,
  public.workspace_invites, public.scans, public.findings,
  public.compliance_violations, public.reports, public.audit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profiles, public.workspaces, public.workspace_members,
  public.workspace_invites, public.scans, public.findings,
  public.compliance_violations, public.reports, public.audit_events TO authenticated;
GRANT INSERT, DELETE ON public.workspaces, public.workspace_members, public.workspace_invites, public.scans TO authenticated;
GRANT INSERT ON public.findings, public.compliance_violations, public.audit_events TO authenticated;
-- Client-created report registrations must not point at another tenant's
-- storage object. Only the trusted backend may assign artifact paths/digests.
GRANT INSERT(id, scan_id, status) ON public.reports TO authenticated;
-- Column privileges prevent transferring ownership/tenant IDs via direct REST.
GRANT UPDATE(display_name, avatar_url, updated_at) ON public.profiles TO authenticated;
GRANT UPDATE(name, slug, settings, updated_at) ON public.workspaces TO authenticated;
GRANT UPDATE(role, updated_at) ON public.workspace_members TO authenticated;
GRANT UPDATE(target_name, selected_frameworks, status, progress, finding_count,
  critical_count, high_count, framework_scores, summary, error_code, error_message,
  started_at, completed_at) ON public.scans TO authenticated;
GRANT UPDATE(state, state_note, assigned_to, updated_at) ON public.findings TO authenticated;
GRANT UPDATE(status) ON public.reports TO authenticated;

CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR private.shares_workspace(id));
CREATE POLICY profiles_edit ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY workspaces_read ON public.workspaces FOR SELECT TO authenticated
  USING (private.workspace_role(id) IS NOT NULL);
CREATE POLICY workspaces_create ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY workspaces_edit ON public.workspaces FOR UPDATE TO authenticated
  USING (private.workspace_role(id) IN ('owner','admin'))
  WITH CHECK (private.workspace_role(id) IN ('owner','admin'));
CREATE POLICY workspaces_delete ON public.workspaces FOR DELETE TO authenticated
  USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY members_read ON public.workspace_members FOR SELECT TO authenticated
  USING (private.workspace_role(workspace_id) IS NOT NULL);
CREATE POLICY members_create ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (private.workspace_role(workspace_id) IN ('owner','admin') AND role <> 'owner');
CREATE POLICY members_edit ON public.workspace_members FOR UPDATE TO authenticated
  USING (private.workspace_role(workspace_id) IN ('owner','admin') AND role <> 'owner')
  WITH CHECK (private.workspace_role(workspace_id) IN ('owner','admin') AND role <> 'owner');
CREATE POLICY members_delete ON public.workspace_members FOR DELETE TO authenticated
  USING (private.workspace_role(workspace_id) IN ('owner','admin') AND role <> 'owner');
CREATE POLICY invites_read ON public.workspace_invites FOR SELECT TO authenticated
  USING (private.workspace_role(workspace_id) IN ('owner','admin'));
CREATE POLICY invites_create ON public.workspace_invites FOR INSERT TO authenticated
  WITH CHECK (private.workspace_role(workspace_id) IN ('owner','admin') AND role <> 'owner' AND invited_by = (SELECT auth.uid()));
CREATE POLICY invites_delete ON public.workspace_invites FOR DELETE TO authenticated
  USING (private.workspace_role(workspace_id) IN ('owner','admin'));
CREATE POLICY scans_read ON public.scans FOR SELECT TO authenticated
  USING (private.workspace_role(workspace_id) IS NOT NULL);
CREATE POLICY scans_create ON public.scans FOR INSERT TO authenticated
  WITH CHECK (private.workspace_role(workspace_id) IN ('owner','admin','analyst') AND created_by = (SELECT auth.uid()));
CREATE POLICY scans_edit ON public.scans FOR UPDATE TO authenticated
  USING (private.workspace_role(workspace_id) IN ('owner','admin','analyst'))
  WITH CHECK (private.workspace_role(workspace_id) IN ('owner','admin','analyst'));
CREATE POLICY scans_delete ON public.scans FOR DELETE TO authenticated
  USING (private.workspace_role(workspace_id) IN ('owner','admin'));
CREATE POLICY findings_read ON public.findings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND private.workspace_role(s.workspace_id) IS NOT NULL));
CREATE POLICY findings_create ON public.findings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND private.workspace_role(s.workspace_id) IN ('owner','admin','analyst')));
CREATE POLICY findings_edit ON public.findings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND private.workspace_role(s.workspace_id) IN ('owner','admin','analyst')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND private.workspace_role(s.workspace_id) IN ('owner','admin','analyst')));
CREATE POLICY violations_read ON public.compliance_violations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.findings f WHERE f.id = finding_id));
CREATE POLICY violations_create ON public.compliance_violations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.findings f JOIN public.scans s ON s.id = f.scan_id
    WHERE f.id = finding_id AND private.workspace_role(s.workspace_id) IN ('owner','admin','analyst')));
CREATE POLICY reports_read ON public.reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id));
CREATE POLICY reports_create ON public.reports FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND private.workspace_role(s.workspace_id) IN ('owner','admin','analyst')));
CREATE POLICY reports_edit ON public.reports FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND private.workspace_role(s.workspace_id) IN ('owner','admin','analyst')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND private.workspace_role(s.workspace_id) IN ('owner','admin','analyst')));
CREATE POLICY events_read ON public.audit_events FOR SELECT TO authenticated
  USING (private.workspace_role(workspace_id) IN ('owner','admin'));
CREATE POLICY events_create ON public.audit_events FOR INSERT TO authenticated
  WITH CHECK (private.workspace_role(workspace_id) IS NOT NULL AND actor_user_id = (SELECT auth.uid()));

ALTER VIEW public.workspaces_with_counts SET (security_invoker = true);
REVOKE ALL ON public.workspaces_with_counts FROM PUBLIC, anon;
GRANT SELECT ON public.workspaces_with_counts TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
