-- PROPOSAL ONLY. Not installed in prisma/migrations and not approved for execution.
-- Two private durable interview tables. Existing spotlight IDs and user IDs are TEXT.
BEGIN;

CREATE TABLE IF NOT EXISTS public.spotlight_questions (
  id TEXT PRIMARY KEY,
  spotlight_id TEXT NOT NULL REFERENCES public.product_spotlights(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  kind VARCHAR(16) NOT NULL,
  question_version INTEGER NOT NULL,
  meaning_key VARCHAR(64) NOT NULL,
  context_snapshot JSONB NOT NULL,
  wording TEXT NOT NULL,
  prompt_version VARCHAR(80) NOT NULL,
  policy_version VARCHAR(80) NOT NULL,
  parent_answer_revision_id TEXT,
  retired_at TIMESTAMP(3),
  retired_reason VARCHAR(32),
  state_version INTEGER NOT NULL DEFAULT 0,
  current_answer_number INTEGER,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT spotlight_questions_kind_check CHECK (
    (kind = 'BASE' AND parent_answer_revision_id IS NULL) OR
    (kind = 'FOLLOW_UP' AND parent_answer_revision_id IS NOT NULL)
  ),
  CONSTRAINT spotlight_questions_version_check CHECK (
    question_version > 0 AND state_version >= 0 AND
    (current_answer_number IS NULL OR current_answer_number > 0)
  ),
  CONSTRAINT spotlight_questions_text_check CHECK (
    meaning_key ~ '^[0-9a-f]{64}$' AND btrim(wording) <> '' AND
    btrim(prompt_version) <> '' AND btrim(policy_version) <> ''
  ),
  CONSTRAINT spotlight_questions_snapshot_check CHECK (jsonb_typeof(context_snapshot) = 'object'),
  CONSTRAINT spotlight_questions_retirement_check CHECK (
    (retired_at IS NULL AND retired_reason IS NULL) OR
    (retired_at IS NOT NULL AND retired_reason IS NOT NULL AND retired_reason IN ('DESELECTED','NO_VALID_SOURCE','SCOPE_CHANGED','PARENT_REANSWERED','POLICY_CHANGED'))
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS spotlight_questions_id_version_key ON public.spotlight_questions(id, question_version);
CREATE UNIQUE INDEX IF NOT EXISTS spotlight_questions_version_key ON public.spotlight_questions(spotlight_id, kind, question_version);
CREATE UNIQUE INDEX IF NOT EXISTS spotlight_questions_meaning_key ON public.spotlight_questions(spotlight_id, kind, meaning_key);
CREATE UNIQUE INDEX IF NOT EXISTS spotlight_questions_active_kind_key ON public.spotlight_questions(spotlight_id, kind) WHERE retired_at IS NULL;
CREATE INDEX IF NOT EXISTS spotlight_questions_parent_idx ON public.spotlight_questions(parent_answer_revision_id);

CREATE TABLE IF NOT EXISTS public.spotlight_answer_revisions (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  question_version INTEGER NOT NULL,
  revision_number INTEGER NOT NULL,
  answering_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  accepted_text TEXT NOT NULL,
  acceptance_snapshot JSONB NOT NULL,
  input_modality VARCHAR(16) NOT NULL,
  acceptance_mode VARCHAR(24) NOT NULL,
  reused_from_revision_id TEXT REFERENCES public.spotlight_answer_revisions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  reuse_snapshot JSONB,
  request_key VARCHAR(128) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  accepted_state_version INTEGER NOT NULL,
  accepted_selection_version INTEGER NOT NULL,
  accepted_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT spotlight_answers_question_version_fk FOREIGN KEY (question_id, question_version)
    REFERENCES public.spotlight_questions(id, question_version) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT spotlight_answers_numbers_check CHECK (
    revision_number > 0 AND accepted_state_version > 0 AND accepted_selection_version > 0
  ),
  CONSTRAINT spotlight_answers_text_check CHECK (
    btrim(accepted_text) <> '' AND btrim(request_key) <> '' AND request_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT spotlight_answers_snapshot_check CHECK (jsonb_typeof(acceptance_snapshot) = 'object'),
  CONSTRAINT spotlight_answers_modality_check CHECK (input_modality IN ('TEXT','VOICE','MIXED')),
  CONSTRAINT spotlight_answers_reuse_check CHECK (
    (acceptance_mode = 'AUTHORED' AND reused_from_revision_id IS NULL AND reuse_snapshot IS NULL) OR
    (acceptance_mode = 'CONFIRMED_REUSE' AND reuse_snapshot IS NOT NULL AND jsonb_typeof(reuse_snapshot) = 'object')
  ),
  CONSTRAINT spotlight_answers_no_self_reuse CHECK (reused_from_revision_id IS NULL OR reused_from_revision_id <> id)
);
CREATE UNIQUE INDEX IF NOT EXISTS spotlight_answers_number_key ON public.spotlight_answer_revisions(question_id, revision_number);
CREATE UNIQUE INDEX IF NOT EXISTS spotlight_answers_request_key ON public.spotlight_answer_revisions(question_id, answering_user_id, request_key);
CREATE INDEX IF NOT EXISTS spotlight_answers_actor_idx ON public.spotlight_answer_revisions(answering_user_id);
CREATE INDEX IF NOT EXISTS spotlight_answers_reuse_idx ON public.spotlight_answer_revisions(reused_from_revision_id);

-- Cyclic references added after both tables and referenced unique indexes exist.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.spotlight_questions'::regclass AND conname = 'spotlight_questions_current_answer_fk') THEN
    ALTER TABLE public.spotlight_questions ADD CONSTRAINT spotlight_questions_current_answer_fk
      FOREIGN KEY (id, current_answer_number) REFERENCES public.spotlight_answer_revisions(question_id, revision_number)
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.spotlight_questions'::regclass AND conname = 'spotlight_questions_parent_answer_revision_id_fkey') THEN
    ALTER TABLE public.spotlight_questions ADD CONSTRAINT spotlight_questions_parent_answer_revision_id_fkey
      FOREIGN KEY (parent_answer_revision_id) REFERENCES public.spotlight_answer_revisions(id)
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.spotlight_history_no_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Durable spotlight history cannot be updated, deleted or truncated' USING ERRCODE = '23514';
END;
$$;

CREATE OR REPLACE FUNCTION public.spotlight_question_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.state_version <> 0 OR NEW.current_answer_number IS NOT NULL THEN
      RAISE EXCEPTION 'New question must start without an answer at state version zero' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF (to_jsonb(NEW) - ARRAY['retired_at','retired_reason','state_version','current_answer_number'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['retired_at','retired_reason','state_version','current_answer_number']) THEN
      RAISE EXCEPTION 'Question definition is immutable; reconcile a new meaning explicitly' USING ERRCODE = '23514';
    END IF;
    IF NEW.state_version <> OLD.state_version + 1 THEN
      RAISE EXCEPTION 'Question state version must advance exactly once' USING ERRCODE = '23514';
    END IF;
    IF NEW.current_answer_number IS DISTINCT FROM OLD.current_answer_number AND
       (NEW.current_answer_number IS NULL OR NEW.current_answer_number <> coalesce(OLD.current_answer_number, 0) + 1) THEN
      RAISE EXCEPTION 'Current answer must advance to the next revision' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Definition replacement is atomic within this transaction; no trigger-free committed state.
DROP TRIGGER IF EXISTS spotlight_questions_guard ON public.spotlight_questions;
CREATE TRIGGER spotlight_questions_guard BEFORE INSERT OR UPDATE ON public.spotlight_questions
  FOR EACH ROW EXECUTE FUNCTION public.spotlight_question_guard();
DROP TRIGGER IF EXISTS spotlight_questions_no_delete ON public.spotlight_questions;
CREATE TRIGGER spotlight_questions_no_delete BEFORE DELETE ON public.spotlight_questions
  FOR EACH ROW EXECUTE FUNCTION public.spotlight_history_no_mutation();
DROP TRIGGER IF EXISTS spotlight_questions_no_truncate ON public.spotlight_questions;
CREATE TRIGGER spotlight_questions_no_truncate BEFORE TRUNCATE ON public.spotlight_questions
  FOR EACH STATEMENT EXECUTE FUNCTION public.spotlight_history_no_mutation();
DROP TRIGGER IF EXISTS spotlight_answers_no_mutation ON public.spotlight_answer_revisions;
CREATE TRIGGER spotlight_answers_no_mutation BEFORE UPDATE OR DELETE ON public.spotlight_answer_revisions
  FOR EACH ROW EXECUTE FUNCTION public.spotlight_history_no_mutation();
DROP TRIGGER IF EXISTS spotlight_answers_no_truncate ON public.spotlight_answer_revisions;
CREATE TRIGGER spotlight_answers_no_truncate BEFORE TRUNCATE ON public.spotlight_answer_revisions
  FOR EACH STATEMENT EXECUTE FUNCTION public.spotlight_history_no_mutation();

ALTER TABLE public.spotlight_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spotlight_answer_revisions ENABLE ROW LEVEL SECURITY;
-- No policies and no grants, including no service_role grants.
COMMIT;
