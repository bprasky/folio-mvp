# Approved Prisma alignment for private live/media storage

The user approved the exact schema proposal on 2026-10-01. Both model blocks
and the two User inverse fields are now applied to the branch's
`prisma/schema.prisma`; format, validate and client generation passed. The
reviewed patch and full User block remain under `docs/reviews/live-interviews/`
as the approval record. Do not reapply that historical patch.

The companion SQL migration is **still unapplied** to the shared database.
Read-only migration status identifies only
`20261001120000_live_interview_private_media` as pending. No production database,
bucket, flags or worker deployment were changed. Keeping Prisma aligned avoids
future migrations inferring unwanted table removal. The runtime uses
parameterized SQL for locking and does not require the new generated delegates.

Highest existing-model impact: add only these inverse fields to `User`:

```prisma
  liveInterviewSessions LiveInterviewSession[] @relation("LiveInterviewActor")
  interviewMediaRecords InterviewMediaRecord[] @relation("InterviewMediaActor")
```

Approved new models:

```prisma
model LiveInterviewSession {
  id             String   @id
  actorId        String
  sourceType     String
  sourceId       String
  canonicalId    String
  status         String
  credentialHash String   @unique
  expiresAt      DateTime @db.Timestamptz(6)
  providerIds    Json     @default("{}")
  payload        Json     @default("{}")
  version        Int      @default(1)
  createdAt      DateTime @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime @default(now()) @db.Timestamptz(6)
  actor          User     @relation("LiveInterviewActor", fields: [actorId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  mediaRecords   InterviewMediaRecord[]

  @@index([actorId, sourceType, sourceId, createdAt], map: "live_interview_actor_source")
  @@index([status, expiresAt], map: "live_interview_cleanup")
  @@map("live_interview_sessions")
}

model InterviewMediaRecord {
  id          String   @id
  actorId     String
  sessionId   String
  kind        String
  state       String
  payload     Json
  version     Int      @default(1)
  jobKey      String?  @unique
  leaseToken  String?
  leaseUntil  DateTime? @db.Timestamptz(6)
  attempts    Int      @default(0)
  availableAt DateTime @default(now()) @db.Timestamptz(6)
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  updatedAt   DateTime @default(now()) @db.Timestamptz(6)
  actor       User     @relation("InterviewMediaActor", fields: [actorId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  session     LiveInterviewSession @relation(fields: [sessionId], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@index([actorId, sessionId, kind, createdAt], map: "interview_media_actor")
  @@index([kind, state, availableAt, leaseUntil], map: "interview_media_claim")
  @@map("interview_media_records")
}
```

Partial unique indexes, check constraints, RLS and revoked client grants remain
in the hand-reviewed SQL because Prisma cannot fully express these constraints.
No backfill is needed; these are new private tables. Existing canonical answers
are untouched.

The schema was backed up before editing to
`%TEMP%/schema-prisma-backup-live-interviews-approved-20261001.prisma`.
`npm run verify:prisma` passed for 235 models and 103 enums; migration discipline
passed. The intentionally pending SQL migration is the expected state of this
schema-only approval, not a claim that production is migrated. `npm run db:check`
still points to the pre-existing missing `scripts/db-check.ts`.
SQL constraints were exercised in disposable PGlite; no production schema push,
deployment or migration resolve was run. Use safe migration commands only after
separate database-application approval. Unexpected validation/history failures
require restoring the backup and stopping.

Release follow-up, 2026-10-01: after the founder's separate SQL approval, the
exact reviewed migration was applied through the guarded `npm run migrate:deploy`
command. The earlier schema-only approval and pending status above describe
the implementation checkpoint, not the current production migration state.

Rollback disables creation/export flags and the worker while preserving private
tables, original chunks and accepted interview evidence. Do not drop user media
as a rollout rollback.
