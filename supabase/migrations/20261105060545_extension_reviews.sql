BEGIN;
-- Extension metadata never changes existing scan types or framework semantics.
CREATE TABLE public.extension_reviews (
  scan_id uuid PRIMARY KEY REFERENCES public.scans(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  package_hash text NOT NULL,
  package_name text NOT NULL,
  package_version text NOT NULL,
  manifest_version integer NOT NULL,
  stores text[] NOT NULL CHECK (cardinality(stores) BETWEEN 1 AND 2 AND stores <@ ARRAY['chrome','edge']::text[]),
  policy_version text NOT NULL,
  coverage jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX extension_reviews_workspace_idx ON public.extension_reviews(workspace_id, created_at DESC, scan_id);
CREATE TABLE public.extension_declarations (
  scan_id uuid PRIMARY KEY REFERENCES public.extension_reviews(scan_id) ON DELETE CASCADE,
  content jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX extension_declarations_expiry_idx ON public.extension_declarations(expires_at);
CREATE TABLE public.extension_review_assets (
  id uuid PRIMARY KEY,
  scan_id uuid NOT NULL REFERENCES public.extension_reviews(scan_id) ON DELETE CASCADE,
  store text NOT NULL CHECK (store IN ('chrome','edge')),
  object_path text NOT NULL UNIQUE,
  media_type text NOT NULL CHECK (media_type = 'image/png'),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 786432),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 4096),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 4096),
  expires_at timestamptz NOT NULL
);
CREATE INDEX extension_assets_scan_idx ON public.extension_review_assets(scan_id, id);
CREATE INDEX extension_assets_expiry_idx ON public.extension_review_assets(expires_at);
CREATE TRIGGER extension_asset_cleanup BEFORE DELETE ON public.extension_review_assets
FOR EACH ROW EXECUTE FUNCTION private.queue_source_cleanup();
CREATE TABLE public.extension_policy_results (
  id uuid PRIMARY KEY,
  scan_id uuid NOT NULL REFERENCES public.extension_reviews(scan_id) ON DELETE CASCADE,
  store text NOT NULL CHECK (store IN ('chrome','edge')),
  rule_id text NOT NULL,
  category text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('passed','violation','needs_review','not_assessed','not_applicable')),
  priority smallint NOT NULL DEFAULT 2 CHECK (priority BETWEEN 0 AND 4),
  title text NOT NULL,
  details jsonb NOT NULL,
  finding_id uuid REFERENCES public.findings(id) ON DELETE SET NULL
);
CREATE INDEX extension_results_page_idx ON public.extension_policy_results(scan_id, store, outcome, id);
CREATE INDEX extension_results_priority_idx ON public.extension_policy_results(scan_id, priority, store, rule_id, id);
CREATE INDEX extension_results_finding_idx ON public.extension_policy_results(finding_id);
CREATE TABLE public.extension_review_annotations (
  result_id uuid PRIMARY KEY REFERENCES public.extension_policy_results(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL REFERENCES public.extension_reviews(scan_id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 2000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX extension_annotations_scan_idx ON public.extension_review_annotations(scan_id);
CREATE INDEX extension_annotations_actor_idx ON public.extension_review_annotations(actor_id);
ALTER TABLE public.advisor_conversations ADD COLUMN policy_result_id uuid REFERENCES public.extension_policy_results(id) ON DELETE CASCADE;
CREATE INDEX advisor_conversations_policy_idx ON public.advisor_conversations(policy_result_id);
ALTER TABLE public.advisor_conversations DROP CONSTRAINT advisor_conversations_check;
ALTER TABLE public.advisor_conversations ADD CONSTRAINT advisor_context_shape CHECK (
  (scan_id IS NULL AND finding_id IS NULL AND policy_result_id IS NULL)
  OR (scan_id IS NOT NULL AND num_nonnulls(finding_id, policy_result_id) = 1)
);
ALTER TABLE public.extension_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_policy_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_review_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_review_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.extension_review_assets FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,scan_id,store,media_type,byte_size,width,height,expires_at) ON public.extension_review_assets TO authenticated;
GRANT ALL ON public.extension_review_assets TO service_role;
REVOKE ALL ON public.extension_reviews, public.extension_declarations, public.extension_policy_results, public.extension_review_annotations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.extension_reviews, public.extension_declarations, public.extension_policy_results, public.extension_review_annotations TO authenticated;
GRANT ALL ON public.extension_reviews, public.extension_declarations, public.extension_policy_results, public.extension_review_annotations TO service_role;
CREATE POLICY extension_reviews_read ON public.extension_reviews FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND s.workspace_id = extension_reviews.workspace_id));
CREATE POLICY extension_declarations_read ON public.extension_declarations FOR SELECT TO authenticated
USING (expires_at > now() AND EXISTS (SELECT 1 FROM public.extension_reviews r WHERE r.scan_id = extension_declarations.scan_id)
  AND NOT EXISTS (SELECT 1 FROM public.source_snapshots s WHERE s.scan_id = extension_declarations.scan_id AND (s.state = 'expired' OR s.expires_at <= now())));
CREATE POLICY extension_results_read ON public.extension_policy_results FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.extension_reviews r WHERE r.scan_id = extension_policy_results.scan_id));
CREATE POLICY extension_annotations_read ON public.extension_review_annotations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.extension_policy_results r WHERE r.id = result_id AND r.scan_id = extension_review_annotations.scan_id));
CREATE POLICY extension_assets_read ON public.extension_review_assets FOR SELECT TO authenticated
USING (expires_at > now() AND EXISTS (SELECT 1 FROM public.extension_reviews r WHERE r.scan_id = extension_review_assets.scan_id)
  AND NOT EXISTS (SELECT 1 FROM public.source_snapshots s WHERE s.scan_id = extension_review_assets.scan_id AND (s.state = 'expired' OR s.expires_at <= now())));
-- All writes are server-only, after live role and relationship checks.
COMMIT;
