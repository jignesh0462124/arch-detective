-- All fixture accounts and rows are uncommitted and rolled back. No emails are
-- sent (this is SQL, not an Auth signup call). Never remove the final ROLLBACK.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';
DO $test$
#variable_conflict use_variable
DECLARE
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  member_id uuid := gen_random_uuid();
  workspace_id uuid := gen_random_uuid();
  other_workspace_id uuid := gen_random_uuid();
  scan_id uuid := gen_random_uuid();
  finding_id uuid := gen_random_uuid();
  report_id uuid := gen_random_uuid();
  row_count integer;
BEGIN
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
    (owner_id,'archon-rls-'||owner_id::text||'@example.invalid','{}'),
    (other_id,'archon-rls-'||other_id::text||'@example.invalid','{}'),
    (member_id,'archon-rls-'||member_id::text||'@example.invalid','{}');

  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.workspaces(id,name,slug,owner_user_id)
    VALUES(workspace_id,'RLS rollback-only verification','rls-check-'||workspace_id::text,owner_id);
  SELECT count(*) INTO row_count FROM public.workspace_members m WHERE m.workspace_id=workspace_id AND m.user_id=owner_id AND m.role='owner';
  IF row_count<>1 THEN RAISE EXCEPTION 'Owner trigger failed'; END IF;
  INSERT INTO public.workspace_members(workspace_id,user_id,role) VALUES(workspace_id,member_id,'viewer');
  INSERT INTO public.scans(id,workspace_id,created_by,target_name,status) VALUES(scan_id,workspace_id,owner_id,'RLS test fixture','completed');
  INSERT INTO public.findings(id,scan_id,title,severity,source) VALUES(finding_id,scan_id,'RLS test fixture','high','llm-review');
  INSERT INTO public.reports(id,scan_id,status) VALUES(report_id,scan_id,'ready');
  BEGIN
    INSERT INTO public.reports(scan_id,object_path) VALUES(scan_id,'another-tenant/report.pdf');
    RAISE EXCEPTION 'Forged artifact path was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub',other_id::text,true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.workspaces(id,name,slug,owner_user_id)
    VALUES(other_workspace_id,'RLS second fixture','rls-check-'||other_workspace_id::text,other_id);
  SELECT count(*) INTO row_count FROM public.workspaces w WHERE w.id IN(workspace_id,other_workspace_id);
  IF row_count<>1 THEN RAISE EXCEPTION 'Workspace tenant isolation failed'; END IF;
  SELECT count(*) INTO row_count FROM public.scans s WHERE s.id=scan_id;
  IF row_count<>0 THEN RAISE EXCEPTION 'Cross-tenant scan visible'; END IF;
  BEGIN
    INSERT INTO public.workspace_members(workspace_id,user_id,role) VALUES(workspace_id,other_id,'admin');
    RAISE EXCEPTION 'Cross-tenant membership accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO row_count FROM public.findings f WHERE f.id=finding_id;
  IF row_count<>1 THEN RAISE EXCEPTION 'Viewer cannot read findings'; END IF;
  UPDATE public.findings f SET state='resolved' WHERE f.id=finding_id;
  GET DIAGNOSTICS row_count=ROW_COUNT;
  IF row_count<>0 THEN RAISE EXCEPTION 'Viewer can triage'; END IF;
  BEGIN
    INSERT INTO public.scans(workspace_id,created_by,target_name) VALUES(workspace_id,member_id,'Viewer denied fixture');
    RAISE EXCEPTION 'Viewer scan accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  SET LOCAL ROLE authenticated;
  UPDATE public.workspace_members m SET role='analyst' WHERE m.workspace_id=workspace_id AND m.user_id=member_id;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
  SET LOCAL ROLE authenticated;
  UPDATE public.findings f SET state='resolved' WHERE f.id=finding_id;
  GET DIAGNOSTICS row_count=ROW_COUNT;
  IF row_count<>1 THEN RAISE EXCEPTION 'Analyst triage failed'; END IF;
  INSERT INTO public.scans(workspace_id,created_by,target_name) VALUES(workspace_id,member_id,'Analyst allowed fixture');
  DELETE FROM public.scans s WHERE s.id=scan_id;
  GET DIAGNOSTICS row_count=ROW_COUNT;
  IF row_count<>0 THEN RAISE EXCEPTION 'Analyst can delete scans'; END IF;
  BEGIN
    UPDATE public.scans s SET workspace_id=other_workspace_id WHERE s.id=scan_id;
    RAISE EXCEPTION 'Scan tenant reassignment accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  SET LOCAL ROLE authenticated;
  UPDATE public.workspace_members m SET role='admin' WHERE m.workspace_id=workspace_id AND m.user_id=member_id;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
  SET LOCAL ROLE authenticated;
  UPDATE public.workspaces w SET name='RLS renamed fixture' WHERE w.id=workspace_id;
  GET DIAGNOSTICS row_count=ROW_COUNT;
  IF row_count<>1 THEN RAISE EXCEPTION 'Admin workspace update failed'; END IF;
  BEGIN
    UPDATE public.workspace_members m SET role='owner' WHERE m.workspace_id=workspace_id AND m.user_id=member_id;
    RAISE EXCEPTION 'Admin can promote to owner';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  DELETE FROM public.workspace_members m WHERE m.workspace_id=workspace_id AND m.user_id=owner_id;
  GET DIAGNOSTICS row_count=ROW_COUNT;
  IF row_count<>0 THEN RAISE EXCEPTION 'Admin removed owner'; END IF;
  BEGIN
    UPDATE public.workspaces w SET owner_user_id=member_id WHERE w.id=workspace_id;
    RAISE EXCEPTION 'Ownership reassignment accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.audit_events(workspace_id,actor_user_id,event_type) VALUES(workspace_id,other_id,'forged');
    RAISE EXCEPTION 'Spoofed actor accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.reports r SET object_path='forged.pdf' WHERE r.id=report_id;
    RAISE EXCEPTION 'Report artifact reassignment accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  SELECT count(*) INTO row_count FROM public.workspaces_with_counts w WHERE w.id IN(workspace_id,other_workspace_id);
  IF row_count<>1 THEN RAISE EXCEPTION 'Counts view bypasses tenant RLS'; END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub','',true);
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM id FROM public.workspaces LIMIT 1;
    RAISE EXCEPTION 'Anonymous table access accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.is_workspace_member(workspace_id);
    RAISE EXCEPTION 'Anonymous helper execution accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO row_count FROM public.workspaces w WHERE w.id IN(workspace_id,other_workspace_id);
  IF row_count<>2 THEN RAISE EXCEPTION 'Trusted backend access broken'; END IF;
  RESET ROLE;
END;
$test$;
SELECT 'PASS: live owner/admin/analyst/viewer/outsider/anon/service-role verification; fixtures will be rolled back' AS result;
ROLLBACK;
