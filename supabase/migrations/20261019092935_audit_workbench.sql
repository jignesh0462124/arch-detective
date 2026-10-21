-- Additive workbench metadata. Source bodies are private Storage objects.
ALTER TYPE public.finding_source ADD VALUE IF NOT EXISTS 'static-rule';

CREATE TABLE public.audit_workbench_jobs (
  scan_id uuid PRIMARY KEY REFERENCES public.scans(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  idempotency_key uuid NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  events jsonb NOT NULL DEFAULT '[]',
  result_metadata jsonb NOT NULL DEFAULT '{}',
  error_message text,
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, created_by, idempotency_key)
);
CREATE INDEX audit_jobs_heartbeat_idx ON public.audit_workbench_jobs(heartbeat_at) WHERE status = 'running';
CREATE INDEX audit_jobs_creator_idx ON public.audit_workbench_jobs(created_by);
CREATE TABLE public.source_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL UNIQUE REFERENCES public.scans(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  state text NOT NULL CHECK (state IN ('indexing','ready','failed','expired')),
  file_count integer NOT NULL DEFAULT 0 CHECK (file_count >= 0),
  exclusions jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX source_snapshots_expiry_idx ON public.source_snapshots(expires_at) WHERE state = 'ready';
CREATE TABLE public.snapshot_files (
  id uuid PRIMARY KEY,
  snapshot_id uuid NOT NULL REFERENCES public.source_snapshots(id) ON DELETE CASCADE,
  path text NOT NULL,
  language text NOT NULL DEFAULT 'plaintext',
  byte_size integer NOT NULL CHECK (byte_size >= 0),
  line_count integer NOT NULL CHECK (line_count >= 0),
  content_hash text,
  object_path text UNIQUE,
  preview_state text NOT NULL CHECK (preview_state IN ('ready','binary','oversized','unsupported','excluded','expired')),
  redacted boolean NOT NULL DEFAULT false,
  reason text,
  UNIQUE(snapshot_id, path)
);
-- UNIQUE(snapshot_id,path) already indexes the parent lookup and cascade path.
CREATE TABLE public.finding_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id uuid NOT NULL REFERENCES public.findings(id) ON DELETE CASCADE,
  snapshot_id uuid NOT NULL REFERENCES public.source_snapshots(id) ON DELETE CASCADE,
  file_id uuid REFERENCES public.snapshot_files(id) ON DELETE CASCADE,
  line_number integer CHECK (line_number > 0),
  match_status text NOT NULL CHECK (match_status IN ('verified','unlocated')),
  UNIQUE(finding_id, snapshot_id)
);
CREATE INDEX finding_locations_file_idx ON public.finding_locations(file_id);
CREATE INDEX finding_locations_snapshot_idx ON public.finding_locations(snapshot_id);
CREATE TABLE public.source_cleanup_queue (
  object_path text PRIMARY KEY,
  enqueued_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_workbench_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshot_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finding_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_cleanup_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_workbench_jobs, public.source_snapshots, public.snapshot_files,
  public.finding_locations, public.source_cleanup_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.audit_workbench_jobs, public.source_snapshots,
  public.snapshot_files, public.finding_locations TO authenticated;
GRANT ALL ON public.audit_workbench_jobs, public.source_snapshots, public.snapshot_files,
  public.finding_locations, public.source_cleanup_queue TO service_role;

CREATE POLICY audit_jobs_read ON public.audit_workbench_jobs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND s.workspace_id = audit_workbench_jobs.workspace_id));
CREATE POLICY source_snapshots_read ON public.source_snapshots FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id));
CREATE POLICY snapshot_files_read ON public.snapshot_files FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.source_snapshots s WHERE s.id = snapshot_id));
CREATE POLICY finding_locations_read ON public.finding_locations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.source_snapshots s JOIN public.findings f ON f.scan_id = s.scan_id
 WHERE s.id = snapshot_id AND f.id = finding_id));

-- Metadata cascades cannot delete Storage objects. Keep a durable independent queue.
CREATE FUNCTION private.queue_source_cleanup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.object_path IS NOT NULL THEN
    INSERT INTO public.source_cleanup_queue(object_path) VALUES (OLD.object_path) ON CONFLICT DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.queue_source_cleanup() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER snapshot_file_cleanup BEFORE DELETE ON public.snapshot_files
FOR EACH ROW EXECUTE FUNCTION private.queue_source_cleanup();

-- A restrictive policy defeats any older broad permissive Storage policies for this bucket.
-- Source content is served by the authorized backend, never directly from a public URL.
DO $$ BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    VALUES ('audit-source','audit-source',false,2097152,ARRAY['text/plain'])
    ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 2097152,
      allowed_mime_types = ARRAY['text/plain'];
    EXECUTE 'CREATE POLICY audit_source_server_only ON storage.objects AS RESTRICTIVE FOR ALL
      TO anon, authenticated USING (bucket_id <> ''audit-source'') WITH CHECK (bucket_id <> ''audit-source'')';
  END IF;
END $$;
