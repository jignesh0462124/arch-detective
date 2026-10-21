-- Hosted metadata/RLS smoke test. Uses one existing owner only as FK context.
-- All synthetic rows and settings are rolled back; no source objects are uploaded.
BEGIN;
SET LOCAL statement_timeout = '30s';
DO $$
DECLARE test_user uuid; test_workspace uuid; test_scan uuid := gen_random_uuid();
        test_snapshot uuid := gen_random_uuid(); test_file uuid := gen_random_uuid();
        test_finding uuid := gen_random_uuid();
BEGIN
  SELECT user_id,workspace_id INTO test_user,test_workspace
  FROM public.workspace_members WHERE role='owner' LIMIT 1;
  IF test_user IS NULL THEN RAISE EXCEPTION 'No existing owner available for rollback-only verification'; END IF;
  PERFORM set_config('workbench_test.user',test_user::text,true);
  PERFORM set_config('workbench_test.scan',test_scan::text,true);
  PERFORM set_config('workbench_test.snapshot',test_snapshot::text,true);
  PERFORM set_config('workbench_test.file',test_file::text,true);
  PERFORM set_config('workbench_test.finding',test_finding::text,true);
  INSERT INTO public.scans(id,workspace_id,created_by,scan_type,source_type,target_name,status)
    VALUES(test_scan,test_workspace,test_user,'codebase','upload','Rollback-only workbench verification','completed');
  INSERT INTO public.audit_workbench_jobs(scan_id,workspace_id,created_by,idempotency_key,request_hash,status)
    VALUES(test_scan,test_workspace,test_user,gen_random_uuid(),'verification-only','completed');
  INSERT INTO public.source_snapshots(id,scan_id,state,file_count)
    VALUES(test_snapshot,test_scan,'ready',1);
  INSERT INTO public.snapshot_files(id,snapshot_id,path,byte_size,line_count,preview_state,object_path)
    VALUES(test_file,test_snapshot,'fixture.py',1,1,'pending','__rollback_verification__/'||test_file||'.txt');
  INSERT INTO public.findings(id,scan_id,title,severity,source)
    VALUES(test_finding,test_scan,'Rollback-only fixture','low','static-rule');
  INSERT INTO public.finding_locations(finding_id,snapshot_id,file_id,line_number,match_status)
    VALUES(test_finding,test_snapshot,test_file,1,'verified');
END $$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE visible integer; denied boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',current_setting('workbench_test.user'),true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',current_setting('workbench_test.user'),'role','authenticated')::text,true);
  SELECT count(*) INTO visible FROM public.audit_workbench_jobs WHERE scan_id=current_setting('workbench_test.scan')::uuid;
  IF visible <> 1 THEN RAISE EXCEPTION 'Member cannot read job'; END IF;
  SELECT count(*) INTO visible FROM public.source_snapshots WHERE id=current_setting('workbench_test.snapshot')::uuid;
  IF visible <> 1 THEN RAISE EXCEPTION 'Member cannot read snapshot'; END IF;
  SELECT count(*) INTO visible FROM public.snapshot_files WHERE id=current_setting('workbench_test.file')::uuid;
  IF visible <> 1 THEN RAISE EXCEPTION 'Member cannot read file metadata'; END IF;
  SELECT count(*) INTO visible FROM public.finding_locations WHERE finding_id=current_setting('workbench_test.finding')::uuid;
  IF visible <> 1 THEN RAISE EXCEPTION 'Member cannot read finding location'; END IF;
  IF (public.audit_workbench_counts(current_setting('workbench_test.scan')::uuid)->>'total')::integer <> 1
    THEN RAISE EXCEPTION 'Member aggregate has incorrect finding count'; END IF;
  IF (public.audit_workbench_counts(current_setting('workbench_test.scan')::uuid)->'previews'->>'pending')::integer <> 1
    THEN RAISE EXCEPTION 'Pending previews missing from aggregate'; END IF;
  BEGIN
    UPDATE public.source_snapshots SET state='failed' WHERE id=current_setting('workbench_test.snapshot')::uuid;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Browser snapshot write was not denied'; END IF;

  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',current_setting('request.jwt.claim.sub'),'role','authenticated')::text,true);
  SELECT count(*) INTO visible FROM public.audit_workbench_jobs WHERE scan_id=current_setting('workbench_test.scan')::uuid;
  IF visible <> 0 THEN RAISE EXCEPTION 'Job exposed to outsider'; END IF;
  SELECT count(*) INTO visible FROM public.source_snapshots WHERE id=current_setting('workbench_test.snapshot')::uuid;
  IF visible <> 0 THEN RAISE EXCEPTION 'Snapshot exposed to outsider'; END IF;
  SELECT count(*) INTO visible FROM public.snapshot_files WHERE id=current_setting('workbench_test.file')::uuid;
  IF visible <> 0 THEN RAISE EXCEPTION 'File metadata exposed to outsider'; END IF;
  SELECT count(*) INTO visible FROM public.finding_locations WHERE finding_id=current_setting('workbench_test.finding')::uuid;
  IF visible <> 0 THEN RAISE EXCEPTION 'Location exposed to outsider'; END IF;
  IF (public.audit_workbench_counts(current_setting('workbench_test.scan')::uuid)->>'total')::integer <> 0
    THEN RAISE EXCEPTION 'Aggregate bypasses RLS'; END IF;
END $$;

SET LOCAL ROLE anon;
DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    PERFORM 1 FROM public.source_snapshots;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Anonymous metadata read was not denied'; END IF;
  denied := false;
  BEGIN
    PERFORM public.audit_workbench_counts(current_setting('workbench_test.scan')::uuid);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Anonymous aggregate execute was not denied'; END IF;
END $$;
RESET ROLE;
DO $$
DECLARE queued integer;
BEGIN
  DELETE FROM public.scans WHERE id=current_setting('workbench_test.scan')::uuid;
  SELECT count(*) INTO queued FROM public.source_cleanup_queue
    WHERE object_path='__rollback_verification__/'||current_setting('workbench_test.file')||'.txt';
  IF queued <> 1 THEN RAISE EXCEPTION 'Source deletion was not queued'; END IF;
  IF EXISTS(SELECT 1 FROM public.source_snapshots WHERE id=current_setting('workbench_test.snapshot')::uuid)
    THEN RAISE EXCEPTION 'Snapshot did not cascade'; END IF;
END $$;
SELECT 'PASS: member read, outsider isolation, browser write denial, anonymous denial and cascade cleanup; fixtures rolled back' AS verification;
ROLLBACK;
