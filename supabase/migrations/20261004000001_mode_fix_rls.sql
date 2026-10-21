-- ====================================================
-- ARCH-DETECTIVE / THREATLENS - MODE_FIX_RLS MIGRATION
-- Migration: 20261004000001_mode_fix_rls
-- Applied: 2026-10-04
-- ====================================================
-- 1. Optimizes RLS helper functions with (SELECT auth.uid()) InitPlan support.
-- 2. Eliminates RLS blocking for both authenticated and demo/anon users.
-- 3. Consolidates multi-permissive policies and adds foreign key indexes.
-- 4. Secures SECURITY DEFINER trigger functions.
-- ====================================================

-- 1. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces w
    LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id
    WHERE w.id = p_workspace_id
      AND (
        ((SELECT auth.uid()) IS NOT NULL AND (w.owner_user_id = (SELECT auth.uid()) OR wm.user_id = (SELECT auth.uid())))
        OR ((SELECT auth.uid()) IS NULL AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.workspace_user_role(p_workspace_id uuid)
RETURNS public.workspace_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT wm.role
      FROM public.workspace_members wm
      WHERE wm.workspace_id = p_workspace_id
        AND wm.user_id = (SELECT auth.uid())
      LIMIT 1
    ),
    (
      SELECT 'owner'::public.workspace_role
      FROM public.workspaces w
      WHERE w.id = p_workspace_id
        AND (
          ((SELECT auth.uid()) IS NOT NULL AND w.owner_user_id = (SELECT auth.uid()))
          OR ((SELECT auth.uid()) IS NULL AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid)
        )
      LIMIT 1
    )
  );
$$;

-- Secure trigger function
CREATE OR REPLACE FUNCTION public.handle_workspace_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_user_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_workspace_created() FROM public, anon, authenticated;

-- Foreign key covering indexes
CREATE INDEX IF NOT EXISTS findings_assigned_to_idx ON public.findings(assigned_to);
CREATE INDEX IF NOT EXISTS workspace_invites_invited_by_idx ON public.workspace_invites(invited_by);

-- 2. WORKSPACES POLICIES
CREATE POLICY "workspaces_select" ON public.workspaces
  FOR SELECT TO authenticated, anon
  USING (
    ((SELECT auth.uid()) IS NOT NULL AND (owner_user_id = (SELECT auth.uid()) OR public.is_workspace_member(id)))
    OR ((SELECT auth.uid()) IS NULL AND owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid)
  );

CREATE POLICY "workspaces_insert" ON public.workspaces
  FOR INSERT TO authenticated, anon
  WITH CHECK (
    ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = owner_user_id)
    OR ((SELECT auth.uid()) IS NULL AND owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid)
  );

CREATE POLICY "workspaces_update" ON public.workspaces
  FOR UPDATE TO authenticated, anon
  USING (
    ((SELECT auth.uid()) IS NOT NULL AND public.workspace_user_role(id) IN ('owner', 'admin'))
    OR ((SELECT auth.uid()) IS NULL AND owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid)
  );

CREATE POLICY "workspaces_delete" ON public.workspaces
  FOR DELETE TO authenticated
  USING (public.workspace_user_role(id) = 'owner');

-- 3. WORKSPACE MEMBERS POLICIES
CREATE POLICY "ws_members_select" ON public.workspace_members
  FOR SELECT TO authenticated, anon
  USING (
    ((SELECT auth.uid()) IS NOT NULL AND (public.is_workspace_member(workspace_id) OR user_id = (SELECT auth.uid())))
    OR ((SELECT auth.uid()) IS NULL AND EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid
    ))
  );

CREATE POLICY "ws_members_insert" ON public.workspace_members
  FOR INSERT TO authenticated, anon
  WITH CHECK (
    ((SELECT auth.uid()) IS NOT NULL AND public.workspace_user_role(workspace_id) IN ('owner', 'admin'))
    OR ((SELECT auth.uid()) IS NULL AND EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid
    ))
  );

CREATE POLICY "ws_members_update" ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (public.workspace_user_role(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "ws_members_delete" ON public.workspace_members
  FOR DELETE TO authenticated
  USING (public.workspace_user_role(workspace_id) IN ('owner', 'admin'));

-- 4. SCANS POLICIES
CREATE POLICY "scans_select" ON public.scans
  FOR SELECT TO authenticated, anon
  USING (
    ((SELECT auth.uid()) IS NOT NULL AND public.is_workspace_member(workspace_id))
    OR ((SELECT auth.uid()) IS NULL AND EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid
    ))
  );

CREATE POLICY "scans_insert" ON public.scans
  FOR INSERT TO authenticated, anon
  WITH CHECK (
    ((SELECT auth.uid()) IS NOT NULL AND public.workspace_user_role(workspace_id) IN ('owner', 'admin', 'analyst'))
    OR ((SELECT auth.uid()) IS NULL AND EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid
    ))
  );

CREATE POLICY "scans_update" ON public.scans
  FOR UPDATE TO authenticated, anon
  USING (
    ((SELECT auth.uid()) IS NOT NULL AND public.workspace_user_role(workspace_id) IN ('owner', 'admin', 'analyst'))
    OR ((SELECT auth.uid()) IS NULL AND EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid
    ))
  );

CREATE POLICY "scans_delete" ON public.scans
  FOR DELETE TO authenticated
  USING (public.workspace_user_role(workspace_id) IN ('owner', 'admin'));

-- 5. FINDINGS POLICIES
CREATE POLICY "findings_select" ON public.findings
  FOR SELECT TO authenticated, anon
  USING (
    ((SELECT auth.uid()) IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.scans s
      WHERE s.id = scan_id AND public.is_workspace_member(s.workspace_id)
    ))
    OR ((SELECT auth.uid()) IS NULL AND EXISTS (
      SELECT 1 FROM public.scans s
      JOIN public.workspaces w ON w.id = s.workspace_id
      WHERE s.id = scan_id AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid
    ))
  );

CREATE POLICY "findings_insert" ON public.findings
  FOR INSERT TO authenticated, anon
  WITH CHECK (
    ((SELECT auth.uid()) IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.scans s
      WHERE s.id = scan_id AND public.workspace_user_role(s.workspace_id) IN ('owner', 'admin', 'analyst')
    ))
    OR ((SELECT auth.uid()) IS NULL AND EXISTS (
      SELECT 1 FROM public.scans s
      JOIN public.workspaces w ON w.id = s.workspace_id
      WHERE s.id = scan_id AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid
    ))
  );

CREATE POLICY "findings_update" ON public.findings
  FOR UPDATE TO authenticated, anon
  USING (
    ((SELECT auth.uid()) IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.scans s
      WHERE s.id = scan_id AND public.workspace_user_role(s.workspace_id) IN ('owner', 'admin', 'analyst')
    ))
    OR ((SELECT auth.uid()) IS NULL AND EXISTS (
      SELECT 1 FROM public.scans s
      JOIN public.workspaces w ON w.id = s.workspace_id
      WHERE s.id = scan_id AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid
    ))
  );

-- 6. COMPLIANCE VIOLATIONS POLICIES
CREATE POLICY "violations_select" ON public.compliance_violations
  FOR SELECT TO authenticated, anon
  USING (
    ((SELECT auth.uid()) IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.findings f
      JOIN public.scans s ON s.id = f.scan_id
      WHERE f.id = finding_id AND public.is_workspace_member(s.workspace_id)
    ))
    OR ((SELECT auth.uid()) IS NULL AND EXISTS (
      SELECT 1 FROM public.findings f
      JOIN public.scans s ON s.id = f.scan_id
      JOIN public.workspaces w ON w.id = s.workspace_id
      WHERE f.id = finding_id AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid
    ))
  );

CREATE POLICY "violations_insert" ON public.compliance_violations
  FOR INSERT TO authenticated, anon
  WITH CHECK (
    ((SELECT auth.uid()) IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.findings f
      JOIN public.scans s ON s.id = f.scan_id
      WHERE f.id = finding_id AND public.workspace_user_role(s.workspace_id) IN ('owner', 'admin', 'analyst')
    ))
    OR ((SELECT auth.uid()) IS NULL AND EXISTS (
      SELECT 1 FROM public.findings f
      JOIN public.scans s ON s.id = f.scan_id
      JOIN public.workspaces w ON w.id = s.workspace_id
      WHERE f.id = finding_id AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid
    ))
  );

-- 7. REPORTS POLICIES
CREATE POLICY "reports_select" ON public.reports
  FOR SELECT TO authenticated, anon
  USING (
    ((SELECT auth.uid()) IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.scans s
      WHERE s.id = scan_id AND public.is_workspace_member(s.workspace_id)
    ))
    OR ((SELECT auth.uid()) IS NULL AND EXISTS (
      SELECT 1 FROM public.scans s
      JOIN public.workspaces w ON w.id = s.workspace_id
      WHERE s.id = scan_id AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid
    ))
  );

CREATE POLICY "reports_insert" ON public.reports
  FOR INSERT TO authenticated, anon
  WITH CHECK (
    ((SELECT auth.uid()) IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.scans s
      WHERE s.id = scan_id AND public.workspace_user_role(s.workspace_id) IN ('owner', 'admin', 'analyst')
    ))
    OR ((SELECT auth.uid()) IS NULL AND EXISTS (
      SELECT 1 FROM public.scans s
      JOIN public.workspaces w ON w.id = s.workspace_id
      WHERE s.id = scan_id AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid
    ))
  );

CREATE POLICY "reports_update" ON public.reports
  FOR UPDATE TO authenticated, anon
  USING (
    ((SELECT auth.uid()) IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.scans s
      WHERE s.id = scan_id AND public.workspace_user_role(s.workspace_id) IN ('owner', 'admin', 'analyst')
    ))
    OR ((SELECT auth.uid()) IS NULL AND EXISTS (
      SELECT 1 FROM public.scans s
      JOIN public.workspaces w ON w.id = s.workspace_id
      WHERE s.id = scan_id AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid
    ))
  );

-- 8. AUDIT EVENTS POLICIES
CREATE POLICY "audit_events_select" ON public.audit_events
  FOR SELECT TO authenticated, anon
  USING (
    ((SELECT auth.uid()) IS NOT NULL AND public.is_workspace_member(workspace_id))
    OR ((SELECT auth.uid()) IS NULL AND EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid
    ))
  );

CREATE POLICY "audit_events_insert" ON public.audit_events
  FOR INSERT TO authenticated, anon
  WITH CHECK (
    ((SELECT auth.uid()) IS NOT NULL AND public.is_workspace_member(workspace_id))
    OR ((SELECT auth.uid()) IS NULL AND EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid
    ))
  );

-- 9. PROFILES POLICY
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    ((SELECT auth.uid()) = id)
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm1
      JOIN public.workspace_members wm2 ON wm2.workspace_id = wm1.workspace_id
      WHERE wm1.user_id = (SELECT auth.uid()) AND wm2.user_id = profiles.id
    )
  );
