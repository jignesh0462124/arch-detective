-- ====================================================
-- ARCH-DETECTIVE / THREATLENS - WORKSPACE SETTINGS AND INVITES
-- Migration: 20261007000001_workspace_settings_and_invites
-- Applied: 2026-10-07
-- ====================================================

-- 1. Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE p.id = u.id AND p.email IS NULL;

-- 2. Update handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_app_meta_data->>'display_name', NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(profiles.display_name, EXCLUDED.display_name);
  RETURN NEW;
END; $$;

-- 3. Add settings jsonb column to workspaces
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{"default_frameworks": ["SOC 2", "ISO 27001", "GDPR"], "retention_days": 90}'::jsonb;

-- 4. Update workspace_invites policies for authenticated and demo sessions
ALTER POLICY "ws_invites_select_admin" ON public.workspace_invites TO authenticated, anon USING (
  ((SELECT auth.uid()) IS NOT NULL AND public.workspace_user_role(workspace_id) IN ('owner', 'admin'))
  OR ((SELECT auth.uid()) IS NULL AND EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid
  ))
);

ALTER POLICY "ws_invites_insert_admin" ON public.workspace_invites TO authenticated, anon WITH CHECK (
  ((SELECT auth.uid()) IS NOT NULL AND public.workspace_user_role(workspace_id) IN ('owner', 'admin'))
  OR ((SELECT auth.uid()) IS NULL AND EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid
  ))
);

ALTER POLICY "ws_invites_delete_admin" ON public.workspace_invites TO authenticated, anon USING (
  ((SELECT auth.uid()) IS NOT NULL AND public.workspace_user_role(workspace_id) IN ('owner', 'admin'))
  OR ((SELECT auth.uid()) IS NULL AND EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_user_id = 'd5e264d7-48cb-457d-b136-a24688f5b633'::uuid
  ))
);
