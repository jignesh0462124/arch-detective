BEGIN;
CREATE TABLE public.advisor_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  scan_id uuid REFERENCES public.scans(id) ON DELETE CASCADE,
  finding_id uuid REFERENCES public.findings(id) ON DELETE CASCADE,
  snapshot_id uuid REFERENCES public.source_snapshots(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  CHECK ((scan_id IS NULL) = (finding_id IS NULL)),
  CHECK (expires_at <= created_at + interval '30 days')
);
CREATE INDEX advisor_conversations_history_idx ON public.advisor_conversations(owner_user_id, workspace_id, updated_at DESC, id DESC);
CREATE INDEX advisor_conversations_scan_idx ON public.advisor_conversations(scan_id);
CREATE INDEX advisor_conversations_finding_idx ON public.advisor_conversations(finding_id);
CREATE INDEX advisor_conversations_snapshot_idx ON public.advisor_conversations(snapshot_id);
CREATE INDEX advisor_conversations_workspace_idx ON public.advisor_conversations(workspace_id);
CREATE INDEX advisor_conversations_expiry_idx ON public.advisor_conversations(expires_at);
CREATE TABLE public.advisor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.advisor_conversations(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL DEFAULT '' CHECK (char_length(content) <= 32768),
  model_id text,
  status text NOT NULL CHECK (status IN ('streaming','completed','interrupted','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, submission_id, role)
);
CREATE INDEX advisor_messages_page_idx ON public.advisor_messages(conversation_id, created_at DESC, id DESC);
ALTER TABLE public.advisor_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.advisor_conversations, public.advisor_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.advisor_conversations, public.advisor_messages TO authenticated;
GRANT ALL ON public.advisor_conversations, public.advisor_messages TO service_role;
CREATE POLICY advisor_private_history ON public.advisor_conversations FOR SELECT TO authenticated
USING (owner_user_id = (SELECT auth.uid()) AND expires_at > now() AND private.workspace_role(workspace_id) IS NOT NULL);
CREATE POLICY advisor_private_messages ON public.advisor_messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.advisor_conversations c
  WHERE c.id = conversation_id
    AND c.owner_user_id = (SELECT auth.uid())
    AND c.expires_at > now()
    AND private.workspace_role(c.workspace_id) IS NOT NULL
));
CREATE FUNCTION private.expire_advisor_source_history() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.state IN ('expired','failed') THEN
    DELETE FROM public.advisor_conversations WHERE snapshot_id = NEW.id;
  ELSE
    UPDATE public.advisor_conversations SET expires_at = least(expires_at, NEW.expires_at) WHERE snapshot_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.expire_advisor_source_history() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER expire_advisor_source_history AFTER UPDATE OF state, expires_at ON public.source_snapshots
FOR EACH ROW EXECUTE FUNCTION private.expire_advisor_source_history();
COMMIT;
