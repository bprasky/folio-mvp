---
name: interview_questions table exists in prod but intentionally undeclared in schema.prisma
description: Phase 5H1 decision to skip declaring the InterviewQuestion model despite the table existing; InterviewSession's inverse field was dropped. Future Prisma client access requires declaring the model first.
type: project
---

# interview_questions — undeclared by design (Phase 5H1)

## Decision

The `interview_questions` table exists in prod (Phase 5H1 surfaced it via `prisma db pull` as `model interview_questions`). It's an inverse-side join on `interview_sessions` — one InterviewSession has many InterviewQuestions.

During Phase 5H1 restoration, **we intentionally did NOT declare a Prisma model for `interview_questions`**, and we dropped the `interview_questions interview_questions[]` inverse field from the restored `InterviewSession` model.

**Why:** no app code in `src/` references `prisma.interviewQuestion.X` — it was not in Phase 5C's 41-model dangling-refs list. Restoring it would be scope creep beyond Bucket A's "unblock app code" mandate. The FK column on `interview_questions.interviewSessionId` still exists in the DB and the relation continues to work at the Postgres level; Prisma Client simply can't traverse it.

**How to apply:** if a future feature needs to query interview questions through Prisma (e.g., `prisma.interviewSession.findMany({ include: { questions: ... } })`), that feature must:
1. Add a `model InterviewQuestion` block to `schema.prisma` via `prisma db pull` into a scratch file + extraction (same pattern as Phase 5H1).
2. Add the inverse field `questions InterviewQuestion[]` back to `InterviewSession`.
3. Regenerate the Prisma Client.

Not an urgent item — only surface if a concrete query needs it.
