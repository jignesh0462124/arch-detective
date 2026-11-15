BEGIN;
-- The ORM already models this field; older hosted schemas did not create it.
-- Existing scan rows receive an empty object and keep their original behaviour.
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS source_config jsonb NOT NULL DEFAULT '{}'::jsonb;
-- The existing column-scoped authenticated write grants remain unchanged.
NOTIFY pgrst, 'reload schema';
COMMIT;
