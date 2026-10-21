-- Additive progressive previews; browser write privileges and retention are unchanged.
ALTER TABLE public.snapshot_files DROP CONSTRAINT snapshot_files_preview_state_check;
ALTER TABLE public.snapshot_files ADD CONSTRAINT snapshot_files_preview_state_check
  CHECK (preview_state IN ('pending','ready','binary','oversized','unsupported','excluded','expired'));

CREATE INDEX findings_workbench_page_idx ON public.findings(scan_id,severity,created_at,id);

-- Every input relation is evaluated with the caller's RLS, including aggregate totals.
CREATE FUNCTION public.audit_workbench_counts(p_scan_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH visible_findings AS MATERIALIZED (
    SELECT f.id,f.severity FROM public.findings f WHERE f.scan_id = p_scan_id
  ), severity_counts AS (
    SELECT severity::text AS severity,count(*) AS n FROM visible_findings GROUP BY severity
  ), file_counts AS (
    SELECT l.file_id,count(*) AS n FROM public.finding_locations l
    JOIN visible_findings f ON f.id = l.finding_id
    WHERE l.file_id IS NOT NULL GROUP BY l.file_id
  ), previews AS (
    SELECT count(*) FILTER (WHERE sf.preview_state = 'ready') AS ready,
           count(*) FILTER (WHERE sf.preview_state = 'pending') AS pending,
           count(*) AS total
    FROM public.snapshot_files sf JOIN public.source_snapshots ss ON ss.id = sf.snapshot_id
    WHERE ss.scan_id = p_scan_id
  )
  SELECT jsonb_build_object(
    'total',(SELECT count(*) FROM visible_findings),
    'severity',coalesce((SELECT jsonb_object_agg(severity,n) FROM severity_counts),'{}'::jsonb),
    'files',coalesce((SELECT jsonb_object_agg(file_id,n) FROM file_counts),'{}'::jsonb),
    'previews',(SELECT jsonb_build_object('ready',ready,'pending',pending,'total',total) FROM previews)
  );
$$;
REVOKE ALL ON FUNCTION public.audit_workbench_counts(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.audit_workbench_counts(uuid) TO authenticated,service_role;
NOTIFY pgrst, 'reload schema';
