-- ====================================================
-- ARCH-DETECTIVE / THREATLENS - FAST WORKSPACES VIEW
-- Migration: 20261007000002_fast_workspace_counts_view
-- Applied: 2026-10-07
-- ====================================================
-- Replaces N+1 sequential count queries with a single-query PostgreSQL view.
-- Enables ultra-fast initial data fetch on login.

CREATE OR REPLACE VIEW public.workspaces_with_counts
WITH (security_invoker = true) AS
SELECT
  w.id,
  w.name,
  w.slug,
  w.owner_user_id,
  w.settings,
  w.created_at,
  w.updated_at,
  COALESCE(wm.member_count, 1)::int AS member_count,
  COALESCE(s.scan_count, 0)::int AS scan_count
FROM public.workspaces w
LEFT JOIN (
  SELECT workspace_id, count(*)::int AS member_count
  FROM public.workspace_members
  GROUP BY workspace_id
) wm ON wm.workspace_id = w.id
LEFT JOIN (
  SELECT workspace_id, count(*)::int AS scan_count
  FROM public.scans
  GROUP BY workspace_id
) s ON s.workspace_id = w.id;

GRANT SELECT ON public.workspaces_with_counts TO authenticated, anon;
