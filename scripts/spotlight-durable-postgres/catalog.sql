-- Read-only postflight. No credentials or individual records returned.
SELECT json_build_object(
  'serverVersion', current_setting('server_version'),
  'tables', (SELECT json_agg(x ORDER BY x.name) FROM (
    SELECT c.relname AS name, c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls,
      pg_get_userbyid(c.relowner) AS owner
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('spotlight_questions','spotlight_answer_revisions') AND c.relkind='r'
  ) x),
  'columns', (SELECT json_agg(x ORDER BY x.table_name,x.ordinal_position) FROM (
    SELECT table_name,column_name,data_type,is_nullable,column_default,character_maximum_length,datetime_precision,ordinal_position
    FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('spotlight_questions','spotlight_answer_revisions')
  ) x),
  'constraints', (SELECT json_agg(x ORDER BY x.name) FROM (
    SELECT c.conname AS name,c.contype AS type,c.conrelid::regclass::text AS table_name,
      pg_get_constraintdef(c.oid) AS definition,c.confdeltype AS delete_action,c.confupdtype AS update_action
    FROM pg_constraint c WHERE c.conrelid IN (to_regclass('public.spotlight_questions'),to_regclass('public.spotlight_answer_revisions'))
  ) x),
  'indexes', (SELECT json_agg(x ORDER BY x.indexname) FROM (
    SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('spotlight_questions','spotlight_answer_revisions')
  ) x),
  'functions', (SELECT json_agg(x ORDER BY x.name) FROM (SELECT p.proname AS name,p.prosrc AS body,p.prosecdef AS security_definer,p.proconfig AS config,pg_get_function_result(p.oid) AS result FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('spotlight_history_no_mutation','spotlight_question_guard')) x),
  'triggers', (SELECT json_agg(x ORDER BY x.name) FROM (SELECT t.tgname AS name,t.tgrelid::regclass::text AS table_name,t.tgtype AS type,t.tgenabled AS enabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgrelid IN ('public.spotlight_questions'::regclass,'public.spotlight_answer_revisions'::regclass)) x),
  'policies', (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN ('spotlight_questions','spotlight_answer_revisions')),
  'questionCount', (SELECT count(*) FROM public.spotlight_questions),
  'answerCount', (SELECT count(*) FROM public.spotlight_answer_revisions)
);
