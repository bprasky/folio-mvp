-- Read-only postflight. No credentials or individual records returned.
SELECT json_build_object(
  'serverVersion', current_setting('server_version'),
  'tables', (SELECT json_agg(x ORDER BY x.name) FROM (
    SELECT c.relname AS name, c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls,
      pg_get_userbyid(c.relowner) AS owner
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('product_spotlights','product_spotlight_tags') AND c.relkind='r'
  ) x),
  'columns', (SELECT json_agg(x ORDER BY x.table_name,x.ordinal_position) FROM (
    SELECT table_name,column_name,data_type,is_nullable,column_default,character_maximum_length,datetime_precision,ordinal_position
    FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('product_spotlights','product_spotlight_tags')
  ) x),
  'constraints', (SELECT json_agg(x ORDER BY x.name) FROM (
    SELECT c.conname AS name,c.contype AS type,c.conrelid::regclass::text AS table_name,
      pg_get_constraintdef(c.oid) AS definition,c.confdeltype AS delete_action,c.confupdtype AS update_action
    FROM pg_constraint c WHERE c.conrelid IN (to_regclass('public.product_spotlights'),to_regclass('public.product_spotlight_tags'))
  ) x),
  'indexes', (SELECT json_agg(x ORDER BY x.indexname) FROM (
    SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('product_spotlights','product_spotlight_tags')
  ) x),
  'policies', (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN ('product_spotlights','product_spotlight_tags')),
  'spotlightCount', (SELECT count(*) FROM public.product_spotlights),
  'sourceCount', (SELECT count(*) FROM public.product_spotlight_tags)
);
