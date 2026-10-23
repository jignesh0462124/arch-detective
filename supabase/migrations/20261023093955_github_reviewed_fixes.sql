-- Additive GitHub integration. Credentials and patch bodies never enter the Data API.
CREATE TABLE public.repository_integrations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 repository_id bigint NOT NULL, installation_id bigint NOT NULL, full_name text NOT NULL, created_by uuid NOT NULL REFERENCES auth.users(id),
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id, repository_id)
);
CREATE TABLE public.repository_scan_refs (
 scan_id uuid PRIMARY KEY REFERENCES public.scans(id) ON DELETE CASCADE,
 integration_id uuid NOT NULL REFERENCES public.repository_integrations(id), workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 branch text NOT NULL, commit_sha text NOT NULL CHECK (commit_sha ~ '^[0-9a-f]{40}$'), analysis_config jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.fix_proposals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE, finding_id uuid NOT NULL REFERENCES public.findings(id) ON DELETE CASCADE,
 snapshot_id uuid REFERENCES public.source_snapshots(id) ON DELETE SET NULL,
 created_by uuid NOT NULL REFERENCES auth.users(id), revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
 status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','superseded','published')), metadata jsonb NOT NULL DEFAULT '{}', expires_at timestamptz NOT NULL,
 publish_lease uuid, publish_lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
-- Access through authenticated backend only. Encrypted records contain OAuth state,
-- access/refresh tokens, patch bodies and durable publication checkpoints.
CREATE TABLE public.github_private_records (
 id text PRIMARY KEY, owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
 proposal_id uuid REFERENCES public.fix_proposals(id) ON DELETE CASCADE,
 snapshot_id uuid REFERENCES public.source_snapshots(id) ON DELETE CASCADE,
 ciphertext text NOT NULL, expires_at timestamptz NOT NULL, refresh_lease uuid, refresh_lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
-- Relationships remain valid even if a privileged writer accidentally mixes scopes.
ALTER TABLE public.scans ADD CONSTRAINT github_scan_workspace_key UNIQUE(id, workspace_id);
ALTER TABLE public.findings ADD CONSTRAINT github_finding_scan_key UNIQUE(id, scan_id);
ALTER TABLE public.repository_integrations ADD CONSTRAINT github_integration_workspace_key UNIQUE(id, workspace_id);
ALTER TABLE public.repository_scan_refs ADD CONSTRAINT github_ref_scan_scope FOREIGN KEY(scan_id, workspace_id) REFERENCES public.scans(id, workspace_id) ON DELETE CASCADE;
ALTER TABLE public.repository_scan_refs ADD CONSTRAINT github_ref_integration_scope FOREIGN KEY(integration_id, workspace_id) REFERENCES public.repository_integrations(id, workspace_id);
ALTER TABLE public.fix_proposals ADD CONSTRAINT github_proposal_scan_scope FOREIGN KEY(scan_id, workspace_id) REFERENCES public.scans(id, workspace_id) ON DELETE CASCADE;
ALTER TABLE public.fix_proposals ADD CONSTRAINT github_proposal_finding_scope FOREIGN KEY(finding_id, scan_id) REFERENCES public.findings(id, scan_id) ON DELETE CASCADE;
CREATE TABLE public.github_webhook_deliveries (id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX repository_integrations_workspace_idx ON public.repository_integrations(workspace_id);
CREATE INDEX repository_integrations_creator_idx ON public.repository_integrations(created_by);
CREATE INDEX repository_scan_integration_idx ON public.repository_scan_refs(integration_id);
CREATE INDEX repository_scan_workspace_idx ON public.repository_scan_refs(workspace_id);
CREATE INDEX fix_proposals_workspace_created_idx ON public.fix_proposals(workspace_id, created_at DESC);
CREATE INDEX fix_proposals_scan_idx ON public.fix_proposals(scan_id);
CREATE INDEX fix_proposals_finding_idx ON public.fix_proposals(finding_id);
CREATE INDEX fix_proposals_snapshot_idx ON public.fix_proposals(snapshot_id);
CREATE INDEX fix_proposals_creator_idx ON public.fix_proposals(created_by);
CREATE INDEX github_private_owner_idx ON public.github_private_records(owner_id);
CREATE INDEX github_private_workspace_idx ON public.github_private_records(workspace_id);
CREATE INDEX github_private_proposal_idx ON public.github_private_records(proposal_id);
CREATE INDEX github_private_snapshot_idx ON public.github_private_records(snapshot_id);
CREATE INDEX github_private_expiry_idx ON public.github_private_records(expires_at);
ALTER TABLE public.repository_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repository_scan_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fix_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_private_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_webhook_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.repository_integrations, public.repository_scan_refs, public.fix_proposals, public.github_private_records, public.github_webhook_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.repository_integrations, public.repository_scan_refs, public.fix_proposals TO authenticated;
GRANT ALL ON public.repository_integrations, public.repository_scan_refs, public.fix_proposals, public.github_private_records, public.github_webhook_deliveries TO service_role;
CREATE POLICY repository_integrations_read ON public.repository_integrations FOR SELECT TO authenticated USING (public.workspace_user_role(workspace_id) IS NOT NULL);
CREATE POLICY repository_scan_refs_read ON public.repository_scan_refs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND s.workspace_id = repository_scan_refs.workspace_id));
CREATE POLICY fix_proposals_read ON public.fix_proposals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.scans s JOIN public.findings f ON f.scan_id=s.id WHERE s.id=fix_proposals.scan_id AND f.id=fix_proposals.finding_id AND s.workspace_id=fix_proposals.workspace_id));
