-- Metadata only. No source archives, findings content or account details.
SELECT jsonb_build_object(
  'tables', (SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT c.relname, c.relkind, c.relrowsecurity, c.reloptions
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','v') ORDER BY c.relname
  ) t),
  'columns', (SELECT jsonb_agg(to_jsonb(c)) FROM (
    SELECT table_name, column_name, udt_name, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position
  ) c),
  'policies', (SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname IN ('public','storage')),
  'grants', (SELECT jsonb_agg(to_jsonb(g)) FROM information_schema.role_table_grants g
    WHERE table_schema='public' AND grantee IN ('anon','authenticated','service_role','PUBLIC','threatlens_backend')),
  'column_grants', (SELECT jsonb_agg(to_jsonb(g)) FROM information_schema.role_column_grants g
    WHERE table_schema='public' AND grantee IN ('anon','authenticated','PUBLIC')),
  'functions', (SELECT jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', p.proname,
    'args', pg_get_function_identity_arguments(p.oid), 'definition', pg_get_functiondef(p.oid)))
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','private') AND p.proname IN ('is_workspace_member','workspace_user_role','has_workspace_role','handle_workspace_created','handle_new_user','set_updated_at','workspace_role','shares_workspace')),
  'triggers', (SELECT jsonb_agg(jsonb_build_object('table', c.relname, 'definition', pg_get_triggerdef(t.oid)))
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE NOT t.tgisinternal AND (n.nspname='public' OR (n.nspname='auth' AND c.relname='users'))),
  'views', (SELECT jsonb_agg(to_jsonb(v)) FROM pg_views v WHERE schemaname='public'),
  'enums', (SELECT jsonb_agg(to_jsonb(e)) FROM (
    SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels FROM pg_type t
    JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' GROUP BY t.typname ORDER BY t.typname
  ) e)
) AS schema_snapshot;
